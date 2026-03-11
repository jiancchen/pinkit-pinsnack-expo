import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppColors } from '../constants/AppColors';
import { AppStorageService, StoredApp } from '../services/AppStorageService';
import { ClaudeApiService } from '../services/ClaudeApiService';
import { PromptGenerator } from '../services/PromptGenerator';
import { SecureStorageService } from '../services/SecureStorageService';
import { createLogger } from '../utils/Logger';
import {
  CLAUDE_MODEL_PICKER_OPTIONS,
  MODEL_INFO,
  PRICING_AS_OF_DISPLAY,
  formatModelPricingShort,
  resolveSupportedClaudeModel,
} from '../types/ClaudeApi';
import { useUISettingsStore } from '../stores/UISettingsStore';
import AppThemeBackground from '../components/AppThemeBackground';

const log = createLogger('AppRecreate');

type Mode = 'recreate' | 'fix';
type RevisionRecord = NonNullable<StoredApp['revisions']>[number];

function normalizeRevisionsWithParents(revisions: RevisionRecord[]): RevisionRecord[] {
  const idSet = new Set(revisions.map((rev) => rev.id));
  return revisions.map((rev, index) => {
    const parentRevisionId =
      typeof rev.parentRevisionId === 'string' && idSet.has(rev.parentRevisionId)
        ? rev.parentRevisionId
        : revisions[index + 1]?.id || null;
    return {
      ...rev,
      parentRevisionId,
    };
  });
}

function buildRootRevision(app: StoredApp, fallbackModel?: string, fallbackPrompt?: string): RevisionRecord | null {
  const htmlSnapshot = typeof app.html === 'string' ? app.html : '';
  if (!htmlSnapshot.trim()) return null;
  const createdAt = new Date(app.timestamp).getTime();
  return {
    id: `root_${app.id}`,
    at: Number.isFinite(createdAt) ? createdAt : Date.now(),
    operation: 'create',
    status: 'completed',
    model: resolveSupportedClaudeModel(app.model || fallbackModel || undefined),
    updatedPrompt: (app.prompt || fallbackPrompt || app.description || '').trim(),
    userNotes: 'Initial generated version',
    fixSummary: ['Initial generated version'],
    parentRevisionId: null,
    htmlSnapshot,
  };
}

export default function AppRecreatePage() {
  const router = useRouter();
  const { appId, mode, showHistory, prefillPrompt, prefillFixNotes } = useLocalSearchParams<{
    appId?: string;
    mode?: string;
    showHistory?: string;
    prefillPrompt?: string;
    prefillFixNotes?: string;
  }>();
  const appTheme = useUISettingsStore((s) => s.appTheme);
  const debugAllowWithoutApiKey = useUISettingsStore((s) => s.debugAllowWithoutApiKey);
  const isUniverseTheme = appTheme === 'universe';

  const safeGoBack = () => {
    const canGoBack = (router as any)?.canGoBack?.();
    if (canGoBack) {
      router.back();
      return;
    }
    router.replace('/(tabs)');
  };

  const resolvedMode: Mode = mode === 'fix' ? 'fix' : 'recreate';
  const shouldStartInHistory = showHistory === '1' || showHistory === 'true';

  const [app, setApp] = useState<StoredApp | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingApiKey, setIsCheckingApiKey] = useState(true);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isRecreating, setIsRecreating] = useState(false);

  const [newPrompt, setNewPrompt] = useState('');
  const [fixNotes, setFixNotes] = useState('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showRevisionHistory, setShowRevisionHistory] = useState(resolvedMode === 'fix' || shouldStartInHistory);
  const [baseRevisionId, setBaseRevisionId] = useState<string | null>(null);

  const bodyScrollRef = useRef<ScrollView>(null);
  const newPromptRef = useRef<TextInput>(null);
  const fixNotesRef = useRef<TextInput>(null);
  const hasApiAccess = hasApiKey || debugAllowWithoutApiKey;

  const promptApiSetup = (featureLabel: string) => {
    Alert.alert(
      `${featureLabel} requires setup`,
      'Complete API key setup to unlock this feature.',
      [
        { text: 'Open Setup', onPress: () => router.push('/welcome') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const scrollInputIntoView = (target: 'prompt' | 'fix') => {
    setTimeout(() => {
      if (target === 'fix') {
        bodyScrollRef.current?.scrollToEnd({ animated: true });
        return;
      }
      bodyScrollRef.current?.scrollTo({ y: 220, animated: true });
    }, 120);
  };

  useEffect(() => {
    const id = typeof appId === 'string' ? appId : '';
    if (!id) {
      Alert.alert('Error', 'Missing app id.', [{ text: 'OK', onPress: safeGoBack }]);
      return;
    }
    void loadApp(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId]);

  useEffect(() => {
    if (!app) return;
    if (shouldStartInHistory) return;
    if (resolvedMode === 'fix') {
      setTimeout(() => fixNotesRef.current?.focus(), 250);
    } else {
      setTimeout(() => newPromptRef.current?.focus(), 250);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app?.id, shouldStartInHistory]);

  useEffect(() => {
    if (shouldStartInHistory) {
      setShowRevisionHistory(true);
    }
  }, [shouldStartInHistory]);

  useEffect(() => {
    setBaseRevisionId(null);
  }, [app?.id]);

  const loadApp = async (id: string) => {
    try {
      setIsLoading(true);
      const [storedApp, hasKey] = await Promise.all([
        AppStorageService.getApp(id),
        SecureStorageService.hasApiKey(),
      ]);
      setHasApiKey(hasKey);
      if (!storedApp) {
        Alert.alert('Error', 'App not found.', [{ text: 'OK', onPress: safeGoBack }]);
        return;
      }

      setApp(storedApp);
      const prefilledPrompt = typeof prefillPrompt === 'string' ? prefillPrompt.trim() : '';
      const prefilledFixNotes = typeof prefillFixNotes === 'string' ? prefillFixNotes.trim() : '';

      setNewPrompt(prefilledPrompt || storedApp.prompt || '');
      setFixNotes(prefilledFixNotes);

      try {
        const config = await SecureStorageService.getConfig();
        const preferred = storedApp.model ? resolveSupportedClaudeModel(storedApp.model) : config.model;
        setSelectedModel(preferred);
      } catch {
        if (storedApp.model) setSelectedModel(resolveSupportedClaudeModel(storedApp.model));
      }
    } catch (error) {
      log.error('Error loading app for recreate:', error);
      setHasApiKey(false);
      Alert.alert('Error', 'Failed to load app.', [{ text: 'OK', onPress: safeGoBack }]);
    } finally {
      setIsCheckingApiKey(false);
      setIsLoading(false);
    }
  };

  const revisionHistory = useMemo<RevisionRecord[]>(() => {
    if (!app) return [];
    if (app.revisions?.length) {
      return normalizeRevisionsWithParents(app.revisions);
    }
    if (app.lastRevision) {
      return [
        {
          id: `last_${app.lastRevision.at}`,
          at: app.lastRevision.at,
          operation: 'app_revision' as const,
          status: 'completed' as const,
          model: app.lastRevision.model,
          updatedPrompt: app.lastRevision.updatedPrompt,
          userNotes: app.lastRevision.userNotes,
          fixSummary: app.lastRevision.fixSummary,
          parentRevisionId: app.lastRevision.parentRevisionId || null,
          htmlSnapshot: app.html || '',
        },
      ];
    }
    const rootRevision = buildRootRevision(app);
    if (rootRevision) {
      return [rootRevision];
    }
    return [];
  }, [app]);

  const activeBaseRevisionId = useMemo(() => {
    if (!revisionHistory.length) return null;
    if (baseRevisionId && revisionHistory.some((rev) => rev.id === baseRevisionId)) return baseRevisionId;
    const latestCompleted = revisionHistory.find((rev) => rev.status === 'completed');
    return latestCompleted?.id || revisionHistory[0]?.id || null;
  }, [baseRevisionId, revisionHistory]);

  const revisionTree = useMemo(() => {
    const chronological = [...revisionHistory].sort((a, b) => a.at - b.at);
    const byId = new Map(chronological.map((rev) => [rev.id, rev]));
    const depthCache = new Map<string, number>();

    const getDepth = (rev: RevisionRecord, seen: Set<string> = new Set()): number => {
      const cached = depthCache.get(rev.id);
      if (typeof cached === 'number') return cached;
      const parentId = rev.parentRevisionId || null;
      if (!parentId || !byId.has(parentId) || seen.has(parentId)) {
        depthCache.set(rev.id, 0);
        return 0;
      }
      seen.add(rev.id);
      const parent = byId.get(parentId)!;
      const depth = getDepth(parent, seen) + 1;
      depthCache.set(rev.id, depth);
      return depth;
    };

    return chronological.map((rev) => {
      const parent = rev.parentRevisionId ? byId.get(rev.parentRevisionId) : undefined;
      return {
        ...rev,
        depth: getDepth(rev),
        parentAt: parent?.at,
        parentModel: parent?.model,
      };
    });
  }, [revisionHistory]);

  const onRecreate = async () => {
    if (!app || isRecreating) return;
    if (!hasApiAccess) {
      promptApiSetup('Update/Fix');
      return;
    }

    const updatedPrompt = newPrompt.trim();
    if (!updatedPrompt) {
      Alert.alert('Error', 'Please enter a prompt.');
      return;
    }

    const notes = fixNotes.trim();
    const actionLabel = resolvedMode === 'fix' ? 'Fix' : 'Recreate';
    const confirmTitle = resolvedMode === 'fix' ? 'Fix App' : 'Recreate App';
    const confirmBody =
      resolvedMode === 'fix'
        ? 'This sends the full current HTML, original prompt, updated prompt, and your fix notes to Claude. Claude returns a complete replacement HTML file. Continue?'
        : 'This sends the full current HTML plus your updated prompt/notes to Claude, then replaces the app with a complete returned HTML file. Continue?';

    Alert.alert(
      confirmTitle,
      confirmBody,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: actionLabel,
          onPress: async () => {
            const revisionId = `rev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const startedAt = Date.now();
            try {
              Keyboard.dismiss();
              setIsRecreating(true);

              const config = await SecureStorageService.getConfig();
              const model = resolveSupportedClaudeModel(selectedModel || config.model);
              const existingRevisions = Array.isArray(app.revisions) ? [...app.revisions] : [];
              const hasRootRevision = existingRevisions.some((rev) => rev.operation === 'create');
              const rootRevision = hasRootRevision ? null : buildRootRevision(app, model, updatedPrompt);
              const revisionsWithRoot = rootRevision ? [rootRevision, ...existingRevisions] : existingRevisions;
              const resolvedParentRevisionId =
                activeBaseRevisionId || app.mainRevisionId || revisionsWithRoot[0]?.id || null;

              const nextRevision = {
                id: revisionId,
                at: startedAt,
                operation: 'app_revision' as const,
                status: 'generating' as const,
                model,
                updatedPrompt,
                userNotes: notes,
                parentRevisionId: resolvedParentRevisionId,
              };
              const nextRevisions = [nextRevision, ...revisionsWithRoot];

              await AppStorageService.updateApp(app.id, {
                prompt: updatedPrompt,
                request: {
                  description: updatedPrompt,
                  style: (app.style as any) || 'modern',
                  platform: 'mobile',
                },
                status: 'generating',
                model,
                lastRevision: {
                  at: startedAt,
                  model,
                  updatedPrompt,
                  userNotes: notes,
                  parentRevisionId: resolvedParentRevisionId,
                },
                revisions: nextRevisions,
              });

              setApp((prev) =>
                prev
                  ? {
                      ...prev,
                      prompt: updatedPrompt,
                      status: 'generating',
                      model,
                      lastRevision: {
                        at: startedAt,
                        model,
                        updatedPrompt,
                        userNotes: notes,
                        parentRevisionId: resolvedParentRevisionId,
                      },
                      revisions: nextRevisions,
                    }
                  : prev
              );

              const prompt = PromptGenerator.generateHtmlRevisionPrompt({
                originalPrompt: app.prompt || '',
                updatedPrompt,
                userNotes: notes,
                originalHtml: app.html || '',
              });

              const claudeService = ClaudeApiService.getInstance();
              await claudeService.initialize();

              const response = await claudeService.generateAppConcept(prompt, {
                model,
                maxTokens: config.maxTokens,
                temperature: config.temperature,
                operation: 'app_revision',
                appId: app.id,
              });

              let fixSummary: string[] | undefined;
              try {
                const match = response?.html?.match(
                  /<script[^>]*id=["']droplets_debug["'][^>]*>([\s\S]*?)<\/script>/i
                );
                if (match?.[1]) {
                  const parsed = JSON.parse(match[1]);
                  if (Array.isArray(parsed?.fixSummary)) {
                    fixSummary = parsed.fixSummary.filter((x: any) => typeof x === 'string').slice(0, 6);
                  }
                }
              } catch {
                // ignore
              }

              const completedRevisions = nextRevisions.map((rev) =>
                rev.id === revisionId
                  ? { ...rev, status: 'completed' as const, fixSummary, htmlSnapshot: response.html }
                  : rev
              );

              await AppStorageService.updateApp(app.id, {
                html: response.html,
                status: 'completed',
                model,
                mainRevisionId: revisionId,
                lastRevision: {
                  at: Date.now(),
                  model,
                  updatedPrompt,
                  userNotes: notes,
                  fixSummary,
                  parentRevisionId: resolvedParentRevisionId,
                },
                revisions: completedRevisions,
              });

              setApp((prev) =>
                prev
                  ? {
                      ...prev,
                      html: response.html,
                      status: 'completed',
                      model,
                      mainRevisionId: revisionId,
                      lastRevision: {
                        at: Date.now(),
                        model,
                        updatedPrompt,
                        userNotes: notes,
                        fixSummary,
                        parentRevisionId: resolvedParentRevisionId,
                      },
                      revisions: completedRevisions,
                    }
                  : prev
              );

              setBaseRevisionId(revisionId);

              Alert.alert('Success', 'App recreated successfully.', [{ text: 'OK', onPress: safeGoBack }]);
            } catch (error: any) {
              log.error('Error recreating app:', error);
              const errorMessage = typeof error?.message === 'string' ? error.message : 'Failed to recreate app';
              try {
                const existing = await AppStorageService.getApp(app.id);
                const revisions = existing?.revisions || app.revisions || [];
                const updatedRevisions = revisions.map((rev) =>
                  rev.id === revisionId ? { ...rev, status: 'error' as const, errorMessage } : rev
                );
                await AppStorageService.updateApp(app.id, { status: 'error', revisions: updatedRevisions });
              } catch {
                // ignore
              }
              setApp((prev) => {
                if (!prev) return prev;
                const updatedRevisions = (prev.revisions || []).map((rev) =>
                  rev.id === revisionId ? { ...rev, status: 'error' as const, errorMessage } : rev
                );
                return { ...prev, status: 'error', revisions: updatedRevisions };
              });
              Alert.alert('Error', errorMessage);
            } finally {
              setIsRecreating(false);
            }
          },
        },
      ]
    );
  };

  const onTryRevision = async (revision: RevisionRecord) => {
    if (!app) return;
    if (revision.status !== 'completed') {
      Alert.alert('Revision not ready', 'This revision is still generating or failed.');
      return;
    }

    const htmlSnapshot = revision.htmlSnapshot;
    if (!htmlSnapshot) {
      Alert.alert(
        'Snapshot unavailable',
        'This older revision was created before snapshot support. Regenerate from this base to create a runnable snapshot.'
      );
      return;
    }

    const appliedLastRevision = {
      at: revision.at,
      model: revision.model,
      updatedPrompt: revision.updatedPrompt,
      userNotes: revision.userNotes || '',
      fixSummary: revision.fixSummary,
      parentRevisionId: revision.parentRevisionId || null,
    };

    try {
      await AppStorageService.updateApp(app.id, {
        html: htmlSnapshot,
        prompt: revision.updatedPrompt,
        request: {
          description: revision.updatedPrompt,
          style: (app.style as any) || 'modern',
          platform: 'mobile',
        },
        status: 'completed',
        model: revision.model,
        mainRevisionId: revision.id,
        lastRevision: appliedLastRevision,
      });

      setApp((prev) =>
        prev
          ? {
              ...prev,
              html: htmlSnapshot,
              prompt: revision.updatedPrompt,
              status: 'completed',
              model: revision.model,
              mainRevisionId: revision.id,
              lastRevision: appliedLastRevision,
            }
          : prev
      );
      setNewPrompt(revision.updatedPrompt);
      setFixNotes(revision.userNotes || '');
      setBaseRevisionId(revision.id);
      setSelectedModel(resolveSupportedClaudeModel(revision.model));

      router.push(`/app-view?appId=${app.id}`);
    } catch (error) {
      log.error('Error applying revision snapshot:', error);
      Alert.alert('Error', 'Failed to open revision snapshot.');
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, isUniverseTheme ? styles.containerUniverse : undefined]}>
        {Platform.OS === 'android' ? (
          <StatusBar
            translucent
            backgroundColor="transparent"
            barStyle={isUniverseTheme ? 'light-content' : 'dark-content'}
          />
        ) : null}
        <AppThemeBackground />
        <View style={[styles.center, isUniverseTheme ? styles.centerUniverse : undefined]}>
          <ActivityIndicator size="large" color={AppColors.FABMain} />
          <Text style={[styles.centerText, isUniverseTheme ? styles.centerTextUniverse : undefined]}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!app) {
    return (
      <SafeAreaView style={[styles.container, isUniverseTheme ? styles.containerUniverse : undefined]}>
        {Platform.OS === 'android' ? (
          <StatusBar
            translucent
            backgroundColor="transparent"
            barStyle={isUniverseTheme ? 'light-content' : 'dark-content'}
          />
        ) : null}
        <AppThemeBackground />
        <View style={[styles.center, isUniverseTheme ? styles.centerUniverse : undefined]}>
          <Text style={[styles.centerText, isUniverseTheme ? styles.centerTextUniverse : undefined]}>
            App not found.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={safeGoBack}>
            <Text style={styles.primaryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const primaryHeaderActionLabel = resolvedMode === 'fix' ? 'Fix' : 'Recreate';
  const fullHtmlExplainer =
    resolvedMode === 'fix'
      ? 'Fix mode sends the app\'s full current HTML + prompt + your notes to Claude, then replaces the app with the returned full HTML.'
      : 'Recreate sends the full current HTML + updated prompt/notes to Claude and replaces the app with a complete returned HTML file.';
  const selectedModelName = MODEL_INFO[selectedModel]?.name || selectedModel || 'Select Claude Model';
  const selectedModelPricing =
    (selectedModel && formatModelPricingShort(selectedModel)) || 'Pricing unavailable';

  return (
    <SafeAreaView style={[styles.container, isUniverseTheme ? styles.containerUniverse : undefined]} edges={['top', 'bottom']}>
      {Platform.OS === 'android' ? (
        <StatusBar
          translucent
          backgroundColor="transparent"
          barStyle={isUniverseTheme ? 'light-content' : 'dark-content'}
        />
      ) : null}
      <AppThemeBackground />
      <KeyboardAvoidingView
        style={[styles.container, isUniverseTheme ? styles.containerUniverse : undefined]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={[styles.header, isUniverseTheme ? styles.headerUniverse : undefined]}>
          <TouchableOpacity
            style={[styles.headerIconButton, isUniverseTheme ? styles.headerIconButtonUniverse : undefined]}
            onPress={safeGoBack}
            disabled={isRecreating}
            accessibilityLabel="Back"
          >
            <Ionicons
              name="chevron-back"
              size={22}
              color={isUniverseTheme ? 'rgba(226, 240, 255, 0.92)' : 'rgba(0, 0, 0, 0.8)'}
            />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, isUniverseTheme ? styles.headerTitleUniverse : undefined]}>
              Update Prompt & Recreate
            </Text>
            <Text
              style={[styles.headerSubtitle, isUniverseTheme ? styles.headerSubtitleUniverse : undefined]}
              numberOfLines={1}
            >
              {app.title}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.headerIconButton, isUniverseTheme ? styles.headerIconButtonUniverse : undefined]}
              onPress={() => Keyboard.dismiss()}
              accessibilityLabel="Hide keyboard"
            >
              <Ionicons
                name="chevron-down"
                size={20}
                color={isUniverseTheme ? 'rgba(226, 240, 255, 0.92)' : 'rgba(0, 0, 0, 0.65)'}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.headerPrimaryAction,
                isUniverseTheme ? styles.headerPrimaryActionUniverse : undefined,
                isRecreating || !hasApiAccess || isCheckingApiKey ? styles.headerPrimaryActionDisabled : undefined,
              ]}
              onPress={onRecreate}
              disabled={isRecreating || isCheckingApiKey}
              accessibilityLabel={primaryHeaderActionLabel}
            >
              {isRecreating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.headerPrimaryActionText}>{primaryHeaderActionLabel}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          ref={bodyScrollRef}
          style={[styles.body, isUniverseTheme ? styles.bodyUniverse : undefined]}
          contentContainerStyle={styles.bodyContent}
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.explainerCard, isUniverseTheme ? styles.explainerCardUniverse : undefined]}>
            <Ionicons
              name="information-circle-outline"
              size={18}
              color={isUniverseTheme ? 'rgba(210, 233, 255, 0.9)' : 'rgba(0, 0, 0, 0.7)'}
            />
            <Text style={[styles.explainerText, isUniverseTheme ? styles.explainerTextUniverse : undefined]}>
              {fullHtmlExplainer}
            </Text>
          </View>

          {!hasApiAccess ? (
            <View style={[styles.setupCallout, isUniverseTheme ? styles.setupCalloutUniverse : undefined]}>
              <Ionicons
                name="lock-closed-outline"
                size={18}
                color={isUniverseTheme ? 'rgba(205, 226, 248, 0.95)' : 'rgba(0, 0, 0, 0.72)'}
              />
              <Text style={[styles.setupCalloutText, isUniverseTheme ? styles.setupCalloutTextUniverse : undefined]}>
                Setup API key to unlock app updates, fix mode, and model selection.
              </Text>
              <TouchableOpacity
                style={[styles.setupCalloutButton, isUniverseTheme ? styles.setupCalloutButtonUniverse : undefined]}
                onPress={() => router.push('/welcome')}
              >
                <Text style={[styles.setupCalloutButtonText, isUniverseTheme ? styles.setupCalloutButtonTextUniverse : undefined]}>
                  Open Setup
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <Text style={[styles.sectionTitle, isUniverseTheme ? styles.sectionTitleUniverse : undefined]}>
            Select AI Model
          </Text>
          <TouchableOpacity
            style={[
              styles.modelPickerTrigger,
              isUniverseTheme ? styles.modelPickerTriggerUniverse : undefined,
              !hasApiAccess ? styles.inputLocked : undefined,
            ]}
            onPress={() => {
              if (!hasApiAccess) {
                promptApiSetup('Model settings');
                return;
              }
              setShowModelPicker(true);
            }}
            disabled={isRecreating || isCheckingApiKey}
          >
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={[styles.modelName, isUniverseTheme ? styles.modelNameUniverse : undefined]}>
                {selectedModelName}
              </Text>
              <Text style={[styles.modelPrice, isUniverseTheme ? styles.modelPriceUniverse : undefined]}>
                {selectedModelPricing} (as of {PRICING_AS_OF_DISPLAY})
              </Text>
            </View>
            <Ionicons
              name="chevron-down"
              size={18}
              color={isUniverseTheme ? 'rgba(220, 238, 255, 0.9)' : 'rgba(0, 0, 0, 0.6)'}
            />
          </TouchableOpacity>

          <Text style={[styles.sectionTitle, isUniverseTheme ? styles.sectionTitleUniverse : undefined]}>
            Updated Prompt
          </Text>
          <TextInput
            ref={newPromptRef}
            style={[
              styles.textInput,
              isUniverseTheme ? styles.textInputUniverse : styles.textInputYellow,
              styles.multiline,
            ]}
            value={newPrompt}
            onChangeText={setNewPrompt}
            placeholder="Update the original prompt…"
            placeholderTextColor={isUniverseTheme ? 'rgba(191, 216, 243, 0.66)' : 'rgba(0, 0, 0, 0.45)'}
            multiline={true}
            textAlignVertical="top"
            onFocus={() => scrollInputIntoView('prompt')}
            editable={!isRecreating && hasApiAccess}
          />

          <View style={styles.sectionHeaderRow}>
            <Text
              style={[
                styles.sectionTitle,
                isUniverseTheme ? styles.sectionTitleUniverse : undefined,
                { marginBottom: 0 },
              ]}
            >
              Fix Request (optional)
            </Text>
            <TouchableOpacity
              style={[styles.inlineActionButton, isUniverseTheme ? styles.inlineActionButtonUniverse : undefined]}
              onPress={() => {
                const template =
                  'Repro steps:\n- \n\nExpected:\n- \n\nActual:\n- \n\nDevice / screen:\n- \n\nConstraints:\n- Keep same functionality\n- Fix layout/overflow\n';
                setFixNotes((prev) => (prev.trim() ? `${prev.trim()}\n\n${template}` : template));
              }}
              disabled={isRecreating || !hasApiAccess}
            >
              <Ionicons
                name="clipboard-outline"
                size={16}
                color={isUniverseTheme ? 'rgba(206, 228, 251, 0.86)' : 'rgba(0, 0, 0, 0.7)'}
              />
              <Text style={[styles.inlineActionText, isUniverseTheme ? styles.inlineActionTextUniverse : undefined]}>
                Template
              </Text>
            </TouchableOpacity>
          </View>
          <TextInput
            ref={fixNotesRef}
            style={[
              styles.textInput,
              isUniverseTheme ? styles.textInputUniverse : styles.textInputYellow,
              styles.multiline,
            ]}
            value={fixNotes}
            onChangeText={setFixNotes}
            placeholder="e.g., buttons overflow on small screens; spacing is off; scrolling is broken…"
            placeholderTextColor={isUniverseTheme ? 'rgba(191, 216, 243, 0.66)' : 'rgba(0, 0, 0, 0.45)'}
            multiline={true}
            textAlignVertical="top"
            onFocus={() => scrollInputIntoView('fix')}
            editable={!isRecreating && hasApiAccess}
          />

          <TouchableOpacity
            style={[styles.historyToggle, isUniverseTheme ? styles.historyToggleUniverse : undefined]}
            onPress={() => setShowRevisionHistory((v) => !v)}
            disabled={isRecreating}
          >
            <Ionicons
              name={showRevisionHistory ? 'chevron-down' : 'chevron-forward'}
              size={18}
              color={isUniverseTheme ? 'rgba(210, 233, 255, 0.85)' : 'rgba(0, 0, 0, 0.7)'}
            />
            <Text style={[styles.historyToggleText, isUniverseTheme ? styles.historyToggleTextUniverse : undefined]}>
              Generation History
            </Text>
          </TouchableOpacity>

          {showRevisionHistory && (
            <View style={[styles.historyPanel, isUniverseTheme ? styles.historyPanelUniverse : undefined]}>
              <Text style={[styles.historyLegend, isUniverseTheme ? styles.historyLegendUniverse : undefined]}>
                Tree view (oldest to newest). Tap "Use as Base" to fork from any revision.
              </Text>
              {revisionTree.length === 0 ? (
                <Text style={[styles.historyEmptyText, isUniverseTheme ? styles.historyEmptyTextUniverse : undefined]}>
                  No revision history yet.
                </Text>
              ) : (
                revisionTree.map((rev) => {
                  const when = new Date(rev.at).toLocaleString();
                  const statusIcon =
                    rev.status === 'completed'
                      ? 'checkmark-circle-outline'
                      : rev.status === 'error'
                        ? 'close-circle-outline'
                        : 'time-outline';
                  const statusColor =
                    rev.status === 'completed' ? '#16A34A' : rev.status === 'error' ? '#EF4444' : '#F59E0B';
                  const errorMessage =
                    typeof (rev as any)?.errorMessage === 'string' ? ((rev as any).errorMessage as string) : undefined;
                  const depthPrefix = rev.depth === 0 ? '●' : `${'│ '.repeat(Math.max(0, rev.depth - 1))}└─`;
                  const parentLabel = rev.parentAt
                    ? `Forked from ${new Date(rev.parentAt).toLocaleString()}${rev.parentModel ? ` • ${MODEL_INFO[rev.parentModel]?.name || rev.parentModel}` : ''}`
                    : 'Root revision';
                  const isBase = activeBaseRevisionId === rev.id;
                  const canTry =
                    rev.status === 'completed' &&
                    typeof rev.htmlSnapshot === 'string' &&
                    rev.htmlSnapshot.trim().length > 0;
                  return (
                    <View
                      key={rev.id}
                      style={[
                        styles.historyRow,
                        isBase ? styles.historyRowBase : undefined,
                        isBase && isUniverseTheme ? styles.historyRowBaseUniverse : undefined,
                      ]}
                    >
                      <Text style={[styles.historyTreePrefix, isUniverseTheme ? styles.historyTreePrefixUniverse : undefined]}>
                        {depthPrefix}
                      </Text>
                      <Ionicons name={statusIcon as any} size={18} color={statusColor} />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[styles.historyRowTitle, isUniverseTheme ? styles.historyRowTitleUniverse : undefined]}
                        >
                          {when} • {MODEL_INFO[rev.model]?.name || rev.model}
                        </Text>
                        <Text
                          style={[
                            styles.historyRowSubtext,
                            isUniverseTheme ? styles.historyRowSubtextUniverse : undefined,
                          ]}
                        >
                          {parentLabel}
                        </Text>
                        {!!rev.fixSummary?.length && (
                          <Text
                            style={[
                              styles.historyRowSubtext,
                              isUniverseTheme ? styles.historyRowSubtextUniverse : undefined,
                            ]}
                          >
                            Fixes: {rev.fixSummary.join(' · ')}
                          </Text>
                        )}
                        {!!errorMessage && (
                          <Text style={[styles.historyRowSubtext, { color: '#EF4444' }]}>{errorMessage}</Text>
                        )}
                      </View>
                      <View style={styles.historyActions}>
                        <TouchableOpacity
                          style={[styles.historyUseButton, isUniverseTheme ? styles.historyUseButtonUniverse : undefined]}
                          onPress={() => {
                            setNewPrompt(rev.updatedPrompt);
                            setFixNotes(rev.userNotes || '');
                            setBaseRevisionId(rev.id);
                          }}
                          disabled={isRecreating}
                        >
                          <Text
                            style={[
                              styles.historyUseButtonText,
                              isUniverseTheme ? styles.historyUseButtonTextUniverse : undefined,
                            ]}
                          >
                            {isBase ? 'Base' : 'Use as Base'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.historyTryButton,
                            isUniverseTheme ? styles.historyTryButtonUniverse : undefined,
                            !canTry ? styles.historyTryButtonDisabled : undefined,
                          ]}
                          onPress={() => void onTryRevision(rev)}
                          disabled={isRecreating || !canTry}
                        >
                          <Text
                            style={[
                              styles.historyTryButtonText,
                              isUniverseTheme ? styles.historyTryButtonTextUniverse : undefined,
                            ]}
                          >
                            Try
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}

          <View style={{ height: 26 }} />
        </ScrollView>
      </KeyboardAvoidingView>

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
              Select AI Model
            </Text>
            <Text style={[styles.modalSubtitle, isUniverseTheme ? styles.modalSubtitleUniverse : undefined]}>
              Prices as of {PRICING_AS_OF_DISPLAY} (USD per MTok)
            </Text>

            <ScrollView
              style={styles.modelOptionsScroll}
              contentContainerStyle={styles.modelOptionsScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {CLAUDE_MODEL_PICKER_OPTIONS.map((model) => {
                const status = MODEL_INFO[model]?.status;
                const isRetired = status === 'retired';
                const isSelected = selectedModel === model;
                return (
                  <TouchableOpacity
                    key={model}
                    style={[
                      styles.modelOption,
                      isUniverseTheme ? styles.modelOptionUniverse : undefined,
                      isSelected && styles.modelOptionSelected,
                      isSelected && isUniverseTheme ? styles.modelOptionSelectedUniverse : undefined,
                      isRetired && styles.modelOptionDisabled,
                      !hasApiAccess && styles.inputLocked,
                    ]}
                    disabled={isRetired || !hasApiAccess}
                    onPress={() => {
                      if (!hasApiAccess) {
                        promptApiSetup('Model settings');
                        return;
                      }
                      setSelectedModel(model);
                      setShowModelPicker(false);
                    }}
                  >
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text
                        style={[
                          styles.modelName,
                          isUniverseTheme ? styles.modelNameUniverse : undefined,
                          isSelected ? styles.modelNameSelected : undefined,
                          isRetired ? styles.modelNameDisabled : undefined,
                        ]}
                      >
                        {MODEL_INFO[model]?.name || model}
                        {status === 'deprecated' ? ' (deprecated)' : status === 'retired' ? ' (retired)' : ''}
                      </Text>
                      <Text
                        style={[
                          styles.modelPrice,
                          isUniverseTheme ? styles.modelPriceUniverse : undefined,
                          isSelected ? styles.modelPriceSelected : undefined,
                        ]}
                      >
                        {formatModelPricingShort(model) || 'Pricing unavailable'}
                      </Text>
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={20} color={AppColors.FABMain} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalCancelButton, isUniverseTheme ? styles.modalCancelButtonUniverse : undefined]}
              onPress={() => setShowModelPicker(false)}
            >
              <Text
                style={[styles.modalCancelButtonText, isUniverseTheme ? styles.modalCancelButtonTextUniverse : undefined]}
              >
                Done
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 10,
  },
  centerUniverse: {
    backgroundColor: 'rgba(4, 14, 30, 0.88)',
  },
  centerText: {
    fontSize: 14,
    color: 'rgba(0, 0, 0, 0.7)',
    textAlign: 'center',
  },
  centerTextUniverse: {
    color: 'rgba(214, 233, 253, 0.9)',
  },
  primaryButton: {
    marginTop: 10,
    backgroundColor: AppColors.FABMain,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryButtonText: {
    color: 'white',
    fontWeight: '700',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    backgroundColor: AppColors.Primary,
  },
  headerUniverse: {
    backgroundColor: 'rgba(8, 22, 42, 0.9)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(123, 169, 220, 0.32)',
  },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },
  headerIconButtonUniverse: {
    backgroundColor: 'rgba(10, 34, 61, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(140, 185, 235, 0.3)',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerPrimaryAction: {
    minWidth: 82,
    height: 38,
    borderRadius: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.FABMain,
  },
  headerPrimaryActionUniverse: {
    backgroundColor: '#0f7cff',
  },
  headerPrimaryActionDisabled: {
    opacity: 0.6,
  },
  headerPrimaryActionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'rgba(0, 0, 0, 0.85)',
  },
  headerTitleUniverse: {
    color: 'rgba(233, 246, 255, 0.95)',
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: 'rgba(0, 0, 0, 0.6)',
  },
  headerSubtitleUniverse: {
    color: 'rgba(190, 216, 244, 0.86)',
  },
  body: {
    flex: 1,
    paddingHorizontal: 12,
  },
  bodyUniverse: {
    backgroundColor: 'transparent',
  },
  bodyContent: {
    paddingBottom: 14,
    paddingTop: 10,
    gap: 14,
  },
  explainerCard: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  explainerCardUniverse: {
    borderColor: 'rgba(123, 169, 220, 0.3)',
    backgroundColor: 'rgba(8, 26, 48, 0.86)',
  },
  explainerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: 'rgba(0, 0, 0, 0.72)',
  },
  explainerTextUniverse: {
    color: 'rgba(205, 226, 248, 0.9)',
  },
  setupCallout: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  setupCalloutUniverse: {
    borderColor: 'rgba(123, 169, 220, 0.3)',
    backgroundColor: 'rgba(8, 26, 48, 0.86)',
  },
  setupCalloutText: {
    fontSize: 12,
    lineHeight: 17,
    color: 'rgba(0, 0, 0, 0.72)',
    fontWeight: '700',
  },
  setupCalloutTextUniverse: {
    color: 'rgba(205, 226, 248, 0.9)',
  },
  setupCalloutButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  setupCalloutButtonUniverse: {
    backgroundColor: 'rgba(27, 86, 146, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(196, 223, 250, 0.65)',
  },
  setupCalloutButtonText: {
    fontSize: 12,
    fontWeight: '900',
    color: 'rgba(0, 0, 0, 0.75)',
  },
  setupCalloutButtonTextUniverse: {
    color: 'rgba(233, 246, 255, 0.95)',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'rgba(0, 0, 0, 0.82)',
    marginBottom: 6,
  },
  sectionTitleUniverse: {
    color: 'rgba(223, 238, 255, 0.94)',
  },
  modelPickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.35)',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  modelPickerTriggerUniverse: {
    borderColor: 'rgba(123, 169, 220, 0.34)',
    backgroundColor: 'rgba(7, 24, 45, 0.9)',
  },
  inputLocked: {
    opacity: 0.5,
  },
  textInput: {
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.5)',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: 'rgba(0, 0, 0, 0.8)',
    backgroundColor: '#fff',
  },
  textInputYellow: {
    borderColor: 'rgba(128, 128, 128, 0.5)',
    backgroundColor: '#fff',
    color: 'rgba(0, 0, 0, 0.8)',
  },
  textInputUniverse: {
    borderColor: 'rgba(123, 169, 220, 0.34)',
    backgroundColor: 'rgba(7, 24, 45, 0.92)',
    color: 'rgba(227, 242, 255, 0.95)',
  },
  multiline: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  modelOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.35)',
    backgroundColor: '#fff',
    gap: 10,
  },
  modelOptionUniverse: {
    borderColor: 'rgba(123, 169, 220, 0.34)',
    backgroundColor: 'rgba(7, 24, 45, 0.9)',
  },
  modelOptionSelected: {
    backgroundColor: AppColors.FABMain,
    borderColor: AppColors.FABMain,
  },
  modelOptionSelectedUniverse: {
    backgroundColor: '#0f7cff',
    borderColor: '#0f7cff',
  },
  modelOptionDisabled: {
    opacity: 0.5,
  },
  modelName: {
    fontSize: 13,
    fontWeight: '800',
    color: 'rgba(0, 0, 0, 0.82)',
  },
  modelNameUniverse: {
    color: 'rgba(224, 240, 255, 0.94)',
  },
  modelNameSelected: {
    color: 'white',
  },
  modelNameDisabled: {
    color: 'rgba(0, 0, 0, 0.5)',
  },
  modelPrice: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(0, 0, 0, 0.55)',
    lineHeight: 14,
  },
  modelPriceUniverse: {
    color: 'rgba(190, 216, 244, 0.84)',
  },
  modelPriceSelected: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  inlineActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
  },
  inlineActionButtonUniverse: {
    backgroundColor: 'rgba(10, 34, 61, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(140, 185, 235, 0.3)',
  },
  inlineActionText: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgba(0, 0, 0, 0.7)',
  },
  inlineActionTextUniverse: {
    color: 'rgba(214, 233, 253, 0.92)',
  },
  historyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  historyToggleUniverse: {
    backgroundColor: 'rgba(7, 24, 45, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(123, 169, 220, 0.3)',
  },
  historyToggleText: {
    fontSize: 14,
    fontWeight: '800',
    color: 'rgba(0, 0, 0, 0.8)',
  },
  historyToggleTextUniverse: {
    color: 'rgba(223, 238, 255, 0.94)',
  },
  historyPanel: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 12,
    gap: 10,
  },
  historyPanelUniverse: {
    borderColor: 'rgba(123, 169, 220, 0.3)',
    backgroundColor: 'rgba(8, 26, 48, 0.86)',
  },
  historyLegend: {
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(0, 0, 0, 0.65)',
  },
  historyLegendUniverse: {
    color: 'rgba(190, 216, 244, 0.84)',
  },
  historyEmptyText: {
    fontSize: 13,
    color: 'rgba(0, 0, 0, 0.6)',
  },
  historyEmptyTextUniverse: {
    color: 'rgba(190, 216, 244, 0.84)',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 4,
    borderRadius: 10,
    paddingHorizontal: 6,
  },
  historyRowBase: {
    backgroundColor: 'rgba(95, 15, 64, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(95, 15, 64, 0.34)',
  },
  historyRowBaseUniverse: {
    backgroundColor: 'rgba(23, 74, 128, 0.35)',
    borderColor: 'rgba(140, 185, 235, 0.45)',
  },
  historyTreePrefix: {
    minWidth: 22,
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(0, 0, 0, 0.45)',
  },
  historyTreePrefixUniverse: {
    color: 'rgba(176, 208, 240, 0.75)',
  },
  historyRowTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgba(0, 0, 0, 0.78)',
  },
  historyRowTitleUniverse: {
    color: 'rgba(224, 240, 255, 0.94)',
  },
  historyRowSubtext: {
    marginTop: 3,
    fontSize: 12,
    color: 'rgba(0, 0, 0, 0.55)',
    lineHeight: 16,
  },
  historyRowSubtextUniverse: {
    color: 'rgba(190, 216, 244, 0.84)',
  },
  historyUseButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
  },
  historyUseButtonUniverse: {
    backgroundColor: 'rgba(10, 34, 61, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(140, 185, 235, 0.3)',
  },
  historyUseButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgba(0, 0, 0, 0.75)',
  },
  historyUseButtonTextUniverse: {
    color: 'rgba(214, 233, 253, 0.92)',
  },
  historyActions: {
    alignItems: 'flex-end',
    gap: 6,
  },
  historyTryButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(95, 15, 64, 0.14)',
  },
  historyTryButtonUniverse: {
    backgroundColor: 'rgba(15, 124, 255, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(129, 183, 246, 0.4)',
  },
  historyTryButtonDisabled: {
    opacity: 0.45,
  },
  historyTryButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: AppColors.FABMain,
  },
  historyTryButtonTextUniverse: {
    color: 'rgba(214, 233, 253, 0.95)',
  },
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  modalContent: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '84%',
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 20,
    padding: 20,
  },
  modalContentUniverse: {
    backgroundColor: 'rgba(7, 20, 38, 0.98)',
    borderWidth: 1,
    borderColor: 'rgba(123, 169, 220, 0.4)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: 'rgba(0, 0, 0, 0.85)',
  },
  modalTitleUniverse: {
    color: 'rgba(225, 239, 255, 0.95)',
  },
  modalSubtitle: {
    marginTop: 6,
    marginBottom: 12,
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(0, 0, 0, 0.6)',
  },
  modalSubtitleUniverse: {
    color: 'rgba(190, 216, 244, 0.84)',
  },
  modelOptionsScroll: {
    maxHeight: 360,
  },
  modelOptionsScrollContent: {
    gap: 8,
    paddingBottom: 6,
  },
  modalCancelButton: {
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
  },
  modalCancelButtonUniverse: {
    backgroundColor: 'rgba(10, 34, 61, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(140, 185, 235, 0.3)',
  },
  modalCancelButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: 'rgba(0, 0, 0, 0.75)',
  },
  modalCancelButtonTextUniverse: {
    color: 'rgba(214, 233, 253, 0.92)',
  },
});
