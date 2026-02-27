import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
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
  Platform,
  StatusBar,
  Animated,
  Easing,
  AccessibilityInfo,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { AppColors } from '../src/constants/AppColors';
import AppThemeBackground from '../src/components/AppThemeBackground';
import { SecureStorageService } from '../src/services/SecureStorageService';
import { ClaudeApiService } from '../src/services/ClaudeApiService';
import { GenerationQueueService } from '../src/services/GenerationQueueService';
import { useUISettingsStore } from '../src/stores/UISettingsStore';
import { createLogger } from '../src/utils/Logger';

const log = createLogger('Welcome');

const TOTAL_STEPS = 5;
const TERMS_ACCEPTANCE_STORAGE_KEY = '@pinsnacks/terms_acceptance';
const TERMS_OF_USE_VERSION = '2026-02-26';

type KeySetupOutcome = 'verified' | 'skipped' | null;

type TermsAcceptanceRecord = {
  version: string;
  acceptedAt: string;
};

export default function WelcomePage() {
  const router = useRouter();
  const appTheme = useUISettingsStore((s) => s.appTheme);
  const isUniverseTheme = appTheme === 'universe';
  const { width: screenWidth } = useWindowDimensions();

  const [currentStep, setCurrentStep] = useState(1);
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSavingTerms, setIsSavingTerms] = useState(false);
  const [termsAcceptedAt, setTermsAcceptedAt] = useState<string | null>(null);
  const [keySetupOutcome, setKeySetupOutcome] = useState<KeySetupOutcome>(null);
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);

  const stepTransitionAnim = React.useRef(new Animated.Value(1)).current;
  const ambientFloatAnim = React.useRef(new Animated.Value(0)).current;
  const accentPulseAnim = React.useRef(new Animated.Value(0)).current;

  const isBusy = isLoading || isSavingTerms;

  const stageAnimatedStyle = {
    opacity: stepTransitionAnim,
    transform: [
      {
        translateY: stepTransitionAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [18, 0],
        }),
      },
    ],
  };

  const ambientDrift = ambientFloatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-12, 12],
  });

  const ambientDriftInverse = ambientFloatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [12, -12],
  });

  const ambientScale = accentPulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.95, 1.08],
  });

  const ambientOpacity = accentPulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.55],
  });

  const headerIconScale = accentPulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06],
  });

  useEffect(() => {
    let isMounted = true;

    const loadTermsAcceptance = async () => {
      try {
        const raw = await AsyncStorage.getItem(TERMS_ACCEPTANCE_STORAGE_KEY);
        if (!raw || !isMounted) {
          return;
        }

        const parsed = JSON.parse(raw) as Partial<TermsAcceptanceRecord>;
        if (parsed.version === TERMS_OF_USE_VERSION) {
          setTermsAccepted(true);
          setTermsAcceptedAt(typeof parsed.acceptedAt === 'string' ? parsed.acceptedAt : null);
        }
      } catch (error) {
        log.warn('Failed to load Terms acceptance state:', error);
      }
    };

    void loadTermsAcceptance();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadReduceMotionPreference = async () => {
      try {
        const enabled = await AccessibilityInfo.isReduceMotionEnabled();
        if (isMounted) {
          setReduceMotionEnabled(Boolean(enabled));
        }
      } catch {
        // no-op
      }
    };

    void loadReduceMotionPreference();

    const subscription = AccessibilityInfo.addEventListener?.(
      'reduceMotionChanged',
      (enabled: boolean) => {
        setReduceMotionEnabled(Boolean(enabled));
      }
    );

    return () => {
      isMounted = false;
      subscription?.remove?.();
    };
  }, []);

  useEffect(() => {
    if (reduceMotionEnabled) {
      stepTransitionAnim.setValue(1);
      return;
    }

    stepTransitionAnim.setValue(0);
    Animated.timing(stepTransitionAnim, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [currentStep, reduceMotionEnabled, stepTransitionAnim]);

  useEffect(() => {
    if (reduceMotionEnabled) {
      ambientFloatAnim.setValue(0);
      accentPulseAnim.setValue(0);
      return;
    }

    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(ambientFloatAnim, {
          toValue: 1,
          duration: 4000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(ambientFloatAnim, {
          toValue: 0,
          duration: 4000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(accentPulseAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(accentPulseAnim, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    floatLoop.start();
    pulseLoop.start();

    return () => {
      floatLoop.stop();
      pulseLoop.stop();
    };
  }, [reduceMotionEnabled, ambientFloatAnim, accentPulseAnim]);

  const goToStep = (step: number) => {
    setCurrentStep(Math.max(1, Math.min(TOTAL_STEPS, step)));
  };

  const handleBackPress = () => {
    if (isBusy) {
      return;
    }

    if (currentStep === 1) {
      router.back();
      return;
    }

    goToStep(currentStep - 1);
  };

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

      setKeySetupOutcome('verified');
      setApiKey('');
      goToStep(5);
    } catch (error: any) {
      log.error('API key setup error:', error);
      Alert.alert('Setup failed', error?.message || 'Failed to set up your API key. Please try again.');
      await SecureStorageService.removeApiKey();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkipApiKey = () => {
    if (isLoading) {
      return;
    }

    setKeySetupOutcome('skipped');
    goToStep(5);
  };

  const handleTermsContinue = async () => {
    if (!termsAccepted) {
      return;
    }

    setIsSavingTerms(true);
    try {
      const acceptedAt = new Date().toISOString();
      const record: TermsAcceptanceRecord = {
        version: TERMS_OF_USE_VERSION,
        acceptedAt,
      };
      await AsyncStorage.setItem(TERMS_ACCEPTANCE_STORAGE_KEY, JSON.stringify(record));
      setTermsAcceptedAt(acceptedAt);
      goToStep(4);
    } catch (error) {
      log.warn('Failed to persist Terms acceptance:', error);
      Alert.alert(
        'Unable to continue',
        'We could not record your Terms acceptance on this device. Please try again.'
      );
    } finally {
      setIsSavingTerms(false);
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

  const openTermsOfUse = () => {
    Alert.alert(
      'Terms of Use',
      'Wire this button to your published Terms of Use URL before release. The acceptance screen is enforced, but the document link is still a placeholder.'
    );
  };

  const stepSubtitle = `Step ${currentStep} of ${TOTAL_STEPS}`;
  const canContinueFromTerms = termsAccepted && !isSavingTerms;
  const isTermsScreenAcceptedFromStorage = Boolean(termsAcceptedAt);

  const renderScreen = () => {
    if (currentStep === 1) {
      return (
        <>
          <View
            style={[
              styles.screenCard,
              styles.singleStepCard,
              isUniverseTheme ? styles.screenCardUniverse : undefined,
            ]}
          >
            <View style={styles.sectionRow}>
              <Text style={[styles.stepLabel, isUniverseTheme ? styles.stepLabelUniverse : undefined]}>1</Text>
              <Text style={[styles.cardTitle, isUniverseTheme ? styles.cardTitleUniverse : undefined]}>
                Create apps directly on your phone
              </Text>
            </View>
            <Text style={[styles.stepText, isUniverseTheme ? styles.stepTextUniverse : undefined]}>
              PinSnacks creates apps for you on your phone, and your saved apps stay on this device until you delete
              them.
            </Text>
            <Text style={[styles.supportText, isUniverseTheme ? styles.supportTextUniverse : undefined]}>
              You can revisit setup later from Settings to update your key or review onboarding details.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, isBusy ? styles.actionButtonDisabled : undefined]}
            onPress={() => goToStep(2)}
            disabled={isBusy}
          >
            <Text style={styles.primaryButtonText}>Continue</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
        </>
      );
    }

    if (currentStep === 2) {
      return (
        <>
          <View
            style={[
              styles.screenCard,
              styles.dualStepCard,
              isUniverseTheme ? styles.screenCardUniverse : undefined,
            ]}
          >
            <View style={styles.sectionRow}>
              <Text style={[styles.stepLabel, isUniverseTheme ? styles.stepLabelUniverse : undefined]}>Demo</Text>
              <Text style={[styles.cardTitle, isUniverseTheme ? styles.cardTitleUniverse : undefined]}>
                Demo preview
              </Text>
            </View>

            <View style={[styles.demoPlaceholder, isUniverseTheme ? styles.demoPlaceholderUniverse : undefined]}>
              <Ionicons
                name="play-circle-outline"
                size={54}
                color={isUniverseTheme ? 'rgba(214, 233, 253, 0.92)' : 'rgba(31, 41, 55, 0.8)'}
              />
              <Text style={[styles.demoPlaceholderText, isUniverseTheme ? styles.demoPlaceholderTextUniverse : undefined]}>
                Demo video placeholder
              </Text>
              <Text
                style={[
                  styles.demoPlaceholderSubtext,
                  isUniverseTheme ? styles.demoPlaceholderSubtextUniverse : undefined,
                ]}
              >
                Looping setup demo will be added here.
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.screenCard,
              styles.dualStepCard,
              isUniverseTheme ? styles.screenCardUniverse : undefined,
            ]}
          >
            <View style={styles.sectionRow}>
              <Text style={[styles.stepLabel, isUniverseTheme ? styles.stepLabelUniverse : undefined]}>Info</Text>
              <Text style={[styles.cardTitle, isUniverseTheme ? styles.cardTitleUniverse : undefined]}>
                Bring your own API key
              </Text>
            </View>
            <Text style={[styles.stepText, isUniverseTheme ? styles.stepTextUniverse : undefined]}>
              We currently support Claude, with more providers planned. You will add your key in a later step after
              Terms acceptance.
            </Text>
            <Text style={[styles.supportText, isUniverseTheme ? styles.supportTextUniverse : undefined]}>
              You can also skip key setup and configure it later in Settings.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, isBusy ? styles.actionButtonDisabled : undefined]}
            onPress={() => goToStep(3)}
            disabled={isBusy}
          >
            <Text style={styles.primaryButtonText}>Continue</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
        </>
      );
    }

    if (currentStep === 3) {
      return (
        <>
          <View
            style={[
              styles.screenCard,
              styles.singleStepCard,
              isUniverseTheme ? styles.screenCardUniverse : undefined,
            ]}
          >
            <View style={styles.sectionRow}>
              <Text style={[styles.stepLabel, isUniverseTheme ? styles.stepLabelUniverse : undefined]}>3</Text>
              <Text style={[styles.cardTitle, isUniverseTheme ? styles.cardTitleUniverse : undefined]}>
                Terms of Use
              </Text>
            </View>

            <Text style={[styles.stepText, isUniverseTheme ? styles.stepTextUniverse : undefined]}>
              You must accept the Terms of Use before continuing.
            </Text>

            <View style={styles.bulletsWrap}>
              <View style={styles.bulletRow}>
                <View style={[styles.bulletDot, isUniverseTheme ? styles.bulletDotUniverse : undefined]} />
                <Text style={[styles.bulletText, isUniverseTheme ? styles.bulletTextUniverse : undefined]}>
                  Usage may incur API provider charges based on your own Claude account and settings.
                </Text>
              </View>
              <View style={styles.bulletRow}>
                <View style={[styles.bulletDot, isUniverseTheme ? styles.bulletDotUniverse : undefined]} />
                <Text style={[styles.bulletText, isUniverseTheme ? styles.bulletTextUniverse : undefined]}>
                  AI-generated output can be incorrect or incomplete and should be reviewed before use.
                </Text>
              </View>
              <View style={styles.bulletRow}>
                <View style={[styles.bulletDot, isUniverseTheme ? styles.bulletDotUniverse : undefined]} />
                <Text style={[styles.bulletText, isUniverseTheme ? styles.bulletTextUniverse : undefined]}>
                  Acceptance is stored on this device with a timestamp and Terms version for onboarding records.
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.linkButton, isUniverseTheme ? styles.linkButtonUniverse : undefined]}
              onPress={openTermsOfUse}
            >
              <Ionicons name="document-text-outline" size={16} color={AppColors.FABDeepOrange} />
              <Text style={[styles.linkButtonText, isUniverseTheme ? styles.linkButtonTextUniverse : undefined]}>
                View Terms of Use (link placeholder)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.checkboxRow, isUniverseTheme ? styles.checkboxRowUniverse : undefined]}
              onPress={() => setTermsAccepted((prev) => !prev)}
              activeOpacity={0.85}
              disabled={isSavingTerms}
            >
              <Ionicons
                name={termsAccepted ? 'checkmark-circle' : 'ellipse-outline'}
                size={22}
                color={
                  termsAccepted
                    ? AppColors.FABDeepOrange
                    : isUniverseTheme
                      ? 'rgba(191, 216, 243, 0.86)'
                      : 'rgba(0, 0, 0, 0.55)'
                }
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.checkboxText, isUniverseTheme ? styles.checkboxTextUniverse : undefined]}>
                  I have read and accept the Terms of Use.
                </Text>
                {isTermsScreenAcceptedFromStorage ? (
                  <Text
                    style={[
                      styles.checkboxSubtext,
                      isUniverseTheme ? styles.checkboxSubtextUniverse : undefined,
                    ]}
                  >
                    Previously accepted on this device.
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.primaryButton,
              !canContinueFromTerms ? styles.actionButtonDisabled : undefined,
            ]}
            onPress={() => void handleTermsContinue()}
            disabled={!canContinueFromTerms}
          >
            {isSavingTerms ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Text style={styles.primaryButtonText}>Accept & Continue</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        </>
      );
    }

    if (currentStep === 4) {
      return (
        <>
          <View
            style={[
              styles.keySection,
              styles.keyStageCard,
              isUniverseTheme ? styles.keySectionUniverse : undefined,
            ]}
          >
            <View style={styles.sectionRow}>
              <Text style={[styles.stepLabel, isUniverseTheme ? styles.stepLabelUniverse : undefined]}>4</Text>
              <Text style={[styles.keyTitle, isUniverseTheme ? styles.keyTitleUniverse : undefined]}>
                Add your Claude API key
              </Text>
            </View>

            <Text style={[styles.supportText, isUniverseTheme ? styles.supportTextUniverse : undefined]}>
              This step is optional. You can skip now and set up your key later in Settings.
            </Text>

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
              style={[styles.submitButton, isLoading ? styles.actionButtonDisabled : undefined]}
              onPress={() => void handleApiKeySubmit()}
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

            <TouchableOpacity
              style={[styles.secondaryButton, isLoading ? styles.actionButtonDisabled : undefined]}
              onPress={handleSkipApiKey}
              disabled={isLoading}
            >
              <Text style={[styles.secondaryButtonText, isUniverseTheme ? styles.secondaryButtonTextUniverse : undefined]}>
                Skip for now
              </Text>
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
        </>
      );
    }

    return (
      <>
        <View
          style={[
            styles.screenCard,
            styles.singleStepCard,
            isUniverseTheme ? styles.screenCardUniverse : undefined,
          ]}
        >
          <View style={styles.finalIconWrap}>
            <Ionicons
              name={keySetupOutcome === 'verified' ? 'checkmark-circle' : 'sparkles'}
              size={44}
              color={keySetupOutcome === 'verified' ? '#10b981' : AppColors.FABDeepOrange}
            />
          </View>

          <Text style={[styles.finalTitle, isUniverseTheme ? styles.finalTitleUniverse : undefined]}>
            Welcome to PinSnacks
          </Text>
          <Text style={[styles.finalBody, isUniverseTheme ? styles.finalBodyUniverse : undefined]}>
            {keySetupOutcome === 'verified'
              ? 'Your Claude API key is verified. You are ready to create and update apps.'
              : 'Setup is complete. You can add your Claude API key later in Settings when you are ready.'}
          </Text>

          <View style={[styles.infoCallout, isUniverseTheme ? styles.infoCalloutUniverse : undefined]}>
            <Ionicons
              name="settings-outline"
              size={16}
              color={isUniverseTheme ? 'rgba(209, 232, 255, 0.92)' : 'rgba(17, 24, 39, 0.72)'}
            />
            <Text style={[styles.infoCalloutText, isUniverseTheme ? styles.infoCalloutTextUniverse : undefined]}>
              Review token and cost controls in Settings to keep usage within your preferred limits.
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.primaryButtonText}>Start Using PinSnacks</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </TouchableOpacity>
      </>
    );
  };

  return (
    <SafeAreaView style={[styles.container, isUniverseTheme ? styles.containerUniverse : undefined]} edges={['top']}>
      {Platform.OS === 'android' ? (
        <StatusBar
          translucent
          backgroundColor="transparent"
          barStyle={isUniverseTheme ? 'light-content' : 'dark-content'}
        />
      ) : null}
      <AppThemeBackground />
      <LinearGradient
        pointerEvents="none"
        colors={
          isUniverseTheme
            ? ['rgba(6, 20, 39, 0.65)', 'rgba(6, 28, 53, 0.42)', 'rgba(7, 20, 38, 0.65)']
            : ['rgba(255, 237, 213, 0.55)', 'rgba(250, 232, 255, 0.32)', 'rgba(224, 242, 254, 0.52)']
        }
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.headerGradient}
      />
      <View pointerEvents="none" style={styles.effectsLayer}>
        <Animated.View
          style={[
            styles.glowOrb,
            styles.glowOrbTop,
            {
              width: screenWidth * 0.78,
              height: screenWidth * 0.78,
              opacity: ambientOpacity,
              transform: [{ translateY: ambientDrift }, { scale: ambientScale }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.glowOrb,
            styles.glowOrbMid,
            {
              width: screenWidth * 0.56,
              height: screenWidth * 0.56,
              opacity: ambientOpacity,
              transform: [{ translateY: ambientDriftInverse }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.glowOrb,
            styles.glowOrbBottom,
            {
              width: screenWidth * 0.64,
              height: screenWidth * 0.64,
              opacity: ambientOpacity,
              transform: [{ translateY: ambientDrift }],
            },
          ]}
        />
      </View>

      <View style={[styles.header, isUniverseTheme ? styles.headerUniverse : undefined]}>
        <TouchableOpacity
          style={[styles.backButton, isBusy ? styles.backButtonDisabled : undefined]}
          onPress={handleBackPress}
          disabled={isBusy}
        >
          <Ionicons
            name="arrow-back"
            size={22}
            color={isUniverseTheme ? 'rgba(226, 240, 255, 0.95)' : 'rgba(0, 0, 0, 0.84)'}
          />
        </TouchableOpacity>
        <Animated.View
          style={[
            styles.headerIcon,
            isUniverseTheme ? styles.headerIconUniverse : undefined,
            !reduceMotionEnabled ? { transform: [{ scale: headerIconScale }] } : undefined,
          ]}
        >
          <Ionicons name="sparkles" size={20} color="#fff" />
        </Animated.View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, isUniverseTheme ? styles.headerTitleUniverse : undefined]}>
            Setup PinSnacks
          </Text>
          <Text style={[styles.headerSubtitle, isUniverseTheme ? styles.headerSubtitleUniverse : undefined]}>
            {stepSubtitle}
          </Text>
        </View>
      </View>

      <View style={styles.progressWrap}>
        {Array.from({ length: TOTAL_STEPS }).map((_, index) => {
          const stepNumber = index + 1;
          const isActive = stepNumber === currentStep;
          const isComplete = stepNumber < currentStep;
          return (
            <View
              key={stepNumber}
              style={[
                styles.progressDot,
                isUniverseTheme ? styles.progressDotUniverse : undefined,
                isComplete ? styles.progressDotComplete : undefined,
                isActive ? styles.progressDotActive : undefined,
              ]}
            />
          );
        })}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.screenStage, stageAnimatedStyle]}>{renderScreen()}</Animated.View>
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
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 220,
  },
  effectsLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  glowOrb: {
    position: 'absolute',
    borderRadius: 999,
  },
  glowOrbTop: {
    top: -180,
    left: -80,
    backgroundColor: 'rgba(251, 146, 60, 0.34)',
  },
  glowOrbMid: {
    top: 210,
    right: -120,
    backgroundColor: 'rgba(56, 189, 248, 0.22)',
  },
  glowOrbBottom: {
    bottom: -220,
    left: -90,
    backgroundColor: 'rgba(168, 85, 247, 0.16)',
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
  backButtonDisabled: {
    opacity: 0.5,
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
  progressWrap: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  progressDot: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 42, 0.14)',
  },
  progressDotUniverse: {
    backgroundColor: 'rgba(123, 169, 220, 0.2)',
  },
  progressDotComplete: {
    backgroundColor: 'rgba(15, 118, 110, 0.65)',
  },
  progressDotActive: {
    backgroundColor: AppColors.FABDeepOrange,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 30,
  },
  screenStage: {
    gap: 12,
    minHeight: 560,
  },
  screenCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 5,
  },
  screenCardUniverse: {
    borderColor: 'rgba(123, 169, 220, 0.4)',
    backgroundColor: 'rgba(8, 26, 48, 0.9)',
    shadowOpacity: 0.18,
  },
  singleStepCard: {
    minHeight: 340,
  },
  dualStepCard: {
    minHeight: 248,
  },
  keyStageCard: {
    minHeight: 380,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  cardTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: 'rgba(0, 0, 0, 0.84)',
    flex: 1,
  },
  cardTitleUniverse: {
    color: 'rgba(232, 245, 255, 0.95)',
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
  supportText: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    color: 'rgba(0, 0, 0, 0.68)',
  },
  supportTextUniverse: {
    color: 'rgba(191, 216, 243, 0.88)',
  },
  demoPlaceholder: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    minHeight: 156,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 12,
  },
  demoPlaceholderUniverse: {
    borderColor: 'rgba(123, 169, 220, 0.34)',
    backgroundColor: 'rgba(7, 24, 45, 0.9)',
  },
  demoPlaceholderText: {
    fontSize: 13,
    fontWeight: '800',
    color: 'rgba(0, 0, 0, 0.72)',
  },
  demoPlaceholderTextUniverse: {
    color: 'rgba(214, 233, 253, 0.92)',
  },
  demoPlaceholderSubtext: {
    fontSize: 12,
    textAlign: 'center',
    color: 'rgba(0, 0, 0, 0.58)',
    fontWeight: '600',
  },
  demoPlaceholderSubtextUniverse: {
    color: 'rgba(191, 216, 243, 0.82)',
  },
  bulletsWrap: {
    gap: 8,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    marginTop: 7,
  },
  bulletDotUniverse: {
    backgroundColor: 'rgba(191, 216, 243, 0.86)',
  },
  bulletText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    color: 'rgba(0, 0, 0, 0.72)',
  },
  bulletTextUniverse: {
    color: 'rgba(205, 226, 248, 0.9)',
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(251, 146, 60, 0.35)',
    backgroundColor: 'rgba(251, 146, 60, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  linkButtonUniverse: {
    borderColor: 'rgba(251, 146, 60, 0.28)',
    backgroundColor: 'rgba(251, 146, 60, 0.08)',
  },
  linkButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgba(0, 0, 0, 0.75)',
  },
  linkButtonTextUniverse: {
    color: 'rgba(220, 236, 253, 0.94)',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  checkboxRowUniverse: {
    borderColor: 'rgba(123, 169, 220, 0.32)',
    backgroundColor: 'rgba(7, 24, 45, 0.7)',
  },
  checkboxText: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    color: 'rgba(0, 0, 0, 0.82)',
  },
  checkboxTextUniverse: {
    color: 'rgba(225, 240, 255, 0.95)',
  },
  checkboxSubtext: {
    marginTop: 2,
    fontSize: 11,
    color: 'rgba(0, 0, 0, 0.56)',
    fontWeight: '600',
  },
  checkboxSubtextUniverse: {
    color: 'rgba(191, 216, 243, 0.8)',
  },
  keySection: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 5,
  },
  keySectionUniverse: {
    borderColor: 'rgba(123, 169, 220, 0.4)',
    backgroundColor: 'rgba(8, 26, 48, 0.9)',
    shadowOpacity: 0.18,
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
  primaryButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#ff6a2f',
    shadowColor: '#ff6a2f',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 4,
  },
  submitButton: {
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#ff6a2f',
    shadowColor: '#ff6a2f',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 4,
  },
  actionButtonDisabled: {
    opacity: 0.65,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  secondaryButton: {
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.14)',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: 'rgba(0, 0, 0, 0.76)',
  },
  secondaryButtonTextUniverse: {
    color: 'rgba(225, 240, 255, 0.95)',
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
  finalIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  finalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: 'rgba(0, 0, 0, 0.88)',
    textAlign: 'center',
  },
  finalTitleUniverse: {
    color: 'rgba(232, 245, 255, 0.96)',
  },
  finalBody: {
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(0, 0, 0, 0.72)',
    fontWeight: '700',
    textAlign: 'center',
  },
  finalBodyUniverse: {
    color: 'rgba(205, 226, 248, 0.9)',
  },
  infoCallout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  infoCalloutUniverse: {
    borderColor: 'rgba(123, 169, 220, 0.28)',
    backgroundColor: 'rgba(7, 24, 45, 0.68)',
  },
  infoCalloutText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: 'rgba(0, 0, 0, 0.7)',
    fontWeight: '700',
  },
  infoCalloutTextUniverse: {
    color: 'rgba(205, 226, 248, 0.9)',
  },
});
