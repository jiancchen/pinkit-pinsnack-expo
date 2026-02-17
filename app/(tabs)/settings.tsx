import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Alert, Modal, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../../src/constants/AppColors';
import { getLiquidGlassTabBarContentPaddingBottom } from '../../src/constants/LiquidGlassTabBarLayout';
import AppThemeBackground from '../../src/components/AppThemeBackground';
import { SecureStorageService } from '../../src/services/SecureStorageService';
import { ClaudeApiService } from '../../src/services/ClaudeApiService';
import { SeedService } from '../../src/services/SeedService';
import { AppStorageService } from '../../src/services/AppStorageService';
import { PromptHistoryService } from '../../src/services/PromptHistoryService';
import { ScreenshotService } from '../../src/services/ScreenshotService';
import { WebViewScreenshotService } from '../../src/services/WebViewScreenshotService';
import { useScreenshotStore } from '../../src/stores/ScreenshotStore';
import {
  CLAUDE_MODELS,
  CLAUDE_MODEL_PICKER_OPTIONS,
  DEFAULT_CONFIG,
  clampMaxOutputTokens,
  formatModelPricingFull,
  formatModelPricingShort,
  getModelMaxOutputTokens,
  MODEL_INFO,
  PRICING_AS_OF_DISPLAY
} from '../../src/types/ClaudeApi';
import { createLogger } from '../../src/utils/Logger';
import { AppTheme, TabBarVariant, useUISettingsStore } from '../../src/stores/UISettingsStore';
import { useStrings } from '../../src/i18n/strings';

const log = createLogger('Settings');

const MAX_OUTPUT_TOKEN_PRESETS = [4_000, 8_000, 16_000, 32_000, 64_000] as const;

const TEMPERATURE_PRESETS: Array<{ label: string; value: number; helper: string }> = [
  { label: 'Focused', value: 0.2, helper: 'More deterministic' },
  { label: 'Balanced', value: 0.3, helper: 'Good default' },
  { label: 'Creative', value: 0.7, helper: 'More variety' },
];

const TAB_BAR_TINT_OPTIONS: Array<{ label: string; color: string }> = [
  { label: 'Purple', color: '#7C3AED' },
  { label: 'Blue', color: '#2563EB' },
  { label: 'Teal', color: '#14B8A6' },
  { label: 'Green', color: '#22C55E' },
  { label: 'Orange', color: '#F97316' },
  { label: 'Pink', color: '#EC4899' },
];

export default function SettingsPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [temperature, setTemperature] = useState(0.3);
  const [maxTokens, setMaxTokens] = useState(DEFAULT_CONFIG.maxTokens);
  const [selectedModel, setSelectedModel] = useState<string>(CLAUDE_MODELS.HAIKU_4_5);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isLoadingApiKey, setIsLoadingApiKey] = useState(true);
  const [sampleAppsCount, setSampleAppsCount] = useState(0);
  const [isManagingSampleApps, setIsManagingSampleApps] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showDebugMenu, setShowDebugMenu] = useState(false);
  const [showManageApps, setShowManageApps] = useState(false);
  const [manageApps, setManageApps] = useState<Array<{ id: string; title: string; status?: string; sizeKB: number }> | null>(null);
  const [isLoadingManageApps, setIsLoadingManageApps] = useState(false);

  const tabBarVariant = useUISettingsStore((s) => s.tabBar.variant);
  const tabBarTintColor = useUISettingsStore((s) => s.tabBar.tintColor);
  const tabBarBlurIntensity = useUISettingsStore((s) => s.tabBar.blurIntensity);
  const appTheme = useUISettingsStore((s) => s.appTheme);
  const appLanguage = useUISettingsStore((s) => s.appLanguage);
  const debugAllowWithoutApiKey = useUISettingsStore((s) => s.debugAllowWithoutApiKey);
  const isUniverseTheme = appTheme === 'universe';
  const { t } = useStrings();
  const setAppTheme = useUISettingsStore((s) => s.setAppTheme);
  const setAppLanguage = useUISettingsStore((s) => s.setAppLanguage);
  const setTabBarVariant = useUISettingsStore((s) => s.setTabBarVariant);
  const setTabBarTintColor = useUISettingsStore((s) => s.setTabBarTintColor);
  const setTabBarBlurIntensity = useUISettingsStore((s) => s.setTabBarBlurIntensity);
  const setDebugAllowWithoutApiKey = useUISettingsStore((s) => s.setDebugAllowWithoutApiKey);
  const hasApiAccess = hasApiKey || debugAllowWithoutApiKey;
  const modelSettingsLocked = !hasApiAccess;

  const scrollContentPaddingBottom = getLiquidGlassTabBarContentPaddingBottom(insets.bottom, 32);

  useEffect(() => {
    checkApiKeyStatus();
    loadClaudeConfig();
    loadSampleAppsCount();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      // When returning from /welcome (or other screens), refresh state.
      checkApiKeyStatus();
      loadClaudeConfig();
      loadSampleAppsCount();
    }, [])
  );

  const checkApiKeyStatus = async () => {
    try {
      const hasKey = await SecureStorageService.hasApiKey();
      setHasApiKey(hasKey);
    } catch (error) {
      log.error('Error checking API key status:', error);
    } finally {
      setIsLoadingApiKey(false);
    }
  };

  const loadClaudeConfig = async () => {
    try {
      const config = await SecureStorageService.getConfig();
      setSelectedModel(config.model);
      setMaxTokens(config.maxTokens);
      setTemperature(config.temperature);
    } catch (error) {
      log.error('Error loading Claude config:', error);
    }
  };

  const loadSampleAppsCount = async () => {
    try {
      const allApps = await AppStorageService.getAllApps();
      const sampleApps = allApps.filter(app => SeedService.isSampleApp(app));
      setSampleAppsCount(sampleApps.length);
    } catch (error) {
      log.error('Error loading sample apps count:', error);
    }
  };

  const formatSize = (kb: number): string => {
    if (!Number.isFinite(kb) || kb <= 0) return '0 KB';
    if (kb < 1024) return `${kb.toLocaleString()} KB`;
    const mb = kb / 1024;
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    const gb = mb / 1024;
    return `${gb.toFixed(2)} GB`;
  };

  const loadManageApps = async () => {
    try {
      setIsLoadingManageApps(true);
      const apps = await AppStorageService.getAllApps();
      const normalized = apps.map((app) => {
        const sizeChars =
          (app.html?.length || 0) +
          (app.prompt?.length || 0) +
          (app.generatedPrompt?.length || 0) +
          (app.title?.length || 0) +
          (app.description?.length || 0);
        return {
          id: app.id,
          title: app.title,
          status: app.status,
          sizeKB: Math.max(1, Math.round(sizeChars / 1024)),
        };
      });
      normalized.sort((a, b) => b.sizeKB - a.sizeKB);
      setManageApps(normalized);
    } catch (error) {
      log.error('Error loading apps list:', error);
      setManageApps([]);
    } finally {
      setIsLoadingManageApps(false);
    }
  };

  const deleteAppAndAssets = async (appId: string): Promise<void> => {
    await AppStorageService.deleteApp(appId);
    await Promise.all([
      ScreenshotService.deleteScreenshot(appId),
      WebViewScreenshotService.deleteWebViewScreenshot(appId),
    ]);
    try {
      useScreenshotStore.getState().removeScreenshot(appId);
    } catch {
      // ignore
    }
  };

  const handleClearAllApps = () => {
    Alert.alert(
      'Clear all apps',
      'Delete all saved apps on this device? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              const apps = await AppStorageService.getAllApps();
              await Promise.all(
                apps.map((app) =>
                  Promise.all([
                    ScreenshotService.deleteScreenshot(app.id),
                    WebViewScreenshotService.deleteWebViewScreenshot(app.id),
                  ])
                )
              );
              await AppStorageService.clearAllApps();
              try {
                useScreenshotStore.getState().clearAllScreenshots();
              } catch {
                // ignore
              }
              await loadSampleAppsCount();
              setManageApps(null);
              Alert.alert('Success', 'All apps cleared.');
            } catch (error) {
              log.error('Error clearing apps:', error);
              Alert.alert('Error', 'Failed to clear apps.');
            }
          },
        },
      ]
    );
  };

  const handleClearPromptHistory = () => {
    Alert.alert(
      'Clear prompt history',
      'Delete all saved prompts on this device? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await PromptHistoryService.clear();
              Alert.alert('Success', 'Prompt history cleared.');
            } catch (error) {
              log.error('Error clearing prompt history:', error);
              Alert.alert('Error', 'Failed to clear prompt history.');
            }
          },
        },
      ]
    );
  };

  const handleRemoveSampleApps = async () => {
    Alert.alert(
      'Remove Sample Apps',
      'Are you sure you want to remove all sample apps? They will be restored when you restart the app.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setIsManagingSampleApps(true);
            try {
              await SeedService.removeSampleApps();
              await loadSampleAppsCount();
              Alert.alert('Success', 'Sample apps have been removed.');
            } catch (error) {
              log.error('Error removing sample apps:', error);
              Alert.alert('Error', 'Failed to remove sample apps.');
            } finally {
              setIsManagingSampleApps(false);
            }
          },
        },
      ]
    );
  };

  const handleRestoreSampleApps = async () => {
    Alert.alert(
      'Restore Sample Apps',
      'This will restore all sample apps to their original state.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Restore',
          onPress: async () => {
            setIsManagingSampleApps(true);
            try {
              await SeedService.reseedSampleApps();
              await loadSampleAppsCount();
              Alert.alert('Success', 'Sample apps have been restored.');
            } catch (error) {
              log.error('Error restoring sample apps:', error);
              Alert.alert('Error', 'Failed to restore sample apps.');
            } finally {
              setIsManagingSampleApps(false);
            }
          },
        },
      ]
    );
  };

  const handleApiKeySettings = () => {
    if (hasApiKey) {
      Alert.alert(
        'API Key Settings',
        'You have a Claude API key configured. What would you like to do?',
        [
          { text: 'Test Connection', onPress: testApiConnection },
          { text: 'Remove API Key', onPress: removeApiKey, style: 'destructive' },
          { text: 'Update API Key', onPress: () => router.push('/welcome') },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } else {
      router.push('/welcome');
    }
  };

  const testApiConnection = async () => {
    try {
      const claudeService = ClaudeApiService.getInstance();
      await claudeService.initialize();
      const result = await claudeService.testConnection();
      
      Alert.alert(
        result.success ? 'Connection Successful' : 'Connection Failed',
        result.message,
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      Alert.alert('Test Failed', error.message || 'Failed to test API connection');
    }
  };

  const removeApiKey = async () => {
    try {
      await SecureStorageService.removeApiKey();
      setHasApiKey(false);
      Alert.alert('Success', 'API key has been removed.');
    } catch (error: any) {
      Alert.alert('Error', 'Failed to remove API key.');
    }
  };

  const handleDebugMode = () => {
    setShowDebugMenu(true);
  };

  const handleViewTutorial = () => {
    setShowDebugMenu(false);
    router.push('/welcome');
  };

  const handleRuntimeLogs = () => {
    router.push('/runtime-logs');
  };

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

  const handlePrivacyPolicy = () => {
    Alert.alert('Privacy Policy', 'Learn how we protect your data', [{ text: 'OK' }]);
  };

  const handleTermsOfService = () => {
    Alert.alert('Terms of Service', 'Read our terms and conditions', [{ text: 'OK' }]);
  };

  const persistClaudeDefaults = async (
    nextConfig: { model: string; maxTokens: number; temperature: number }
  ): Promise<boolean> => {
    try {
      const apiKey = await SecureStorageService.getApiKey();
      if (apiKey) {
        const claudeService = ClaudeApiService.getInstance();
        await claudeService.updateConfig(apiKey, nextConfig);
      } else {
        await SecureStorageService.storeConfig(nextConfig);
      }
      return true;
    } catch (error) {
      log.error('Error updating Claude defaults:', error);
      Alert.alert('Error', 'Failed to update Claude settings');
      return false;
    }
  };

  const selectTabBarVariant = (variant: TabBarVariant) => {
    setTabBarVariant(variant);
  };

  const selectAppTheme = (theme: AppTheme) => {
    setAppTheme(theme);
  };

  const themedSettingLabelStyle = isUniverseTheme ? styles.settingLabelUniverse : undefined;
  const themedHelperTextStyle = isUniverseTheme ? styles.helperTextUniverse : undefined;
  const themedDropdownStyle = isUniverseTheme ? styles.dropdownUniverse : undefined;
  const themedDropdownTextStyle = isUniverseTheme ? styles.dropdownTextUniverse : undefined;
  const themedSegmentedControlStyle = isUniverseTheme ? styles.segmentedControlUniverse : undefined;

  const getSegmentButtonStyle = (isSelected: boolean) => [
    styles.segmentButton,
    isUniverseTheme ? styles.segmentButtonUniverse : undefined,
    isSelected ? styles.segmentButtonSelected : undefined,
    isSelected && isUniverseTheme ? styles.segmentButtonSelectedUniverse : undefined,
  ];

  const getSegmentButtonTextStyle = (isSelected: boolean) => [
    styles.segmentButtonText,
    isUniverseTheme ? styles.segmentButtonTextUniverse : undefined,
    isSelected ? styles.segmentButtonTextSelected : undefined,
    isSelected && isUniverseTheme ? styles.segmentButtonTextSelectedUniverse : undefined,
  ];

  const getChipStyle = (isSelected: boolean) => [
    styles.chip,
    isUniverseTheme ? styles.chipUniverse : undefined,
    isSelected ? styles.chipSelected : undefined,
    isSelected && isUniverseTheme ? styles.chipSelectedUniverse : undefined,
  ];

  const getChipTextStyle = (isSelected: boolean) => [
    styles.chipText,
    isUniverseTheme ? styles.chipTextUniverse : undefined,
    isSelected ? styles.chipTextSelected : undefined,
    isSelected && isUniverseTheme ? styles.chipTextSelectedUniverse : undefined,
  ];

  const getModelDisplayName = (model: string): string => {
    const modelInfo = MODEL_INFO[model];
    if (!modelInfo) return model;
    if (modelInfo.status === 'deprecated') return `${modelInfo.name} (deprecated)`;
    if (modelInfo.status === 'retired') return `${modelInfo.name} (retired)`;
    return modelInfo.name;
  };

  const handleModelSelect = async (model: string) => {
    try {
      if (modelSettingsLocked) {
        promptApiSetup('Model settings');
        return;
      }

      const modelInfo = MODEL_INFO[model];
      if (modelInfo?.status === 'retired') {
        Alert.alert(
          'Model Retired',
          `${modelInfo.name} was retired on ${modelInfo.retiresOn || 'an earlier date'} and can no longer be used. Please select a different model.`
        );
        return;
      }

      const clampedMaxTokens = clampMaxOutputTokens(model, maxTokens);

      setSelectedModel(model);
      setMaxTokens(clampedMaxTokens);
      setShowModelSelector(false);
      
      const ok = await persistClaudeDefaults({ model, maxTokens: clampedMaxTokens, temperature });
      if (ok) {
        Alert.alert('Success', `Model updated to ${getModelDisplayName(model)}`);
      }
    } catch (error) {
      log.error('Error updating model:', error);
      Alert.alert('Error', 'Failed to update model');
    }
  };

  const handleMaxTokensSelect = async (requestedMaxTokens: number) => {
    if (modelSettingsLocked) {
      promptApiSetup('Model settings');
      return;
    }

    const clampedMaxTokens = clampMaxOutputTokens(selectedModel, requestedMaxTokens);
    setMaxTokens(clampedMaxTokens);
    await persistClaudeDefaults({ model: selectedModel, maxTokens: clampedMaxTokens, temperature });
  };

  const handleTemperatureSelect = async (nextTemperature: number) => {
    if (modelSettingsLocked) {
      promptApiSetup('Model settings');
      return;
    }

    setTemperature(nextTemperature);
    await persistClaudeDefaults({ model: selectedModel, maxTokens, temperature: nextTemperature });
  };

  return (
    <SafeAreaView style={[styles.container, isUniverseTheme ? styles.containerUniverse : undefined]} edges={[]}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle={isUniverseTheme ? 'light-content' : 'dark-content'}
      />
      <AppThemeBackground />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, isUniverseTheme ? styles.headerTitleUniverse : undefined]}>
          Settings
        </Text>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollContentPaddingBottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* API Configuration Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isUniverseTheme ? styles.sectionTitleUniverse : undefined]}>
            API Configuration
          </Text>
          
          <SettingsCard>
            <SettingsItem
              title={hasApiKey ? "Claude API Key (Configured)" : "Setup Claude API Key"}
              description={hasApiKey ? "Test, update, or remove your API key" : "Add your API key to generate apps with AI"}
              onPress={handleApiKeySettings}
              icon={hasApiKey ? "checkmark-circle" : "key-outline"}
              statusColor={hasApiKey ? "#10B981" : "#F59E0B"}
            />
            
            <View style={styles.separator} />
            
            <SettingsItem
              title="Debug Mode"
              description="Enable debugging features"
              onPress={handleDebugMode}
            />

            <View style={styles.separator} />

            <SettingsItem
              title="Runtime Logs"
              description="View crash/error logs saved on this device"
              onPress={handleRuntimeLogs}
              icon="bug-outline"
            />
          </SettingsCard>
        </View>

        {/* Claude Model Configuration Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isUniverseTheme ? styles.sectionTitleUniverse : undefined]}>
            Claude Model Settings
          </Text>
          
          <SettingsCard>
            {modelSettingsLocked ? (
              <View style={[styles.lockedCallout, isUniverseTheme ? styles.lockedCalloutUniverse : undefined]}>
                <Ionicons name="lock-closed-outline" size={18} color={isUniverseTheme ? 'rgba(208, 231, 255, 0.92)' : '#0f172a'} />
                <Text style={[styles.lockedCalloutText, isUniverseTheme ? styles.lockedCalloutTextUniverse : undefined]}>
                  Set up your API key to enable model selection, token limits, and temperature controls.
                </Text>
                <TouchableOpacity
                  style={[styles.lockedCalloutButton, isUniverseTheme ? styles.lockedCalloutButtonUniverse : undefined]}
                  onPress={() => router.push('/welcome')}
                >
                  <Text
                    style={[
                      styles.lockedCalloutButtonText,
                      isUniverseTheme ? styles.lockedCalloutButtonTextUniverse : undefined,
                    ]}
                  >
                    Open Setup
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <View style={styles.settingGroup}>
              <Text style={[styles.settingLabel, themedSettingLabelStyle]}>Model</Text>
              <TouchableOpacity 
                style={[
                  styles.dropdown,
                  themedDropdownStyle,
                  modelSettingsLocked ? styles.inputLocked : undefined,
                ]}
                onPress={() => {
                  if (modelSettingsLocked) {
                    promptApiSetup('Model settings');
                    return;
                  }
                  setShowModelSelector(true);
                }}
              >
                <Text style={[styles.dropdownText, themedDropdownTextStyle]}>{getModelDisplayName(selectedModel)}</Text>
                <Ionicons
                  name="chevron-down"
                  size={20}
                  color={isUniverseTheme ? 'rgba(196, 222, 250, 0.78)' : '#666'}
                />
              </TouchableOpacity>
              <Text style={[styles.helperText, themedHelperTextStyle]}>
                Current model: {getModelDisplayName(selectedModel)}
                {'\n'}
                {formatModelPricingShort(selectedModel) || 'Pricing unavailable'} (as of {PRICING_AS_OF_DISPLAY})
              </Text>
            </View>

            <View style={styles.separator} />

            <View style={styles.settingGroup}>
              <Text style={[styles.settingLabel, themedSettingLabelStyle]}>
                Max Output Tokens: {maxTokens.toLocaleString()}
              </Text>
              <View style={styles.chipRow}>
                {MAX_OUTPUT_TOKEN_PRESETS.filter((preset) => preset <= getModelMaxOutputTokens(selectedModel)).map((preset) => {
                  const isSelected = maxTokens === preset;
                  return (
                    <TouchableOpacity
                      key={preset}
                      style={[
                        ...getChipStyle(isSelected),
                        modelSettingsLocked ? styles.inputLocked : undefined,
                      ]}
                      onPress={() => {
                        if (modelSettingsLocked) {
                          promptApiSetup('Model settings');
                          return;
                        }
                        void handleMaxTokensSelect(preset);
                      }}
                    >
                      <Text style={getChipTextStyle(isSelected)}>
                        {preset >= 1000 ? `${preset / 1000}K` : `${preset}`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={[styles.helperText, themedHelperTextStyle]}>
                Larger values reduce truncation but increase cost. Model max: {getModelMaxOutputTokens(selectedModel).toLocaleString()} tokens.
              </Text>
            </View>

            <View style={styles.separator} />

            <View style={styles.settingGroup}>
              <Text style={[styles.settingLabel, themedSettingLabelStyle]}>Temperature: {temperature.toFixed(1)}</Text>
              <View style={styles.chipRow}>
                {TEMPERATURE_PRESETS.map((preset) => {
                  const isSelected = Math.abs(temperature - preset.value) < 0.0001;
                  return (
                    <TouchableOpacity
                      key={preset.label}
                      style={[
                        ...getChipStyle(isSelected),
                        modelSettingsLocked ? styles.inputLocked : undefined,
                      ]}
                      onPress={() => {
                        if (modelSettingsLocked) {
                          promptApiSetup('Model settings');
                          return;
                        }
                        void handleTemperatureSelect(preset.value);
                      }}
                    >
                      <Text style={getChipTextStyle(isSelected)}>
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={[styles.helperText, themedHelperTextStyle]}>
                {TEMPERATURE_PRESETS.find((p) => Math.abs(p.value - temperature) < 0.0001)?.helper ||
                  'Lower values are more focused; higher values are more creative.'}
              </Text>
            </View>
          </SettingsCard>
        </View>

        {/* Appearance Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isUniverseTheme ? styles.sectionTitleUniverse : undefined]}>
            Appearance
          </Text>

          <SettingsCard>
            <View style={styles.settingGroup}>
              <Text style={[styles.settingLabel, themedSettingLabelStyle]}>App Theme</Text>
              <View style={[styles.segmentedControl, themedSegmentedControlStyle]}>
                <TouchableOpacity
                  style={getSegmentButtonStyle(appTheme === 'yellow')}
                  onPress={() => selectAppTheme('yellow')}
                >
                  <Text style={getSegmentButtonTextStyle(appTheme === 'yellow')}>
                    Yellow
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={getSegmentButtonStyle(appTheme === 'universe')}
                  onPress={() => selectAppTheme('universe')}
                >
                  <Text style={getSegmentButtonTextStyle(appTheme === 'universe')}>
                    Universe
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.helperText, themedHelperTextStyle]}>
                Universe adds a galaxy background with stars across app screens.
              </Text>
            </View>

            <View style={styles.separator} />

            <View style={styles.settingGroup}>
              <Text style={[styles.settingLabel, themedSettingLabelStyle]}>Tab Bar Style</Text>
              <View style={[styles.segmentedControl, themedSegmentedControlStyle]}>
                <TouchableOpacity
                  style={getSegmentButtonStyle(tabBarVariant === 'tinted')}
                  onPress={() => selectTabBarVariant('tinted')}
                >
                  <Text style={getSegmentButtonTextStyle(tabBarVariant === 'tinted')}>
                    Tinted Glass
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={getSegmentButtonStyle(tabBarVariant === 'clear')}
                  onPress={() => selectTabBarVariant('clear')}
                >
                  <Text style={getSegmentButtonTextStyle(tabBarVariant === 'clear')}>
                    Clear Glass
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.helperText, themedHelperTextStyle]}>
                Clear keeps the pill more transparent; tint controls the glow and active highlight.
              </Text>
            </View>

            <View style={styles.separator} />

            <View style={styles.settingGroup}>
              <Text style={[styles.settingLabel, themedSettingLabelStyle]}>Tab Bar Tint</Text>
              <View style={styles.colorSwatchRow}>
                {TAB_BAR_TINT_OPTIONS.map((option) => {
                  const isSelected = tabBarTintColor.toUpperCase() === option.color.toUpperCase();
                  return (
                    <TouchableOpacity
                      key={option.color}
                      style={[
                        styles.colorSwatch,
                        { backgroundColor: option.color },
                        isSelected && styles.colorSwatchSelected
                      ]}
                      onPress={() => setTabBarTintColor(option.color)}
                      accessibilityRole="button"
                      accessibilityLabel={`Set tab bar tint to ${option.label}`}
                    >
                      {isSelected && <Ionicons name="checkmark" size={16} color="white" />}
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={[styles.helperText, themedHelperTextStyle]}>Current tint: {tabBarTintColor}</Text>
            </View>

            <View style={styles.separator} />

            <View style={styles.settingGroup}>
              <Text style={[styles.settingLabel, themedSettingLabelStyle]}>Blur Intensity</Text>
              <View style={[styles.segmentedControl, themedSegmentedControlStyle]}>
                {[
                  { label: 'Low', value: 60 },
                  { label: 'Med', value: 80 },
                  { label: 'High', value: 100 }
                ].map((opt) => {
                  const isSelected = tabBarBlurIntensity === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={getSegmentButtonStyle(isSelected)}
                      onPress={() => setTabBarBlurIntensity(opt.value)}
                    >
                      <Text style={getSegmentButtonTextStyle(isSelected)}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={[styles.helperText, themedHelperTextStyle]}>
                Higher blur looks more iOS-like (Android uses a best-effort blur fallback).
              </Text>
            </View>
          </SettingsCard>
        </View>

        {/* Language & Region Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isUniverseTheme ? styles.sectionTitleUniverse : undefined]}>
            Language & Region Settings
          </Text>
          
          <SettingsCard>
            <View style={styles.settingGroup}>
              <Text style={[styles.settingLabel, themedSettingLabelStyle]}>{t('settings.language.title')}</Text>
              <View style={[styles.segmentedControl, themedSegmentedControlStyle]}>
                <TouchableOpacity
                  style={getSegmentButtonStyle(appLanguage === 'en-US')}
                  onPress={() => setAppLanguage('en-US')}
                >
                  <Text style={getSegmentButtonTextStyle(appLanguage === 'en-US')}>
                    {t('settings.language.english')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={getSegmentButtonStyle(appLanguage === 'es-ES')}
                  onPress={() => setAppLanguage('es-ES')}
                >
                  <Text style={getSegmentButtonTextStyle(appLanguage === 'es-ES')}>
                    {t('settings.language.spanish')}
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.helperText, themedHelperTextStyle]}>
                {t('settings.language.helper')}
              </Text>
            </View>
          </SettingsCard>
        </View>

        {/* Insights Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isUniverseTheme ? styles.sectionTitleUniverse : undefined]}>
            Insights
          </Text>

          <SettingsCard>
            <SettingsItem
              title="App Statistics & Token Usage"
              description="Open charts, usage by app, and aggregate analytics"
              onPress={() => router.push('/stats')}
              icon="stats-chart-outline"
            />
          </SettingsCard>
        </View>

        {/* Storage & Data Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isUniverseTheme ? styles.sectionTitleUniverse : undefined]}>
            Storage & Data
          </Text>

          <SettingsCard>
            <SettingsItem
              title="Manage Apps"
              description="Delete apps one by one"
              onPress={() => {
                setShowManageApps(true);
                void loadManageApps();
              }}
              icon="albums-outline"
            />

            <View style={styles.separator} />

            <SettingsItem
              title="Clear All Apps"
              description="Deletes all saved apps on this device"
              onPress={handleClearAllApps}
              icon="trash-outline"
              statusColor="#DC3545"
            />

            <View style={styles.separator} />

            <SettingsItem
              title="Clear Prompt History"
              description="Deletes saved prompts used to create apps"
              onPress={handleClearPromptHistory}
              icon="time-outline"
              statusColor="#DC3545"
            />
          </SettingsCard>
        </View>

        {/* Sample Apps Management Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isUniverseTheme ? styles.sectionTitleUniverse : undefined]}>
            Sample Apps Management
          </Text>
          
          <SettingsCard>
            <View style={[styles.settingsItem, isUniverseTheme ? styles.settingsItemUniverse : undefined]}>
              <View>
                <Text style={[styles.settingsItemTitle, isUniverseTheme ? styles.settingsItemTitleUniverse : undefined]}>
                  Sample Apps
                </Text>
                <Text
                  style={[
                    styles.settingsItemDescription,
                    isUniverseTheme ? styles.settingsItemDescriptionUniverse : undefined,
                  ]}
                >
                  {sampleAppsCount} sample apps currently available
                </Text>
              </View>
            </View>
            
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: '#dc3545', opacity: isManagingSampleApps || sampleAppsCount === 0 ? 0.6 : 1 }]}
                onPress={handleRemoveSampleApps}
                disabled={isManagingSampleApps || sampleAppsCount === 0}
              >
                <Ionicons name="trash-outline" size={16} color="white" style={{ marginRight: 8 }} />
                <Text style={styles.buttonText}>
                  {isManagingSampleApps ? 'Removing...' : 'Remove All'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.button, { backgroundColor: '#28a745', opacity: isManagingSampleApps ? 0.6 : 1 }]}
                onPress={handleRestoreSampleApps}
                disabled={isManagingSampleApps}
              >
                <Ionicons name="refresh-outline" size={16} color="white" style={{ marginRight: 8 }} />
                <Text style={styles.buttonText}>
                  {isManagingSampleApps ? 'Restoring...' : 'Restore All'}
                </Text>
              </TouchableOpacity>
            </View>
            
            <Text style={[styles.helperText, themedHelperTextStyle, { marginTop: 12 }]}>
              Sample apps are automatically restored when you restart the app. 
              You can remove them temporarily or restore them to their original state.
            </Text>
          </SettingsCard>
        </View>

        {/* Legal Section */}
        <View style={styles.section}>
          <SettingsCard>
            <SettingsItem
              title="Privacy Policy"
              description="Learn how we protect your data"
              onPress={handlePrivacyPolicy}
              icon="document-text-outline"
            />
          </SettingsCard>
        </View>

        <View style={styles.section}>
          <SettingsCard>
            <SettingsItem
              title="Terms of Service"
              description="Read our terms and conditions"
              onPress={handleTermsOfService}
              icon="document-text-outline"
            />
          </SettingsCard>
        </View>
      </ScrollView>

      {/* Model Selector Modal */}
      <Modal
        visible={showModelSelector}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowModelSelector(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowModelSelector(false)} />

          <View style={[styles.modalContent, isUniverseTheme ? styles.modalContentUniverse : undefined]}>
            <Text style={[styles.modalTitle, isUniverseTheme ? styles.modalTitleUniverse : undefined]}>
              Select Claude Model
            </Text>
            <Text style={[styles.modalSubtitle, isUniverseTheme ? styles.modalSubtitleUniverse : undefined]}>
              Prices as of {PRICING_AS_OF_DISPLAY} (USD per MTok)
            </Text>

            <ScrollView
              style={styles.modelOptionsScroll}
              contentContainerStyle={styles.modelOptionsScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {CLAUDE_MODEL_PICKER_OPTIONS.map((modelId) => {
                const modelInfo = MODEL_INFO[modelId];
                const isRetired = modelInfo?.status === 'retired';

                return (
                  <TouchableOpacity
                    key={modelId}
                    style={[
                      styles.modelOption,
                      isUniverseTheme ? styles.modelOptionUniverse : undefined,
                      isRetired && styles.modelOptionDisabled,
                      selectedModel === modelId && styles.modelOptionSelected,
                      selectedModel === modelId && isUniverseTheme ? styles.modelOptionSelectedUniverse : undefined,
                    ]}
                    disabled={isRetired}
                    onPress={() => handleModelSelect(modelId)}
                  >
                    <View style={styles.modelOptionContent}>
                      <Text style={[
                        styles.modelOptionTitle,
                        isUniverseTheme ? styles.modelOptionTitleUniverse : undefined,
                        isRetired && styles.modelOptionTitleDisabled,
                        selectedModel === modelId && styles.modelOptionTitleSelected,
                        selectedModel === modelId && isUniverseTheme ? styles.modelOptionTitleSelectedUniverse : undefined,
                      ]}>
                        {getModelDisplayName(modelId)}
                      </Text>
                      <Text style={[styles.modelOptionPricing, isUniverseTheme ? styles.modelOptionPricingUniverse : undefined]}>
                        {formatModelPricingFull(modelId) || 'Pricing unavailable'}
                      </Text>
                    </View>
                    {selectedModel === modelId && (
                      <Ionicons name="checkmark-circle" size={24} color={AppColors.FABMain} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity 
              style={[styles.modalCancelButton, isUniverseTheme ? styles.modalCancelButtonUniverse : undefined]}
              onPress={() => setShowModelSelector(false)}
            >
              <Text style={[styles.modalCancelButtonText, isUniverseTheme ? styles.modalCancelButtonTextUniverse : undefined]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Debug Menu Modal */}
      <Modal
        visible={showDebugMenu}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDebugMenu(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowDebugMenu(false)} />

          <View style={[styles.modalContent, isUniverseTheme ? styles.modalContentUniverse : undefined]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, isUniverseTheme ? styles.modalTitleUniverse : undefined]}>
                  Debug Mode
                </Text>
                <Text style={[styles.modalSubtitle, isUniverseTheme ? styles.modalSubtitleUniverse : undefined]}>
                  Internal tools for testing and walkthroughs
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.headerIconButton,
                  { backgroundColor: isUniverseTheme ? 'rgba(11, 37, 65, 0.82)' : 'rgba(0, 0, 0, 0.06)' },
                ]}
                onPress={() => setShowDebugMenu(false)}
              >
                <Ionicons
                  name="close"
                  size={20}
                  color={isUniverseTheme ? 'rgba(226, 240, 255, 0.92)' : 'rgba(0, 0, 0, 0.8)'}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.separator} />

            <View style={[styles.debugOptionRow, isUniverseTheme ? styles.debugOptionRowUniverse : undefined]}>
              <View style={styles.debugOptionTextWrap}>
                <Text style={[styles.debugOptionTitle, isUniverseTheme ? styles.debugOptionTitleUniverse : undefined]}>
                  Allow screens without API key
                </Text>
                <Text
                  style={[
                    styles.debugOptionDescription,
                    isUniverseTheme ? styles.debugOptionDescriptionUniverse : undefined,
                  ]}
                >
                  Bypass key-required UI locks so you can inspect screen states.
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.debugTogglePill,
                  debugAllowWithoutApiKey
                    ? isUniverseTheme
                      ? styles.debugTogglePillEnabledUniverse
                      : styles.debugTogglePillEnabled
                    : styles.debugTogglePillDisabled,
                ]}
                onPress={() => setDebugAllowWithoutApiKey(!debugAllowWithoutApiKey)}
              >
                <Text style={styles.debugToggleText}>
                  {debugAllowWithoutApiKey ? 'ON' : 'OFF'}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.debugActionButton, isUniverseTheme ? styles.debugActionButtonUniverse : undefined]}
              onPress={handleViewTutorial}
            >
              <Ionicons
                name="school-outline"
                size={18}
                color={isUniverseTheme ? 'rgba(226, 240, 255, 0.96)' : '#111827'}
              />
              <Text
                style={[
                  styles.debugActionButtonText,
                  isUniverseTheme ? styles.debugActionButtonTextUniverse : undefined,
                ]}
              >
                View Tutorial
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Manage Apps Modal */}
      <Modal
        visible={showManageApps}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowManageApps(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowManageApps(false)} />

          <View style={[styles.modalContent, isUniverseTheme ? styles.modalContentUniverse : undefined]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, isUniverseTheme ? styles.modalTitleUniverse : undefined]}>
                  Manage Apps
                </Text>
                <Text style={[styles.modalSubtitle, isUniverseTheme ? styles.modalSubtitleUniverse : undefined]}>
                  Delete individual apps and free up space.
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.headerIconButton,
                  { backgroundColor: isUniverseTheme ? 'rgba(11, 37, 65, 0.82)' : 'rgba(0, 0, 0, 0.06)' },
                ]}
                onPress={() => setShowManageApps(false)}
              >
                <Ionicons
                  name="close"
                  size={20}
                  color={isUniverseTheme ? 'rgba(226, 240, 255, 0.92)' : 'rgba(0, 0, 0, 0.8)'}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.separator} />

            <ScrollView style={{ marginTop: 12, maxHeight: 420 }}>
              {isLoadingManageApps ? (
                <View style={[styles.settingsItem, isUniverseTheme ? styles.settingsItemUniverse : undefined]}>
                  <Text style={[styles.settingsItemDescription, isUniverseTheme ? styles.settingsItemDescriptionUniverse : undefined]}>
                    Loading apps…
                  </Text>
                </View>
              ) : (manageApps ?? []).length === 0 ? (
                <View style={[styles.settingsItem, isUniverseTheme ? styles.settingsItemUniverse : undefined]}>
                  <Text style={[styles.settingsItemDescription, isUniverseTheme ? styles.settingsItemDescriptionUniverse : undefined]}>
                    No apps found.
                  </Text>
                </View>
              ) : (
                (manageApps ?? []).map((app) => (
                  <View
                    key={app.id}
                    style={[
                      styles.settingsItem,
                      isUniverseTheme ? styles.settingsItemUniverse : undefined,
                      { paddingVertical: 12 },
                    ]}
                  >
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text
                        style={[styles.settingsItemTitle, isUniverseTheme ? styles.settingsItemTitleUniverse : undefined]}
                        numberOfLines={1}
                      >
                        {app.title}
                      </Text>
                      <Text
                        style={[
                          styles.settingsItemDescription,
                          isUniverseTheme ? styles.settingsItemDescriptionUniverse : undefined,
                        ]}
                        numberOfLines={1}
                      >
                        {app.status ? `Status: ${app.status} • ` : ''}
                        Est. {formatSize(app.sizeKB)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.button, { backgroundColor: '#dc3545', paddingVertical: 8, paddingHorizontal: 12 }]}
                      onPress={() => {
                        Alert.alert(
                          'Delete app',
                          `Delete "${app.title}"? This cannot be undone.`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Delete',
                              style: 'destructive',
                              onPress: async () => {
                                await deleteAppAndAssets(app.id);
                                await loadManageApps();
                                await loadSampleAppsCount();
                              },
                            },
                          ]
                        );
                      }}
                    >
                      <Ionicons name="trash-outline" size={16} color="white" style={{ marginRight: 6 }} />
                      <Text style={styles.buttonText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: '#dc3545', flex: 1 }]}
                onPress={handleClearAllApps}
              >
                <Ionicons name="trash-outline" size={16} color="white" style={{ marginRight: 8 }} />
                <Text style={styles.buttonText}>Clear All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: '#6c757d', flex: 1 }]}
                onPress={() => setShowManageApps(false)}
              >
                <Text style={styles.buttonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

interface SettingsCardProps {
  children: React.ReactNode;
}

function SettingsCard({ children }: SettingsCardProps) {
  const isUniverseTheme = useUISettingsStore((s) => s.appTheme === 'universe');
  return (
    <View style={[styles.card, isUniverseTheme ? styles.cardUniverse : undefined]}>
      {children}
    </View>
  );
}

interface SettingsItemProps {
  title: string;
  description: string;
  onPress: () => void;
  icon?: string;
  statusColor?: string;
}

function SettingsItem({ title, description, onPress, icon = "chevron-forward", statusColor }: SettingsItemProps) {
  const isUniverseTheme = useUISettingsStore((s) => s.appTheme === 'universe');
  return (
    <TouchableOpacity
      style={[styles.settingsItem, isUniverseTheme ? styles.settingsItemUniverse : undefined]}
      onPress={onPress}
    >
      <View style={styles.settingsItemContent}>
        <Text style={[styles.settingsItemTitle, isUniverseTheme ? styles.settingsItemTitleUniverse : undefined]}>
          {title}
        </Text>
        <Text
          style={[
            styles.settingsItemDescription,
            isUniverseTheme ? styles.settingsItemDescriptionUniverse : undefined,
          ]}
        >
          {description}
        </Text>
      </View>
      <Ionicons name={icon as any} size={20} color={statusColor || "#94A3B8"} />
    </TouchableOpacity>
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
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'rgba(0, 0, 0, 0.8)',
  },
  headerTitleUniverse: {
    color: 'rgba(234, 246, 255, 0.95)',
  },
  headerIconButton: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
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
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    marginVertical: 4,
  },
  settingsItemUniverse: {
    backgroundColor: 'rgba(9, 28, 52, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(123, 169, 220, 0.32)',
  },
  settingsItemContent: {
    flex: 1,
  },
  settingsItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 2,
  },
  settingsItemTitleUniverse: {
    color: 'rgba(225, 239, 255, 0.95)',
  },
  settingsItemDescription: {
    fontSize: 12,
    color: '#64748B',
  },
  settingsItemDescriptionUniverse: {
    color: 'rgba(190, 216, 244, 0.84)',
  },
  separator: {
    height: 8,
  },
  settingGroup: {
    marginVertical: 8,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
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
    borderColor: 'rgba(128, 128, 128, 0.5)',
    borderRadius: 12,
    backgroundColor: '#fff',
    marginBottom: 4,
  },
  dropdownUniverse: {
    borderColor: 'rgba(125, 171, 222, 0.44)',
    backgroundColor: 'rgba(6, 23, 44, 0.92)',
  },
  dropdownText: {
    fontSize: 16,
    color: 'rgba(0, 0, 0, 0.8)',
  },
  dropdownTextUniverse: {
    color: 'rgba(224, 240, 255, 0.94)',
  },
  helperText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  helperTextUniverse: {
    color: 'rgba(190, 216, 244, 0.84)',
  },
  lockedCallout: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.14)',
    gap: 8,
    marginBottom: 10,
  },
  lockedCalloutUniverse: {
    backgroundColor: 'rgba(10, 34, 61, 0.86)',
    borderColor: 'rgba(123, 169, 220, 0.4)',
  },
  lockedCalloutText: {
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(0, 0, 0, 0.68)',
    fontWeight: '600',
  },
  lockedCalloutTextUniverse: {
    color: 'rgba(204, 228, 251, 0.9)',
  },
  lockedCalloutButton: {
    alignSelf: 'flex-start',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 42, 0.14)',
  },
  lockedCalloutButtonUniverse: {
    backgroundColor: 'rgba(27, 86, 146, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(196, 223, 250, 0.7)',
  },
  lockedCalloutButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  lockedCalloutButtonTextUniverse: {
    color: 'rgba(232, 245, 255, 0.96)',
  },
  inputLocked: {
    opacity: 0.48,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
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
    fontWeight: '700',
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
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.12)',
    overflow: 'hidden',
  },
  segmentedControlUniverse: {
    borderColor: 'rgba(123, 169, 220, 0.35)',
    backgroundColor: 'rgba(8, 22, 42, 0.4)',
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  segmentButtonUniverse: {
    backgroundColor: 'rgba(7, 28, 52, 0.9)',
  },
  segmentButtonSelected: {
    backgroundColor: 'rgba(95, 15, 64, 0.12)',
  },
  segmentButtonSelectedUniverse: {
    backgroundColor: 'rgba(34, 76, 122, 0.86)',
  },
  segmentButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(0, 0, 0, 0.65)',
  },
  segmentButtonTextUniverse: {
    color: 'rgba(214, 233, 253, 0.9)',
  },
  segmentButtonTextSelected: {
    color: 'rgba(0, 0, 0, 0.9)',
  },
  segmentButtonTextSelectedUniverse: {
    color: '#F2FAFF',
  },
  colorSwatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 6,
  },
  colorSwatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: 'rgba(0, 0, 0, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatchSelected: {
    borderColor: 'rgba(0, 0, 0, 0.65)',
    transform: [{ scale: 1.05 }],
  },
  sliderContainer: {
    marginVertical: 8,
  },
  sliderTrack: {
    height: 4,
    backgroundColor: 'rgba(128, 128, 128, 0.3)',
    borderRadius: 2,
    position: 'relative',
  },
  sliderThumb: {
    position: 'absolute',
    top: -6,
    width: 16,
    height: 16,
    backgroundColor: AppColors.FABMain,
    borderRadius: 8,
    marginLeft: -8,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  debugOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    marginTop: 10,
  },
  debugOptionRowUniverse: {
    backgroundColor: 'rgba(9, 28, 52, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(123, 169, 220, 0.32)',
  },
  debugOptionTextWrap: {
    flex: 1,
  },
  debugOptionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  debugOptionTitleUniverse: {
    color: 'rgba(225, 239, 255, 0.96)',
  },
  debugOptionDescription: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
  },
  debugOptionDescriptionUniverse: {
    color: 'rgba(190, 216, 244, 0.84)',
  },
  debugTogglePill: {
    minWidth: 60,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  debugTogglePillEnabled: {
    backgroundColor: '#2563EB',
  },
  debugTogglePillEnabledUniverse: {
    backgroundColor: 'rgba(44, 118, 193, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(195, 224, 250, 0.72)',
  },
  debugTogglePillDisabled: {
    backgroundColor: 'rgba(100, 116, 139, 0.55)',
  },
  debugToggleText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.4,
  },
  debugActionButton: {
    marginTop: 14,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.14)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  debugActionButtonUniverse: {
    backgroundColor: 'rgba(9, 36, 64, 0.9)',
    borderColor: 'rgba(123, 169, 220, 0.35)',
  },
  debugActionButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  debugActionButtonTextUniverse: {
    color: 'rgba(225, 239, 255, 0.95)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 24,
    height: '80%',
  },
  modalContentUniverse: {
    backgroundColor: 'rgba(7, 20, 38, 0.98)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(123, 169, 220, 0.42)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'rgba(0, 0, 0, 0.8)',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalTitleUniverse: {
    color: 'rgba(225, 239, 255, 0.95)',
  },
  modalSubtitle: {
    fontSize: 12,
    color: 'rgba(0, 0, 0, 0.6)',
    textAlign: 'center',
    marginTop: -12,
    marginBottom: 20,
  },
  modalSubtitleUniverse: {
    color: 'rgba(190, 216, 244, 0.84)',
  },
  modelOptionsScroll: {
    flex: 1,
    marginBottom: 12,
  },
  modelOptionsScrollContent: {
    paddingBottom: 4,
  },
  modelOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  modelOptionUniverse: {
    backgroundColor: 'rgba(9, 28, 52, 0.9)',
    borderColor: 'rgba(123, 169, 220, 0.32)',
  },
  modelOptionDisabled: {
    opacity: 0.45,
  },
  modelOptionSelected: {
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    borderColor: AppColors.FABMain,
  },
  modelOptionSelectedUniverse: {
    borderColor: 'rgba(199, 224, 250, 0.78)',
    backgroundColor: 'rgba(34, 76, 122, 0.86)',
  },
  modelOptionContent: {
    flex: 1,
  },
  modelOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(0, 0, 0, 0.8)',
    marginBottom: 4,
  },
  modelOptionTitleUniverse: {
    color: 'rgba(225, 239, 255, 0.95)',
  },
  modelOptionTitleDisabled: {
    color: 'rgba(0, 0, 0, 0.6)',
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
  },
  modelOptionPricingUniverse: {
    color: 'rgba(190, 216, 244, 0.84)',
  },
  modalCancelButton: {
    backgroundColor: '#f0f0f0',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
  },
  modalCancelButtonUniverse: {
    backgroundColor: 'rgba(8, 33, 58, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(123, 169, 220, 0.35)',
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(0, 0, 0, 0.6)',
    textAlign: 'center',
  },
  modalCancelButtonTextUniverse: {
    color: 'rgba(214, 233, 253, 0.92)',
  },
});
