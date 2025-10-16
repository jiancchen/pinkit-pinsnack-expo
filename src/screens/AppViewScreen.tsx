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
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ScreenOrientation from 'expo-screen-orientation';
import { RootStackParamList } from './MyAppScreen';
import { AppColors } from '../constants/AppColors';
import { AppStorageService, StoredApp } from '../services/AppStorageService';
import { AsyncStorageService } from '../services/AsyncStorageService';
import { ScreenshotService } from '../services/ScreenshotService';
import { WebViewScreenshotService } from '../services/WebViewScreenshotService';
import { emitScreenshotCaptured, emitScreenshotError, emitScreenshotLoading } from '../stores/ScreenshotStore';

type Props = NativeStackScreenProps<RootStackParamList, 'AppView'>;

export default function AppViewScreen({ navigation, route }: Props) {
  // Function to inject app ID and React Native storage bridge
  const injectAppId = (html: string, appId: string): string => {
    console.log('🔧 [AppView] Injecting storage isolation for app:', appId);
    
    // Create a more robust storage solution that completely replaces localStorage
    const storageOverride = `
    <script>
      // Enhanced error handling for WebView JavaScript
      (function() {
        // Add global error handling for common DOM errors
        console.log('🔧 [WebView] Setting up error handling and storage isolation');
        
        // Patch DOMTokenList to prevent empty token errors
        const originalAdd = DOMTokenList.prototype.add;
        DOMTokenList.prototype.add = function(...tokens) {
          // Filter out empty tokens to prevent DOMTokenList errors
          const validTokens = tokens.filter(token => token && typeof token === 'string' && token.trim() !== '');
          if (validTokens.length > 0) {
            return originalAdd.apply(this, validTokens);
          }
          console.warn('🚨 [WebView] Prevented empty token addition to classList');
        };
        
        const originalRemove = DOMTokenList.prototype.remove;
        DOMTokenList.prototype.remove = function(...tokens) {
          // Filter out empty tokens to prevent DOMTokenList errors
          const validTokens = tokens.filter(token => token && typeof token === 'string' && token.trim() !== '');
          if (validTokens.length > 0) {
            return originalRemove.apply(this, validTokens);
          }
          console.warn('🚨 [WebView] Prevented empty token removal from classList');
        };
        
        // Global error handler for uncaught errors
        window.addEventListener('error', function(event) {
          console.error('🚨 [WebView] Uncaught error:', event.error);
          console.error('🚨 [WebView] Error details:', event.filename, event.lineno, event.colno);
          // Don't let errors crash the app
          event.preventDefault();
          return true;
        });
        
        // Global promise rejection handler
        window.addEventListener('unhandledrejection', function(event) {
          console.error('🚨 [WebView] Unhandled promise rejection:', event.reason);
          // Don't let promise rejections crash the app
          event.preventDefault();
        });
        
        // Add additional safety for todo app common patterns
        window.addEventListener('DOMContentLoaded', function() {
          console.log('🔧 [WebView] Setting up todo app safety patches');
          
          // Patch common todo functions that might cause issues
          const originalQuerySelector = document.querySelector;
          const originalQuerySelectorAll = document.querySelectorAll;
          
          // Safe querySelector that won't throw on invalid selectors
          document.querySelector = function(selector) {
            try {
              return originalQuerySelector.call(this, selector);
            } catch (e) {
              console.warn('🚨 [WebView] Invalid selector prevented:', selector, e);
              return null;
            }
          };
          
          document.querySelectorAll = function(selector) {
            try {
              return originalQuerySelectorAll.call(this, selector);
            } catch (e) {
              console.warn('🚨 [WebView] Invalid selector prevented:', selector, e);
              return document.createDocumentFragment().querySelectorAll('never-matches');
            }
          };
        });
      })();
      
      // COMPLETE localStorage replacement for app isolation
      (function() {
        const APP_ID = '${appId}';
        console.log('🔧 [WebView] Initializing COMPLETE storage isolation for app:', APP_ID);
        
        // Create isolated storage object that completely replaces localStorage
        const isolatedStorage = {
          _data: {},
          
          setItem: function(key, value) {
            const isolatedKey = APP_ID + '_' + key;
            console.log('📦 [IsolatedStorage] setItem:', key, '->', isolatedKey, 'value length:', String(value).length);
            this._data[isolatedKey] = String(value);
            
            // Also try to store in real localStorage as backup (but prefixed)
            try {
              window.originalLocalStorage.setItem(isolatedKey, String(value));
            } catch(e) {
              console.warn('⚠️ [IsolatedStorage] Backup localStorage failed:', e);
            }
          },
          
          getItem: function(key) {
            const isolatedKey = APP_ID + '_' + key;
            
            // First check our in-memory storage
            if (this._data.hasOwnProperty(isolatedKey)) {
              const value = this._data[isolatedKey];
              console.log('📖 [IsolatedStorage] getItem from memory:', key, '->', isolatedKey, 'found:', !!value);
              return value;
            }
            
            // Fallback to real localStorage
            try {
              const value = window.originalLocalStorage.getItem(isolatedKey);
              if (value !== null) {
                this._data[isolatedKey] = value; // Cache it
                console.log('📖 [IsolatedStorage] getItem from backup:', key, '->', isolatedKey, 'found:', !!value);
                return value;
              }
            } catch(e) {
              console.warn('⚠️ [IsolatedStorage] Backup localStorage read failed:', e);
            }
            
            console.log('📖 [IsolatedStorage] getItem:', key, '->', isolatedKey, 'not found');
            return null;
          },
          
          removeItem: function(key) {
            const isolatedKey = APP_ID + '_' + key;
            console.log('🗑️ [IsolatedStorage] removeItem:', key, '->', isolatedKey);
            delete this._data[isolatedKey];
            
            try {
              window.originalLocalStorage.removeItem(isolatedKey);
            } catch(e) {
              console.warn('⚠️ [IsolatedStorage] Backup localStorage remove failed:', e);
            }
          },
          
          clear: function() {
            console.log('🧹 [IsolatedStorage] clear for app:', APP_ID);
            
            // Clear app-specific items from memory
            Object.keys(this._data).forEach(key => {
              if (key.startsWith(APP_ID + '_')) {
                delete this._data[key];
              }
            });
            
            // Clear from backup localStorage
            try {
              const keys = Object.keys(window.originalLocalStorage);
              keys.forEach(key => {
                if (key.startsWith(APP_ID + '_')) {
                  window.originalLocalStorage.removeItem(key);
                }
              });
            } catch(e) {
              console.warn('⚠️ [IsolatedStorage] Backup localStorage clear failed:', e);
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
        
        // Store reference to original localStorage
        window.originalLocalStorage = window.localStorage;
        
        // COMPLETELY REPLACE localStorage with our isolated version
        Object.defineProperty(window, 'localStorage', {
          value: isolatedStorage,
          writable: false,
          configurable: false
        });
        
        console.log('✅ [WebView] localStorage COMPLETELY REPLACED for app:', APP_ID);
        console.log('🔍 [WebView] Testing storage isolation...');
        
        // Test the isolation
        localStorage.setItem('test_key', 'test_value_' + APP_ID);
        const testValue = localStorage.getItem('test_key');
        console.log('🧪 [WebView] Test result:', testValue === ('test_value_' + APP_ID) ? 'PASSED' : 'FAILED');
        
        // Add message listener for screenshot triggers
        window.addEventListener('message', function(event) {
          try {
            const message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
            if (message.type === 'trigger_screenshot' && message.appId === APP_ID) {
              console.log('📸 [WebView] Received screenshot trigger for app:', APP_ID);
              // Trigger screenshot capture if function is available
              if (window.captureWebViewScreenshot) {
                window.captureWebViewScreenshot();
              } else {
                console.warn('⚠️ [WebView] Screenshot function not available yet');
              }
            }
          } catch (e) {
            // Ignore parsing errors for other messages
          }
        });
        
      })();
    </script>`;
    
    // Insert immediately after <head> tag
    const headRegex = /(<head[^>]*>)/i;
    if (headRegex.test(html)) {
      // Add WebView screenshot script if using webview method
      const screenshotScript = screenshotMethod === 'webview' 
        ? `<script>${WebViewScreenshotService.generateScreenshotScript(appId)}</script>`
        : '';
      
      const injectedHtml = html.replace(headRegex, `$1${storageOverride}${screenshotScript}`);
      console.log('✅ [AppView] Storage isolation script injected after <head>');
      if (screenshotMethod === 'webview') {
        console.log('📸 [AppView] WebView screenshot script also injected');
      }
      return injectedHtml;
    }
    
    // Fallback: insert at the beginning
    console.log('⚠️ [AppView] No <head> found, injecting at beginning');
    const screenshotScript = screenshotMethod === 'webview' 
      ? `<script>${WebViewScreenshotService.generateScreenshotScript(appId)}</script>`
      : '';
    return storageOverride + screenshotScript + html;
  };
  const { appId } = route.params;
  const [app, setApp] = useState<StoredApp | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));
  const [webViewError, setWebViewError] = useState(false);
  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false);
  const [screenshotMethod, setScreenshotMethod] = useState<'external' | 'webview'>('webview');
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [showEditTitleModal, setShowEditTitleModal] = useState(false);
  const [showEditPromptModal, setShowEditPromptModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  
  const webViewRef = useRef<WebView>(null);
  const webViewContainerRef = useRef<View>(null);

  useEffect(() => {
    loadApp();
    setupOrientationListener();
    return () => {
      // Reset to portrait when leaving screen
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, []);

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
      setOrientation(window.width > window.height ? 'landscape' : 'portrait');
    });

    return () => subscription?.remove();
  }, []);

  // Enhanced screenshot capture with early and cleanup handling
  useEffect(() => {
    if (app) {
      // Try to capture screenshot when component mounts (if WebView is ready)
      const timer = setTimeout(() => {
        if (webViewContainerRef.current && !isCapturingScreenshot) {
          console.log('🔄 [AppView] Attempting early screenshot capture for:', app.id);
          captureScreenshot();
        }
      }, 2500); // Fallback capture after 2.5 seconds

      return () => {
        clearTimeout(timer);
        // If we're navigating away and haven't captured yet, try to capture quickly
        if (!isCapturingScreenshot && webViewContainerRef.current) {
          console.log('🏃 [AppView] Quick screenshot capture before navigation for:', app.id);
          // Don't await this to avoid blocking navigation
          captureScreenshot().catch(console.warn);
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

  const loadApp = async () => {
    try {
      setIsLoading(true);
      const storedApp = await AppStorageService.getApp(appId);
      if (storedApp) {
        setApp(storedApp);
        setNewTitle(storedApp.title);
        setNewPrompt(storedApp.prompt || '');
        setSelectedModel(storedApp.model || 'gpt-4');
        // Increment access count
        await AppStorageService.incrementAccessCount(appId);
      } else {
        Alert.alert('Error', 'App not found', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      }
    } catch (error) {
      console.error('Error loading app:', error);
      Alert.alert('Error', 'Failed to load app', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFullscreen = async () => {
    if (isFullscreen) {
      // Exit fullscreen
      setIsFullscreen(false);
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    } else {
      // Enter fullscreen
      setIsFullscreen(true);
      await ScreenOrientation.unlockAsync();
    }
  };

  const rotateDevice = async () => {
    if (orientation === 'portrait') {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_LEFT);
    } else {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    }
  };

  // Handle WebView-based screenshot capture
  const handleWebViewScreenshot = async (appId: string, dataURL: string, method: string) => {
    try {
      console.log(`📸 [AppView] Processing WebView screenshot for app: ${appId}, method: ${method}`);
      emitScreenshotLoading(appId, true);
      setIsCapturingScreenshot(true);
      
      const processedUri = await WebViewScreenshotService.processWebViewScreenshot(appId, dataURL, method);
      
      if (processedUri) {
        console.log('✅ [AppView] WebView screenshot processed and stored:', processedUri);
        emitScreenshotCaptured(appId, processedUri, 'webview');
      } else {
        console.warn('⚠️ [AppView] WebView screenshot processing failed');
        emitScreenshotError(appId, 'WebView screenshot processing failed');
        // Fallback to external method
        setScreenshotMethod('external');
        setTimeout(() => captureScreenshot(), 1000);
      }
    } catch (error) {
      console.error('💥 [AppView] WebView screenshot handling error:', error);
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
    
    console.log('📸 [AppView] Screenshot capture now handled by WebView JavaScript injection');
    console.log('📸 [AppView] WebView script should automatically capture when page loads');
    
    // Screenshot capture is now handled by:
    // 1. JavaScript injection in injectAppId() function
    // 2. html2canvas library loaded in WebView
    // 3. Results sent back via WebView postMessage
    // 4. Processed in handleWebViewScreenshot() function
    
    // If no screenshot has been captured yet, we can try to trigger it
    if (webViewRef.current) {
      try {
        console.log('📸 [AppView] Triggering WebView screenshot capture...');
        webViewRef.current.postMessage(JSON.stringify({
          type: 'trigger_screenshot',
          appId: app.id
        }));
      } catch (error) {
        console.warn('⚠️ [AppView] Failed to trigger WebView screenshot:', error);
        // Create fallback screenshot
        await ScreenshotService.createFallbackScreenshot(app.id, app.title, app.style);
      }
    } else {
      console.warn('⚠️ [AppView] No WebView ref available, creating fallback screenshot');
      await ScreenshotService.createFallbackScreenshot(app.id, app.title, app.style);
    }
  };  const refreshWebView = () => {
    setWebViewError(false);
    webViewRef.current?.reload();
  };

  const shareApp = () => {
    Alert.alert(
      'Share App',
      `Share "${app?.title}" with others`,
      [
        { text: 'Copy Link', onPress: () => {/* TODO: Implement sharing */} },
        { text: 'Export HTML', onPress: () => {/* TODO: Implement export */} },
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

  // Menu functions
  const openMenu = () => {
    setShowMenuModal(true);
  };

  const closeMenu = () => {
    setShowMenuModal(false);
  };

  const openEditTitle = () => {
    setShowMenuModal(false);
    setShowEditTitleModal(true);
  };

  const saveTitle = async () => {
    if (!app || !newTitle.trim()) return;
    
    try {
      const updatedApp = { ...app, title: newTitle.trim() };
      await AppStorageService.updateApp(app.id, updatedApp);
      setApp(updatedApp);
      setShowEditTitleModal(false);
      Alert.alert('Success', 'Title updated successfully');
    } catch (error) {
      console.error('Error updating title:', error);
      Alert.alert('Error', 'Failed to update title');
    }
  };

  const openEditPrompt = () => {
    setShowMenuModal(false);
    setShowEditPromptModal(true);
  };

  const savePromptAndRecreate = async () => {
    if (!app || !newPrompt.trim()) return;
    
    Alert.alert(
      'Recreate App',
      'This will create a new version of the app with the updated prompt. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Recreate',
          onPress: async () => {
            try {
              // TODO: Implement app recreation with new prompt and selected model
              setShowEditPromptModal(false);
              Alert.alert('Coming Soon', 'App recreation feature will be implemented soon');
            } catch (error) {
              console.error('Error recreating app:', error);
              Alert.alert('Error', 'Failed to recreate app');
            }
          }
        }
      ]
    );
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
      console.error('Error updating favorite:', error);
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
              await AppStorageService.deleteApp(app.id);
              Alert.alert('Success', 'App deleted successfully', [
                { text: 'OK', onPress: () => navigation.goBack() }
              ]);
            } catch (error) {
              console.error('Error deleting app:', error);
              Alert.alert('Error', 'Failed to delete app');
            }
          }
        }
      ]
    );
  };

  const fixApp = () => {
    setShowMenuModal(false);
    Alert.alert(
      'Fix App (Coming Soon)',
      'This feature will allow you to reattach the HTML file and send it back upstream for fixes.',
      [{ text: 'OK' }]
    );
    // TODO: Implement fix functionality
    // - Reattach HTML file
    // - Send back to AI for fixes
    // - Update app with fixed version
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={AppColors.FABMain} />
          <Text style={styles.loadingText}>Loading app...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!app) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#EF4444" />
          <Text style={styles.errorText}>App not found</Text>
          <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
            <Text style={styles.buttonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const webViewStyle = {
    flex: 1,
    width: dimensions.width,
    height: isFullscreen ? dimensions.height : dimensions.height - (Platform.OS === 'ios' ? 160 : 140)
  };

  return (
    <View style={[styles.container, isFullscreen && styles.fullscreenContainer]}>
      <StatusBar 
        barStyle={isFullscreen ? "light-content" : "dark-content"}
        backgroundColor={isFullscreen ? "#000" : AppColors.Primary}
        hidden={isFullscreen}
      />
      
      {/* Header - Hidden in fullscreen */}
      {!isFullscreen && (
        <SafeAreaView>
          <View style={styles.header}>
            <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={24} color="rgba(0, 0, 0, 0.8)" />
            </TouchableOpacity>
            
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle} numberOfLines={1}>{app.title}</Text>
              <Text style={styles.headerSubtitle}>{app.style} • {app.category}</Text>
            </View>

            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.headerButton} onPress={openMenu}>
                <Ionicons name="ellipsis-vertical" size={24} color="rgba(0, 0, 0, 0.8)" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerButton} onPress={showAppInfo}>
                <Ionicons name="information-circle" size={24} color="rgba(0, 0, 0, 0.8)" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerButton} onPress={shareApp}>
                <Ionicons name="share" size={24} color="rgba(0, 0, 0, 0.8)" />
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      )}

      {/* WebView Container */}
      <View style={styles.webViewContainer} ref={webViewContainerRef}>
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
            webviewDebuggingEnabled ={true}
            mixedContentMode="compatibility"
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            onError={() => setWebViewError(true)}
            onLoadEnd={() => {
              setWebViewError(false);
              // Platform-specific capture timing
              const delay = Platform.OS === 'ios' ? 1500 : 1000; // iOS needs more time
              setTimeout(() => {
                captureScreenshot();
              }, delay);
            }}
            renderLoading={() => (
              <View style={styles.webViewLoading}>
                <ActivityIndicator size="large" color={AppColors.FABMain} />
              </View>
            )}
            onMessage={(event: any) => {
              // Handle storage messages from the WebView
              try {
                const message = JSON.parse(event.nativeEvent.data);
                console.log('📨 WebView message:', message);
                
                switch (message.type) {
                  case 'storage_set':
                    // Store data using AsyncStorage (unlimited size)
                    AsyncStorageService.setItem(message.key, message.value);
                    break;
                    
                  case 'storage_get':
                    // Retrieve data from AsyncStorage
                    AsyncStorageService.getItem(message.key).then((value: string | null) => {
                      // Send response back to WebView
                      webViewRef.current?.postMessage(JSON.stringify({
                        type: 'storage_response',
                        key: message.key,
                        value: value
                      }));
                    });
                    break;
                    
                  case 'storage_remove':
                    AsyncStorageService.removeItem(message.key);
                    break;
                    
                  case 'storage_clear':
                    AsyncStorageService.clearAppData(message.appId);
                    break;
                    
                  case 'screenshot_captured':
                    // Handle WebView-based screenshot capture
                    handleWebViewScreenshot(message.appId, message.dataURL, message.method);
                    break;
                    
                  case 'screenshot_error':
                    console.error('💥 [WebView] Screenshot error:', message.error);
                    // Fallback to external screenshot method
                    if (screenshotMethod === 'webview') {
                      console.log('🔄 [AppView] Falling back to external screenshot method');
                      setScreenshotMethod('external');
                      setTimeout(() => captureScreenshot(), 1000);
                    }
                    break;
                    
                  default:
                    console.log('📝 Other WebView message:', message);
                }
              } catch (error) {
                console.warn('Failed to parse WebView message:', error);
              }
            }}
          />
        )}
        
        {/* Invisible overlay to help with screenshot identification - only visible in WebView mode */}
        {!webViewError && (
          <View style={styles.screenshotOverlay} pointerEvents="none">
            <Text style={styles.appTitleOverlay}>{app.title}</Text>
          </View>
        )}
      </View>

      {/* Floating Controls - Always visible */}
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

        {/* <TouchableOpacity 
          style={[styles.controlButton, styles.rotateButton]} 
          onPress={rotateDevice}
        >
          <Ionicons 
            name="phone-portrait" 
            size={20} 
            color="white" 
            style={orientation === 'landscape' && { transform: [{ rotate: '90deg' }] }}
          />
        </TouchableOpacity> */}

        {/* <TouchableOpacity 
          style={[styles.controlButton, styles.refreshButton]} 
          onPress={() => {
            refreshWebView();
            // Also retake screenshot
            setTimeout(() => {
              captureScreenshot();
            }, 2000);
          }}
        >
          <Ionicons name="refresh" size={20} color="white" />
        </TouchableOpacity> */}
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
              <Text style={styles.menuItemText}>Fix App (Coming Soon)</Text>
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

      {/* Edit Prompt Modal */}
      <Modal
        visible={showEditPromptModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEditPromptModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowEditPromptModal(false)}
        >
          <View style={styles.menuModal}>
            <Text style={styles.menuTitle}>Update Prompt & Recreate</Text>
            <Text style={styles.menuSubtitle}>
              Add additional instructions to create a new version of this app
            </Text>
            
            {/* Model Selection */}
            <Text style={styles.modelSectionTitle}>Select AI Model:</Text>
            <View style={styles.modelSelection}>
              {['gpt-4', 'gpt-3.5-turbo', 'claude-3', 'gemini-pro'].map((model) => (
                <TouchableOpacity
                  key={model}
                  style={[
                    styles.modelOption,
                    selectedModel === model && styles.selectedModelOption
                  ]}
                  onPress={() => setSelectedModel(model)}
                >
                  <Text style={[
                    styles.modelOptionText,
                    selectedModel === model && styles.selectedModelOptionText
                  ]}>
                    {model}
                  </Text>
                  {selectedModel === model && (
                    <Ionicons name="checkmark" size={16} color="white" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
            
            <TextInput
              style={[styles.textInput, styles.multilineInput, { marginBottom: 20 }]}
              value={newPrompt}
              onChangeText={setNewPrompt}
              placeholder="Enter additional prompt or changes..."
              multiline={true}
              textAlignVertical="top"
              autoFocus={true}
            />
            
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity 
                style={[styles.button, { backgroundColor: '#f0f0f0', flex: 1 }]} 
                onPress={() => setShowEditPromptModal(false)}
              >
                <Text style={[styles.buttonText, { color: 'rgba(0, 0, 0, 0.6)' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.button, { flex: 1 }]} 
                onPress={savePromptAndRecreate}
              >
                <Text style={styles.buttonText}>Recreate</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.Primary,
  },
  fullscreenContainer: {
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: AppColors.Primary,
  },
  headerButton: {
    padding: 8,
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
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(0, 0, 0, 0.6)',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: '#fff',
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: AppColors.Primary,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: 'rgba(0, 0, 0, 0.6)',
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
  rotateButton: {
    backgroundColor: AppColors.FABMain,
  },
  refreshButton: {
    backgroundColor: '#10B981',
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
    zIndex: -1, // Behind the WebView
  },
  appTitleOverlay: {
    color: 'transparent',
    fontSize: 1, // Minimum font size for Android compatibility (was 0)
    opacity: 0,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  menuModal: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
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
  // Model selection styles
  modelSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(0, 0, 0, 0.8)',
    marginBottom: 12,
  },
  modelSelection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
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
    gap: 6,
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
});