import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  Alert,
  Platform,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import * as ScreenOrientation from 'expo-screen-orientation';
import { AppColors } from '../src/constants/AppColors';
import { AppStorageService, StoredApp } from '../src/services/AppStorageService';
import { AsyncStorageService } from '../src/services/AsyncStorageService';
import { ExportService } from '../src/services/ExportService';
import { ScreenshotService } from '../src/services/ScreenshotService';
import { WebViewScreenshotService } from '../src/services/WebViewScreenshotService';
import { emitScreenshotCaptured, emitScreenshotError, emitScreenshotLoading } from '../src/stores/ScreenshotStore';
import { handleWebViewLiveActivityMessage, stopWebViewLiveActivitiesForApp } from '../src/services/WebViewLiveActivityBridge';
import { createLogger } from '../src/utils/Logger';
import { useUISettingsStore } from '../src/stores/UISettingsStore';
import AppThemeBackground from '../src/components/AppThemeBackground';

const log = createLogger('AppView');

export default function AppViewPage() {
  const router = useRouter();
  const { appId } = useLocalSearchParams<{ appId: string }>();
  const appTheme = useUISettingsStore((s) => s.appTheme);
  const isUniverseTheme = appTheme === 'universe';

  const safeGoBack = () => {
    const canGoBack = (router as any)?.canGoBack?.();
    if (canGoBack) {
      router.back();
      return;
    }
    router.replace('/(tabs)');
  };
  
  const [app, setApp] = useState<StoredApp | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));
  const [webViewError, setWebViewError] = useState(false);
  const [isWebViewLoading, setIsWebViewLoading] = useState(true);
  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false);
  const [screenshotMethod, setScreenshotMethod] = useState<'external' | 'webview'>('webview');
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [showEditTitleModal, setShowEditTitleModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  
  const webViewRef = useRef<WebView>(null);
  const webViewContainerRef = useRef<View>(null);

  useEffect(() => {
    if (appId) {
      loadApp(appId as string);
    }
    setupOrientationListener();
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, [appId]);

  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;
      const id = appId as string | undefined;
      if (!id) return () => {};
      void AppStorageService.getApp(id).then((stored) => {
        if (!isActive) return;
        if (stored) {
          setApp(stored);
          setNewTitle(stored.title);
        }
      });
      return () => {
        isActive = false;
        void stopWebViewLiveActivitiesForApp(id);
      };
    }, [appId])
  );

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
      setOrientation(window.width > window.height ? 'landscape' : 'portrait');
    });

    return () => subscription?.remove();
  }, []);

  useEffect(() => {
    if (app) {
      const timer = setTimeout(() => {
        if (webViewContainerRef.current && !isCapturingScreenshot) {
          log.debug('Attempting early screenshot capture for:', app.id);
          captureScreenshot();
        }
      }, 2500);

      return () => {
        clearTimeout(timer);
        if (!isCapturingScreenshot && webViewContainerRef.current) {
          log.debug('Quick screenshot capture before navigation for:', app.id);
          captureScreenshot().catch((error) => log.warn('Quick screenshot capture failed:', error));
        }
      };
    }
  }, [app?.id]);

  const setupOrientationListener = async () => {
    const currentOrientation = await ScreenOrientation.getOrientationAsync();
    setOrientation(
      currentOrientation === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
      currentOrientation === ScreenOrientation.Orientation.LANDSCAPE_RIGHT
        ? 'landscape' 
        : 'portrait'
    );
  };

  const injectAppId = (html: string, appId: string): string => {
    log.debug('Injecting storage isolation for app:', appId);
    
    const storageOverride = `
	    <script>
	      const DEBUG = ${__DEV__ ? 'true' : 'false'};
	      const debugLog = (...args) => { if (DEBUG) console.log(...args); };
	      const debugWarn = (...args) => { if (DEBUG) console.warn(...args); };
	      const debugError = (...args) => { if (DEBUG) console.error(...args); };

	      (function() {
	        debugLog('🔧 [WebView] Setting up error handling and storage isolation');
        
        const originalAdd = DOMTokenList.prototype.add;
        DOMTokenList.prototype.add = function(...tokens) {
          const validTokens = tokens.filter(token => token && typeof token === 'string' && token.trim() !== '');
          if (validTokens.length > 0) {
            return originalAdd.apply(this, validTokens);
          }
	          debugWarn('🚨 [WebView] Prevented empty token addition to classList');
	        };
        
        const originalRemove = DOMTokenList.prototype.remove;
        DOMTokenList.prototype.remove = function(...tokens) {
          const validTokens = tokens.filter(token => token && typeof token === 'string' && token.trim() !== '');
          if (validTokens.length > 0) {
            return originalRemove.apply(this, validTokens);
          }
	          debugWarn('🚨 [WebView] Prevented empty token removal from classList');
	        };
	        
	        window.addEventListener('error', function(event) {
	          debugError('🚨 [WebView] Uncaught error:', event.error);
	          event.preventDefault();
	          return true;
	        });
	        
	        window.addEventListener('unhandledrejection', function(event) {
	          debugError('🚨 [WebView] Unhandled promise rejection:', event.reason);
	          event.preventDefault();
	        });
	        
	        window.addEventListener('DOMContentLoaded', function() {
	          debugLog('🔧 [WebView] Setting up todo app safety patches');
          
          const originalQuerySelector = document.querySelector;
          const originalQuerySelectorAll = document.querySelectorAll;
          
          document.querySelector = function(selector) {
            try {
              return originalQuerySelector.call(this, selector);
            } catch (e) {
	              debugWarn('🚨 [WebView] Invalid selector prevented:', selector, e);
	              return null;
	            }
	          };
          
          document.querySelectorAll = function(selector) {
            try {
              return originalQuerySelectorAll.call(this, selector);
            } catch (e) {
	              debugWarn('🚨 [WebView] Invalid selector prevented:', selector, e);
	              return document.createDocumentFragment().querySelectorAll('never-matches');
	            }
	          };
	        });
	      })();
	      
	      (function() {
	        const APP_ID = '${appId}';
	        debugLog('🔧 [WebView] Initializing COMPLETE storage isolation for app:', APP_ID);
        
        const isolatedStorage = {
          _data: {},
          
	          setItem: function(key, value) {
	            const isolatedKey = APP_ID + '_' + key;
	            debugLog('📦 [IsolatedStorage] setItem:', key, '->', isolatedKey);
	            this._data[isolatedKey] = String(value);
	            
	            try {
	              window.originalLocalStorage.setItem(isolatedKey, String(value));
	            } catch(e) {
	              debugWarn('⚠️ [IsolatedStorage] Backup localStorage failed:', e);
	            }
	          },
          
          getItem: function(key) {
            const isolatedKey = APP_ID + '_' + key;
            
            if (this._data.hasOwnProperty(isolatedKey)) {
              return this._data[isolatedKey];
            }
            
	            try {
	              const value = window.originalLocalStorage.getItem(isolatedKey);
	              if (value !== null) {
	                this._data[isolatedKey] = value;
	                return value;
	              }
	            } catch(e) {
	              debugWarn('⚠️ [IsolatedStorage] Backup localStorage read failed:', e);
	            }
            
            return null;
          },
          
          removeItem: function(key) {
            const isolatedKey = APP_ID + '_' + key;
            delete this._data[isolatedKey];
            
	            try {
	              window.originalLocalStorage.removeItem(isolatedKey);
	            } catch(e) {
	              debugWarn('⚠️ [IsolatedStorage] Backup localStorage remove failed:', e);
	            }
	          },
          
          clear: function() {
            Object.keys(this._data).forEach(key => {
              if (key.startsWith(APP_ID + '_')) {
                delete this._data[key];
              }
            });
            
            try {
              const keys = Object.keys(window.originalLocalStorage);
              keys.forEach(key => {
                if (key.startsWith(APP_ID + '_')) {
                  window.originalLocalStorage.removeItem(key);
                }
              });
	            } catch(e) {
	              debugWarn('⚠️ [IsolatedStorage] Backup localStorage clear failed:', e);
	            }
	          },
          
          get length() {
            return Object.keys(this._data).filter(key => key.startsWith(APP_ID + '_')).length;
          },
          
          key: function(index) {
            const appKeys = Object.keys(this._data).filter(key => key.startsWith(APP_ID + '_'));
            const fullKey = appKeys[index];
            return fullKey ? fullKey.replace(APP_ID + '_', '') : null;
          }
        };
        
        window.originalLocalStorage = window.localStorage;
        
	        Object.defineProperty(window, 'localStorage', {
	          value: isolatedStorage,
	          writable: false,
	          configurable: false
	        });
	        
	        debugLog('✅ [WebView] localStorage COMPLETELY REPLACED for app:', APP_ID);
        
        window.addEventListener('message', function(event) {
          try {
	            const message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
	            if (message.type === 'trigger_screenshot' && message.appId === APP_ID) {
	              debugLog('📸 [WebView] Received screenshot trigger for app:', APP_ID);
	              if (window.captureWebViewScreenshot) {
	                window.captureWebViewScreenshot();
	              }
	            }
	          } catch (e) {}
	        });
        
      })();
    </script>`;
    
    const headRegex = /(<head[^>]*>)/i;
    if (headRegex.test(html)) {
      const screenshotScript = screenshotMethod === 'webview' 
        ? `<script>${WebViewScreenshotService.generateScreenshotScript(appId)}</script>`
        : '';
      
      return html.replace(headRegex, `$1${storageOverride}${screenshotScript}`);
    }
    
    const screenshotScript = screenshotMethod === 'webview' 
      ? `<script>${WebViewScreenshotService.generateScreenshotScript(appId)}</script>`
      : '';
    return storageOverride + screenshotScript + html;
  };

  const loadApp = async (id: string) => {
    try {
      setIsLoading(true);
      const storedApp = await AppStorageService.getApp(id);
      if (storedApp) {
        setApp(storedApp);
        setNewTitle(storedApp.title);
        await AppStorageService.incrementAccessCount(id);
      } else {
        Alert.alert('Error', 'App not found', [
          { text: 'OK', onPress: safeGoBack }
        ]);
      }
    } catch (error) {
      log.error('Error loading app:', error);
      Alert.alert('Error', 'Failed to load app', [
        { text: 'OK', onPress: safeGoBack }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFullscreen = async () => {
    if (isFullscreen) {
      setIsFullscreen(false);
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    } else {
      setIsFullscreen(true);
      await ScreenOrientation.unlockAsync();
    }
  };

  const handleWebViewScreenshot = async (appId: string, dataURL: string, method: string) => {
    try {
      log.debug(`Processing WebView screenshot for app: ${appId}, method: ${method}`);
      emitScreenshotLoading(appId, true);
      setIsCapturingScreenshot(true);
      
      const processedUri = await WebViewScreenshotService.processWebViewScreenshot(appId, dataURL, method);
      
      if (processedUri) {
        log.debug('WebView screenshot processed and stored:', processedUri);
        emitScreenshotCaptured(appId, processedUri, 'webview');
      } else {
        log.warn('WebView screenshot processing failed');
        emitScreenshotError(appId, 'WebView screenshot processing failed');
        setScreenshotMethod('external');
        setTimeout(() => captureScreenshot(), 1000);
      }
    } catch (error) {
      log.error('WebView screenshot handling error:', error);
      emitScreenshotError(appId, error instanceof Error ? error.message : 'WebView screenshot failed');
      setScreenshotMethod('external');
      setTimeout(() => captureScreenshot(), 1000);
    } finally {
      setIsCapturingScreenshot(false);
      emitScreenshotLoading(appId, false);
    }
  };

  const captureScreenshot = async () => {
    if (!app || isCapturingScreenshot) return;
    
    log.debug('Screenshot capture handled by WebView JavaScript injection');
    
    if (webViewRef.current) {
      try {
        log.debug('Triggering WebView screenshot capture...');
        webViewRef.current.postMessage(JSON.stringify({
          type: 'trigger_screenshot',
          appId: app.id
        }));
      } catch (error) {
        log.warn('Failed to trigger WebView screenshot:', error);
        await ScreenshotService.createFallbackScreenshot(app.id, app.title, app.style);
      }
    } else {
      log.warn('No WebView ref available, creating fallback screenshot');
      await ScreenshotService.createFallbackScreenshot(app.id, app.title, app.style);
    }
  };

  const refreshWebView = () => {
    setWebViewError(false);
    webViewRef.current?.reload();
  };

  const exportDebugBundle = async () => {
    if (!app || isExporting) return;
    
    try {
      setIsExporting(true);
      await ExportService.exportDebugBundle(app, {
        injectedHtml: injectAppId(app.html, app.id),
      });
    } catch (error) {
      log.error('Export debug bundle failed:', error);
      Alert.alert(
        'Export Failed',
        error instanceof Error ? error.message : 'Failed to export debug bundle'
      );
    } finally {
      setIsExporting(false);
    }
  };

  const shareApp = () => {
    Alert.alert(
      'Share App',
      `Share "${app?.title}" with others`,
      [
        { text: 'Copy Link', onPress: () => {} },
        { text: 'Export HTML + Prompt', onPress: exportDebugBundle },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const showAppInfo = () => {
    if (!app) return;
    
    Alert.alert(
      app.title,
      `Created: ${new Date(app.timestamp).toLocaleDateString()}\n` +
      `Style: ${app.style}\n` +
      `Category: ${app.category}\n` +
      `Model Used: ${app.model || 'Unknown'}\n` +
      `Access Count: ${app.accessCount}\n` +
      `Status: ${app.status}`,
      [{ text: 'OK' }]
    );
  };

  const openMenu = () => setShowMenuModal(true);
  const closeMenu = () => setShowMenuModal(false);

  const openEditTitle = () => {
    setShowMenuModal(false);
    setShowEditTitleModal(true);
  };

  const saveTitle = async () => {
    if (!app || !newTitle.trim()) return;
    
    try {
      const updatedApp = {
        ...app,
        title: newTitle.trim(),
        titleEditedByUser: true,
      };
      await AppStorageService.updateApp(app.id, {
        title: updatedApp.title,
        titleEditedByUser: true,
      });
      setApp(updatedApp);
      setShowEditTitleModal(false);
      Alert.alert('Success', 'Title updated successfully');
    } catch (error) {
      log.error('Error updating title:', error);
      Alert.alert('Error', 'Failed to update title');
    }
  };

  const openEditPrompt = () => {
    setShowMenuModal(false);
    if (!app) return;
    router.push({
      pathname: '/app-recreate',
      params: { appId: app.id, mode: 'recreate' },
    } as any);
  };

  const openRevisions = () => {
    setShowMenuModal(false);
    if (!app) return;
    router.push({
      pathname: '/app-revisions',
      params: { appId: app.id },
    } as any);
  };

  const toggleFavorite = async () => {
    if (!app) return;
    
    setShowMenuModal(false);
    
    try {
      const updatedApp = { ...app, favorite: !app.favorite };
      await AppStorageService.updateApp(app.id, updatedApp);
      setApp(updatedApp);
      Alert.alert('Success', 
        updatedApp.favorite ? 'Added to favorites' : 'Removed from favorites'
      );
    } catch (error) {
      log.error('Error updating favorite:', error);
      Alert.alert('Error', 'Failed to update favorite status');
    }
  };

  const deleteApp = () => {
    if (!app) return;
    
    setShowMenuModal(false);
    
    Alert.alert(
      'Delete App',
      `Are you sure you want to delete "${app.title}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await stopWebViewLiveActivitiesForApp(app.id);
              await AppStorageService.deleteApp(app.id);
              Alert.alert('Success', 'App deleted successfully', [
                { text: 'OK', onPress: safeGoBack }
              ]);
            } catch (error) {
              log.error('Error deleting app:', error);
              Alert.alert('Error', 'Failed to delete app');
            }
          }
        }
      ]
    );
  };

  const fixApp = () => {
    setShowMenuModal(false);
    if (!app) return;
    router.push({
      pathname: '/app-recreate',
      params: { appId: app.id, mode: 'fix' },
    } as any);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, isUniverseTheme ? styles.containerUniverse : undefined]}>
        <AppThemeBackground />
        <View style={[styles.loadingContainer, isUniverseTheme ? styles.loadingContainerUniverse : undefined]}>
          <ActivityIndicator size="large" color={AppColors.FABMain} />
          <Text style={[styles.loadingText, isUniverseTheme ? styles.loadingTextUniverse : undefined]}>
            Loading app...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!app) {
    return (
      <SafeAreaView style={[styles.container, isUniverseTheme ? styles.containerUniverse : undefined]}>
        <AppThemeBackground />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#EF4444" />
          <Text style={[styles.errorText, isUniverseTheme ? styles.errorTextUniverse : undefined]}>
            App not found
          </Text>
          <TouchableOpacity style={styles.button} onPress={safeGoBack}>
            <Text style={styles.buttonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const webViewStyle = {
    flex: 1,
    width: dimensions.width,
    height: isFullscreen ? dimensions.height : dimensions.height - (Platform.OS === 'ios' ? 160 : 140),
    backgroundColor: isUniverseTheme ? '#020b1f' : '#ffffff',
  };

  return (
    <View
      style={[
        styles.container,
        isUniverseTheme ? styles.containerUniverse : undefined,
        isFullscreen && styles.fullscreenContainer,
      ]}
    >
      <AppThemeBackground />
      <StatusBar 
        barStyle={isFullscreen || isUniverseTheme ? "light-content" : "dark-content"}
        backgroundColor={isFullscreen ? "#000" : isUniverseTheme ? "transparent" : AppColors.Primary}
        hidden={isFullscreen}
      />
      
      {!isFullscreen && (
        <SafeAreaView
          edges={['top']}
          style={[styles.headerSafeArea, isUniverseTheme ? styles.headerSafeAreaUniverse : undefined]}
        >
          <View style={[styles.header, isUniverseTheme ? styles.headerUniverse : undefined]}>
            <TouchableOpacity
              style={[styles.headerButton, isUniverseTheme ? styles.headerButtonUniverse : undefined]}
              onPress={safeGoBack}
            >
              <Ionicons
                name="arrow-back"
                size={24}
                color={isUniverseTheme ? 'rgba(226, 240, 255, 0.92)' : 'rgba(0, 0, 0, 0.8)'}
              />
            </TouchableOpacity>
            
            <View style={styles.headerContent}>
              <Text
                style={[styles.headerTitle, isUniverseTheme ? styles.headerTitleUniverse : undefined]}
                numberOfLines={1}
              >
                {app.title}
              </Text>
              <Text style={[styles.headerSubtitle, isUniverseTheme ? styles.headerSubtitleUniverse : undefined]}>
                {app.style} • {app.category}
              </Text>
            </View>

            <View style={styles.headerActions}>
              <TouchableOpacity
                style={[styles.headerButton, isUniverseTheme ? styles.headerButtonUniverse : undefined]}
                onPress={openMenu}
              >
                <Ionicons
                  name="ellipsis-vertical"
                  size={24}
                  color={isUniverseTheme ? 'rgba(226, 240, 255, 0.92)' : 'rgba(0, 0, 0, 0.8)'}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.headerButton, isUniverseTheme ? styles.headerButtonUniverse : undefined]}
                onPress={showAppInfo}
              >
                <Ionicons
                  name="information-circle"
                  size={24}
                  color={isUniverseTheme ? 'rgba(226, 240, 255, 0.92)' : 'rgba(0, 0, 0, 0.8)'}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.headerButton, isUniverseTheme ? styles.headerButtonUniverse : undefined]}
                onPress={shareApp}
              >
                <Ionicons
                  name="share"
                  size={24}
                  color={isUniverseTheme ? 'rgba(226, 240, 255, 0.92)' : 'rgba(0, 0, 0, 0.8)'}
                />
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      )}

      <View
        style={[styles.webViewContainer, isUniverseTheme ? styles.webViewContainerUniverse : undefined]}
        ref={webViewContainerRef}
      >
        {webViewError ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={48} color="#EF4444" />
            <Text style={styles.errorText}>Failed to load app</Text>
            <Text style={styles.errorSubtext}>There was an issue loading the web content</Text>
            <TouchableOpacity style={styles.button} onPress={refreshWebView}>
              <Text style={styles.buttonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <WebView
            ref={webViewRef}
            source={{ 
              html: injectAppId(app.html, app.id),
              baseUrl: app.baseUrl || `https://sandbox/${app.id}/`
            }}
            style={webViewStyle}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            webviewDebuggingEnabled={__DEV__}
            mixedContentMode="compatibility"
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            onLoadStart={() => {
              setIsWebViewLoading(true);
            }}
            onError={() => {
              setWebViewError(true);
              setIsWebViewLoading(false);
            }}
            onLoadEnd={() => {
              setIsWebViewLoading(false);
              setWebViewError(false);
              const delay = Platform.OS === 'ios' ? 1500 : 1000;
              setTimeout(() => {
                captureScreenshot();
              }, delay);
            }}
            renderLoading={() => (
              <View style={[styles.webViewLoading, isUniverseTheme ? styles.webViewLoadingUniverse : undefined]}>
                <ActivityIndicator size="large" color={AppColors.FABMain} />
              </View>
            )}
            onMessage={(event: WebViewMessageEvent) => {
              try {
                const rawData = event.nativeEvent.data;
                const parsed: unknown = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
                if (!parsed || typeof parsed !== 'object') {
                  log.warn('Invalid WebView message:', parsed);
                  return;
                }

                const message = parsed as Record<string, unknown>;
                const messageType = message.type;
                if (typeof messageType !== 'string') {
                  log.warn('WebView message missing type:', message);
                  return;
                }

                log.verbose('WebView message:', message);
                
                switch (messageType) {
                  case 'live_activity_start_timer':
                  case 'live_activity_start_counter':
                  case 'live_activity_update_counter':
                  case 'live_activity_stop':
                  case 'live_activity_is_active': {
                    if (!app) return;
                    void handleWebViewLiveActivityMessage({
                      appId: app.id,
                      rawMessage: message,
                      sendToWebView: (payload) =>
                        webViewRef.current?.postMessage(JSON.stringify(payload)),
                    });
                    break;
                  }

                  case 'storage_set': {
                    const key = message.key;
                    const value = message.value;
                    if (typeof key !== 'string' || typeof value !== 'string') {
                      log.warn('Invalid storage_set message:', message);
                      return;
                    }
                    void AsyncStorageService.setItem(key, value).catch((error) =>
                      log.warn('WebView storage_set failed:', error)
                    );
                    break;
                  }
                    
                  case 'storage_get': {
                    const key = message.key;
                    if (typeof key !== 'string') {
                      log.warn('Invalid storage_get message:', message);
                      return;
                    }

                    void AsyncStorageService.getItem(key)
                      .then((value: string | null) => {
                        webViewRef.current?.postMessage(
                          JSON.stringify({
                            type: 'storage_response',
                            key,
                            value
                          })
                        );
                      })
                      .catch((error) => log.warn('WebView storage_get failed:', error));
                    break;
                  }
                    
                  case 'storage_remove': {
                    const key = message.key;
                    if (typeof key !== 'string') {
                      log.warn('Invalid storage_remove message:', message);
                      return;
                    }
                    void AsyncStorageService.removeItem(key).catch((error) =>
                      log.warn('WebView storage_remove failed:', error)
                    );
                    break;
                  }
                    
                  case 'storage_clear': {
                    const clearAppId = message.appId;
                    if (typeof clearAppId !== 'string') {
                      log.warn('Invalid storage_clear message:', message);
                      return;
                    }
                    void AsyncStorageService.clearAppData(clearAppId).catch((error) =>
                      log.warn('WebView storage_clear failed:', error)
                    );
                    break;
                  }
                    
                  case 'screenshot_captured': {
                    const screenshotAppId = message.appId;
                    const dataURL = message.dataURL;
                    const method = message.method;
                    if (
                      typeof screenshotAppId !== 'string' ||
                      typeof dataURL !== 'string' ||
                      typeof method !== 'string'
                    ) {
                      log.warn('Invalid screenshot_captured message:', message);
                      return;
                    }
                    void handleWebViewScreenshot(screenshotAppId, dataURL, method);
                    break;
                  }
                    
                  case 'screenshot_error': {
                    const errorMessage = message.error;
                    log.error('WebView screenshot error:', errorMessage);
                    if (screenshotMethod === 'webview') {
                      log.warn('Falling back to external screenshot method');
                      setScreenshotMethod('external');
                      setTimeout(() => captureScreenshot(), 1000);
                    }
                    break;
                  }
                    
                  default:
                    log.verbose('Other WebView message:', message);
                }
              } catch (error) {
                log.warn('Failed to parse WebView message:', error);
              }
            }}
          />
        )}

        {isUniverseTheme && isWebViewLoading && !webViewError ? (
          <View pointerEvents="none" style={styles.webViewLoadingShield} />
        ) : null}
        
        {!webViewError && (
          <View style={styles.screenshotOverlay} pointerEvents="none">
            <Text style={styles.appTitleOverlay}>{app.title}</Text>
          </View>
        )}
      </View>

      <View style={[
        styles.floatingControls,
        isFullscreen && styles.floatingControlsFullscreen,
        orientation === 'landscape' && styles.floatingControlsLandscape
      ]}>
        <TouchableOpacity 
          style={[styles.controlButton, styles.fullscreenButton]} 
          onPress={toggleFullscreen}
        >
          <Ionicons 
            name={isFullscreen ? "contract" : "expand"} 
            size={20} 
            color="white" 
          />
        </TouchableOpacity>
      </View>

      {/* Menu Modal */}
      <Modal
        visible={showMenuModal}
        transparent={true}
        animationType="fade"
        onRequestClose={closeMenu}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={closeMenu}
        >
          <View style={styles.menuModal}>
            <Text style={styles.menuTitle}>App Options</Text>
            
            <TouchableOpacity style={styles.menuItem} onPress={openEditTitle}>
              <Ionicons name="create-outline" size={24} color={AppColors.FABMain} />
              <Text style={styles.menuItemText}>Update Title</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={openEditPrompt}>
              <Ionicons name="refresh-outline" size={24} color={AppColors.FABMain} />
              <Text style={styles.menuItemText}>Update Prompt & Recreate</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={openRevisions}>
              <Ionicons name="git-branch-outline" size={24} color="#0f7cff" />
              <Text style={styles.menuItemText}>Revisions</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={toggleFavorite}>
              <Ionicons 
                name={app?.favorite ? "heart" : "heart-outline"} 
                size={24} 
                color={app?.favorite ? "#EF4444" : AppColors.FABMain} 
              />
              <Text style={styles.menuItemText}>
                {app?.favorite ? 'Remove from Favorites' : 'Add to Favorites'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={fixApp}>
              <Ionicons name="build-outline" size={24} color="#F59E0B" />
              <Text style={styles.menuItemText}>Fix App</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.menuItem, styles.deleteMenuItem]} onPress={deleteApp}>
              <Ionicons name="trash-outline" size={24} color="#EF4444" />
              <Text style={[styles.menuItemText, styles.deleteMenuText]}>Delete App</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} onPress={closeMenu}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Edit Title Modal */}
      <Modal
        visible={showEditTitleModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEditTitleModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowEditTitleModal(false)}
        >
          <View style={styles.menuModal}>
            <Text style={styles.menuTitle}>Update Title</Text>
            
            <TextInput
              style={[styles.textInput, { marginBottom: 20 }]}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="Enter new title"
              autoFocus={true}
              maxLength={100}
            />
            
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity 
                style={[styles.button, { backgroundColor: '#f0f0f0', flex: 1 }]} 
                onPress={() => setShowEditTitleModal(false)}
              >
                <Text style={[styles.buttonText, { color: 'rgba(0, 0, 0, 0.6)' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.button, { flex: 1 }]} 
                onPress={saveTitle}
              >
                <Text style={styles.buttonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

	      {isExporting && (
	        <View style={styles.exportOverlay} pointerEvents="auto">
	          <View style={styles.exportOverlayCard}>
	            <ActivityIndicator size="small" color={AppColors.FABMain} />
	            <Text style={styles.exportOverlayText}>Preparing export…</Text>
	          </View>
	        </View>
	      )}
	    </View>
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
  fullscreenContainer: {
    backgroundColor: '#000',
  },
  headerSafeArea: {
    backgroundColor: AppColors.Primary,
  },
  headerSafeAreaUniverse: {
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
    backgroundColor: AppColors.Primary,
  },
  headerUniverse: {
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(123, 169, 220, 0.28)',
  },
  headerButton: {
    padding: 8,
    borderRadius: 10,
  },
  headerButtonUniverse: {
    backgroundColor: 'rgba(11, 36, 64, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(140, 185, 235, 0.32)',
  },
  headerContent: {
    flex: 1,
    marginHorizontal: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'rgba(0, 0, 0, 0.8)',
  },
  headerTitleUniverse: {
    color: 'rgba(233, 246, 255, 0.95)',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(0, 0, 0, 0.6)',
    marginTop: 2,
  },
  headerSubtitleUniverse: {
    color: 'rgba(190, 216, 244, 0.86)',
  },
  headerActions: {
    flexDirection: 'row',
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  webViewContainerUniverse: {
    backgroundColor: '#020b1f',
  },
  webViewLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  webViewLoadingUniverse: {
    backgroundColor: 'rgba(3, 12, 27, 0.9)',
  },
  webViewLoadingShield: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#020b1f',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: AppColors.Primary,
  },
  loadingContainerUniverse: {
    backgroundColor: 'rgba(4, 14, 30, 0.92)',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: 'rgba(0, 0, 0, 0.6)',
  },
  loadingTextUniverse: {
    color: 'rgba(214, 233, 253, 0.9)',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#EF4444',
    marginTop: 16,
    textAlign: 'center',
  },
  errorTextUniverse: {
    color: '#ff7a7a',
  },
  errorSubtext: {
    fontSize: 14,
    color: 'rgba(0, 0, 0, 0.6)',
    marginTop: 8,
    textAlign: 'center',
  },
  button: {
    backgroundColor: AppColors.FABMain,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  floatingControls: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    flexDirection: 'column',
    gap: 12,
  },
  floatingControlsFullscreen: {
    bottom: Platform.OS === 'ios' ? 40 : 20,
  },
  floatingControlsLandscape: {
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    gap: 8,
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fullscreenButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  screenshotOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: -1,
  },
  appTitleOverlay: {
    color: 'transparent',
    fontSize: 1,
    opacity: 0,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalOverlayContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  menuModal: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '88%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  modalIconButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
  },
  modalBody: {
    flex: 1,
    marginBottom: 14,
  },
  modalBodyContent: {
    paddingBottom: 10,
    gap: 14,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'rgba(0, 0, 0, 0.8)',
    marginBottom: 20,
    textAlign: 'center',
  },
  menuSubtitle: {
    fontSize: 14,
    color: 'rgba(0, 0, 0, 0.6)',
    marginBottom: 20,
    textAlign: 'center',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  menuItemText: {
    fontSize: 16,
    color: 'rgba(0, 0, 0, 0.8)',
    marginLeft: 12,
    flex: 1,
  },
  deleteMenuItem: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  deleteMenuText: {
    color: '#EF4444',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(0, 0, 0, 0.6)',
    textAlign: 'center',
  },
  exportOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportOverlayCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  exportOverlayText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(0, 0, 0, 0.8)',
  },
  textInput: {
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: 'rgba(0, 0, 0, 0.8)',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  multilineInput: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  inlineActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
  },
  inlineActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(0, 0, 0, 0.7)',
  },
  modelSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(0, 0, 0, 0.8)',
    marginBottom: 12,
  },
  modelOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.2)',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    gap: 10,
    width: '100%',
    justifyContent: 'space-between',
  },
  selectedModelOption: {
    backgroundColor: AppColors.FABMain,
    borderColor: AppColors.FABMain,
  },
  modelOptionText: {
    fontSize: 14,
    color: 'rgba(0, 0, 0, 0.8)',
  },
  selectedModelOptionText: {
    color: 'white',
    fontWeight: '600',
  },
  modelOptionSubtext: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(0, 0, 0, 0.55)',
    lineHeight: 14,
  },
  selectedModelOptionSubtext: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  historyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
  },
  historyToggleText: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(0, 0, 0, 0.8)',
  },
  historyPanel: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.12)',
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    padding: 12,
    gap: 10,
  },
  historyEmptyText: {
    fontSize: 13,
    color: 'rgba(0, 0, 0, 0.6)',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  historyRowTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(0, 0, 0, 0.78)',
  },
  historyRowSubtext: {
    marginTop: 3,
    fontSize: 12,
    color: 'rgba(0, 0, 0, 0.55)',
    lineHeight: 16,
  },
  historyUseButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
  },
  historyUseButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(0, 0, 0, 0.75)',
  },
});
