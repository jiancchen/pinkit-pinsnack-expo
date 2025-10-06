import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MyAppScreen from './src/screens/MyAppScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import CreateAppScreen from './src/screens/CreateAppScreen';
import { RootStackParamList } from './src/screens/MyAppScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="MyApp"
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
      </Stack.Navigator>
      <StatusBar style="light" />
    </NavigationContainer>
  );
}
