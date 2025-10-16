import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, StatusBar, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import { AppColors } from '../src/constants/AppColors';
import { AppStorageService, StoredApp } from '../src/services/AppStorageService';

export default function AppViewPage() {
  const router = useRouter();
  const { appId } = useLocalSearchParams<{ appId: string }>();
  const [app, setApp] = useState<StoredApp | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (appId) {
      loadApp(appId);
    }
  }, [appId]);

  const loadApp = async (id: string) => {
    try {
      setIsLoading(true);
      const appData = await AppStorageService.getApp(id);
      if (appData) {
        setApp(appData);
      } else {
        Alert.alert('Error', 'App not found.');
        router.back();
      }
    } catch (error) {
      console.error('Error loading app:', error);
      Alert.alert('Error', 'Failed to load app.');
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={AppColors.FABDeepOrange} />
        </View>
      </SafeAreaView>
    );
  }

  if (!app) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      <WebView
        source={{ html: app.html }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        onError={(error) => {
          console.error('WebView error:', error);
          Alert.alert('Error', 'Failed to load the app.');
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.Primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  webview: {
    flex: 1,
  },
});