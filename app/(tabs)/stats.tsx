import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppColors } from '../../src/constants/AppColors';
import {
  getLiquidGlassTabBarContentPaddingBottom,
  getLiquidGlassTabBarOverlapHeight,
} from '../../src/constants/LiquidGlassTabBarLayout';
import AppThemeBackground from '../../src/components/AppThemeBackground';
import { AssistantToolsService } from '../../src/services/AssistantToolsService';
import { ClaudeApiService } from '../../src/services/ClaudeApiService';
import { GenerationQueueService } from '../../src/services/GenerationQueueService';
import { PromptGenerator, type AppGenerationRequest } from '../../src/services/PromptGenerator';
import { SecureStorageService } from '../../src/services/SecureStorageService';
import {
  CLAUDE_MODEL_PICKER_OPTIONS,
  MODEL_INFO,
  clampMaxOutputTokens,
  clampTemperature,
  estimateCost,
  estimateTokensFromText,
  formatModelPricingShort,
  resolveSupportedClaudeModel,
} from '../../src/types/ClaudeApi';
import { useUISettingsStore } from '../../src/stores/UISettingsStore';
import { useStrings } from '../../src/i18n/strings';
import { createLogger } from '../../src/utils/Logger';

const log = createLogger('Assistant');
const ASSISTANT_MODEL_STORAGE_KEY = 'assistant_model_v1';

type ChatRole = 'assistant' | 'user';
type WriteToolName = 'create_app' | 'update_app' | 'fix_app';

interface ChatBubbleMessage {
  id: string;
  role: ChatRole;
  text: string;
  at: number;
}

interface AssistantToolCall {
  id?: string;
  name: string;
  arguments?: Record<string, unknown>;
}

interface AssistantModelResponse {
  assistantMessage: string;
  toolCalls: AssistantToolCall[];
}

type PendingAction =
  | {
      id: string;
      kind: 'create_app';
      description: string;
      style: AppGenerationRequest['style'];
      styleTags: string[];
      model: string;
      maxTokens: number;
      temperature: number;
      estimatedInputTokens: number;
      estimatedMaxCostUsd: number;
    }
  | {
      id: string;
      kind: 'update_app' | 'fix_app';
      appId: string;
      appTitle: string;
      updatedPrompt: string;
      notes: string;
    };

const ASSISTANT_PROTOCOL_PROMPT = `
You are Droplets Assistant. You must ALWAYS respond with strict JSON and no extra text.

Return exactly this shape:
{
  "assistantMessage": "string",
  "toolCalls": [
    {
      "name": "scan_apps | get_usage_summary | get_aggregate_stats | create_app | update_app | fix_app",
      "arguments": { }
    }
  ]
}

Rules:
- assistantMessage is required, concise, and friendly.
- toolCalls can be [] if no tool is needed.
- Use tools when the user requests app/library-specific info.
- Read tools:
  1) scan_apps arguments: { "limit": number, "sortBy": "recent"|"most_used"|"favorites" }
  2) get_usage_summary arguments: { "limit": number }
  3) get_aggregate_stats arguments: { "limit": number }
- Write/intention tools (require confirmation by user in app UI):
  4) create_app arguments: { "description": string, "style": "modern|minimalist|playful|creative|corporate|elegant", "styleTags": string[] }
  5) update_app arguments: { "appId": string, "updatedPrompt": string, "notes": string }
  6) fix_app arguments: { "appId": string, "notes": string, "updatedPrompt": string }

Important:
- Never assume write actions are executed until tool results explicitly confirm success.
- If appId is unknown, call scan_apps first.
- If user asks for random idea, you can either answer directly or propose create_app.
- Keep assistantMessage under 120 words.
`.trim();

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeJsonResponse(raw: string): string {
  let content = (raw || '').trim();
  if (content.startsWith('```')) {
    content = content.replace(/^```[a-zA-Z0-9_-]*\s*\n/, '').trim();
    content = content.replace(/```[\s]*$/, '').trim();
  }
  const firstBrace = content.indexOf('{');
  const lastBrace = content.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    content = content.slice(firstBrace, lastBrace + 1).trim();
  }
  return content;
}

function parseAssistantResponse(
  raw: string,
  fallbackDoneMessage: string,
  fallbackParseErrorMessage: string
): AssistantModelResponse {
  try {
    const parsed = JSON.parse(normalizeJsonResponse(raw)) as Partial<AssistantModelResponse>;
    const assistantMessage = typeof parsed.assistantMessage === 'string' ? parsed.assistantMessage.trim() : '';
    const toolCalls: AssistantToolCall[] = Array.isArray(parsed.toolCalls)
      ? parsed.toolCalls
          .map((entry) => (entry && typeof entry === 'object' ? (entry as AssistantToolCall) : null))
          .filter((entry): entry is AssistantToolCall => Boolean(entry))
      : [];
    return {
      assistantMessage: assistantMessage || fallbackDoneMessage,
      toolCalls,
    };
  } catch {
    return {
      assistantMessage: raw.trim() || fallbackParseErrorMessage,
      toolCalls: [],
    };
  }
}

function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return '$-';
  if (value <= 0) return '$0.00';
  if (value < 0.01) return `$${value.toFixed(4)}`;
  if (value < 1) return `$${value.toFixed(3)}`;
  return `$${value.toFixed(2)}`;
}

function getCheapestAssistantModel(): string {
  const options = CLAUDE_MODEL_PICKER_OPTIONS.filter((modelId) => MODEL_INFO[modelId]?.status !== 'retired');
  if (options.length === 0) return resolveSupportedClaudeModel(undefined);

  return options.reduce((best, current) => {
    const bestInfo = MODEL_INFO[best];
    const currentInfo = MODEL_INFO[current];
    const bestCost = bestInfo.tokenPricesPerMTok.baseInput + bestInfo.tokenPricesPerMTok.output;
    const currentCost = currentInfo.tokenPricesPerMTok.baseInput + currentInfo.tokenPricesPerMTok.output;
    return currentCost < bestCost ? current : best;
  });
}

function getModelLabel(model: string): string {
  const modelName = MODEL_INFO[model]?.name || model;
  return modelName.replace(/^Claude\s+/i, '');
}

export default function AssistantPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const appTheme = useUISettingsStore((s) => s.appTheme);
  const debugAllowWithoutApiKey = useUISettingsStore((s) => s.debugAllowWithoutApiKey);
  const isUniverseTheme = appTheme === 'universe';
  const { t } = useStrings();
  const initialAssistantMessage = t('assistant.message.initial');

  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [assistantModel, setAssistantModel] = useState<string>(getCheapestAssistantModel());
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [messages, setMessages] = useState<ChatBubbleMessage[]>([
    {
      id: makeId('assistant'),
      role: 'assistant',
      text: initialAssistantMessage,
      at: Date.now(),
    },
  ]);
  const [modelConversation, setModelConversation] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>(
    []
  );
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const hasApiAccess = hasApiKey || debugAllowWithoutApiKey;

  const scrollContentPaddingBottom = getLiquidGlassTabBarContentPaddingBottom(insets.bottom, 32);
  const tabBarOverlapHeight = getLiquidGlassTabBarOverlapHeight(insets.bottom);
  const composerBottomOffset = keyboardVisible ? 8 : tabBarOverlapHeight + 12;
  const assistantModelLabel = useMemo(() => getModelLabel(assistantModel), [assistantModel]);
  const cheapestModel = useMemo(() => getCheapestAssistantModel(), []);
  const availableAssistantModels = useMemo(
    () => CLAUDE_MODEL_PICKER_OPTIONS.filter((modelId) => MODEL_INFO[modelId]?.status !== 'retired'),
    []
  );
  const quickQuestions = useMemo(
    () => [
      t('assistant.quick.random'),
      t('assistant.quick.mostUsed'),
      t('assistant.quick.usageSummary'),
      t('assistant.quick.overview'),
      t('assistant.quick.fix'),
    ],
    [t]
  );

  React.useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && prev[0]?.role === 'assistant') {
        return [{ ...prev[0], text: initialAssistantMessage }];
      }
      return prev;
    });
  }, [initialAssistantMessage]);

  React.useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const persistAssistantModel = async (model: string) => {
    const resolved = resolveSupportedClaudeModel(model);
    setAssistantModel(resolved);
    try {
      await AsyncStorage.setItem(ASSISTANT_MODEL_STORAGE_KEY, resolved);
    } catch (error) {
      log.warn('Failed to persist assistant model:', error);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      let active = true;
      void Promise.all([
        SecureStorageService.hasApiKey(),
        SecureStorageService.getConfig(),
        AsyncStorage.getItem(ASSISTANT_MODEL_STORAGE_KEY),
      ])
        .then(([hasKey, config, savedAssistantModel]) => {
          if (!active) return;
          setHasApiKey(hasKey);

          const fromSettingsModel = resolveSupportedClaudeModel(config?.model);
          const fromSavedModel = savedAssistantModel
            ? resolveSupportedClaudeModel(savedAssistantModel)
            : null;
          const nextModel = fromSavedModel || fromSettingsModel || cheapestModel;
          setAssistantModel(nextModel);
        })
        .catch((error) => {
          log.warn('Failed to check API key status:', error);
          if (!active) return;
          setHasApiKey(false);
          setAssistantModel(cheapestModel);
        });

      return () => {
        active = false;
      };
    }, [cheapestModel])
  );

  React.useEffect(() => {
    const timer = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 80);
    return () => clearTimeout(timer);
  }, [messages, pendingAction, isSending]);

  React.useEffect(() => {
    if (!hasApiAccess && showModelPicker) {
      setShowModelPicker(false);
    }
  }, [hasApiAccess, showModelPicker]);

  const addBubble = (role: ChatRole, text: string) => {
    const content = text.trim();
    if (!content) return;
    setMessages((prev) => [...prev, { id: makeId(role), role, text: content, at: Date.now() }]);
  };

  const promptApiSetup = (featureLabel: string) => {
    Alert.alert(
      t('assistant.apiSetup.requiredTitle', { feature: featureLabel }),
      t('assistant.apiSetup.requiredBody'),
      [
        { text: t('common.actions.openSetup'), onPress: () => router.push('/welcome') },
        { text: t('common.actions.cancel'), style: 'cancel' },
      ]
    );
  };

  const resolveAppFromArgs = async (args: Record<string, unknown> | undefined) => {
    const appId = String(args?.appId || '').trim();
    const appQuery = String(args?.appQuery || args?.appTitle || '').trim().toLowerCase();
    const apps = await AssistantToolsService.scanApps({ limit: 200, sortBy: 'recent' });
    if (appId) {
      const direct = apps.find((app) => app.id === appId);
      if (direct) return direct;
    }
    if (appQuery) {
      const byTitle = apps.find((app) => app.title.toLowerCase() === appQuery);
      if (byTitle) return byTitle;
      const partial = apps.find((app) => app.title.toLowerCase().includes(appQuery));
      if (partial) return partial;
    }
    return null;
  };

  const buildPendingWriteAction = async (call: AssistantToolCall): Promise<PendingAction | null> => {
    const name = call.name as WriteToolName;

    if (name === 'create_app') {
      const { description, style, styleTags } = AssistantToolsService.normalizeCreateArgs(call.arguments);
      if (!description) return null;

      const defaults = await SecureStorageService.getConfig();
      const model = defaults.model;
      const maxTokens = clampMaxOutputTokens(model, defaults.maxTokens);
      const temperature = clampTemperature(defaults.temperature);

      const request: AppGenerationRequest = {
        description,
        style,
        styleTags,
        platform: 'mobile',
      };
      const generatedPrompt = PromptGenerator.generatePrompt(request, { maxOutputTokens: maxTokens });
      const estimatedInputTokens = estimateTokensFromText(generatedPrompt);
      const estimatedMaxCostUsd = estimateCost(estimatedInputTokens, maxTokens, model);

      return {
        id: makeId('pending_create'),
        kind: 'create_app',
        description,
        style,
        styleTags,
        model,
        maxTokens,
        temperature,
        estimatedInputTokens,
        estimatedMaxCostUsd,
      };
    }

    if (name === 'update_app' || name === 'fix_app') {
      const resolvedApp = await resolveAppFromArgs(call.arguments);
      if (!resolvedApp) return null;

      const updatedPrompt = String(call.arguments?.updatedPrompt || '').trim();
      const notes = String(call.arguments?.notes || '').trim();

      return {
        id: makeId('pending_edit'),
        kind: name,
        appId: resolvedApp.id,
        appTitle: resolvedApp.title,
        updatedPrompt,
        notes,
      };
    }

    return null;
  };

  const runReadTool = async (call: AssistantToolCall): Promise<Record<string, unknown>> => {
    const args = call.arguments || {};
    const name = call.name;

    if (name === 'scan_apps') {
      const limit = Number(args.limit || 20);
      const sortByRaw = String(args.sortBy || 'recent').trim().toLowerCase();
      const sortBy = sortByRaw === 'most_used' || sortByRaw === 'favorites' ? sortByRaw : 'recent';
      const apps = await AssistantToolsService.scanApps({ limit, sortBy: sortBy as any });
      return { tool: name, ok: true, result: { apps } };
    }

    if (name === 'get_usage_summary') {
      const limit = Number(args.limit || 20);
      const summary = await AssistantToolsService.getUsageSummaryByApp({ limit });
      return { tool: name, ok: true, result: summary };
    }

    if (name === 'get_aggregate_stats') {
      const limit = Number(args.limit || 10);
      const stats = await AssistantToolsService.getAggregateStats({ limit });
      return { tool: name, ok: true, result: stats };
    }

    return {
      tool: name,
      ok: false,
      error: `Unknown read tool: ${name}`,
    };
  };

  const executeAssistantTurn = async (userText: string) => {
    const claudeService = ClaudeApiService.getInstance();
    await claudeService.initialize();

    let workingConversation: Array<{ role: 'user' | 'assistant'; content: string }> = [
      ...modelConversation,
      { role: 'user', content: userText },
    ];

    let finalAssistantMessage = '';
    let writeAction: PendingAction | null = null;

    for (let step = 0; step < 3; step += 1) {
      const apiMessages = [
        { role: 'user' as const, content: ASSISTANT_PROTOCOL_PROMPT },
        { role: 'assistant' as const, content: 'Understood. I will return strict JSON only.' },
        ...workingConversation,
      ];

      const raw = await claudeService.generateAssistantResponse({
        messages: apiMessages,
        model: assistantModel,
        maxTokens: 1400,
        temperature: 0.2,
        operation: 'assistant_chat',
      });

      const parsed = parseAssistantResponse(
        raw,
        t('assistant.model.done'),
        t('assistant.message.errorGeneric')
      );
      finalAssistantMessage = parsed.assistantMessage || finalAssistantMessage;
      const toolCalls = parsed.toolCalls || [];

      if (toolCalls.length === 0) {
        const assistantContent = finalAssistantMessage || t('assistant.model.done');
        workingConversation = [...workingConversation, { role: 'assistant', content: assistantContent }];
        return { assistantMessage: assistantContent, pendingAction: null, nextConversation: workingConversation };
      }

      const readCalls = toolCalls.filter(
        (call) => call.name === 'scan_apps' || call.name === 'get_usage_summary' || call.name === 'get_aggregate_stats'
      );
      const writeCalls = toolCalls.filter(
        (call) => call.name === 'create_app' || call.name === 'update_app' || call.name === 'fix_app'
      );

      if (finalAssistantMessage) {
        workingConversation = [...workingConversation, { role: 'assistant', content: finalAssistantMessage }];
      }

      if (writeCalls.length > 0) {
        const pending = await buildPendingWriteAction(writeCalls[0]);
        if (pending) {
          writeAction = pending;
          return {
            assistantMessage: finalAssistantMessage || t('assistant.pending.required'),
            pendingAction: writeAction,
            nextConversation: workingConversation,
          };
        }
      }

      if (readCalls.length > 0) {
        const results: Array<Record<string, unknown>> = [];
        for (const call of readCalls) {
          try {
            const output = await runReadTool(call);
            results.push(output);
          } catch (error: any) {
            results.push({ tool: call.name, ok: false, error: error?.message || 'Tool failed' });
          }
        }

        workingConversation = [
          ...workingConversation,
          {
            role: 'user',
            content: `TOOL_RESULTS_JSON: ${JSON.stringify(results)}`,
          },
        ];
        continue;
      }

      return {
        assistantMessage: finalAssistantMessage || t('assistant.message.errorGeneric'),
        pendingAction: null,
        nextConversation: workingConversation,
      };
    }

    return {
      assistantMessage: finalAssistantMessage || t('assistant.message.errorGeneric'),
      pendingAction: writeAction,
      nextConversation: workingConversation,
    };
  };

  const sendMessage = async (rawText?: string) => {
    const text = (typeof rawText === 'string' ? rawText : inputValue).trim();
    if (!text || isSending) return;

    if (!hasApiAccess) {
      promptApiSetup(t('assistant.feature.assistant'));
      return;
    }

    if (!hasApiKey && debugAllowWithoutApiKey) {
      setInputValue('');
      setPendingAction(null);
      addBubble('user', text);
      addBubble(
        'assistant',
        t('assistant.message.debugNoApi')
      );
      return;
    }

    setInputValue('');
    setPendingAction(null);
    addBubble('user', text);
    setIsSending(true);

    try {
      const response = await executeAssistantTurn(text);
      addBubble('assistant', response.assistantMessage);
      setPendingAction(response.pendingAction);
      setModelConversation(response.nextConversation);
    } catch (error: any) {
      log.error('Assistant turn failed:', error);
      addBubble('assistant', error?.message || t('assistant.message.errorGeneric'));
    } finally {
      setIsSending(false);
    }
  };

  const confirmPendingAction = async () => {
    if (!pendingAction || isSending) return;
    setIsSending(true);

    try {
      if (pendingAction.kind === 'create_app') {
        const request: AppGenerationRequest = {
          description: pendingAction.description,
          style: pendingAction.style,
          styleTags: pendingAction.styleTags,
          platform: 'mobile',
        };

        const validation = PromptGenerator.validateRequest(request);
        if (!validation.isValid) {
          addBubble('assistant', t('assistant.message.validationFailed', { errors: validation.errors.join('; ') }));
          setPendingAction(null);
          return;
        }

        const featureCheck = PromptGenerator.checkForUnavailableFeatures(request.description);
        if (!featureCheck.isValid) {
          addBubble(
            'assistant',
            t('assistant.message.unavailableFeatures', {
              reason: featureCheck.reason || '',
              suggestion: featureCheck.suggestion || '',
            })
          );
          setPendingAction(null);
          return;
        }

        const job = await GenerationQueueService.enqueue(request, {
          model: pendingAction.model,
          maxTokens: pendingAction.maxTokens,
          temperature: pendingAction.temperature,
        });

        addBubble(
          'assistant',
          t('assistant.message.createdQueued', {
            jobId: job.id,
            cost: formatUsd(pendingAction.estimatedMaxCostUsd),
          })
        );
        setPendingAction(null);
        return;
      }

      if (pendingAction.kind === 'update_app' || pendingAction.kind === 'fix_app') {
        router.push({
          pathname: '/app-recreate',
          params: {
            appId: pendingAction.appId,
            mode: pendingAction.kind === 'fix_app' ? 'fix' : 'recreate',
            prefillPrompt: pendingAction.updatedPrompt,
            prefillFixNotes: pendingAction.notes,
          },
        } as any);
        addBubble(
          'assistant',
          t('assistant.message.openedFlow', {
            mode:
              pendingAction.kind === 'fix_app'
                ? t('assistant.flow.fixMode')
                : t('assistant.flow.updateMode'),
            title: pendingAction.appTitle,
          })
        );
        setPendingAction(null);
      }
    } catch (error: any) {
      log.error('Failed to run pending action:', error);
      addBubble('assistant', error?.message || t('assistant.message.executeFailed'));
    } finally {
      setIsSending(false);
    }
  };

  const cancelPendingAction = () => {
    if (!pendingAction) return;
    const kindLabel =
      pendingAction.kind === 'create_app'
        ? t('assistant.kind.create')
        : pendingAction.kind === 'fix_app'
          ? t('assistant.kind.fix')
          : t('assistant.kind.update');
    setPendingAction(null);
    addBubble('assistant', t('assistant.message.cancelledAction', { kind: kindLabel }));
  };

  const pendingSummary = useMemo(() => {
    if (!pendingAction) return '';
    if (pendingAction.kind === 'create_app') {
      return t('assistant.pending.summaryCreate', {
        style: pendingAction.style,
        cost: formatUsd(pendingAction.estimatedMaxCostUsd),
        tokens: pendingAction.estimatedInputTokens.toLocaleString(),
      });
    }
    if (pendingAction.kind === 'fix_app') {
      return t('assistant.pending.summaryFix', { title: pendingAction.appTitle });
    }
    return t('assistant.pending.summaryUpdate', { title: pendingAction.appTitle });
  }, [pendingAction]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <SafeAreaView style={[styles.container, isUniverseTheme ? styles.containerUniverse : undefined]} edges={[]}>
        {Platform.OS === 'android' ? (
          <StatusBar
            translucent
            backgroundColor="transparent"
            barStyle={isUniverseTheme ? 'light-content' : 'dark-content'}
          />
        ) : null}
        <AppThemeBackground />

        <View style={styles.header}>
          <Text style={[styles.headerTitle, isUniverseTheme ? styles.headerTitleUniverse : undefined]}>
            {t('assistant.header.title')}
          </Text>
          <TouchableOpacity
            style={[
              styles.modelButton,
              isUniverseTheme ? styles.modelButtonUniverse : undefined,
              !hasApiAccess ? styles.modelButtonLocked : undefined,
            ]}
            onPress={() => {
              if (!hasApiAccess) {
                promptApiSetup(t('assistant.feature.modelSettings'));
                return;
              }
              setShowModelPicker(true);
            }}
            accessibilityRole="button"
            accessibilityLabel={t('assistant.model.selectA11y')}
          >
            <Ionicons
              name="hardware-chip-outline"
              size={14}
              color={isUniverseTheme ? 'rgba(226, 240, 255, 0.94)' : 'rgba(0,0,0,0.75)'}
            />
            <Text style={[styles.modelButtonText, isUniverseTheme ? styles.modelButtonTextUniverse : undefined]}>
              {assistantModelLabel}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollContentPaddingBottom }]}
          showsVerticalScrollIndicator={false}
        >
          {!hasApiAccess ? (
            <View style={[styles.noticeCard, isUniverseTheme ? styles.noticeCardUniverse : undefined]}>
              <Ionicons name="warning-outline" size={18} color="#f59e0b" />
              <Text style={[styles.noticeText, isUniverseTheme ? styles.noticeTextUniverse : undefined]}>
                {t('assistant.notice.apiRequired')}
              </Text>
              <TouchableOpacity
                style={[styles.noticeButton, isUniverseTheme ? styles.noticeButtonUniverse : undefined]}
                onPress={() => router.push('/welcome')}
              >
                <Text style={styles.noticeButtonText}>{t('common.actions.openSetup')}</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.chipsWrap}>
            {quickQuestions.map((question) => (
              <TouchableOpacity
                key={question}
                style={[
                  styles.chip,
                  isUniverseTheme ? styles.chipUniverse : undefined,
                  !hasApiAccess ? styles.chipDisabled : undefined,
                ]}
                onPress={() => void sendMessage(question)}
                disabled={isSending || !hasApiAccess}
              >
                <Text style={[styles.chipText, isUniverseTheme ? styles.chipTextUniverse : undefined]}>{question}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.chatWrap}>
            {messages.map((message) => (
              <View
                key={message.id}
                style={[
                  styles.bubbleRow,
                  message.role === 'user' ? styles.bubbleRowUser : styles.bubbleRowAssistant,
                ]}
              >
                <View
                  style={[
                    styles.bubble,
                    message.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant,
                    message.role === 'assistant' && isUniverseTheme ? styles.bubbleAssistantUniverse : undefined,
                  ]}
                >
                  <Text
                    style={[
                      styles.bubbleText,
                      message.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextAssistant,
                      message.role === 'assistant' && isUniverseTheme ? styles.bubbleTextAssistantUniverse : undefined,
                    ]}
                  >
                    {message.text}
                  </Text>
                </View>
              </View>
            ))}

            {isSending ? (
              <View style={[styles.bubbleRow, styles.bubbleRowAssistant]}>
                <View style={[styles.bubble, styles.bubbleAssistant, isUniverseTheme ? styles.bubbleAssistantUniverse : undefined]}>
                  <View style={styles.loadingInline}>
                    <ActivityIndicator size="small" color={isUniverseTheme ? '#9ecfff' : '#0f7cff'} />
                    <Text
                      style={[
                        styles.bubbleText,
                        styles.bubbleTextAssistant,
                        isUniverseTheme ? styles.bubbleTextAssistantUniverse : undefined,
                      ]}
                    >
                      {t('assistant.loading.waiting')}
                    </Text>
                  </View>
                </View>
              </View>
            ) : null}
          </View>

          {pendingAction ? (
            <View style={[styles.pendingCard, isUniverseTheme ? styles.pendingCardUniverse : undefined]}>
              <View style={styles.pendingHeader}>
                <Ionicons name="alert-circle-outline" size={18} color={isUniverseTheme ? '#9ccfff' : '#0f7cff'} />
                <Text style={[styles.pendingTitle, isUniverseTheme ? styles.pendingTitleUniverse : undefined]}>
                  {t('assistant.pending.required')}
                </Text>
              </View>
              <Text style={[styles.pendingSummary, isUniverseTheme ? styles.pendingSummaryUniverse : undefined]}>
                {pendingSummary}
              </Text>
              {pendingAction.kind === 'create_app' ? (
                <Text style={[styles.pendingBody, isUniverseTheme ? styles.pendingBodyUniverse : undefined]}>
                  {pendingAction.description}
                </Text>
              ) : null}
              <View style={styles.pendingButtonRow}>
                <TouchableOpacity
                  style={[
                    styles.pendingButtonSecondary,
                    isUniverseTheme ? styles.pendingButtonSecondaryUniverse : undefined,
                  ]}
                  onPress={cancelPendingAction}
                  disabled={isSending}
                >
                  <Text
                    style={[
                      styles.pendingButtonSecondaryText,
                      isUniverseTheme ? styles.pendingButtonSecondaryTextUniverse : undefined,
                    ]}
                  >
                    {t('common.actions.cancel')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.pendingButtonPrimary}
                  onPress={() => void confirmPendingAction()}
                  disabled={isSending}
                >
                  <Text style={styles.pendingButtonPrimaryText}>{t('assistant.pending.confirm')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </ScrollView>

        <View
          style={[
            styles.inputBar,
            isUniverseTheme ? styles.inputBarUniverse : undefined,
            { marginBottom: composerBottomOffset },
            !hasApiAccess ? styles.inputBarLocked : undefined,
          ]}
        >
          <TextInput
            style={[styles.input, isUniverseTheme ? styles.inputUniverse : undefined]}
            value={inputValue}
            onChangeText={setInputValue}
            placeholder={t('assistant.input.placeholder')}
            placeholderTextColor={isUniverseTheme ? 'rgba(191, 216, 243, 0.66)' : '#808080'}
            editable={!isSending && hasApiAccess}
            onFocus={() => {
              if (!hasApiAccess) {
                promptApiSetup(t('assistant.feature.assistant'));
              }
            }}
            multiline
            maxLength={1200}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              isUniverseTheme ? styles.sendButtonUniverse : undefined,
              ((!inputValue.trim() && hasApiAccess) || isSending) && styles.sendButtonDisabled,
              !hasApiAccess ? styles.sendButtonDisabled : undefined,
            ]}
            onPress={() => {
              if (!hasApiAccess) {
                promptApiSetup(t('assistant.feature.assistant'));
                return;
              }
              void sendMessage();
            }}
            disabled={isSending || (!inputValue.trim() && hasApiAccess)}
          >
            {isSending ? (
              <ActivityIndicator size="small" color={isUniverseTheme ? 'rgba(226, 240, 255, 0.96)' : '#0f7cff'} />
            ) : (
              <Ionicons
                name="send"
                size={16}
                color={isUniverseTheme ? 'rgba(226, 240, 255, 0.96)' : '#0f7cff'}
              />
            )}
          </TouchableOpacity>
        </View>

        <Modal
          visible={showModelPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowModelPicker(false)}
        >
          <View style={styles.modalOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowModelPicker(false)} />
            <View style={[styles.modalContent, isUniverseTheme ? styles.modalContentUniverse : undefined]}>
              <Text style={[styles.modalTitle, isUniverseTheme ? styles.modalTitleUniverse : undefined]}>
                {t('assistant.model.title')}
              </Text>
              <Text style={[styles.modalSubtitle, isUniverseTheme ? styles.modalSubtitleUniverse : undefined]}>
                {t('assistant.model.subtitle')}
              </Text>

              <ScrollView
                style={styles.modelOptionsScroll}
                contentContainerStyle={styles.modelOptionsScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {availableAssistantModels.map((modelId) => {
                  const isSelected = assistantModel === modelId;
                  const isCheapest = cheapestModel === modelId;

                  return (
                    <TouchableOpacity
                      key={modelId}
                      style={[
                        styles.modelOption,
                        isUniverseTheme ? styles.modelOptionUniverse : undefined,
                        isSelected ? styles.modelOptionSelected : undefined,
                        isSelected && isUniverseTheme ? styles.modelOptionSelectedUniverse : undefined,
                      ]}
                      onPress={() => void persistAssistantModel(modelId)}
                    >
                      <View style={styles.modelOptionContent}>
                        <Text
                          style={[
                            styles.modelOptionTitle,
                            isUniverseTheme ? styles.modelOptionTitleUniverse : undefined,
                            isSelected ? styles.modelOptionTitleSelected : undefined,
                            isSelected && isUniverseTheme ? styles.modelOptionTitleSelectedUniverse : undefined,
                          ]}
                        >
                          {MODEL_INFO[modelId]?.name || modelId}
                        </Text>
                        <Text
                          style={[
                            styles.modelOptionPricing,
                            isUniverseTheme ? styles.modelOptionPricingUniverse : undefined,
                          ]}
                        >
                          {formatModelPricingShort(modelId) || t('assistant.model.pricingUnavailable')}
                        </Text>
                        {isCheapest ? (
                          <Text style={[styles.cheapestTag, isUniverseTheme ? styles.cheapestTagUniverse : undefined]}>
                            {t('assistant.model.cheapest')}
                          </Text>
                        ) : null}
                      </View>
                      {isSelected ? <Ionicons name="checkmark-circle" size={22} color="#0f7cff" /> : null}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <TouchableOpacity
                style={[styles.modalActionButton, isUniverseTheme ? styles.modalActionButtonUniverse : undefined]}
                onPress={() => {
                  void persistAssistantModel(cheapestModel);
                }}
              >
                <Text
                  style={[
                    styles.modalActionButtonText,
                    isUniverseTheme ? styles.modalActionButtonTextUniverse : undefined,
                  ]}
                >
                  {t('assistant.model.useCheapest')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalDoneButton} onPress={() => setShowModelPicker(false)}>
                <Text style={styles.modalDoneButtonText}>{t('assistant.model.done')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.Primary,
  },
  containerUniverse: {
    backgroundColor: 'transparent',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    flex: 1,
    fontSize: 24,
    fontWeight: '900',
    color: 'rgba(0, 0, 0, 0.84)',
  },
  headerTitleUniverse: {
    color: 'rgba(234, 246, 255, 0.95)',
  },
  modelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.68)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  modelButtonUniverse: {
    backgroundColor: 'rgba(11, 37, 65, 0.84)',
    borderColor: 'rgba(155, 196, 239, 0.34)',
  },
  modelButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(0,0,0,0.75)',
  },
  modelButtonTextUniverse: {
    color: 'rgba(226, 240, 255, 0.95)',
  },
  modelButtonLocked: {
    opacity: 0.62,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  noticeCard: {
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#f59e0b',
    backgroundColor: '#fff4d6',
    padding: 12,
    gap: 8,
  },
  noticeCardUniverse: {
    borderColor: 'rgba(248, 179, 72, 0.74)',
    backgroundColor: 'rgba(66, 39, 6, 0.72)',
  },
  noticeText: {
    fontSize: 13,
    color: '#8a4b00',
  },
  noticeTextUniverse: {
    color: 'rgba(249, 229, 191, 0.94)',
  },
  noticeButton: {
    alignSelf: 'flex-start',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f59e0b',
  },
  noticeButtonUniverse: {
    backgroundColor: '#d97706',
  },
  noticeButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  chipUniverse: {
    borderColor: 'rgba(125, 171, 222, 0.4)',
    backgroundColor: 'rgba(7, 28, 52, 0.9)',
  },
  chipDisabled: {
    opacity: 0.48,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(0,0,0,0.72)',
  },
  chipTextUniverse: {
    color: 'rgba(214, 233, 253, 0.92)',
  },
  chatWrap: {
    gap: 10,
  },
  bubbleRow: {
    width: '100%',
    flexDirection: 'row',
  },
  bubbleRowAssistant: {
    justifyContent: 'flex-start',
  },
  bubbleRowUser: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '88%',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
  },
  bubbleAssistant: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderColor: 'rgba(0,0,0,0.1)',
  },
  bubbleAssistantUniverse: {
    backgroundColor: 'rgba(8, 22, 42, 0.92)',
    borderColor: 'rgba(123, 169, 220, 0.4)',
  },
  bubbleUser: {
    backgroundColor: '#0f7cff',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 19,
  },
  bubbleTextAssistant: {
    color: 'rgba(0,0,0,0.82)',
  },
  bubbleTextAssistantUniverse: {
    color: 'rgba(223, 238, 255, 0.95)',
  },
  bubbleTextUser: {
    color: '#fff',
  },
  loadingInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pendingCard: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(15,124,255,0.35)',
    backgroundColor: 'rgba(237,245,255,0.96)',
    padding: 12,
    gap: 8,
  },
  pendingCardUniverse: {
    borderColor: 'rgba(123, 169, 220, 0.46)',
    backgroundColor: 'rgba(9, 30, 56, 0.92)',
  },
  pendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pendingTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: 'rgba(0,0,0,0.8)',
  },
  pendingTitleUniverse: {
    color: 'rgba(226, 240, 255, 0.95)',
  },
  pendingSummary: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(0,0,0,0.7)',
  },
  pendingSummaryUniverse: {
    color: 'rgba(198, 222, 248, 0.9)',
  },
  pendingBody: {
    fontSize: 13,
    color: 'rgba(0,0,0,0.78)',
  },
  pendingBodyUniverse: {
    color: 'rgba(216, 234, 253, 0.92)',
  },
  pendingButtonRow: {
    marginTop: 4,
    flexDirection: 'row',
    gap: 10,
  },
  pendingButtonPrimary: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 10,
    backgroundColor: '#0f7cff',
  },
  pendingButtonPrimaryText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  pendingButtonSecondary: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  pendingButtonSecondaryUniverse: {
    backgroundColor: 'rgba(11, 37, 65, 0.84)',
    borderWidth: 1,
    borderColor: 'rgba(155, 196, 239, 0.34)',
  },
  pendingButtonSecondaryText: {
    fontSize: 13,
    fontWeight: '800',
    color: 'rgba(0,0,0,0.7)',
  },
  pendingButtonSecondaryTextUniverse: {
    color: 'rgba(226, 240, 255, 0.94)',
  },
  inputBar: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    borderTopWidth: 0,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  inputBarUniverse: {
    backgroundColor: 'transparent',
  },
  inputBarLocked: {
    opacity: 0.58,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 118,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.26)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: 'rgba(0,0,0,0.84)',
    backgroundColor: 'transparent',
  },
  inputUniverse: {
    borderColor: 'rgba(125, 171, 222, 0.44)',
    color: 'rgba(227, 242, 255, 0.95)',
    backgroundColor: 'transparent',
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(15, 124, 255, 0.38)',
    backgroundColor: 'transparent',
  },
  sendButtonUniverse: {
    borderColor: 'rgba(144, 194, 242, 0.42)',
    backgroundColor: 'transparent',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modalContent: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    backgroundColor: 'rgba(255,255,255,0.98)',
    padding: 16,
    maxHeight: '80%',
  },
  modalContentUniverse: {
    borderColor: 'rgba(123, 169, 220, 0.42)',
    backgroundColor: 'rgba(7, 20, 38, 0.98)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: 'rgba(0,0,0,0.84)',
    textAlign: 'center',
  },
  modalTitleUniverse: {
    color: 'rgba(225, 239, 255, 0.95)',
  },
  modalSubtitle: {
    marginTop: 6,
    fontSize: 12,
    textAlign: 'center',
    color: 'rgba(0,0,0,0.6)',
    marginBottom: 12,
  },
  modalSubtitleUniverse: {
    color: 'rgba(190, 216, 244, 0.84)',
  },
  modelOptionsScroll: {
    maxHeight: 350,
  },
  modelOptionsScrollContent: {
    paddingBottom: 6,
    gap: 8,
  },
  modelOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
    backgroundColor: 'rgba(248,250,252,0.9)',
    padding: 10,
    gap: 10,
  },
  modelOptionUniverse: {
    borderColor: 'rgba(123, 169, 220, 0.35)',
    backgroundColor: 'rgba(9, 28, 52, 0.9)',
  },
  modelOptionSelected: {
    borderColor: 'rgba(15,124,255,0.42)',
    backgroundColor: 'rgba(15,124,255,0.08)',
  },
  modelOptionSelectedUniverse: {
    borderColor: 'rgba(145, 196, 255, 0.45)',
    backgroundColor: 'rgba(16, 52, 90, 0.64)',
  },
  modelOptionContent: {
    flex: 1,
  },
  modelOptionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: 'rgba(0,0,0,0.82)',
  },
  modelOptionTitleUniverse: {
    color: 'rgba(224, 240, 255, 0.94)',
  },
  modelOptionTitleSelected: {
    color: 'rgba(0,0,0,0.9)',
  },
  modelOptionTitleSelectedUniverse: {
    color: 'rgba(240, 249, 255, 0.98)',
  },
  modelOptionPricing: {
    marginTop: 2,
    fontSize: 11,
    color: 'rgba(0,0,0,0.62)',
  },
  modelOptionPricingUniverse: {
    color: 'rgba(190, 216, 244, 0.84)',
  },
  cheapestTag: {
    marginTop: 4,
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(34,197,94,0.16)',
    color: '#0f7a34',
    fontSize: 10,
    fontWeight: '800',
  },
  cheapestTagUniverse: {
    backgroundColor: 'rgba(52, 211, 153, 0.2)',
    color: 'rgba(172, 255, 223, 0.95)',
  },
  modalActionButton: {
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  modalActionButtonUniverse: {
    borderColor: 'rgba(123, 169, 220, 0.35)',
    backgroundColor: 'rgba(11, 37, 65, 0.82)',
  },
  modalActionButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: 'rgba(0,0,0,0.7)',
  },
  modalActionButtonTextUniverse: {
    color: 'rgba(226, 240, 255, 0.94)',
  },
  modalDoneButton: {
    marginTop: 10,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f7cff',
  },
  modalDoneButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
});
