import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from './MyAppScreen';
import { AppColors, samplePromptHistory } from '../types/PromptHistory';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export default function SettingsScreen({ navigation }: Props) {
  const [temperature, setTemperature] = useState(0.3);
  const [selectedModel, setSelectedModel] = useState('Claude 3.5 Sonnet');
  const [selectedLanguage, setSelectedLanguage] = useState('English');

  const models = [
    'Claude 3.5 Sonnet',
    'Claude 3 Opus',
    'Claude 3 Haiku',
  ];

  const languages = [
    'English',
    'Spanish',
    'French',
    'German',
    'Japanese',
  ];

  const handleApiKeySettings = () => {
    Alert.alert('API Key Settings', 'Configure your Claude API key', [{ text: 'OK' }]);
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
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={AppColors.Primary} />
      
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
              title="API Key Settings"
              description="Configure your Claude API key"
              onPress={handleApiKeySettings}
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
                Current model: {selectedModel} - $3/$15 per million tokens
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
    </View>
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
}

function SettingsItem({ title, description, onPress, icon = "chevron-forward" }: SettingsItemProps) {
  return (
    <TouchableOpacity style={styles.settingsItem} onPress={onPress}>
      <View style={styles.settingsItemContent}>
        <Text style={styles.settingsItemTitle}>{title}</Text>
        <Text style={styles.settingsItemDescription}>{description}</Text>
      </View>
      <Ionicons name={icon as any} size={20} color="#94A3B8" />
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
});