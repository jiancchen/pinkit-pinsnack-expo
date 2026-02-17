/**
 * Screenshot State Store using Zustand
 * Provides reactive state management for screenshot capture and loading
 * Similar to Android LiveData/Flow pattern with emit/observe
 */

import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { ScreenshotService } from '../services/ScreenshotService';
import { WebViewScreenshotService } from '../services/WebViewScreenshotService';
import { ScreenshotLogger as log } from '../utils/Logger';

export interface ScreenshotState {
  appId: string;
  uri: string | null;
  isLoading: boolean;
  method: 'external' | 'webview' | null;
  timestamp: string;
  error?: string;
}

interface ScreenshotStore {
  // State
  screenshots: Record<string, ScreenshotState>;
  isCapturing: Record<string, boolean>;
  
  // Actions - like Android ViewModel methods
  getScreenshot: (appId: string) => ScreenshotState | null;
  setScreenshotLoading: (appId: string, isLoading: boolean) => void;
  setScreenshotCaptured: (appId: string, uri: string, method: 'external' | 'webview') => void;
  setScreenshotError: (appId: string, error: string) => void;
  setCapturing: (appId: string, isCapturing: boolean) => void;
  removeScreenshot: (appId: string) => void;
  
  // Async actions - like Android Repository methods
  loadScreenshot: (appId: string) => Promise<void>;
  captureScreenshot: (appId: string, method: 'external' | 'webview') => Promise<void>;
  
  // Utility actions
  clearAllScreenshots: () => void;
  getScreenshotStats: () => { total: number; loaded: number; loading: number; errors: number };
}

export const useScreenshotStore = create<ScreenshotStore>()(
  devtools(
    subscribeWithSelector(
      (set, get) => ({
        // Initial state
        screenshots: {},
        isCapturing: {},

        // Getters - like Android LiveData observers
        getScreenshot: (appId: string) => {
          return get().screenshots[appId] || null;
        },

        // State mutations - like Android MutableLiveData.postValue()
        setScreenshotLoading: (appId: string, isLoading: boolean) => {
          set((state) => ({
            screenshots: {
              ...state.screenshots,
              [appId]: {
                ...state.screenshots[appId],
                appId,
                uri: state.screenshots[appId]?.uri || null,
                method: state.screenshots[appId]?.method || null,
                isLoading,
                timestamp: new Date().toISOString(),
              }
            }
          }), false, `setScreenshotLoading/${appId}/${isLoading}`);
        },

        setScreenshotCaptured: (appId: string, uri: string, method: 'external' | 'webview') => {
          log.debug(`Screenshot captured for ${appId} via ${method}`);
          set((state) => ({
            screenshots: {
              ...state.screenshots,
              [appId]: {
                appId,
                uri,
                method,
                isLoading: false,
                timestamp: new Date().toISOString(),
              }
            }
          }), false, `setScreenshotCaptured/${appId}/${method}`);
        },

        setScreenshotError: (appId: string, error: string) => {
          log.warn(`Screenshot error for ${appId}: ${error}`);
          set((state) => ({
            screenshots: {
              ...state.screenshots,
              [appId]: {
                ...state.screenshots[appId],
                appId,
                uri: null,
                isLoading: false,
                error,
                timestamp: new Date().toISOString(),
              }
            }
          }), false, `setScreenshotError/${appId}`);
        },

        setCapturing: (appId: string, isCapturing: boolean) => {
          set((state) => ({
            isCapturing: {
              ...state.isCapturing,
              [appId]: isCapturing
            }
          }), false, `setCapturing/${appId}/${isCapturing}`);
        },

        removeScreenshot: (appId: string) => {
          set((state) => {
            const { [appId]: removed, ...rest } = state.screenshots;
            const { [appId]: removedCapturing, ...restCapturing } = state.isCapturing;
            return {
              screenshots: rest,
              isCapturing: restCapturing
            };
          }, false, `removeScreenshot/${appId}`);
        },

        // Async actions - like Android Repository methods
        loadScreenshot: async (appId: string) => {
          const { setScreenshotLoading, setScreenshotCaptured, setScreenshotError } = get();
          
          try {
            setScreenshotLoading(appId, true);
            log.debug(`Loading screenshot for app: ${appId}`);
            
            // Try WebView screenshot first, then fallback to external
            let uri = await WebViewScreenshotService.getWebViewScreenshot(appId);
            let method: 'external' | 'webview' = 'webview';
            
            if (!uri) {
              uri = await ScreenshotService.getScreenshot(appId);
              method = 'external';
            }
            
            if (uri) {
              setScreenshotCaptured(appId, uri, method);
              log.debug(`Screenshot loaded for ${appId} via ${method}`);
            } else {
              setScreenshotError(appId, 'No screenshot found');
            }
          } catch (error) {
            log.error(`Failed to load screenshot for ${appId}:`, error);
            setScreenshotError(appId, error instanceof Error ? error.message : 'Unknown error');
          }
        },

        captureScreenshot: async (appId: string, method: 'external' | 'webview') => {
          const { setCapturing, setScreenshotError } = get();
          
          try {
            setCapturing(appId, true);
            log.debug(`Starting screenshot capture for ${appId} via ${method}`);
            
            // This will be called from the capture services when they complete
            // The actual capture happens in AppViewScreen, but the result flows through here
            
          } catch (error) {
            log.error(`Screenshot capture failed for ${appId}:`, error);
            setScreenshotError(appId, error instanceof Error ? error.message : 'Capture failed');
          } finally {
            setCapturing(appId, false);
          }
        },

        // Utility actions
        clearAllScreenshots: () => {
          set(() => ({
            screenshots: {},
            isCapturing: {}
          }), false, 'clearAllScreenshots');
        },

        getScreenshotStats: () => {
          const screenshots = get().screenshots;
          const values = Object.values(screenshots);
          
          return {
            total: values.length,
            loaded: values.filter(s => s.uri && !s.error).length,
            loading: values.filter(s => s.isLoading).length,
            errors: values.filter(s => s.error).length
          };
        },
      })
    ),
    {
      name: 'screenshot-store', // For Redux DevTools
    }
  )
);

// Selector hooks - like Android LiveData observers
export const useScreenshotState = (appId: string) => 
  useScreenshotStore((state) => state.getScreenshot(appId));

export const useIsCapturing = (appId: string) => 
  useScreenshotStore((state) => state.isCapturing[appId] || false);

export const useScreenshotStats = () => 
  useScreenshotStore((state) => state.getScreenshotStats());

// Action hooks - like Android ViewModel methods  
export const useScreenshotActions = () => {
  const store = useScreenshotStore();
  return {
    loadScreenshot: store.loadScreenshot,
    captureScreenshot: store.captureScreenshot,
    setScreenshotCaptured: store.setScreenshotCaptured,
    setScreenshotError: store.setScreenshotError,
    setCapturing: store.setCapturing,
    removeScreenshot: store.removeScreenshot,
  };
};

// Subscribe to specific app screenshot changes - like Android Flow.collect()
export const subscribeToScreenshot = (appId: string, callback: (state: ScreenshotState | null) => void) => {
  return useScreenshotStore.subscribe(
    (state) => state.getScreenshot(appId),
    callback,
    {
      equalityFn: (a, b) => a?.uri === b?.uri && a?.isLoading === b?.isLoading && a?.error === b?.error
    }
  );
};

// Global screenshot event emitters - like Android Event Bus
export const emitScreenshotCaptured = (appId: string, uri: string, method: 'external' | 'webview') => {
  useScreenshotStore.getState().setScreenshotCaptured(appId, uri, method);
};

export const emitScreenshotError = (appId: string, error: string) => {
  useScreenshotStore.getState().setScreenshotError(appId, error);
};

export const emitScreenshotLoading = (appId: string, isLoading: boolean) => {
  useScreenshotStore.getState().setScreenshotLoading(appId, isLoading);
};
