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
  SafeAreaView
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ScreenOrientation from 'expo-screen-orientation';
import { RootStackParamList } from './MyAppScreen';
import { AppColors } from '../types/PromptHistory';
import { AppStorageService, StoredApp } from '../services/AppStorageService';

type Props = NativeStackScreenProps<RootStackParamList, 'AppView'>;

export default function AppViewScreen({ navigation, route }: Props) {
  const { appId } = route.params;
  const [app, setApp] = useState<StoredApp | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));
  const [webViewError, setWebViewError] = useState(false);
  const webViewRef = useRef<WebView>(null);

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

  const refreshWebView = () => {
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
      <View style={styles.webViewContainer}>
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
              html: app.html,
              baseUrl: app.baseUrl || `https://sandbox/${app.id}/`
            }}
            style={webViewStyle}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            mixedContentMode="compatibility"
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            onError={() => setWebViewError(true)}
            onLoadEnd={() => setWebViewError(false)}
            renderLoading={() => (
              <View style={styles.webViewLoading}>
                <ActivityIndicator size="large" color={AppColors.FABMain} />
              </View>
            )}
            onMessage={(event: any) => {
              // Handle messages from the WebView if needed
              console.log('WebView message:', event.nativeEvent.data);
            }}
          />
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

        <TouchableOpacity 
          style={[styles.controlButton, styles.rotateButton]} 
          onPress={rotateDevice}
        >
          <Ionicons 
            name="phone-portrait" 
            size={20} 
            color="white" 
            style={orientation === 'landscape' && { transform: [{ rotate: '90deg' }] }}
          />
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.controlButton, styles.refreshButton]} 
          onPress={refreshWebView}
        >
          <Ionicons name="refresh" size={20} color="white" />
        </TouchableOpacity>
      </View>
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
});