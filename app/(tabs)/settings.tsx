import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Alert, Modal, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../../src/constants/AppColors';
import { samplePromptHistory } from '../../src/types/Samples';
import { SecureStorageService } from '../../src/services/SecureStorageService';
import { ClaudeApiService } from '../../src/services/ClaudeApiService';
import { SeedService } from '../../src/services/SeedService';
import { AppStorageService } from '../../src/services/AppStorageService';
import { TokenTrackingService, TokenStats } from '../../src/services/TokenTrackingService';
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
import { TabBarVariant, useUISettingsStore } from '../../src/stores/UISettingsStore';

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
  const [temperature, setTemperature] = useState(0.3);
  const [maxTokens, setMaxTokens] = useState(DEFAULT_CONFIG.maxTokens);
  const [selectedModel, setSelectedModel] = useState<string>(CLAUDE_MODELS.HAIKU_4_5);
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isLoadingApiKey, setIsLoadingApiKey] = useState(true);
  const [sampleAppsCount, setSampleAppsCount] = useState(0);
  const [isManagingSampleApps, setIsManagingSampleApps] = useState(false);
  const [tokenStats, setTokenStats] = useState<TokenStats | null>(null);
  const [isLoadingTokenStats, setIsLoadingTokenStats] = useState(true);
  const [showModelSelector, setShowModelSelector] = useState(false);

  const tabBarVariant = useUISettingsStore((s) => s.tabBar.variant);
  const tabBarTintColor = useUISettingsStore((s) => s.tabBar.tintColor);
  const tabBarBlurIntensity = useUISettingsStore((s) => s.tabBar.blurIntensity);
  const setTabBarVariant = useUISettingsStore((s) => s.setTabBarVariant);
  const setTabBarTintColor = useUISettingsStore((s) => s.setTabBarTintColor);
  const setTabBarBlurIntensity = useUISettingsStore((s) => s.setTabBarBlurIntensity);

  useEffect(() => {
    checkApiKeyStatus();
    loadClaudeConfig();
    loadSampleAppsCount();
    loadTokenStats();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      // When returning from /welcome (or other screens), refresh state.
      checkApiKeyStatus();
      loadClaudeConfig();
      loadSampleAppsCount();
      loadTokenStats();
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

  const loadTokenStats = async () => {
    try {
      setIsLoadingTokenStats(true);
      const stats = await TokenTrackingService.getTokenStats();
      setTokenStats(stats);
    } catch (error) {
      log.error('Error loading token stats:', error);
    } finally {
      setIsLoadingTokenStats(false);
    }
  };

  const handleClearTokenHistory = () => {
    Alert.alert(
      'Clear Token History',
      'Are you sure you want to clear all token usage history? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await TokenTrackingService.clearTokenHistory();
              await loadTokenStats();
              Alert.alert('Success', 'Token history cleared successfully');
            } catch (error) {
              log.error('Error clearing token history:', error);
              Alert.alert('Error', 'Failed to clear token history');
            }
          }
        }
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
    Alert.alert('Debug Mode', 'Enable debugging features', [{ text: 'OK' }]);
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

  const getModelDisplayName = (model: string): string => {
    const modelInfo = MODEL_INFO[model];
    if (!modelInfo) return model;
    if (modelInfo.status === 'deprecated') return `${modelInfo.name} (deprecated)`;
    if (modelInfo.status === 'retired') return `${modelInfo.name} (retired)`;
    return modelInfo.name;
  };

  const handleModelSelect = async (model: string) => {
    try {
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
    const clampedMaxTokens = clampMaxOutputTokens(selectedModel, requestedMaxTokens);
    setMaxTokens(clampedMaxTokens);
    await persistClaudeDefaults({ model: selectedModel, maxTokens: clampedMaxTokens, temperature });
  };

  const handleTemperatureSelect = async (nextTemperature: number) => {
    setTemperature(nextTemperature);
    await persistClaudeDefaults({ model: selectedModel, maxTokens, temperature: nextTemperature });
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <StatusBar translucent backgroundColor="transparent" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* API Configuration Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>API Configuration</Text>
          
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
          </SettingsCard>
        </View>

        {/* Claude Model Configuration Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Claude Model Settings</Text>
          
          <SettingsCard>
            <View style={styles.settingGroup}>
              <Text style={styles.settingLabel}>Model</Text>
              <TouchableOpacity 
                style={styles.dropdown}
                onPress={() => setShowModelSelector(true)}
              >
                <Text style={styles.dropdownText}>{getModelDisplayName(selectedModel)}</Text>
                <Ionicons name="chevron-down" size={20} color="#666" />
              </TouchableOpacity>
              <Text style={styles.helperText}>
                Current model: {getModelDisplayName(selectedModel)}
                {'\n'}
                {formatModelPricingShort(selectedModel) || 'Pricing unavailable'} (as of {PRICING_AS_OF_DISPLAY})
              </Text>
            </View>

            <View style={styles.separator} />

            <View style={styles.settingGroup}>
              <Text style={styles.settingLabel}>
                Max Output Tokens: {maxTokens.toLocaleString()}
              </Text>
              <View style={styles.chipRow}>
                {MAX_OUTPUT_TOKEN_PRESETS.filter((preset) => preset <= getModelMaxOutputTokens(selectedModel)).map((preset) => {
                  const isSelected = maxTokens === preset;
                  return (
                    <TouchableOpacity
                      key={preset}
                      style={[styles.chip, isSelected && styles.chipSelected]}
                      onPress={() => handleMaxTokensSelect(preset)}
                    >
                      <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                        {preset >= 1000 ? `${preset / 1000}K` : `${preset}`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.helperText}>
                Larger values reduce truncation but increase cost. Model max: {getModelMaxOutputTokens(selectedModel).toLocaleString()} tokens.
              </Text>
            </View>

            <View style={styles.separator} />

            <View style={styles.settingGroup}>
              <Text style={styles.settingLabel}>Temperature: {temperature.toFixed(1)}</Text>
              <View style={styles.chipRow}>
                {TEMPERATURE_PRESETS.map((preset) => {
                  const isSelected = Math.abs(temperature - preset.value) < 0.0001;
                  return (
                    <TouchableOpacity
                      key={preset.label}
                      style={[styles.chip, isSelected && styles.chipSelected]}
                      onPress={() => handleTemperatureSelect(preset.value)}
                    >
                      <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.helperText}>
                {TEMPERATURE_PRESETS.find((p) => Math.abs(p.value - temperature) < 0.0001)?.helper ||
                  'Lower values are more focused; higher values are more creative.'}
              </Text>
            </View>
          </SettingsCard>
        </View>

        {/* Appearance Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>

          <SettingsCard>
            <View style={styles.settingGroup}>
              <Text style={styles.settingLabel}>Tab Bar Style</Text>
              <View style={styles.segmentedControl}>
                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    tabBarVariant === 'tinted' && styles.segmentButtonSelected
                  ]}
                  onPress={() => selectTabBarVariant('tinted')}
                >
                  <Text
                    style={[
                      styles.segmentButtonText,
                      tabBarVariant === 'tinted' && styles.segmentButtonTextSelected
                    ]}
                  >
                    Tinted Glass
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    tabBarVariant === 'clear' && styles.segmentButtonSelected
                  ]}
                  onPress={() => selectTabBarVariant('clear')}
                >
                  <Text
                    style={[
                      styles.segmentButtonText,
                      tabBarVariant === 'clear' && styles.segmentButtonTextSelected
                    ]}
                  >
                    Clear Glass
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.helperText}>
                Clear keeps the pill more transparent; tint controls the glow and active highlight.
              </Text>
            </View>

            <View style={styles.separator} />

            <View style={styles.settingGroup}>
              <Text style={styles.settingLabel}>Tab Bar Tint</Text>
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
              <Text style={styles.helperText}>Current tint: {tabBarTintColor}</Text>
            </View>

            <View style={styles.separator} />

            <View style={styles.settingGroup}>
              <Text style={styles.settingLabel}>Blur Intensity</Text>
              <View style={styles.segmentedControl}>
                {[
                  { label: 'Low', value: 60 },
                  { label: 'Med', value: 80 },
                  { label: 'High', value: 100 }
                ].map((opt) => {
                  const isSelected = tabBarBlurIntensity === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[
                        styles.segmentButton,
                        isSelected && styles.segmentButtonSelected
                      ]}
                      onPress={() => setTabBarBlurIntensity(opt.value)}
                    >
                      <Text
                        style={[
                          styles.segmentButtonText,
                          isSelected && styles.segmentButtonTextSelected
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.helperText}>
                Higher blur looks more iOS-like (Android uses a best-effort blur fallback).
              </Text>
            </View>
          </SettingsCard>
        </View>

        {/* Language & Region Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Language & Region Settings</Text>
          
          <SettingsCard>
            <View style={styles.settingGroup}>
              <Text style={styles.settingLabel}>App Language</Text>
              <TouchableOpacity style={styles.dropdown}>
                <Text style={styles.dropdownText}>{selectedLanguage}</Text>
                <Ionicons name="chevron-down" size={20} color="#666" />
              </TouchableOpacity>
              <Text style={styles.helperText}>
                Changes will take effect after restarting the app
              </Text>
            </View>
          </SettingsCard>
        </View>

        {/* App Statistics Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Statistics</Text>
          
          <SettingsCard>
            <View style={styles.statsContainer}>
              <StatItem
                label="Total Apps"
                value={samplePromptHistory.length.toString()}
              />
              <StatItem
                label="Favorites"
                value={samplePromptHistory.filter(item => item.favorite).length.toString()}
              />
            </View>
          </SettingsCard>
        </View>

        {/* Token Usage Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Token Usage & Costs</Text>
          
          <SettingsCard>
            {isLoadingTokenStats ? (
              <View style={styles.settingsItem}>
                <Text style={styles.settingsItemDescription}>Loading token usage statistics...</Text>
              </View>
            ) : tokenStats ? (
              <View>
                <View style={styles.settingsItem}>
                  <View>
                    <Text style={styles.settingsItemTitle}>Total Usage</Text>
                    <Text style={styles.settingsItemDescription}>
                      {tokenStats.totalTokens.toLocaleString()} tokens across {tokenStats.totalRequests} requests
                    </Text>
                  </View>
                </View>
                
                <View style={styles.settingsItem}>
                  <View>
                    <Text style={styles.settingsItemTitle}>Input/Output Breakdown</Text>
                    <Text style={styles.settingsItemDescription}>
                      Input: {tokenStats.totalInputTokens.toLocaleString()} • Output: {tokenStats.totalOutputTokens.toLocaleString()}
                    </Text>
                  </View>
                </View>

                {Object.entries(tokenStats.usageByModel).length > 0 && (
                  <View style={styles.settingsItem}>
                    <View>
                      <Text style={styles.settingsItemTitle}>Usage by Model</Text>
                      {Object.entries(tokenStats.usageByModel).map(([model, usage]) => (
                        <Text key={model} style={styles.settingsItemDescription}>
                          {getModelDisplayName(model)}: {(usage.inputTokens + usage.outputTokens).toLocaleString()} tokens ({usage.requests} requests)
                        </Text>
                      ))}
                    </View>
                  </View>
                )}
                
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: '#dc3545', marginTop: 16 }]}
                  onPress={handleClearTokenHistory}
                >
                  <Ionicons name="trash-outline" size={16} color="white" style={{ marginRight: 8 }} />
                  <Text style={styles.buttonText}>Clear Token History</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.settingsItem}>
                <Text style={styles.settingsItemDescription}>No token usage data available</Text>
              </View>
            )}
          </SettingsCard>
        </View>

        {/* Sample Apps Management Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sample Apps Management</Text>
          
          <SettingsCard>
            <View style={styles.settingsItem}>
              <View>
                <Text style={styles.settingsItemTitle}>Sample Apps</Text>
                <Text style={styles.settingsItemDescription}>
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
            
            <Text style={[styles.helperText, { marginTop: 12 }]}>
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

          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Claude Model</Text>
            <Text style={styles.modalSubtitle}>Prices as of {PRICING_AS_OF_DISPLAY} (USD per MTok)</Text>

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
                      isRetired && styles.modelOptionDisabled,
                      selectedModel === modelId && styles.modelOptionSelected
                    ]}
                    disabled={isRetired}
                    onPress={() => handleModelSelect(modelId)}
                  >
                    <View style={styles.modelOptionContent}>
                      <Text style={[
                        styles.modelOptionTitle,
                        isRetired && styles.modelOptionTitleDisabled,
                        selectedModel === modelId && styles.modelOptionTitleSelected
                      ]}>
                        {getModelDisplayName(modelId)}
                      </Text>
                      <Text style={styles.modelOptionPricing}>
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
              style={styles.modalCancelButton}
              onPress={() => setShowModelSelector(false)}
            >
              <Text style={styles.modalCancelButtonText}>Cancel</Text>
            </TouchableOpacity>
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
  return (
    <View style={styles.card}>
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
  return (
    <TouchableOpacity style={styles.settingsItem} onPress={onPress}>
      <View style={styles.settingsItemContent}>
        <Text style={styles.settingsItemTitle}>{title}</Text>
        <Text style={styles.settingsItemDescription}>{description}</Text>
      </View>
      <Ionicons name={icon as any} size={20} color={statusColor || "#94A3B8"} />
    </TouchableOpacity>
  );
}

interface StatItemProps {
  label: string;
  value: string;
}

function StatItem({ label, value }: StatItemProps) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.Primary,
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
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    marginVertical: 4,
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
  settingsItemDescription: {
    fontSize: 12,
    color: '#64748B',
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
  dropdownText: {
    fontSize: 16,
    color: 'rgba(0, 0, 0, 0.8)',
  },
  helperText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
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
  chipSelected: {
    backgroundColor: 'rgba(95, 15, 64, 0.12)',
    borderColor: 'rgba(0, 0, 0, 0.2)',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(0, 0, 0, 0.65)',
  },
  chipTextSelected: {
    color: 'rgba(0, 0, 0, 0.9)',
  },
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.12)',
    overflow: 'hidden',
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  segmentButtonSelected: {
    backgroundColor: 'rgba(95, 15, 64, 0.12)',
  },
  segmentButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(0, 0, 0, 0.65)',
  },
  segmentButtonTextSelected: {
    color: 'rgba(0, 0, 0, 0.9)',
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
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'rgba(0, 0, 0, 0.8)',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(0, 0, 0, 0.6)',
    marginTop: 2,
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
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'rgba(0, 0, 0, 0.8)',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 12,
    color: 'rgba(0, 0, 0, 0.6)',
    textAlign: 'center',
    marginTop: -12,
    marginBottom: 20,
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
  modelOptionDisabled: {
    opacity: 0.45,
  },
  modelOptionSelected: {
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    borderColor: AppColors.FABMain,
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
  modelOptionTitleDisabled: {
    color: 'rgba(0, 0, 0, 0.6)',
  },
  modelOptionTitleSelected: {
    color: 'rgba(0, 0, 0, 0.9)',
  },
  modelOptionPricing: {
    fontSize: 12,
    color: 'rgba(0, 0, 0, 0.6)',
  },
  modalCancelButton: {
    backgroundColor: '#f0f0f0',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(0, 0, 0, 0.6)',
    textAlign: 'center',
  },
});
