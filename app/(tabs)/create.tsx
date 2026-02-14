import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert, StatusBar, Modal, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../../src/constants/AppColors';
import { getLiquidGlassTabBarContentPaddingBottom } from '../../src/constants/LiquidGlassTabBarLayout';
import AppThemeBackground from '../../src/components/AppThemeBackground';
import { PromptGenerator, AppStyle, AppCategory, AppGenerationRequest } from '../../src/services/PromptGenerator';
import { GenerationQueueService } from '../../src/services/GenerationQueueService';
import { SecureStorageService } from '../../src/services/SecureStorageService';
import { PromptHistoryService, type PromptHistoryEntry } from '../../src/services/PromptHistoryService';
import { useUISettingsStore } from '../../src/stores/UISettingsStore';
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

const MAX_OUTPUT_TOKEN_PRESETS = [4_000, 8_000, 16_000, 32_000, 64_000] as const;

const TEMPERATURE_PRESETS: Array<{ label: string; value: number }> = [
  { label: 'Focused', value: 0.2 },
  { label: 'Balanced', value: 0.3 },
  { label: 'Creative', value: 0.7 },
];

const styles = {
  minimalist: { name: 'Minimalist', emoji: '🎨' },
  creative: { name: 'Creative', emoji: '🎯' },
  corporate: { name: 'Corporate', emoji: '💼' },
  playful: { name: 'Playful', emoji: '🎪' },
  elegant: { name: 'Elegant', emoji: '✨' },
  modern: { name: 'Modern', emoji: '🚀' },
};

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
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<AppStyle>('modern');
  const [isLoading, setIsLoading] = useState(false);
  const [showPromptHistory, setShowPromptHistory] = useState(false);
  const [promptHistoryEntries, setPromptHistoryEntries] = useState<PromptHistoryEntry[]>([]);
  const [isLoadingPromptHistory, setIsLoadingPromptHistory] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isCheckingApiKey, setIsCheckingApiKey] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [defaultsConfig, setDefaultsConfig] = useState(DEFAULT_CONFIG);
  const [generationModel, setGenerationModel] = useState<string>(DEFAULT_CONFIG.model);
  const [generationMaxTokens, setGenerationMaxTokens] = useState<number>(DEFAULT_CONFIG.maxTokens);
  const [generationTemperature, setGenerationTemperature] = useState<number>(DEFAULT_CONFIG.temperature);

  const scrollContentPaddingBottom = getLiquidGlassTabBarContentPaddingBottom(insets.bottom, 32);

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
      style: selectedStyle,
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
  }, [prompt, selectedStyle, generationModel, effectiveMaxTokens]);

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

  const handleSubmit = async () => {
    log.debug('Starting app generation process');
    
    if (!prompt.trim()) {
      log.warn('Empty prompt provided');
      Alert.alert('Error', 'Please enter an app description');
      return;
    }

    if (!hasApiKey) {
      log.warn('No API key configured');
      Alert.alert(
        'API Key Required',
        'You need to set up your Claude API key to generate apps. Would you like to add one now?',
        [
          { text: 'Add API Key', onPress: () => router.push('/(tabs)/settings') },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
      return;
    }

    const request: AppGenerationRequest = {
      description: prompt.trim(),
      style: selectedStyle,
      platform: 'mobile'
    };
    
    log.debug('Generation request:', request);

    // Validate the request
    const validation = PromptGenerator.validateRequest(request);
    if (!validation.isValid) {
      log.warn('Request validation failed:', validation.errors);
      Alert.alert('Validation Error', validation.errors.join('\n'));
      return;
    }
    
    log.debug('Request validation passed');

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
            style: 'cancel'
          }
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

  const handleTemplateSelect = (template: typeof templates[0]) => {
    setPrompt(template.prompt);
    setSelectedStyle(template.style);
  };

  return (
    <SafeAreaView
      style={[styleSheet.container, isUniverseTheme ? styleSheet.containerUniverse : undefined]}
      edges={[]}
    >
      <StatusBar translucent backgroundColor="transparent" />
      <AppThemeBackground />
      
      {/* Header */}
	      <View style={styleSheet.header}>
	        <TouchableOpacity
	          style={styleSheet.backButton}
	          onPress={() => router.back()}
	        >
	          <Ionicons
              name="arrow-back"
              size={24}
              color={isUniverseTheme ? 'rgba(226, 240, 255, 0.92)' : 'rgba(0, 0, 0, 0.8)'}
            />
	        </TouchableOpacity>
	        <Text style={[styleSheet.headerTitle, isUniverseTheme ? styleSheet.headerTitleUniverse : undefined]}>
            Create New App
          </Text>
          <View style={{ flex: 1 }} />
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
                Describe Your App
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
              placeholder="Describe what kind of app you want to create..."
              placeholderTextColor={isUniverseTheme ? 'rgba(191, 216, 243, 0.66)' : '#999'}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              editable={!isLoading}
            />
          </View>
        </View>

        {/* Style Selection Section */}
        <View style={styleSheet.section}>
          <Text style={[styleSheet.sectionTitle, isUniverseTheme ? styleSheet.sectionTitleUniverse : undefined]}>
            Pick a Design Style
          </Text>
          
          <View style={[styleSheet.card, isUniverseTheme ? styleSheet.cardUniverse : undefined]}>
            <View style={styleSheet.optionsContainer}>
              {Object.entries(styles).map(([key, style]) => (
                <OptionCard
                  key={key}
                  id={key as AppStyle}
                  emoji={style.emoji}
                  name={style.name}
                  isSelected={selectedStyle === key}
                  isUniverseTheme={isUniverseTheme}
                  onSelect={() => setSelectedStyle(key as AppStyle)}
                />
              ))}
            </View>
          </View>
        </View>

	        {/* Generate Button Section */}
	        <View style={styleSheet.section}>
          {!hasApiKey && !isCheckingApiKey && (
            <View style={[styleSheet.warningCard, isUniverseTheme ? styleSheet.warningCardUniverse : undefined]}>
              <Ionicons name="warning" size={20} color="#F59E0B" />
              <Text style={[styleSheet.warningText, isUniverseTheme ? styleSheet.warningTextUniverse : undefined]}>
                You need to set up your Claude API key to generate apps
              </Text>
              <TouchableOpacity 
                style={[styleSheet.settingsButton, isUniverseTheme ? styleSheet.settingsButtonUniverse : undefined]}
                onPress={() => router.push('/(tabs)/settings')}
              >
                <Text style={styleSheet.settingsButtonText}>Go to Settings</Text>
              </TouchableOpacity>
            </View>
          )}
          
	          <TouchableOpacity
	            style={[
	              styleSheet.generateButton,
	              { opacity: (!prompt.trim() || isLoading || !hasApiKey) ? 0.6 : 1 }
	            ]}
	            onPress={handleSubmit}
	            disabled={!prompt.trim() || isLoading || !hasApiKey}
	          >
            {isLoading ? (
              <View style={styleSheet.loadingContainer}>
                <Text style={styleSheet.generateButtonText}>Queuing…</Text>
              </View>
            ) : (
              <View style={styleSheet.buttonContent}>
                <Ionicons name="sparkles" size={20} color="white" />
                <Text style={styleSheet.generateButtonText}>
                  {hasApiKey ? 'Generate App with AI' : 'API Key Required'}
                </Text>
              </View>
            )}
	          </TouchableOpacity>

            {runEstimate && (
              <Text
                style={[
                  styleSheet.costEstimateText,
                  isUniverseTheme ? styleSheet.costEstimateTextUniverse : undefined,
                ]}
              >
                Est. max cost {formatUsd(runEstimate.estimatedMaxCost)} • Input ~{runEstimate.estimatedInputTokens.toLocaleString()} • Output up to {runEstimate.effectiveMaxTokens.toLocaleString()} ({getModelDisplayName(generationModel)})
              </Text>
            )}
	        </View>

        {/* Templates Section */}
        {!isLoading && (
          <View style={styleSheet.section}>
            <Text style={[styleSheet.sectionTitle, isUniverseTheme ? styleSheet.sectionTitleUniverse : undefined]}>
              Quick Templates
            </Text>
            
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
        )}
	      </ScrollView>

        {/* Advanced Settings Modal */}
        <Modal
          visible={showAdvanced}
          transparent={true}
          animationType="slide"
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
                      Done
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={[styleSheet.modalTitle, isUniverseTheme ? styleSheet.modalTitleUniverse : undefined]}>
                    Advanced
                  </Text>
                  <Text style={[styleSheet.modalSubtitle, isUniverseTheme ? styleSheet.modalSubtitleUniverse : undefined]}>
                    Tune model, token budget, and creativity for this run.
                  </Text>

                  <View style={styleSheet.settingGroup}>
                    <Text style={[styleSheet.settingLabel, isUniverseTheme ? styleSheet.settingLabelUniverse : undefined]}>
                      Model
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
                      Max Output Tokens: {effectiveMaxTokens.toLocaleString()}
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
                      Temperature: {effectiveTemperature.toFixed(1)}
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
                      Estimate
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
                        Reset
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styleSheet.modalButton} onPress={closeAdvanced}>
                      <Text style={styleSheet.modalButtonText}>Done</Text>
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
          animationType="slide"
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
                    Previous Prompts
                  </Text>
                  <Text style={[styleSheet.modalSubtitle, isUniverseTheme ? styleSheet.modalSubtitleUniverse : undefined]}>
                    Tap a prompt to load it into the editor.
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
                    Clear
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styleSheet.modalButton} onPress={() => setShowPromptHistory(false)}>
                  <Text style={styleSheet.modalButtonText}>Done</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styleSheet.modelOptionsScroll} contentContainerStyle={styleSheet.modelOptionsScrollContent}>
                {isLoadingPromptHistory ? (
                  <View style={styleSheet.historyEmptyState}>
                    <Text style={[styleSheet.modalSubtitle, isUniverseTheme ? styleSheet.modalSubtitleUniverse : undefined]}>
                      Loading…
                    </Text>
                  </View>
                ) : promptHistoryEntries.length === 0 ? (
                  <View style={styleSheet.historyEmptyState}>
                    <Text style={[styleSheet.modalSubtitle, isUniverseTheme ? styleSheet.modalSubtitleUniverse : undefined]}>
                      No saved prompts yet.
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
                          setSelectedStyle(entry.request.style);
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

	    </SafeAreaView>
	  );
	}

interface OptionCardProps {
  id: string;
  emoji: string;
  name: string;
  isSelected: boolean;
  isUniverseTheme?: boolean;
  onSelect: () => void;
}

function OptionCard({ emoji, name, isSelected, isUniverseTheme = false, onSelect }: OptionCardProps) {
  return (
    <TouchableOpacity
      style={[
        styleSheet.optionCard,
        isUniverseTheme && styleSheet.optionCardUniverse,
        isSelected && styleSheet.optionCardSelected,
        isSelected && isUniverseTheme && styleSheet.optionCardSelectedUniverse,
      ]}
      onPress={onSelect}
    >
      <Text style={styleSheet.optionEmoji}>{emoji}</Text>
      <Text style={[
        styleSheet.optionName,
        isUniverseTheme && styleSheet.optionNameUniverse,
        isSelected && styleSheet.optionNameSelected,
        isSelected && isUniverseTheme && styleSheet.optionNameSelectedUniverse,
      ]}>
        {name}
      </Text>
    </TouchableOpacity>
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
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionCard: {
    width: 80,
    height: 80,
    backgroundColor: '#fff',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.3)',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    margin: 4,
  },
  optionCardUniverse: {
    backgroundColor: 'rgba(10, 30, 54, 0.92)',
    borderColor: 'rgba(128, 174, 224, 0.44)',
  },
  optionCardSelected: {
    backgroundColor: '#FFF3C4',
    borderColor: AppColors.FABMain,
    borderWidth: 2,
    elevation: 6,
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  optionCardSelectedUniverse: {
    backgroundColor: 'rgba(34, 76, 122, 0.86)',
    borderColor: 'rgba(199, 224, 250, 0.78)',
  },
  optionEmoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  optionName: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(0, 0, 0, 0.8)',
    textAlign: 'center',
  },
  optionNameUniverse: {
    color: 'rgba(223, 238, 255, 0.94)',
  },
  optionNameSelected: {
    color: 'rgba(0, 0, 0, 0.8)',
    fontWeight: 'bold',
  },
  optionNameSelectedUniverse: {
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
  templateCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
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
    fontSize: 24,
    marginRight: 12,
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
  costEstimateText: {
    marginTop: 10,
    fontSize: 12,
    color: 'rgba(0, 0, 0, 0.65)',
    textAlign: 'center',
  },
  costEstimateTextUniverse: {
    color: 'rgba(207, 226, 248, 0.92)',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  modalContent: {
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalContentUniverse: {
    backgroundColor: 'rgba(7, 20, 38, 0.98)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(123, 169, 220, 0.4)',
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
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
});
