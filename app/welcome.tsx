import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AppColors } from '../src/constants/AppColors';
import { SecureStorageService } from '../src/services/SecureStorageService';
import { ClaudeApiService } from '../src/services/ClaudeApiService';
import { GenerationQueueService } from '../src/services/GenerationQueueService';
import { createLogger } from '../src/utils/Logger';

const log = createLogger('Welcome');

export default function WelcomePage() {
  const router = useRouter();
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  const handleApiKeySubmit = async () => {
    if (!apiKey.trim()) {
      Alert.alert('Error', 'Please enter your Claude API key');
      return;
    }

    if (!SecureStorageService.validateApiKey(apiKey)) {
      Alert.alert(
        'Invalid API Key',
        'Please enter a valid Claude API key. It should start with "sk-ant-" and be at least 50 characters long.'
      );
      return;
    }

    setIsLoading(true);
    try {
      await SecureStorageService.storeApiKey(apiKey);

      const claudeService = ClaudeApiService.getInstance();
      await claudeService.initialize();

      const testResult = await claudeService.testConnection();

      if (testResult.success) {
        void GenerationQueueService.startWorker();
        Alert.alert(
          'Success!',
          'Your Claude API key has been saved and verified. You can now start generating apps!',
          [
            {
              text: 'Back to Settings',
              onPress: () => router.replace('/(tabs)/settings'),
            },
          ]
        );
      } else {
        Alert.alert(
          'Connection Failed',
          `Failed to connect to Claude API: ${testResult.message}. Please check your API key and try again.`
        );
        await SecureStorageService.removeApiKey();
      }
    } catch (error: any) {
      log.error('API key setup error:', error);
      Alert.alert('Setup Failed', error.message || 'Failed to set up your API key. Please try again.');
      await SecureStorageService.removeApiKey();
    } finally {
      setIsLoading(false);
    }
  };

  const openClaudeConsole = () => {
    void Linking.openURL('https://console.anthropic.com/').catch((error) =>
      log.warn('Failed to open Claude Console:', error)
    );
  };

  const openClaudeDocumentation = () => {
    void Linking.openURL('https://docs.anthropic.com/en/api/getting-started').catch((error) =>
      log.warn('Failed to open Claude documentation:', error)
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <StatusBar translucent backgroundColor="transparent" />
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={AppColors.White} />
          </TouchableOpacity>

          <View style={styles.iconContainer}>
            <Ionicons name="sparkles" size={48} color={AppColors.White} />
          </View>
          <Text style={styles.title}>Welcome to Droplets</Text>
          <Text style={styles.subtitle}>AI-Powered App Generator</Text>
        </View>

        <View style={styles.content}>
          <Text style={styles.description}>
            Transform your ideas into beautiful app concepts using Claude AI. Get started by entering your Claude API key below.
          </Text>

          <View style={styles.featuresContainer}>
            <View style={styles.feature}>
              <Ionicons name="bulb-outline" size={24} color={AppColors.FABDeepOrange} />
              <Text style={styles.featureText}>Generate creative app concepts</Text>
            </View>
            <View style={styles.feature}>
              <Ionicons name="color-palette-outline" size={24} color={AppColors.FABDeepOrange} />
              <Text style={styles.featureText}>Choose from multiple design styles</Text>
            </View>
            <View style={styles.feature}>
              <Ionicons name="layers-outline" size={24} color={AppColors.FABDeepOrange} />
              <Text style={styles.featureText}>Detailed technical specifications</Text>
            </View>
            <View style={styles.feature}>
              <Ionicons name="rocket-outline" size={24} color={AppColors.FABDeepOrange} />
              <Text style={styles.featureText}>Ready-to-use marketing copy</Text>
            </View>
          </View>

          <View style={styles.setupContainer}>
            <Text style={styles.setupTitle}>Setup Your Claude API Key</Text>
            <Text style={styles.setupDescription}>
              You'll need a Claude API key from Anthropic to generate app concepts.
            </Text>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Enter your Claude API key (sk-ant-...)"
                placeholderTextColor={AppColors.Black + '80'}
                value={apiKey}
                onChangeText={setApiKey}
                secureTextEntry={!showApiKey}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowApiKey(!showApiKey)}
                disabled={isLoading}
              >
                <Ionicons
                  name={showApiKey ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={AppColors.Black + '60'}
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
              onPress={handleApiKeySubmit}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={AppColors.White} size="small" />
              ) : (
                <>
                  <Ionicons name="key-outline" size={20} color={AppColors.White} />
                  <Text style={styles.submitButtonText}>Save & Verify API Key</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.helpContainer}>
            <Text style={styles.helpTitle}>Need help getting your API key?</Text>

            <TouchableOpacity style={styles.linkButton} onPress={openClaudeConsole}>
              <Ionicons name="link-outline" size={16} color={AppColors.FABDeepOrange} />
              <Text style={styles.linkText}>Get API Key from Claude Console</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.linkButton} onPress={openClaudeDocumentation}>
              <Ionicons name="document-text-outline" size={16} color={AppColors.FABDeepOrange} />
              <Text style={styles.linkText}>Read Claude API Documentation</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.securityNote}>
            <Ionicons name="shield-checkmark-outline" size={20} color={AppColors.StackColors[7]} />
            <Text style={styles.securityText}>
              Your API key is stored securely using device encryption and never shared with third parties.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.Primary,
  },
  contentContainer: {
    flexGrow: 1,
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 20,
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    padding: 8,
    zIndex: 1,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: AppColors.FABDeepOrange,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    elevation: 8,
    shadowColor: AppColors.Black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: AppColors.Black,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: AppColors.Black + 'CC',
    fontWeight: '500',
  },
  content: {
    flex: 1,
    backgroundColor: AppColors.White,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 20,
  },
  description: {
    fontSize: 16,
    color: AppColors.Black + 'CC',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  featuresContainer: {
    marginBottom: 30,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    paddingHorizontal: 10,
  },
  featureText: {
    fontSize: 16,
    color: AppColors.Black + 'CC',
    marginLeft: 15,
    flex: 1,
  },
  setupContainer: {
    backgroundColor: AppColors.White,
    borderRadius: 20,
    padding: 20,
    marginBottom: 30,
    elevation: 4,
    shadowColor: AppColors.Black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  setupTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: AppColors.Black,
    textAlign: 'center',
    marginBottom: 10,
  },
  setupDescription: {
    fontSize: 14,
    color: AppColors.Black + '99',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.White,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: AppColors.Black + '20',
    marginBottom: 20,
  },
  input: {
    flex: 1,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: AppColors.Black,
  },
  eyeButton: {
    padding: 15,
  },
  submitButton: {
    backgroundColor: AppColors.FABDeepOrange,
    borderRadius: 15,
    paddingVertical: 15,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: AppColors.White,
  },
  helpContainer: {
    marginBottom: 30,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.Black,
    textAlign: 'center',
    marginBottom: 15,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: AppColors.FABDeepOrange + '10',
    borderRadius: 12,
    marginBottom: 10,
    gap: 8,
  },
  linkText: {
    fontSize: 14,
    color: AppColors.FABDeepOrange,
    fontWeight: '500',
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: AppColors.StackColors[7] + '10',
    padding: 15,
    borderRadius: 15,
    gap: 10,
  },
  securityText: {
    flex: 1,
    fontSize: 13,
    color: AppColors.Black + '99',
    lineHeight: 18,
  },
});
