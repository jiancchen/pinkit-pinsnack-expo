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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../types/PromptHistory';
import { SecureStorageService } from '../services/SecureStorageService';
import { ClaudeApiService } from '../services/ClaudeApiService';

interface WelcomeScreenProps {
  onApiKeySetup: () => void;
  navigation?: any;
}

export default function WelcomeScreen({ onApiKeySetup, navigation }: WelcomeScreenProps) {
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
      // Store the API key
      await SecureStorageService.storeApiKey(apiKey);
      
      // Initialize the Claude API service
      const claudeService = ClaudeApiService.getInstance();
      await claudeService.initialize();
      
      // Test the connection
      const testResult = await claudeService.testConnection();
      
      if (testResult.success) {
        Alert.alert(
          'Success!',
          'Your Claude API key has been saved and verified. You can now start generating apps!',
          [{ text: 'Get Started', onPress: onApiKeySetup }]
        );
      } else {
        Alert.alert(
          'Connection Failed',
          `Failed to connect to Claude API: ${testResult.message}. Please check your API key and try again.`
        );
        await SecureStorageService.removeApiKey();
      }
    } catch (error: any) {
      console.error('API key setup error:', error);
      Alert.alert(
        'Setup Failed',
        error.message || 'Failed to set up your API key. Please try again.'
      );
      await SecureStorageService.removeApiKey();
    } finally {
      setIsLoading(false);
    }
  };

  const openClaudeConsole = () => {
    Linking.openURL('https://console.anthropic.com/');
  };

  const openClaudeDocumentation = () => {
    Linking.openURL('https://docs.anthropic.com/en/api/getting-started');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        {navigation && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={AppColors.White} />
          </TouchableOpacity>
        )}
        <View style={styles.iconContainer}>
          <Ionicons name="sparkles" size={48} color={AppColors.White} />
        </View>
        <Text style={styles.title}>Welcome to Droplets</Text>
        <Text style={styles.subtitle}>AI-Powered App Generator</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.description}>
          Transform your ideas into beautiful app concepts using Claude AI. 
          Get started by entering your Claude API key below.
        </Text>

        {/* Features */}
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

        {/* API Key Setup */}
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

        {/* Help Links */}
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

        {/* Security Note */}
        <View style={styles.securityNote}>
          <Ionicons name="shield-checkmark-outline" size={20} color={AppColors.StackColors[7]} />
          <Text style={styles.securityText}>
            Your API key is stored securely using device encryption and never shared with third parties.
          </Text>
        </View>
      </View>
    </ScrollView>
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 40,
  },
  description: {
    fontSize: 16,
    color: AppColors.Black + 'E6',
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 32,
  },
  featuresContainer: {
    marginBottom: 32,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  featureText: {
    fontSize: 16,
    color: AppColors.Black + 'E6',
    marginLeft: 12,
    flex: 1,
  },
  setupContainer: {
    marginBottom: 32,
  },
  setupTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: AppColors.Black,
    marginBottom: 8,
  },
  setupDescription: {
    fontSize: 14,
    color: AppColors.Black + 'CC',
    marginBottom: 20,
    lineHeight: 20,
  },
  inputContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  input: {
    height: 56,
    borderWidth: 2,
    borderColor: AppColors.Black + '20',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingRight: 50,
    fontSize: 16,
    color: AppColors.Black,
    backgroundColor: AppColors.White,
  },
  eyeButton: {
    position: 'absolute',
    right: 16,
    top: 18,
    padding: 4,
  },
  submitButton: {
    height: 56,
    backgroundColor: AppColors.FABDeepOrange,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: AppColors.Black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  submitButtonDisabled: {
    backgroundColor: AppColors.Black + '40',
    elevation: 0,
    shadowOpacity: 0,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.White,
    marginLeft: 8,
  },
  helpContainer: {
    marginBottom: 32,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.Black,
    marginBottom: 16,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: AppColors.Black + '08',
    borderRadius: 8,
    marginBottom: 8,
  },
  linkText: {
    fontSize: 14,
    color: AppColors.FABDeepOrange,
    marginLeft: 8,
    fontWeight: '500',
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: AppColors.StackColors[7] + '20',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: AppColors.StackColors[7],
  },
  securityText: {
    fontSize: 12,
    color: AppColors.Black + 'CC',
    marginLeft: 12,
    flex: 1,
    lineHeight: 16,
  },
});