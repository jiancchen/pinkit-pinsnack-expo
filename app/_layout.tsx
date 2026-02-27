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
import { RuntimeLogService } from '../src/services/RuntimeLogService';
import { AppColors } from '../src/constants/AppColors';
import { createLogger } from '../src/utils/Logger';
import GenerationLiveActivityController from '../src/components/GenerationLiveActivityController';
import { useUISettingsStore } from '../src/stores/UISettingsStore';

const log = createLogger('RootLayout');

type GlobalErrorHandler = (error: unknown, isFatal?: boolean) => void;

type ErrorUtilsLike = {
  getGlobalHandler?: () => GlobalErrorHandler;
  setGlobalHandler?: (handler: GlobalErrorHandler) => void;
};

function normalizeError(error: unknown): { name?: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message || 'Unknown error',
      stack: error.stack,
    };
  }

  if (typeof error === 'string') {
    return { message: error };
  }

  try {
    return { message: JSON.stringify(error) };
  } catch {
    return { message: String(error) };
  }
}

export default function RootLayout() {
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const appTheme = useUISettingsStore((s) => s.appTheme);
  const isUniverseTheme = appTheme === 'universe';
  // Flag to force showing main app without API key requirement
  const FORCE_MAIN_APP = true;

  useEffect(() => {
    const globalScope = globalThis as typeof globalThis & {
      ErrorUtils?: ErrorUtilsLike;
      addEventListener?: (
        type: string,
        listener: (event: { reason?: unknown }) => void
      ) => void;
      removeEventListener?: (
        type: string,
        listener: (event: { reason?: unknown }) => void
      ) => void;
    };

    const errorUtils = globalScope.ErrorUtils;
    const previousHandler = errorUtils?.getGlobalHandler?.();

    if (errorUtils?.setGlobalHandler) {
      errorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
        const normalized = normalizeError(error);
        void RuntimeLogService.appendCrash({
          source: 'global.ErrorUtils',
          isFatal: Boolean(isFatal),
          name: normalized.name,
          message: normalized.message,
          stack: normalized.stack,
        });
        previousHandler?.(error, isFatal);
      });
    }

    const hasRejectionEventAPI =
      typeof globalScope.addEventListener === 'function' &&
      typeof globalScope.removeEventListener === 'function';

    const unhandledRejectionHandler = (event: { reason?: unknown }) => {
      const normalized = normalizeError(event.reason ?? event);
      void RuntimeLogService.appendCrash({
        source: 'unhandledrejection',
        isFatal: false,
        name: normalized.name,
        message: normalized.message,
        stack: normalized.stack,
      });
    };

    if (hasRejectionEventAPI) {
      globalScope.addEventListener?.('unhandledrejection', unhandledRejectionHandler);
    }

    return () => {
      if (previousHandler && errorUtils?.setGlobalHandler) {
        errorUtils.setGlobalHandler(previousHandler);
      }

      if (hasRejectionEventAPI) {
        globalScope.removeEventListener?.('unhandledrejection', unhandledRejectionHandler);
      }
    };
  }, []);

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
      {Platform.OS === 'android' ? <SystemBars style={isUniverseTheme ? 'light' : 'dark'} /> : null}
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: {
              backgroundColor: isUniverseTheme ? '#01030a' : AppColors.Primary,
            },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="welcome" options={{ headerShown: false }} />
          <Stack.Screen name="app-view" options={{ headerShown: false }} />
          <Stack.Screen name="app-recreate" options={{ headerShown: false }} />
          <Stack.Screen name="app-revisions" options={{ headerShown: false }} />
          <Stack.Screen name="stats" options={{ headerShown: false }} />
          <Stack.Screen name="runtime-logs" options={{ headerShown: false }} />
        </Stack>
        <GenerationLiveActivityController />
        {Platform.OS === 'android' ? (
          <StatusBar
            style={isUniverseTheme ? 'light' : 'dark'}
            translucent
            backgroundColor="transparent"
          />
        ) : null}
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
