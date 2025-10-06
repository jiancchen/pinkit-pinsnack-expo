import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, StatusBar } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Scrollable3DStack from '../components/Scrollable3DStack';
import FloatingToolbar from '../components/FloatingToolbar';
import { samplePromptHistory, AppColors } from '../types/PromptHistory';

export type RootStackParamList = {
  MyApp: undefined;
  Settings: undefined;
  CreateApp: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, 'MyApp'>;

export default function MyAppScreen({ navigation }: Props) {
  const [promptHistory] = useState(samplePromptHistory);

  const handleNavigateToApp = (appId: string) => {
    const app = promptHistory.find(item => item.id === appId);
    if (app) {
      Alert.alert(
        'Open App',
        `Opening ${app.title || 'Untitled App'}`,
        [{ text: 'OK' }]
      );
    }
  };

  const handleShowSnackbar = (message: string) => {
    Alert.alert('Info', message, [{ text: 'OK' }]);
  };

  const handleNavigateToMain = () => {
    // Already on main screen
    Alert.alert('Info', 'You are already on the main screen', [{ text: 'OK' }]);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={AppColors.Primary} />
      
      {/* Main 3D Stack */}
      <Scrollable3DStack
        items={promptHistory}
        onNavigateToApp={handleNavigateToApp}
        onShowSnackbar={handleShowSnackbar}
      />

      {/* Floating Toolbar */}
      <FloatingToolbar
        onNavigateToMain={handleNavigateToMain}
        onNavigateToCreate={() => navigation.navigate('CreateApp')}
        onNavigateToSettings={() => navigation.navigate('Settings')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.Primary,
  },
});