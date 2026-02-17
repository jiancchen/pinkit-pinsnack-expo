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
import AppThemeBackground from '../src/components/AppThemeBackground';
import { SecureStorageService } from '../src/services/SecureStorageService';
import { ClaudeApiService } from '../src/services/ClaudeApiService';
import { GenerationQueueService } from '../src/services/GenerationQueueService';
import { useUISettingsStore } from '../src/stores/UISettingsStore';
import { createLogger } from '../src/utils/Logger';

const log = createLogger('Welcome');

export default function WelcomePage() {
  const router = useRouter();
  const appTheme = useUISettingsStore((s) => s.appTheme);
  const isUniverseTheme = appTheme === 'universe';

  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  const handleApiKeySubmit = async () => {
    if (!apiKey.trim()) {
      Alert.alert('Missing API key', 'Please enter your Claude API key.');
      return;
    }

    if (!SecureStorageService.validateApiKey(apiKey)) {
      Alert.alert(
        'Invalid API key',
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
      if (!testResult.success) {
        await SecureStorageService.removeApiKey();
        Alert.alert('Connection failed', `Failed to connect to Claude API: ${testResult.message}`);
        return;
      }

      void GenerationQueueService.startWorker();

      Alert.alert(
        'Setup complete',
        'Your API key is saved. Review token/cost controls in Settings if you need stricter limits.',
        [{ text: 'Continue', onPress: () => router.replace('/(tabs)') }]
      );
    } catch (error: any) {
      log.error('API key setup error:', error);
      Alert.alert('Setup failed', error?.message || 'Failed to set up your API key. Please try again.');
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
    <SafeAreaView style={[styles.container, isUniverseTheme ? styles.containerUniverse : undefined]} edges={['top']}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle={isUniverseTheme ? 'light-content' : 'dark-content'}
      />
      <AppThemeBackground />

      <View style={[styles.header, isUniverseTheme ? styles.headerUniverse : undefined]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons
            name="arrow-back"
            size={22}
            color={isUniverseTheme ? 'rgba(226, 240, 255, 0.95)' : 'rgba(0, 0, 0, 0.84)'}
          />
        </TouchableOpacity>
        <View style={[styles.headerIcon, isUniverseTheme ? styles.headerIconUniverse : undefined]}>
          <Ionicons name="sparkles" size={20} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, isUniverseTheme ? styles.headerTitleUniverse : undefined]}>
            Setup PinSnacks
          </Text>
          <Text style={[styles.headerSubtitle, isUniverseTheme ? styles.headerSubtitleUniverse : undefined]}>
            Quick start in 5 steps
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.stepCard, isUniverseTheme ? styles.stepCardUniverse : undefined]}>
          <Text style={[styles.stepLabel, isUniverseTheme ? styles.stepLabelUniverse : undefined]}>1</Text>
          <Text style={[styles.stepText, isUniverseTheme ? styles.stepTextUniverse : undefined]}>
            PinSnacks creates apps for you on your phone, and your saved apps stay on this device until you delete them.
          </Text>
        </View>

        <View style={[styles.stepCard, isUniverseTheme ? styles.stepCardUniverse : undefined]}>
          <Text style={[styles.stepLabel, isUniverseTheme ? styles.stepLabelUniverse : undefined]}>2</Text>
          <Text style={[styles.stepText, isUniverseTheme ? styles.stepTextUniverse : undefined]}>
            Bring your own API key. We currently support Claude, with more providers planned.
          </Text>
        </View>

        <View style={[styles.stepCard, isUniverseTheme ? styles.stepCardUniverse : undefined]}>
          <Text style={[styles.stepLabel, isUniverseTheme ? styles.stepLabelUniverse : undefined]}>3</Text>
          <Text style={[styles.stepText, isUniverseTheme ? styles.stepTextUniverse : undefined]}>
            Demo Preview (placeholder)
          </Text>
          <View style={[styles.demoPlaceholder, isUniverseTheme ? styles.demoPlaceholderUniverse : undefined]}>
            <Ionicons
              name="play-circle-outline"
              size={42}
              color={isUniverseTheme ? 'rgba(214, 233, 253, 0.92)' : 'rgba(31, 41, 55, 0.8)'}
            />
            <Text style={[styles.demoPlaceholderText, isUniverseTheme ? styles.demoPlaceholderTextUniverse : undefined]}>
              Looping setup demo will be added here.
            </Text>
          </View>
        </View>

        <View style={[styles.keySection, isUniverseTheme ? styles.keySectionUniverse : undefined]}>
          <View style={styles.sectionRow}>
            <Text style={[styles.stepLabel, isUniverseTheme ? styles.stepLabelUniverse : undefined]}>4</Text>
            <Text style={[styles.keyTitle, isUniverseTheme ? styles.keyTitleUniverse : undefined]}>
              Add your Claude API key
            </Text>
          </View>

          <View style={[styles.inputContainer, isUniverseTheme ? styles.inputContainerUniverse : undefined]}>
            <TextInput
              style={[styles.input, isUniverseTheme ? styles.inputUniverse : undefined]}
              placeholder="Enter your Claude API key (sk-ant-...)"
              placeholderTextColor={isUniverseTheme ? 'rgba(191, 216, 243, 0.66)' : 'rgba(0, 0, 0, 0.45)'}
              value={apiKey}
              onChangeText={setApiKey}
              secureTextEntry={!showApiKey}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowApiKey((prev) => !prev)}
              disabled={isLoading}
            >
              <Ionicons
                name={showApiKey ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={isUniverseTheme ? 'rgba(204, 228, 251, 0.82)' : 'rgba(0, 0, 0, 0.5)'}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, isLoading ? styles.submitButtonDisabled : undefined]}
            onPress={handleApiKeySubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="key-outline" size={18} color="#fff" />
                <Text style={styles.submitButtonText}>Save & Verify Key</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.helpLinksWrap}>
            <TouchableOpacity style={styles.helpLink} onPress={openClaudeConsole}>
              <Ionicons name="link-outline" size={15} color={AppColors.FABDeepOrange} />
              <Text style={[styles.helpLinkText, isUniverseTheme ? styles.helpLinkTextUniverse : undefined]}>
                Get API key from Claude Console
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.helpLink} onPress={openClaudeDocumentation}>
              <Ionicons name="document-text-outline" size={15} color={AppColors.FABDeepOrange} />
              <Text style={[styles.helpLinkText, isUniverseTheme ? styles.helpLinkTextUniverse : undefined]}>
                Claude API getting-started docs
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.stepCard, isUniverseTheme ? styles.stepCardUniverse : undefined]}>
          <Text style={[styles.stepLabel, isUniverseTheme ? styles.stepLabelUniverse : undefined]}>5</Text>
          <Text style={[styles.stepText, isUniverseTheme ? styles.stepTextUniverse : undefined]}>
            Cost and usage guidance
          </Text>
          <Text style={[styles.guidanceText, isUniverseTheme ? styles.guidanceTextUniverse : undefined]}>
            You control usage with model selection, max output tokens, and temperature. If unsure, keep recommended defaults.
          </Text>
          <Text style={[styles.guidanceText, isUniverseTheme ? styles.guidanceTextUniverse : undefined]}>
            Misconfigured settings can consume a lot of tokens. Check Settings for usage/cost insights and tune limits as needed.
          </Text>
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
  containerUniverse: {
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 10,
  },
  headerUniverse: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(123, 169, 220, 0.35)',
    backgroundColor: 'rgba(8, 24, 44, 0.42)',
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
  },
  headerIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.FABMain,
  },
  headerIconUniverse: {
    backgroundColor: '#0f7cff',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: 'rgba(0, 0, 0, 0.86)',
  },
  headerTitleUniverse: {
    color: 'rgba(232, 245, 255, 0.96)',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(0, 0, 0, 0.62)',
    marginTop: 2,
  },
  headerSubtitleUniverse: {
    color: 'rgba(191, 216, 243, 0.86)',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    gap: 12,
    paddingBottom: 20,
  },
  stepCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 7,
  },
  stepCardUniverse: {
    borderColor: 'rgba(123, 169, 220, 0.34)',
    backgroundColor: 'rgba(8, 26, 48, 0.88)',
  },
  stepLabel: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: '900',
    color: '#0f172a',
    backgroundColor: 'rgba(15, 23, 42, 0.12)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  stepLabelUniverse: {
    color: 'rgba(232, 245, 255, 0.95)',
    backgroundColor: 'rgba(49, 102, 159, 0.65)',
  },
  stepText: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(0, 0, 0, 0.8)',
    lineHeight: 20,
  },
  stepTextUniverse: {
    color: 'rgba(219, 236, 255, 0.94)',
  },
  demoPlaceholder: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  demoPlaceholderUniverse: {
    borderColor: 'rgba(123, 169, 220, 0.34)',
    backgroundColor: 'rgba(7, 24, 45, 0.9)',
  },
  demoPlaceholderText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(0, 0, 0, 0.62)',
  },
  demoPlaceholderTextUniverse: {
    color: 'rgba(191, 216, 243, 0.86)',
  },
  keySection: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 10,
  },
  keySectionUniverse: {
    borderColor: 'rgba(123, 169, 220, 0.34)',
    backgroundColor: 'rgba(8, 26, 48, 0.88)',
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  keyTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: 'rgba(0, 0, 0, 0.84)',
  },
  keyTitleUniverse: {
    color: 'rgba(232, 245, 255, 0.95)',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.36)',
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  inputContainerUniverse: {
    borderColor: 'rgba(123, 169, 220, 0.44)',
    backgroundColor: 'rgba(7, 24, 45, 0.9)',
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: 'rgba(0, 0, 0, 0.84)',
  },
  inputUniverse: {
    color: 'rgba(227, 242, 255, 0.95)',
  },
  eyeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  submitButton: {
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: AppColors.FABMain,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  helpLinksWrap: {
    gap: 8,
  },
  helpLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  helpLinkText: {
    fontSize: 12,
    color: 'rgba(0, 0, 0, 0.7)',
    fontWeight: '700',
  },
  helpLinkTextUniverse: {
    color: 'rgba(205, 226, 248, 0.9)',
  },
  guidanceText: {
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(0, 0, 0, 0.68)',
    fontWeight: '600',
  },
  guidanceTextUniverse: {
    color: 'rgba(191, 216, 243, 0.88)',
  },
});
