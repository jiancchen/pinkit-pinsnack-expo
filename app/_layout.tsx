import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Platform, View, ActivityIndicator } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import { useEffect, useState } from 'react';
import { SystemBars } from 'react-native-edge-to-edge';
import { SecureStorageService } from '../src/services/SecureStorageService';
import { ClaudeApiService } from '../src/services/ClaudeApiService';
import { GenerationQueueService } from '../src/services/GenerationQueueService';
import { NotificationService } from '../src/services/NotificationService';
import { SeedService } from '../src/services/SeedService';
import { AppColors } from '../src/constants/AppColors';
import { createLogger } from '../src/utils/Logger';
import GenerationActivityBanner from '../src/components/GenerationActivityBanner';
import GenerationLiveActivityController from '../src/components/GenerationLiveActivityController';

const log = createLogger('RootLayout');

export default function RootLayout() {
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Flag to force showing main app without API key requirement
  const FORCE_MAIN_APP = true;

  useEffect(() => {
    NotificationService.configureForegroundBehavior();
    checkApiKeyStatus();
    
    // Initialize sample apps seeding
    SeedService.initializeSeeding();
    
    // Configure navigation bar for Android - make it transparent and edge-to-edge
    if (Platform.OS === 'android') {
      NavigationBar.setBackgroundColorAsync('#00000000'); // Fully transparent
      NavigationBar.setButtonStyleAsync('light'); // Light colored icons
      NavigationBar.setPositionAsync('absolute'); // Content renders behind it
      // NavigationBar.setVisibilityAsync("hidden")
    }
  }, []);

  const checkApiKeyStatus = async () => {
    try {
      const hasKey = await SecureStorageService.hasApiKey();
      if (hasKey) {
        // Initialize Claude API service if API key exists
        const claudeService = ClaudeApiService.getInstance();
        await claudeService.initialize();
        void GenerationQueueService.startWorker();
      }
      setHasApiKey(hasKey);
    } catch (error) {
      log.error('Error checking API key status:', error);
      setHasApiKey(false);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={{ 
        flex: 1, 
        backgroundColor: AppColors.Primary, 
        justifyContent: 'center', 
        alignItems: 'center' 
      }}>
        <ActivityIndicator size="large" color={AppColors.FABDeepOrange} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <SystemBars style="light" />
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Stack
          screenOptions={{
            headerShown: false,
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="welcome" options={{ headerShown: false }} />
          <Stack.Screen name="app-view" options={{ headerShown: false }} />
        </Stack>
        <GenerationLiveActivityController />
        <GenerationActivityBanner />
        <StatusBar style="light" translucent backgroundColor="transparent" />
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
