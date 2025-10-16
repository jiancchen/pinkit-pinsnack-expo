import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from './MyAppScreen';
import { AppColors } from '../constants/AppColors';
import { samplePromptHistory } from '../types/Samples';
import { SecureStorageService } from '../services/SecureStorageService';
import { ClaudeApiService } from '../services/ClaudeApiService';
import { SeedService } from '../services/SeedService';
import { AppStorageService } from '../services/AppStorageService';
import { TokenTrackingService, TokenStats } from '../services/TokenTrackingService';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export default function SettingsScreen({ navigation }: Props) {
  const [temperature, setTemperature] = useState(0.3);
  const [selectedModel, setSelectedModel] = useState('Claude 3 Haiku');
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isLoadingApiKey, setIsLoadingApiKey] = useState(true);
  const [sampleAppsCount, setSampleAppsCount] = useState(0);
  const [isManagingSampleApps, setIsManagingSampleApps] = useState(false);
  const [tokenStats, setTokenStats] = useState<TokenStats | null>(null);
  const [isLoadingTokenStats, setIsLoadingTokenStats] = useState(true);

  useFocusEffect(
    React.useCallback(() => {
      checkApiKeyStatus();
      loadSampleAppsCount();
      loadTokenStats();
    }, [])
  );

  useEffect(() => {
    checkApiKeyStatus();
    loadSampleAppsCount();
    loadTokenStats();
  }, []);

  const checkApiKeyStatus = async () => {
    try {
      const hasKey = await SecureStorageService.hasApiKey();
      setHasApiKey(hasKey);
    } catch (error) {
      console.error('Error checking API key status:', error);
    } finally {
      setIsLoadingApiKey(false);
    }
  };

  const loadSampleAppsCount = async () => {
    try {
      const allApps = await AppStorageService.getAllApps();
      const sampleApps = allApps.filter(app => SeedService.isSampleApp(app));
      setSampleAppsCount(sampleApps.length);
    } catch (error) {
      console.error('Error loading sample apps count:', error);
    }
  };

  const loadTokenStats = async () => {
    try {
      setIsLoadingTokenStats(true);
      const stats = await TokenTrackingService.getTokenStats();
      setTokenStats(stats);
    } catch (error) {
      console.error('Error loading token stats:', error);
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
              await loadTokenStats(); // Reload stats
              Alert.alert('Success', 'Token history cleared successfully');
            } catch (error) {
              console.error('Error clearing token history:', error);
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
              console.error('Error removing sample apps:', error);
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
              console.error('Error restoring sample apps:', error);
              Alert.alert('Error', 'Failed to restore sample apps.');
            } finally {
              setIsManagingSampleApps(false);
            }
          },
        },
      ]
    );
  };

  const models = [
    'Claude 3 Haiku',
    'Claude 3.5 Sonnet',
    'Claude 3 Opus',
  ];

  const languages = [
    'English',
    'Spanish',
    'French',
    'German',
    'Japanese',
  ];

  const handleApiKeySettings = () => {
    if (hasApiKey) {
      Alert.alert(
        'API Key Settings',
        'You have a Claude API key configured. What would you like to do?',
        [
          { text: 'Test Connection', onPress: testApiConnection },
          { text: 'Remove API Key', onPress: removeApiKey, style: 'destructive' },
          { text: 'Update API Key', onPress: () => navigation.navigate('Welcome') },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } else {
      navigation.navigate('Welcome');
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
              <TouchableOpacity style={styles.dropdown}>
                <Text style={styles.dropdownText}>{selectedModel}</Text>
                <Ionicons name="chevron-down" size={20} color="#666" />
              </TouchableOpacity>
              <Text style={styles.helperText}>
                Current model: {selectedModel} - {selectedModel === 'Claude 3 Haiku' ? '$0.25/$1.25 per million tokens' : selectedModel === 'Claude 3.5 Sonnet' ? '$3/$15 per million tokens' : '$15/$75 per million tokens'}
              </Text>
            </View>

            <View style={styles.separator} />

            <View style={styles.settingGroup}>
              <Text style={styles.settingLabel}>Temperature: {temperature.toFixed(1)}</Text>
              <View style={styles.sliderContainer}>
                <View style={styles.sliderTrack}>
                  <View 
                    style={[
                      styles.sliderThumb, 
                      { left: `${temperature * 100}%` }
                    ]} 
                  />
                </View>
              </View>
              <Text style={styles.helperText}>
                Lower values make responses more focused, higher values more creative
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
                          {model}: {(usage.inputTokens + usage.outputTokens).toLocaleString()} tokens ({usage.requests} requests)
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
});