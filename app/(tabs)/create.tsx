import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert, StatusBar, Modal, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppColors } from '../../src/constants/AppColors';
import { getLiquidGlassTabBarContentPaddingBottom } from '../../src/constants/LiquidGlassTabBarLayout';
import AppThemeBackground from '../../src/components/AppThemeBackground';
import { PromptGenerator, AppStyle, AppCategory, AppGenerationRequest } from '../../src/services/PromptGenerator';
import { GenerationQueueService } from '../../src/services/GenerationQueueService';
import { SecureStorageService } from '../../src/services/SecureStorageService';
import { PromptHistoryService, type PromptHistoryEntry } from '../../src/services/PromptHistoryService';
import { useUISettingsStore } from '../../src/stores/UISettingsStore';
import { useStrings } from '../../src/i18n/strings';
import {
  CLAUDE_MODEL_PICKER_OPTIONS,
  DEFAULT_CONFIG,
  MODEL_INFO,
  PRICING_AS_OF_DISPLAY,
  clampMaxOutputTokens,
  clampTemperature,
  estimateCost,
  estimateTokensFromText,
  formatModelPricingShort,
  getModelMaxOutputTokens,
} from '../../src/types/ClaudeApi';
import { createLogger } from '../../src/utils/Logger';

const log = createLogger('CreateApp');
const RECENT_STYLE_TAGS_STORAGE_KEY = 'create_recent_style_tags_v1';

const MAX_OUTPUT_TOKEN_PRESETS = [4_000, 8_000, 16_000, 32_000, 64_000] as const;

const TEMPERATURE_PRESETS: Array<{ label: string; value: number }> = [
  { label: 'Focused', value: 0.2 },
  { label: 'Balanced', value: 0.3 },
  { label: 'Creative', value: 0.7 },
];

const COMMON_STYLE_TAGS = [
  'modern',
  'minimalist',
  'playful',
  'creative',
  'elegant',
  'corporate',
  'glassmorphism',
  'retro',
  'dark',
  'pastel',
  'bold',
  'neon',
  'clean',
];

const STYLE_TAG_TO_APP_STYLE: Record<string, AppStyle> = {
  minimalist: 'minimalist',
  creative: 'creative',
  corporate: 'corporate',
  playful: 'playful',
  elegant: 'elegant',
  modern: 'modern',
};

function normalizeTag(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, '-');
}

const templates = [
  {
    emoji: '✅',
    name: 'Todo List',
    description: 'Simple task management',
    prompt: 'Create a todo list app with add, delete, and mark complete functionality',
    style: 'minimalist' as AppStyle,
    category: 'productivity' as AppCategory
  },
  {
    emoji: '🎯',
    name: 'Habit Tracker',
    description: 'Track daily habits',
    prompt: 'Create a habit tracker that lets me check off daily habits and shows streaks',
    style: 'modern' as AppStyle,
    category: 'health' as AppCategory
  },
  {
    emoji: '📝',
    name: 'Note Taking',
    description: 'Quick notes and memos',
    prompt: 'Create a simple note-taking app where I can add, edit, and delete notes',
    style: 'minimalist' as AppStyle,
    category: 'productivity' as AppCategory
  },
  {
    emoji: '🧮',
    name: 'Calculator',
    description: 'Basic calculator',
    prompt: 'Create a calculator app with basic arithmetic operations',
    style: 'modern' as AppStyle,
    category: 'utility' as AppCategory
  },
  {
    emoji: '⏰',
    name: 'Timer',
    description: 'Countdown timer',
    prompt: 'Create a countdown timer app with start, pause, and reset functionality',
    style: 'minimalist' as AppStyle,
    category: 'utility' as AppCategory
  }
];

export default function CreatePage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const appTheme = useUISettingsStore((s) => s.appTheme);
  const isUniverseTheme = appTheme === 'universe';
  const { t } = useStrings();
  const [prompt, setPrompt] = useState('');
  const [selectedStyleTags, setSelectedStyleTags] = useState<string[]>(['modern']);
  const [newStyleTag, setNewStyleTag] = useState('');
  const [recentStyleTags, setRecentStyleTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showPromptHistory, setShowPromptHistory] = useState(false);
  const [promptHistoryEntries, setPromptHistoryEntries] = useState<PromptHistoryEntry[]>([]);
  const [isLoadingPromptHistory, setIsLoadingPromptHistory] = useState(false);
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);
  const [pendingCreateRequest, setPendingCreateRequest] = useState<AppGenerationRequest | null>(null);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isCheckingApiKey, setIsCheckingApiKey] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [defaultsConfig, setDefaultsConfig] = useState(DEFAULT_CONFIG);
  const [generationModel, setGenerationModel] = useState<string>(DEFAULT_CONFIG.model);
  const [generationMaxTokens, setGenerationMaxTokens] = useState<number>(DEFAULT_CONFIG.maxTokens);
  const [generationTemperature, setGenerationTemperature] = useState<number>(DEFAULT_CONFIG.temperature);

  const scrollContentPaddingBottom = getLiquidGlassTabBarContentPaddingBottom(insets.bottom, 32);

  const selectedAppStyle: AppStyle = useMemo(() => {
    for (const tag of selectedStyleTags) {
      const mapped = STYLE_TAG_TO_APP_STYLE[tag];
      if (mapped) return mapped;
    }
    return 'modern';
  }, [selectedStyleTags]);

  const persistRecentStyleTags = async (tags: string[]) => {
    const unique = Array.from(new Set(tags.map(normalizeTag).filter(Boolean))).slice(0, 24);
    setRecentStyleTags(unique);
    try {
      await AsyncStorage.setItem(RECENT_STYLE_TAGS_STORAGE_KEY, JSON.stringify(unique));
    } catch (error) {
      log.warn('Failed to persist recent style tags:', error);
    }
  };

  const addStyleTag = async (rawTag: string) => {
    const normalized = normalizeTag(rawTag);
    if (!normalized) return;

    if (!selectedStyleTags.includes(normalized)) {
      const next = [...selectedStyleTags, normalized];
      setSelectedStyleTags(next);
      await persistRecentStyleTags([normalized, ...recentStyleTags]);
    }
  };

  const removeStyleTag = (tag: string) => {
    setSelectedStyleTags((prev) => {
      const next = prev.filter((value) => value !== tag);
      if (next.length === 0) return ['modern'];
      return next;
    });
  };

  const handleAddCustomTag = async () => {
    if (!newStyleTag.trim()) return;
    await addStyleTag(newStyleTag);
    setNewStyleTag('');
  };

  const checkApiKeyStatus = async () => {
    try {
      const [hasKey, config] = await Promise.all([
        SecureStorageService.hasApiKey(),
        SecureStorageService.getConfig(),
      ]);
      setHasApiKey(hasKey);
      setDefaultsConfig(config);
      setGenerationModel(config.model);
      setGenerationMaxTokens(config.maxTokens);
      setGenerationTemperature(config.temperature);
    } catch (error) {
      log.error('Error checking API key status:', error);
      setHasApiKey(false);
    } finally {
      setIsCheckingApiKey(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      checkApiKeyStatus();
    }, [])
  );

  React.useEffect(() => {
    let isMounted = true;
    const loadRecentTags = async () => {
      try {
        const raw = await AsyncStorage.getItem(RECENT_STYLE_TAGS_STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return;
        const normalized = parsed
          .map((value: unknown) => (typeof value === 'string' ? normalizeTag(value) : ''))
          .filter((value: string) => value.length > 0)
          .slice(0, 24);
        if (isMounted) {
          setRecentStyleTags(normalized);
        }
      } catch (error) {
        log.warn('Failed to load recent style tags:', error);
      }
    };
    void loadRecentTags();
    return () => {
      isMounted = false;
    };
  }, []);

  const loadPromptHistory = async () => {
    try {
      setIsLoadingPromptHistory(true);
      const entries = await PromptHistoryService.list(120);
      setPromptHistoryEntries(entries);
    } catch (error) {
      log.warn('Failed to load prompt history:', error);
      setPromptHistoryEntries([]);
    } finally {
      setIsLoadingPromptHistory(false);
    }
  };

  React.useEffect(() => {
    if (!showPromptHistory) return;
    void loadPromptHistory();
  }, [showPromptHistory]);

  const getModelDisplayName = (model: string): string => {
    const modelInfo = MODEL_INFO[model];
    if (!modelInfo) return model;
    if (modelInfo.status === 'deprecated') return `${modelInfo.name} (deprecated)`;
    if (modelInfo.status === 'retired') return `${modelInfo.name} (retired)`;
    return modelInfo.name;
  };

  const formatUsd = (value: number): string => {
    if (!Number.isFinite(value)) return '$—';
    if (value <= 0) return '$0.00';
    if (value < 0.01) return `$${value.toFixed(4)}`;
    if (value < 1) return `$${value.toFixed(3)}`;
    return `$${value.toFixed(2)}`;
  };

  const effectiveMaxTokens = clampMaxOutputTokens(generationModel, generationMaxTokens);
  const effectiveTemperature = clampTemperature(generationTemperature);

  const runEstimate = useMemo(() => {
    const description = prompt.trim();
    if (!description) return null;

    const requestForPrompt: AppGenerationRequest = {
      description,
      style: selectedAppStyle,
      styleTags: selectedStyleTags,
      platform: 'mobile',
    };

    const generatedPrompt = PromptGenerator.generatePrompt(requestForPrompt, {
      maxOutputTokens: effectiveMaxTokens,
    });

    const estimatedInputTokens = estimateTokensFromText(generatedPrompt);
    const estimatedMaxCost = estimateCost(estimatedInputTokens, effectiveMaxTokens, generationModel);

    return {
      estimatedInputTokens,
      effectiveMaxTokens,
      estimatedMaxCost,
    };
  }, [prompt, selectedAppStyle, selectedStyleTags, generationModel, effectiveMaxTokens]);

  const handleAdvancedModelSelect = (modelId: string) => {
    const modelInfo = MODEL_INFO[modelId];
    if (modelInfo?.status === 'retired') return;

    const clampedMaxTokens = clampMaxOutputTokens(modelId, generationMaxTokens);
    setGenerationModel(modelId);
    setGenerationMaxTokens(clampedMaxTokens);
    setShowModelSelector(false);
  };

  const closeAdvanced = () => {
    setShowModelSelector(false);
    setShowAdvanced(false);
  };

  const closeModelSelector = () => {
    setShowModelSelector(false);
  };

  const resetAdvancedToDefaults = () => {
    setGenerationModel(defaultsConfig.model);
    setGenerationMaxTokens(defaultsConfig.maxTokens);
    setGenerationTemperature(defaultsConfig.temperature);
  };

  const buildRequest = (): AppGenerationRequest => ({
    description: prompt.trim(),
    style: selectedAppStyle,
    styleTags: selectedStyleTags,
    platform: 'mobile',
  });

  const queueGeneration = async (request: AppGenerationRequest) => {
    log.debug('Starting app generation process');
    log.debug('Generation request:', request);

    setIsLoading(true);

    try {
      const modelUsed = generationModel;
      const maxTokensUsed = clampMaxOutputTokens(modelUsed, generationMaxTokens);
      const temperatureUsed = clampTemperature(generationTemperature);
      log.info('Using model:', modelUsed);
      log.info('Max output tokens:', maxTokensUsed);
      log.info('Temperature:', temperatureUsed);

      log.debug('Queuing generation job...');
      const job = await GenerationQueueService.enqueue(request, {
        model: modelUsed,
        maxTokens: maxTokensUsed,
        temperature: temperatureUsed,
      });
      log.info('Queued generation job:', { jobId: job.id, appId: job.appId });

      router.push('/(tabs)');
      Alert.alert(
        'Generation queued',
        'Your app is generating. You can navigate around Droplets, but please keep the app open — backgrounding may pause generation. You’ll get a notification when it’s ready.',
        [
          {
            text: 'OK',
          },
          {
            text: 'Create Another',
            onPress: () => router.push('/(tabs)/create'),
            style: 'cancel',
          },
        ]
      );
    } catch (error: any) {
      log.error('App generation error:', error);
      Alert.alert(
        'Generation Failed',
        error.message || 'Failed to generate app. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      log.debug('Generation process completed');
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!prompt.trim()) {
      Alert.alert('Error', t('create.error.emptyPrompt'));
      return;
    }

    if (!hasApiKey) {
      Alert.alert(
        t('create.apiRequired.title'),
        t('create.apiRequired.body'),
        [
          { text: t('create.apiRequired.cta'), onPress: () => router.push('/(tabs)/settings') },
          { text: t('create.actions.cancel'), style: 'cancel' },
        ]
      );
      return;
    }

    const request = buildRequest();
    const validation = PromptGenerator.validateRequest(request);
    if (!validation.isValid) {
      Alert.alert('Validation Error', validation.errors.join('\n'));
      return;
    }

    setPendingCreateRequest(request);
    setShowGenerateConfirm(true);
  };

  const closeGenerateConfirm = () => {
    setShowGenerateConfirm(false);
    setPendingCreateRequest(null);
  };

  const confirmGenerate = () => {
    if (!pendingCreateRequest) {
      closeGenerateConfirm();
      return;
    }
    const request = pendingCreateRequest;
    setShowGenerateConfirm(false);
    setPendingCreateRequest(null);
    void queueGeneration(request);
  };

  const handleTemplateSelect = (template: typeof templates[0]) => {
    setPrompt(template.prompt);
    void addStyleTag(template.style);
  };

  return (
    <SafeAreaView
      style={[styleSheet.container, isUniverseTheme ? styleSheet.containerUniverse : undefined]}
      edges={[]}
    >
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle={isUniverseTheme ? 'light-content' : 'dark-content'}
      />
      <AppThemeBackground />
      
      {/* Header */}
	      <View style={styleSheet.header}>
	        <TouchableOpacity style={styleSheet.backButton} onPress={() => router.back()}>
	          <Ionicons
              name="arrow-back"
              size={24}
              color={isUniverseTheme ? 'rgba(226, 240, 255, 0.92)' : 'rgba(0, 0, 0, 0.8)'}
            />
	        </TouchableOpacity>
	        <Text style={[styleSheet.headerTitle, isUniverseTheme ? styleSheet.headerTitleUniverse : undefined]}>
            {t('create.header')}
          </Text>
          <View style={{ flex: 1 }} />
          <View style={styleSheet.headerRightActions}>
            <TouchableOpacity
              style={[styleSheet.headerIconButton, isUniverseTheme ? styleSheet.headerIconButtonUniverse : undefined]}
              onPress={() => setShowAdvanced(true)}
              accessibilityRole="button"
              accessibilityLabel="Open advanced settings"
            >
              <Ionicons
                name="options-outline"
                size={22}
                color={isUniverseTheme ? 'rgba(226, 240, 255, 0.92)' : 'rgba(0, 0, 0, 0.8)'}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styleSheet.headerCreateButton,
                isUniverseTheme ? styleSheet.headerCreateButtonUniverse : undefined,
                (!prompt.trim() || isLoading || !hasApiKey || isCheckingApiKey)
                  ? styleSheet.headerCreateButtonDisabled
                  : undefined,
              ]}
              onPress={() => void handleSubmit()}
              disabled={!prompt.trim() || isLoading || !hasApiKey || isCheckingApiKey}
            >
              <Ionicons name="sparkles" size={16} color="#fff" />
              <Text style={styleSheet.headerCreateButtonText}>{t('create.actions.create')}</Text>
            </TouchableOpacity>
          </View>
	      </View>

      <ScrollView 
        style={styleSheet.scrollView}
        contentContainerStyle={[styleSheet.scrollContent, { paddingBottom: scrollContentPaddingBottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Input Section */}
        <View style={styleSheet.section}>
          <View style={[styleSheet.card, isUniverseTheme ? styleSheet.cardUniverse : undefined]}>
            <View style={styleSheet.inputHeader}>
              <Text style={[styleSheet.sectionTitle, isUniverseTheme ? styleSheet.sectionTitleUniverse : undefined]}>
                {t('create.describe')}
              </Text>
              <View style={styleSheet.inputHeaderActions}>
                <TouchableOpacity
                  onPress={() => setShowPromptHistory(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Open prompt history"
                  style={[
                    styleSheet.inputHeaderIconButton,
                    isUniverseTheme ? styleSheet.inputHeaderIconButtonUniverseSoft : undefined,
                  ]}
                  disabled={isLoading}
                >
                  <Ionicons
                    name="time-outline"
                    size={20}
                    color={isUniverseTheme ? 'rgba(210, 233, 255, 0.85)' : '#666'}
                  />
                </TouchableOpacity>
                {prompt.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setPrompt('')}
                    accessibilityRole="button"
                    accessibilityLabel="Clear prompt"
                    style={[
                      styleSheet.inputHeaderIconButton,
                      isUniverseTheme ? styleSheet.inputHeaderIconButtonUniverseSoft : undefined,
                    ]}
                    disabled={isLoading}
                  >
                    <Ionicons
                      name="close"
                      size={20}
                      color={isUniverseTheme ? 'rgba(210, 233, 255, 0.85)' : '#666'}
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>
            
            <TextInput
              style={[styleSheet.textInput, isUniverseTheme ? styleSheet.textInputUniverse : undefined]}
              value={prompt}
              onChangeText={setPrompt}
              placeholder={t('create.describe.placeholder')}
              placeholderTextColor={isUniverseTheme ? 'rgba(191, 216, 243, 0.66)' : '#999'}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              editable={!isLoading}
            />

            {runEstimate ? (
              <View style={[styleSheet.inlineEstimateRow, isUniverseTheme ? styleSheet.inlineEstimateRowUniverse : undefined]}>
                <Ionicons
                  name="calculator-outline"
                  size={15}
                  color={isUniverseTheme ? 'rgba(201, 225, 250, 0.9)' : 'rgba(0, 0, 0, 0.65)'}
                />
                <Text
                  style={[
                    styleSheet.inlineEstimateText,
                    isUniverseTheme ? styleSheet.inlineEstimateTextUniverse : undefined,
                  ]}
                >
                  Est. max cost {formatUsd(runEstimate.estimatedMaxCost)} • Input ~
                  {runEstimate.estimatedInputTokens.toLocaleString()} • Output up to{' '}
                  {runEstimate.effectiveMaxTokens.toLocaleString()} ({getModelDisplayName(generationModel)})
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Style Tag Section */}
        <View style={styleSheet.section}>
          <Text style={[styleSheet.sectionTitle, isUniverseTheme ? styleSheet.sectionTitleUniverse : undefined]}>
            {t('create.designTags')}
          </Text>

          <View style={[styleSheet.card, isUniverseTheme ? styleSheet.cardUniverse : undefined]}>
            <View style={styleSheet.selectedTagsWrap}>
              {selectedStyleTags.map((tag) => (
                <View
                  key={tag}
                  style={[styleSheet.selectedTagChip, isUniverseTheme ? styleSheet.selectedTagChipUniverse : undefined]}
                >
                  <Text
                    style={[
                      styleSheet.selectedTagText,
                      isUniverseTheme ? styleSheet.selectedTagTextUniverse : undefined,
                    ]}
                  >
                    {tag}
                  </Text>
                  <TouchableOpacity onPress={() => removeStyleTag(tag)} hitSlop={8}>
                    <Ionicons
                      name="close"
                      size={14}
                      color={isUniverseTheme ? 'rgba(216, 235, 255, 0.9)' : 'rgba(33,33,33,0.8)'}
                    />
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            <View style={styleSheet.tagInputRow}>
              <TextInput
                style={[styleSheet.tagInput, isUniverseTheme ? styleSheet.tagInputUniverse : undefined]}
                value={newStyleTag}
                onChangeText={setNewStyleTag}
                placeholder={t('create.designTags.placeholder')}
                placeholderTextColor={isUniverseTheme ? 'rgba(191, 216, 243, 0.66)' : '#999'}
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={() => void handleAddCustomTag()}
                returnKeyType="done"
              />
              <TouchableOpacity
                style={[styleSheet.addTagButton, isUniverseTheme ? styleSheet.addTagButtonUniverse : undefined]}
                onPress={() => void handleAddCustomTag()}
              >
                <Text style={styleSheet.addTagButtonText}>{t('create.designTags.add')}</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styleSheet.helperText, isUniverseTheme ? styleSheet.helperTextUniverse : undefined]}>
              {t('create.designTags.common')}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styleSheet.tagSuggestionsRow}>
              {COMMON_STYLE_TAGS.map((tag) => {
                const isSelected = selectedStyleTags.includes(tag);
                return (
                  <TouchableOpacity
                    key={tag}
                    style={[
                      styleSheet.suggestionChip,
                      isUniverseTheme ? styleSheet.suggestionChipUniverse : undefined,
                      isSelected ? styleSheet.suggestionChipSelected : undefined,
                      isSelected && isUniverseTheme ? styleSheet.suggestionChipSelectedUniverse : undefined,
                    ]}
                    onPress={() => void addStyleTag(tag)}
                  >
                    <Text
                      style={[
                        styleSheet.suggestionChipText,
                        isUniverseTheme ? styleSheet.suggestionChipTextUniverse : undefined,
                        isSelected ? styleSheet.suggestionChipTextSelected : undefined,
                        isSelected && isUniverseTheme ? styleSheet.suggestionChipTextSelectedUniverse : undefined,
                      ]}
                    >
                      {tag}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {recentStyleTags.length > 0 ? (
              <>
                <Text style={[styleSheet.helperText, isUniverseTheme ? styleSheet.helperTextUniverse : undefined]}>
                  {t('create.designTags.saved')}
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styleSheet.tagSuggestionsRow}
                >
                  {recentStyleTags.map((tag) => (
                    <TouchableOpacity
                      key={`recent-${tag}`}
                      style={[styleSheet.suggestionChip, isUniverseTheme ? styleSheet.suggestionChipUniverse : undefined]}
                      onPress={() => void addStyleTag(tag)}
                    >
                      <Text
                        style={[
                          styleSheet.suggestionChipText,
                          isUniverseTheme ? styleSheet.suggestionChipTextUniverse : undefined,
                        ]}
                      >
                        {tag}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            ) : null}
          </View>
        </View>

        {!hasApiKey && !isCheckingApiKey && (
          <View style={styleSheet.section}>
            <View style={[styleSheet.warningCard, isUniverseTheme ? styleSheet.warningCardUniverse : undefined]}>
              <Ionicons name="warning" size={20} color="#F59E0B" />
              <Text style={[styleSheet.warningText, isUniverseTheme ? styleSheet.warningTextUniverse : undefined]}>
                {t('create.apiRequired.body')}
              </Text>
              <TouchableOpacity
                style={[styleSheet.settingsButton, isUniverseTheme ? styleSheet.settingsButtonUniverse : undefined]}
                onPress={() => router.push('/(tabs)/settings')}
              >
                <Text style={styleSheet.settingsButtonText}>{t('create.apiRequired.cta')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Templates Section */}
        {!isLoading && (
          <View style={styleSheet.section}>
            <Text style={[styleSheet.sectionTitle, isUniverseTheme ? styleSheet.sectionTitleUniverse : undefined]}>
              {t('create.templates')}
            </Text>

            <View style={styleSheet.templatesGrid}>
              {templates.map((template, index) => (
                <TemplateCard
                  key={index}
                  emoji={template.emoji}
                  name={template.name}
                  description={template.description}
                  style={template.style}
                  category={template.category}
                  isUniverseTheme={isUniverseTheme}
                  onSelect={() => handleTemplateSelect(template)}
                />
              ))}
            </View>
          </View>
        )}
	      </ScrollView>

        {/* Advanced Settings Modal */}
        <Modal
          visible={showAdvanced}
          transparent={true}
          animationType="fade"
          onRequestClose={closeAdvanced}
          onDismiss={closeAdvanced}
        >
          <View style={styleSheet.modalOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeAdvanced} />

            <View style={[styleSheet.modalContent, isUniverseTheme ? styleSheet.modalContentUniverse : undefined]}>
              {showModelSelector ? (
                <>
                  <View style={styleSheet.modelPickerHeaderRow}>
                    <TouchableOpacity
                      style={[
                        styleSheet.modelPickerBackButton,
                        isUniverseTheme ? styleSheet.modelPickerBackButtonUniverse : undefined,
                      ]}
                      onPress={closeModelSelector}
                      accessibilityRole="button"
                      accessibilityLabel="Back to advanced settings"
                    >
                      <Ionicons
                        name="chevron-back"
                        size={20}
                        color={isUniverseTheme ? 'rgba(226, 240, 255, 0.92)' : 'rgba(0, 0, 0, 0.8)'}
                      />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <Text style={[styleSheet.modalTitle, isUniverseTheme ? styleSheet.modalTitleUniverse : undefined]}>
                        Select Claude Model
                      </Text>
                      <Text
                        style={[styleSheet.modalSubtitle, isUniverseTheme ? styleSheet.modalSubtitleUniverse : undefined]}
                      >
                        Prices as of {PRICING_AS_OF_DISPLAY} (USD per MTok)
                      </Text>
                    </View>
                  </View>

                  <ScrollView
                    style={styleSheet.modelOptionsScroll}
                    contentContainerStyle={styleSheet.modelOptionsScrollContent}
                    showsVerticalScrollIndicator={false}
                  >
                    {CLAUDE_MODEL_PICKER_OPTIONS.map((modelId) => {
                      const modelInfo = MODEL_INFO[modelId];
                      const isRetired = modelInfo?.status === 'retired';
                      const isSelected = generationModel === modelId;

                      return (
                        <TouchableOpacity
                          key={modelId}
                          style={[
                            styleSheet.modelOption,
                            isUniverseTheme ? styleSheet.modelOptionUniverse : undefined,
                            isRetired && styleSheet.modelOptionDisabled,
                            isSelected && styleSheet.modelOptionSelected,
                            isSelected && isUniverseTheme ? styleSheet.modelOptionSelectedUniverse : undefined,
                          ]}
                          disabled={isRetired}
                          onPress={() => handleAdvancedModelSelect(modelId)}
                        >
                          <View style={styleSheet.modelOptionContent}>
                            <Text style={[
                              styleSheet.modelOptionTitle,
                              isUniverseTheme ? styleSheet.modelOptionTitleUniverse : undefined,
                              isRetired && styleSheet.modelOptionTitleDisabled,
                              isSelected && styleSheet.modelOptionTitleSelected,
                              isSelected && isUniverseTheme ? styleSheet.modelOptionTitleSelectedUniverse : undefined,
                            ]}>
                              {getModelDisplayName(modelId)}
                            </Text>
                            <Text
                              style={[
                                styleSheet.modelOptionPricing,
                                isUniverseTheme ? styleSheet.modelOptionPricingUniverse : undefined,
                              ]}
                            >
                              {formatModelPricingShort(modelId) || 'Pricing unavailable'}
                              {'\n'}
                              Max output: {getModelMaxOutputTokens(modelId).toLocaleString()} tokens
                            </Text>
                          </View>
                          {isSelected && (
                            <Ionicons name="checkmark-circle" size={22} color={AppColors.FABMain} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  <TouchableOpacity
                    style={[styleSheet.modalCancelButton, isUniverseTheme ? styleSheet.modalCancelButtonUniverse : undefined]}
                    onPress={closeModelSelector}
                  >
                    <Text
                      style={[
                        styleSheet.modalCancelButtonText,
                        isUniverseTheme ? styleSheet.modalCancelButtonTextUniverse : undefined,
                      ]}
                    >
                      {t('create.actions.done')}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={[styleSheet.modalTitle, isUniverseTheme ? styleSheet.modalTitleUniverse : undefined]}>
                    {t('create.advanced.title')}
                  </Text>
                  <Text style={[styleSheet.modalSubtitle, isUniverseTheme ? styleSheet.modalSubtitleUniverse : undefined]}>
                    {t('create.advanced.subtitle')}
                  </Text>

                  <View style={styleSheet.settingGroup}>
                    <Text style={[styleSheet.settingLabel, isUniverseTheme ? styleSheet.settingLabelUniverse : undefined]}>
                      {t('create.advanced.model')}
                    </Text>
                    <TouchableOpacity
                      style={[styleSheet.dropdown, isUniverseTheme ? styleSheet.dropdownUniverse : undefined]}
                      onPress={() => setShowModelSelector(true)}
                    >
                      <Text style={[styleSheet.dropdownText, isUniverseTheme ? styleSheet.dropdownTextUniverse : undefined]}>
                        {getModelDisplayName(generationModel)}
                      </Text>
                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color={isUniverseTheme ? 'rgba(196, 222, 250, 0.78)' : '#666'}
                      />
                    </TouchableOpacity>
                    <Text style={[styleSheet.helperText, isUniverseTheme ? styleSheet.helperTextUniverse : undefined]}>
                      {formatModelPricingShort(generationModel) || 'Pricing unavailable'} (as of {PRICING_AS_OF_DISPLAY})
                    </Text>
                  </View>

                  <View style={[styleSheet.separator, isUniverseTheme ? styleSheet.separatorUniverse : undefined]} />

                  <View style={styleSheet.settingGroup}>
                    <Text style={[styleSheet.settingLabel, isUniverseTheme ? styleSheet.settingLabelUniverse : undefined]}>
                      {t('create.advanced.maxTokens')}: {effectiveMaxTokens.toLocaleString()}
                    </Text>
                    <View style={styleSheet.stepperRow}>
                      <TouchableOpacity
                        style={[styleSheet.stepperButton, isUniverseTheme ? styleSheet.stepperButtonUniverse : undefined]}
                        onPress={() => setGenerationMaxTokens((value) => clampMaxOutputTokens(generationModel, value - 1_000))}
                      >
                        <Ionicons
                          name="remove"
                          size={18}
                          color={isUniverseTheme ? 'rgba(226, 240, 255, 0.92)' : 'rgba(0, 0, 0, 0.8)'}
                        />
                      </TouchableOpacity>
                      <Text style={[styleSheet.stepperValue, isUniverseTheme ? styleSheet.stepperValueUniverse : undefined]}>
                        {effectiveMaxTokens.toLocaleString()}
                      </Text>
                      <TouchableOpacity
                        style={[styleSheet.stepperButton, isUniverseTheme ? styleSheet.stepperButtonUniverse : undefined]}
                        onPress={() => setGenerationMaxTokens((value) => clampMaxOutputTokens(generationModel, value + 1_000))}
                      >
                        <Ionicons
                          name="add"
                          size={18}
                          color={isUniverseTheme ? 'rgba(226, 240, 255, 0.92)' : 'rgba(0, 0, 0, 0.8)'}
                        />
                      </TouchableOpacity>
                    </View>
                    <View style={styleSheet.chipRow}>
                      {MAX_OUTPUT_TOKEN_PRESETS.filter((preset) => preset <= getModelMaxOutputTokens(generationModel)).map((preset) => {
                        const isSelected = effectiveMaxTokens === preset;
                        return (
                          <TouchableOpacity
                            key={preset}
                            style={[
                              styleSheet.chip,
                              isUniverseTheme ? styleSheet.chipUniverse : undefined,
                              isSelected && styleSheet.chipSelected,
                              isSelected && isUniverseTheme ? styleSheet.chipSelectedUniverse : undefined,
                            ]}
                            onPress={() => setGenerationMaxTokens(clampMaxOutputTokens(generationModel, preset))}
                          >
                            <Text
                              style={[
                                styleSheet.chipText,
                                isUniverseTheme ? styleSheet.chipTextUniverse : undefined,
                                isSelected && styleSheet.chipTextSelected,
                                isSelected && isUniverseTheme ? styleSheet.chipTextSelectedUniverse : undefined,
                              ]}
                            >
                              {preset >= 1000 ? `${preset / 1000}K` : `${preset}`}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <Text style={[styleSheet.helperText, isUniverseTheme ? styleSheet.helperTextUniverse : undefined]}>
                      Model max: {getModelMaxOutputTokens(generationModel).toLocaleString()} tokens
                    </Text>
                  </View>

                  <View style={[styleSheet.separator, isUniverseTheme ? styleSheet.separatorUniverse : undefined]} />

                  <View style={styleSheet.settingGroup}>
                    <Text style={[styleSheet.settingLabel, isUniverseTheme ? styleSheet.settingLabelUniverse : undefined]}>
                      {t('create.advanced.temperature')}: {effectiveTemperature.toFixed(1)}
                    </Text>
                    <View style={styleSheet.chipRow}>
                      {TEMPERATURE_PRESETS.map((preset) => {
                        const isSelected = Math.abs(effectiveTemperature - preset.value) < 0.0001;
                        return (
                          <TouchableOpacity
                            key={preset.label}
                            style={[
                              styleSheet.chip,
                              isUniverseTheme ? styleSheet.chipUniverse : undefined,
                              isSelected && styleSheet.chipSelected,
                              isSelected && isUniverseTheme ? styleSheet.chipSelectedUniverse : undefined,
                            ]}
                            onPress={() => setGenerationTemperature(preset.value)}
                          >
                            <Text
                              style={[
                                styleSheet.chipText,
                                isUniverseTheme ? styleSheet.chipTextUniverse : undefined,
                                isSelected && styleSheet.chipTextSelected,
                                isSelected && isUniverseTheme ? styleSheet.chipTextSelectedUniverse : undefined,
                              ]}
                            >
                              {preset.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <Text style={[styleSheet.helperText, isUniverseTheme ? styleSheet.helperTextUniverse : undefined]}>
                      Lower = more focused, higher = more creative.
                    </Text>
                  </View>

                  <View style={[styleSheet.separator, isUniverseTheme ? styleSheet.separatorUniverse : undefined]} />

                  <View style={styleSheet.settingGroup}>
                    <Text style={[styleSheet.settingLabel, isUniverseTheme ? styleSheet.settingLabelUniverse : undefined]}>
                      {t('create.advanced.estimate')}
                    </Text>
                    {runEstimate ? (
                      <Text style={[styleSheet.helperText, isUniverseTheme ? styleSheet.helperTextUniverse : undefined]}>
                        Est. max cost {formatUsd(runEstimate.estimatedMaxCost)} • Input ~{runEstimate.estimatedInputTokens.toLocaleString()} • Output up to {runEstimate.effectiveMaxTokens.toLocaleString()}
                      </Text>
                    ) : (
                      <Text style={[styleSheet.helperText, isUniverseTheme ? styleSheet.helperTextUniverse : undefined]}>
                        Enter a prompt to see an estimate.
                      </Text>
                    )}
                  </View>

                  <View style={styleSheet.modalButtonRow}>
                    <TouchableOpacity
                      style={[
                        styleSheet.modalButton,
                        styleSheet.modalButtonSecondary,
                        isUniverseTheme ? styleSheet.modalButtonSecondaryUniverse : undefined,
                      ]}
                      onPress={resetAdvancedToDefaults}
                    >
                      <Text
                        style={[
                          styleSheet.modalButtonText,
                          styleSheet.modalButtonTextSecondary,
                          isUniverseTheme ? styleSheet.modalButtonTextSecondaryUniverse : undefined,
                        ]}
                      >
                        {t('create.actions.reset')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styleSheet.modalButton} onPress={closeAdvanced}>
                      <Text style={styleSheet.modalButtonText}>{t('create.actions.done')}</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>

        {/* Prompt History Modal */}
        <Modal
          visible={showPromptHistory}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowPromptHistory(false)}
          onDismiss={() => setShowPromptHistory(false)}
        >
          <View style={styleSheet.modalOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowPromptHistory(false)} />

            <View
              style={[
                styleSheet.modelPickerContent,
                isUniverseTheme ? styleSheet.modelPickerContentUniverse : undefined,
              ]}
            >
              <View style={styleSheet.historyHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styleSheet.modalTitle, isUniverseTheme ? styleSheet.modalTitleUniverse : undefined]}>
                    {t('create.history.title')}
                  </Text>
                  <Text style={[styleSheet.modalSubtitle, isUniverseTheme ? styleSheet.modalSubtitleUniverse : undefined]}>
                    {t('create.history.subtitle')}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styleSheet.headerIconButton, isUniverseTheme ? styleSheet.headerIconButtonUniverse : undefined]}
                  onPress={() => setShowPromptHistory(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Close prompt history"
                >
                  <Ionicons
                    name="close"
                    size={20}
                    color={isUniverseTheme ? 'rgba(226, 240, 255, 0.92)' : 'rgba(0, 0, 0, 0.8)'}
                  />
                </TouchableOpacity>
              </View>

              <View style={styleSheet.modalButtonRow}>
                <TouchableOpacity
                  style={[
                    styleSheet.modalButton,
                    styleSheet.modalButtonSecondary,
                    isUniverseTheme ? styleSheet.modalButtonSecondaryUniverse : undefined,
                  ]}
                  onPress={() => {
                    Alert.alert(
                      'Clear prompt history',
                      'Delete all saved prompts on this device?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Clear',
                          style: 'destructive',
                          onPress: async () => {
                            await PromptHistoryService.clear();
                            await loadPromptHistory();
                          },
                        },
                      ]
                    );
                  }}
                >
                  <Text
                    style={[
                      styleSheet.modalButtonText,
                      styleSheet.modalButtonTextSecondary,
                      isUniverseTheme ? styleSheet.modalButtonTextSecondaryUniverse : undefined,
                    ]}
                  >
                    {t('create.actions.clear')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styleSheet.modalButton} onPress={() => setShowPromptHistory(false)}>
                  <Text style={styleSheet.modalButtonText}>{t('create.actions.done')}</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styleSheet.modelOptionsScroll} contentContainerStyle={styleSheet.modelOptionsScrollContent}>
                {isLoadingPromptHistory ? (
                  <View style={styleSheet.historyEmptyState}>
                    <Text style={[styleSheet.modalSubtitle, isUniverseTheme ? styleSheet.modalSubtitleUniverse : undefined]}>
                      {t('create.history.loading')}
                    </Text>
                  </View>
                ) : promptHistoryEntries.length === 0 ? (
                  <View style={styleSheet.historyEmptyState}>
                    <Text style={[styleSheet.modalSubtitle, isUniverseTheme ? styleSheet.modalSubtitleUniverse : undefined]}>
                      {t('create.history.empty')}
                    </Text>
                  </View>
                ) : (
                  promptHistoryEntries.map((entry) => {
                    const createdAt = new Date(entry.createdAt);
                    const description = entry.request?.description || '';
                    return (
                      <TouchableOpacity
                        key={entry.id}
                        style={[styleSheet.historyRow, isUniverseTheme ? styleSheet.historyRowUniverse : undefined]}
                        onPress={() => {
                          setPrompt(description);
                          const historyTags =
                            entry.request.styleTags && entry.request.styleTags.length > 0
                              ? entry.request.styleTags
                              : [entry.request.style];
                          const nextTags = historyTags
                            .map((tag) => normalizeTag(tag))
                            .filter((tag) => tag.length > 0);
                          setSelectedStyleTags(nextTags.length > 0 ? nextTags : ['modern']);
                          setShowPromptHistory(false);
                        }}
                      >
                        <View style={styleSheet.historyRowTop}>
                          <Text
                            style={[
                              styleSheet.historyRowStyle,
                              isUniverseTheme ? styleSheet.historyRowStyleUniverse : undefined,
                            ]}
                          >
                            {entry.request.style}
                          </Text>
                          <Text
                            style={[
                              styleSheet.historyRowDate,
                              isUniverseTheme ? styleSheet.historyRowDateUniverse : undefined,
                            ]}
                          >
                            {Number.isFinite(createdAt.getTime()) ? createdAt.toLocaleString() : ''}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styleSheet.historyRowPrompt,
                            isUniverseTheme ? styleSheet.historyRowPromptUniverse : undefined,
                          ]}
                          numberOfLines={3}
                        >
                          {description}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        <Modal
          visible={showGenerateConfirm}
          transparent={true}
          animationType="fade"
          onRequestClose={closeGenerateConfirm}
        >
          <View style={styleSheet.modalOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeGenerateConfirm} />

            <View style={[styleSheet.confirmCard, isUniverseTheme ? styleSheet.confirmCardUniverse : undefined]}>
              <Text style={[styleSheet.modalTitle, isUniverseTheme ? styleSheet.modalTitleUniverse : undefined]}>
                {t('create.confirm.title')}
              </Text>

              <View style={styleSheet.confirmMetrics}>
                <View style={styleSheet.confirmMetricRow}>
                  <Text
                    style={[
                      styleSheet.confirmMetricLabel,
                      isUniverseTheme ? styleSheet.confirmMetricLabelUniverse : undefined,
                    ]}
                  >
                    {t('create.confirm.estimatedCost')}
                  </Text>
                  <Text
                    style={[
                      styleSheet.confirmMetricValue,
                      isUniverseTheme ? styleSheet.confirmMetricValueUniverse : undefined,
                    ]}
                  >
                    {formatUsd(runEstimate?.estimatedMaxCost ?? 0)}
                  </Text>
                </View>

                <View style={styleSheet.confirmMetricRow}>
                  <Text
                    style={[
                      styleSheet.confirmMetricLabel,
                      isUniverseTheme ? styleSheet.confirmMetricLabelUniverse : undefined,
                    ]}
                  >
                    {t('create.confirm.model')}
                  </Text>
                  <Text
                    style={[
                      styleSheet.confirmMetricValue,
                      isUniverseTheme ? styleSheet.confirmMetricValueUniverse : undefined,
                    ]}
                  >
                    {getModelDisplayName(generationModel)}
                  </Text>
                </View>

                <View style={styleSheet.confirmMetricRow}>
                  <Text
                    style={[
                      styleSheet.confirmMetricLabel,
                      isUniverseTheme ? styleSheet.confirmMetricLabelUniverse : undefined,
                    ]}
                  >
                    {t('create.confirm.inputTokens')}
                  </Text>
                  <Text
                    style={[
                      styleSheet.confirmMetricValue,
                      isUniverseTheme ? styleSheet.confirmMetricValueUniverse : undefined,
                    ]}
                  >
                    {(runEstimate?.estimatedInputTokens ?? 0).toLocaleString()}
                  </Text>
                </View>

                <View style={styleSheet.confirmMetricRow}>
                  <Text
                    style={[
                      styleSheet.confirmMetricLabel,
                      isUniverseTheme ? styleSheet.confirmMetricLabelUniverse : undefined,
                    ]}
                  >
                    {t('create.confirm.outputTokens')}
                  </Text>
                  <Text
                    style={[
                      styleSheet.confirmMetricValue,
                      isUniverseTheme ? styleSheet.confirmMetricValueUniverse : undefined,
                    ]}
                  >
                    {effectiveMaxTokens.toLocaleString()}
                  </Text>
                </View>
              </View>

              <Text style={[styleSheet.confirmDisclaimer, isUniverseTheme ? styleSheet.confirmDisclaimerUniverse : undefined]}>
                {t('create.confirm.disclaimer')}
              </Text>

              <View style={styleSheet.modalButtonRow}>
                <TouchableOpacity
                  style={[
                    styleSheet.modalButton,
                    styleSheet.modalButtonSecondary,
                    isUniverseTheme ? styleSheet.modalButtonSecondaryUniverse : undefined,
                  ]}
                  onPress={closeGenerateConfirm}
                >
                  <Text
                    style={[
                      styleSheet.modalButtonText,
                      styleSheet.modalButtonTextSecondary,
                      isUniverseTheme ? styleSheet.modalButtonTextSecondaryUniverse : undefined,
                    ]}
                  >
                    {t('create.actions.cancel')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styleSheet.modalButton} onPress={confirmGenerate}>
                  <Text style={styleSheet.modalButtonText}>{t('create.actions.create')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

	    </SafeAreaView>
	  );
	}

interface TemplateCardProps {
  emoji: string;
  name: string;
  description: string;
  style: AppStyle;
  category: AppCategory;
  isUniverseTheme?: boolean;
  onSelect: () => void;
}

function TemplateCard({ emoji, name, description, isUniverseTheme = false, onSelect }: TemplateCardProps) {
  return (
    <TouchableOpacity
      style={[styleSheet.templateCard, isUniverseTheme ? styleSheet.templateCardUniverse : undefined]}
      onPress={onSelect}
    >
      <Text style={styleSheet.templateEmoji}>{emoji}</Text>
      <View style={styleSheet.templateContent}>
        <Text style={[styleSheet.templateName, isUniverseTheme ? styleSheet.templateNameUniverse : undefined]}>
          {name}
        </Text>
        <Text
          style={[styleSheet.templateDescription, isUniverseTheme ? styleSheet.templateDescriptionUniverse : undefined]}
        >
          {description}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styleSheet = StyleSheet.create({
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
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'rgba(0, 0, 0, 0.8)',
  },
  headerTitleUniverse: {
    color: 'rgba(234, 246, 255, 0.95)',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'rgba(0, 0, 0, 0.8)',
    marginBottom: 12,
  },
  sectionTitleUniverse: {
    color: 'rgba(219, 236, 255, 0.92)',
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardUniverse: {
    backgroundColor: 'rgba(8, 22, 42, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(123, 169, 220, 0.42)',
    shadowOpacity: 0.22,
  },
  headerCreateButton: {
    height: 38,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: AppColors.FABMain,
  },
  headerCreateButtonUniverse: {
    backgroundColor: '#0f7cff',
  },
  headerCreateButtonDisabled: {
    opacity: 0.5,
  },
  headerCreateButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  selectedTagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  selectedTagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 235, 163, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
  },
  selectedTagChipUniverse: {
    backgroundColor: 'rgba(34, 76, 122, 0.86)',
    borderColor: 'rgba(199, 224, 250, 0.78)',
  },
  selectedTagText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(0, 0, 0, 0.85)',
  },
  selectedTagTextUniverse: {
    color: 'rgba(226, 241, 255, 0.95)',
  },
  tagInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  tagInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.35)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: 'rgba(0, 0, 0, 0.85)',
    backgroundColor: '#fff',
  },
  tagInputUniverse: {
    borderColor: 'rgba(125, 171, 222, 0.44)',
    color: 'rgba(227, 242, 255, 0.95)',
    backgroundColor: 'rgba(6, 23, 44, 0.92)',
  },
  inlineEstimateRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: -2,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  inlineEstimateRowUniverse: {
    backgroundColor: 'rgba(8, 33, 58, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(123, 169, 220, 0.3)',
  },
  inlineEstimateText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(0, 0, 0, 0.68)',
  },
  inlineEstimateTextUniverse: {
    color: 'rgba(205, 226, 248, 0.9)',
  },
  addTagButton: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: AppColors.FABMain,
  },
  addTagButtonUniverse: {
    backgroundColor: '#0f7cff',
  },
  addTagButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  tagSuggestionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 10,
    paddingBottom: 4,
  },
  suggestionChip: {
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  suggestionChipUniverse: {
    borderColor: 'rgba(125, 171, 222, 0.4)',
    backgroundColor: 'rgba(7, 28, 52, 0.9)',
  },
  suggestionChipSelected: {
    backgroundColor: 'rgba(95, 15, 64, 0.12)',
    borderColor: 'rgba(0, 0, 0, 0.2)',
  },
  suggestionChipSelectedUniverse: {
    backgroundColor: 'rgba(34, 76, 122, 0.86)',
    borderColor: 'rgba(199, 224, 250, 0.78)',
  },
  suggestionChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgba(0, 0, 0, 0.7)',
  },
  suggestionChipTextUniverse: {
    color: 'rgba(214, 233, 253, 0.9)',
  },
  suggestionChipTextSelected: {
    color: 'rgba(0, 0, 0, 0.9)',
  },
  suggestionChipTextSelectedUniverse: {
    color: '#F2FAFF',
  },
  inputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  inputHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inputHeaderIconButton: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
  },
  inputHeaderIconButtonUniverseSoft: {
    backgroundColor: 'rgba(11, 37, 65, 0.74)',
    borderWidth: 1,
    borderColor: 'rgba(154, 197, 241, 0.36)',
  },
  textInput: {
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.5)',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: 'rgba(0, 0, 0, 0.8)',
    backgroundColor: '#fff',
    minHeight: 120,
    marginBottom: 16,
  },
  textInputUniverse: {
    borderColor: 'rgba(125, 171, 222, 0.44)',
    color: 'rgba(227, 242, 255, 0.95)',
    backgroundColor: 'rgba(6, 23, 44, 0.92)',
  },
  generateButton: {
    backgroundColor: AppColors.FABMain,
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  generateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  warningCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  warningCardUniverse: {
    backgroundColor: 'rgba(78, 49, 11, 0.68)',
    borderColor: 'rgba(240, 180, 76, 0.85)',
  },
  warningText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#92400E',
  },
  warningTextUniverse: {
    color: 'rgba(252, 232, 189, 0.96)',
  },
  settingsButton: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 8,
  },
  settingsButtonUniverse: {
    backgroundColor: '#D97706',
  },
  settingsButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  templatesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  templateCard: {
    width: '48%',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    minHeight: 116,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  templateCardUniverse: {
    backgroundColor: 'rgba(8, 22, 42, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(123, 169, 220, 0.42)',
    shadowOpacity: 0.22,
  },
  templateEmoji: {
    fontSize: 22,
    marginBottom: 8,
  },
  templateContent: {
    flex: 1,
  },
  templateName: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(0, 0, 0, 0.8)',
    marginBottom: 2,
  },
  templateNameUniverse: {
    color: 'rgba(225, 239, 255, 0.95)',
  },
  templateDescription: {
    fontSize: 12,
    color: 'rgba(0, 0, 0, 0.6)',
  },
  templateDescriptionUniverse: {
    color: 'rgba(190, 216, 244, 0.86)',
  },
  headerIconButton: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },
  headerIconButtonUniverse: {
    backgroundColor: 'rgba(12, 37, 65, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(155, 196, 239, 0.34)',
  },
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  modalContent: {
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 560,
    maxHeight: '88%',
  },
  modalContentUniverse: {
    backgroundColor: 'rgba(7, 20, 38, 0.98)',
    borderWidth: 1,
    borderColor: 'rgba(123, 169, 220, 0.4)',
  },
  modelPickerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modelPickerBackButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  modelPickerBackButtonUniverse: {
    backgroundColor: 'rgba(8, 33, 58, 0.95)',
    borderColor: 'rgba(123, 169, 220, 0.35)',
  },
  modelPickerContent: {
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 560,
    maxHeight: '88%',
  },
  modelPickerContentUniverse: {
    backgroundColor: 'rgba(7, 20, 38, 0.98)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(123, 169, 220, 0.4)',
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
    fontSize: 12,
    color: 'rgba(0, 0, 0, 0.6)',
    lineHeight: 16,
  },
  modalSubtitleUniverse: {
    color: 'rgba(190, 216, 244, 0.84)',
  },
  settingGroup: {
    marginTop: 16,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(0, 0, 0, 0.8)',
    marginBottom: 8,
  },
  settingLabelUniverse: {
    color: 'rgba(223, 238, 255, 0.94)',
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.35)',
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  dropdownUniverse: {
    borderColor: 'rgba(125, 171, 222, 0.44)',
    backgroundColor: 'rgba(6, 23, 44, 0.92)',
  },
  dropdownText: {
    fontSize: 14,
    color: 'rgba(0, 0, 0, 0.85)',
    fontWeight: '700',
  },
  dropdownTextUniverse: {
    color: 'rgba(224, 240, 255, 0.94)',
  },
  helperText: {
    fontSize: 12,
    color: 'rgba(0, 0, 0, 0.6)',
    marginTop: 6,
    lineHeight: 16,
  },
  helperTextUniverse: {
    color: 'rgba(190, 216, 244, 0.84)',
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    marginTop: 16,
  },
  separatorUniverse: {
    backgroundColor: 'rgba(123, 169, 220, 0.28)',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  stepperButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  stepperButtonUniverse: {
    backgroundColor: 'rgba(8, 33, 58, 0.95)',
    borderColor: 'rgba(123, 169, 220, 0.35)',
  },
  stepperValue: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
    color: 'rgba(0, 0, 0, 0.85)',
  },
  stepperValueUniverse: {
    color: 'rgba(224, 240, 255, 0.94)',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  chipUniverse: {
    borderColor: 'rgba(125, 171, 222, 0.4)',
    backgroundColor: 'rgba(7, 28, 52, 0.9)',
  },
  chipSelected: {
    backgroundColor: 'rgba(95, 15, 64, 0.12)',
    borderColor: 'rgba(0, 0, 0, 0.2)',
  },
  chipSelectedUniverse: {
    backgroundColor: 'rgba(34, 76, 122, 0.86)',
    borderColor: 'rgba(199, 224, 250, 0.78)',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgba(0, 0, 0, 0.65)',
  },
  chipTextUniverse: {
    color: 'rgba(214, 233, 253, 0.9)',
  },
  chipTextSelected: {
    color: 'rgba(0, 0, 0, 0.9)',
  },
  chipTextSelectedUniverse: {
    color: '#F2FAFF',
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: AppColors.FABMain,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonSecondary: {
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
  },
  modalButtonSecondaryUniverse: {
    backgroundColor: 'rgba(8, 33, 58, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(123, 169, 220, 0.35)',
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: 'white',
  },
  modalButtonTextSecondary: {
    color: 'rgba(0, 0, 0, 0.85)',
  },
  modalButtonTextSecondaryUniverse: {
    color: 'rgba(214, 233, 253, 0.92)',
  },
  modelOptionsScroll: {
    marginTop: 14,
  },
  modelOptionsScrollContent: {
    paddingBottom: 10,
  },
  historyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  historyEmptyState: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  historyRow: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
  },
  historyRowUniverse: {
    backgroundColor: 'rgba(9, 28, 52, 0.9)',
    borderColor: 'rgba(123, 169, 220, 0.32)',
  },
  historyRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  historyRowStyle: {
    fontSize: 12,
    fontWeight: '900',
    color: 'rgba(0, 0, 0, 0.75)',
    textTransform: 'capitalize',
  },
  historyRowStyleUniverse: {
    color: 'rgba(225, 239, 255, 0.95)',
  },
  historyRowDate: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(0, 0, 0, 0.5)',
  },
  historyRowDateUniverse: {
    color: 'rgba(190, 216, 244, 0.8)',
  },
  historyRowPrompt: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(0, 0, 0, 0.8)',
    lineHeight: 18,
  },
  historyRowPromptUniverse: {
    color: 'rgba(214, 233, 253, 0.9)',
  },
  modelOption: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modelOptionUniverse: {
    backgroundColor: 'rgba(9, 28, 52, 0.9)',
    borderColor: 'rgba(123, 169, 220, 0.32)',
  },
  modelOptionDisabled: {
    opacity: 0.45,
  },
  modelOptionSelected: {
    borderColor: AppColors.FABMain,
    backgroundColor: 'rgba(255, 243, 196, 0.7)',
  },
  modelOptionSelectedUniverse: {
    borderColor: 'rgba(199, 224, 250, 0.78)',
    backgroundColor: 'rgba(34, 76, 122, 0.86)',
  },
  modelOptionContent: {
    flex: 1,
    paddingRight: 12,
  },
  modelOptionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: 'rgba(0, 0, 0, 0.85)',
    marginBottom: 4,
  },
  modelOptionTitleUniverse: {
    color: 'rgba(225, 239, 255, 0.95)',
  },
  modelOptionTitleDisabled: {
    color: 'rgba(0, 0, 0, 0.5)',
  },
  modelOptionTitleSelected: {
    color: 'rgba(0, 0, 0, 0.9)',
  },
  modelOptionTitleSelectedUniverse: {
    color: '#F2FAFF',
  },
  modelOptionPricing: {
    fontSize: 12,
    color: 'rgba(0, 0, 0, 0.6)',
    lineHeight: 16,
  },
  modelOptionPricingUniverse: {
    color: 'rgba(190, 216, 244, 0.84)',
  },
  modalCancelButton: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelButtonUniverse: {
    backgroundColor: 'rgba(8, 33, 58, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(123, 169, 220, 0.35)',
  },
  modalCancelButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: 'rgba(0, 0, 0, 0.75)',
  },
  modalCancelButtonTextUniverse: {
    color: 'rgba(214, 233, 253, 0.92)',
  },
  confirmCard: {
    width: '100%',
    maxWidth: 560,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.98)',
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  confirmCardUniverse: {
    backgroundColor: 'rgba(7, 20, 38, 0.98)',
    borderColor: 'rgba(123, 169, 220, 0.4)',
  },
  confirmMetrics: {
    marginTop: 12,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    gap: 8,
  },
  confirmMetricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  confirmMetricLabel: {
    fontSize: 12,
    color: 'rgba(0, 0, 0, 0.64)',
    fontWeight: '700',
  },
  confirmMetricLabelUniverse: {
    color: 'rgba(190, 216, 244, 0.84)',
  },
  confirmMetricValue: {
    fontSize: 13,
    fontWeight: '800',
    color: 'rgba(0, 0, 0, 0.86)',
  },
  confirmMetricValueUniverse: {
    color: 'rgba(226, 240, 255, 0.96)',
  },
  confirmDisclaimer: {
    marginTop: 12,
    fontSize: 12,
    lineHeight: 17,
    color: 'rgba(0, 0, 0, 0.62)',
  },
  confirmDisclaimerUniverse: {
    color: 'rgba(199, 224, 250, 0.84)',
  },
});
