import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as NavigationBar from 'expo-navigation-bar';
import MyAppScreen from './src/screens/MyAppScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import CreateAppScreen from './src/screens/CreateAppScreen';
import WelcomeScreen from './src/screens/WelcomeScreen';
import AppViewScreen from './src/screens/AppViewScreen';
import { RootStackParamList } from './src/screens/MyAppScreen';
import { SecureStorageService } from './src/services/SecureStorageService';
import { ClaudeApiService } from './src/services/ClaudeApiService';
import { SeedService } from './src/services/SeedService';
import { AppColors } from './src/constants/AppColors';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Flag to force showing main app without API key requirement
  const FORCE_MAIN_APP = true;

  useEffect(() => {
    checkApiKeyStatus();
    
    // Initialize sample apps seeding
    SeedService.initializeSeeding();
    
    // Configure transparent navigation bar for Android
    if (Platform.OS === 'android') {
      NavigationBar.setBackgroundColorAsync('transparent');
      NavigationBar.setVisibilityAsync('hidden');
    }
  }, []);

  const checkApiKeyStatus = async () => {
    try {
      const hasKey = await SecureStorageService.hasApiKey();
      if (hasKey) {
        // Initialize Claude API service if API key exists
        const claudeService = ClaudeApiService.getInstance();
        await claudeService.initialize();
      }
      setHasApiKey(hasKey);
    } catch (error) {
      console.error('Error checking API key status:', error);
      setHasApiKey(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApiKeySetup = () => {
    setHasApiKey(true);
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
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName={"MyApp"}
          screenOptions={{
            headerShown: false, // Remove the top app bar
          }}
        >
          <Stack.Screen 
            name="MyApp" 
            component={MyAppScreen}
          />
          <Stack.Screen 
            name="Settings" 
            component={SettingsScreen}
          />
          <Stack.Screen 
            name="CreateApp" 
            component={CreateAppScreen}
          />
          <Stack.Screen 
            name="AppView" 
            component={AppViewScreen}
          />
          <Stack.Screen 
            name="Welcome" 
            options={{ gestureEnabled: false }}
          >
            {(props) => <WelcomeScreen {...props} onApiKeySetup={handleApiKeySetup} navigation={props.navigation} />}
          </Stack.Screen>
        </Stack.Navigator>
        <StatusBar style="light" translucent backgroundColor="transparent" />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
