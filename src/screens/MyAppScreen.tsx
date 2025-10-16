import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Scrollable3DStack from '../components/Scrollable3DStack';
import FloatingToolbar from '../components/FloatingToolbar';
import SearchBarWithFavorites from '../components/SearchBarWithFavorites';
import { PromptHistory } from '../types/PromptHistory';
import { AppColors } from '../constants/AppColors';
import { AppStorageService, StoredApp } from '../services/AppStorageService';

export type RootStackParamList = {
  Welcome: undefined;
  MyApp: undefined;
  Settings: undefined;
  CreateApp: undefined;
  AppView: { appId: string };
};

type Props = NativeStackScreenProps<RootStackParamList, 'MyApp'>;

export default function MyAppScreen({ navigation }: Props) {
  const [promptHistory, setPromptHistory] = useState<PromptHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [showFavorites, setShowFavorites] = useState(false);

  const loadApps = async () => {
    try {
      setIsLoading(true);
      const storedApps = await AppStorageService.getAllApps();
      
      // Convert StoredApp to PromptHistory format for the 3D stack
      const converted: PromptHistory[] = storedApps.map((app: StoredApp) => ({
        id: app.id,
        prompt: app.prompt,
        html: app.html,
        title: app.title,
        favorite: app.favorite,
        accessCount: app.accessCount,
        timestamp: app.timestamp,
        style: app.style,
        category: app.category,
        status: app.status,
        generatedConcept: app.generatedConcept
      }));
      
      setPromptHistory(converted);
    } catch (error) {
      console.error('Failed to load apps:', error);
      Alert.alert('Error', 'Failed to load your apps. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Load apps when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadApps();
    }, [])
  );

  useEffect(() => {
    loadApps();
  }, []);

  const handleNavigateToApp = async (appId: string) => {
    const app = promptHistory.find((item: PromptHistory) => item.id === appId);
    if (app) {
      try {
        // Update access count
        await AppStorageService.incrementAccessCount(appId);
        
        // Navigate to the app view screen
        navigation.navigate('AppView', { appId });
        
        // Reload apps to update access count
        loadApps();
      } catch (error) {
        console.error('Error updating access count:', error);
        // Navigate anyway even if access count update fails
        navigation.navigate('AppView', { appId });
      }
    }
  };

  const handleShowSnackbar = (message: string) => {
    Alert.alert('Info', message, [{ text: 'OK' }]);
  };

  const handleNavigateToMain = () => {
    // Already on main screen
    // Alert.alert('Info', 'You are already on the main screen', [{ text: 'OK' }]);
  };

  // Filter items based on search text
  const filteredItems = React.useMemo(() => {
    if (searchText.trim() === '') {
      return promptHistory;
    }
    return promptHistory.filter((item) => 
      item.title?.toLowerCase().includes(searchText.toLowerCase()) ||
      item.prompt.toLowerCase().includes(searchText.toLowerCase())
    );
  }, [promptHistory, searchText]);

  // Get favorite items
  const favoriteItems = React.useMemo(() => {
    return promptHistory.filter((item) => item.favorite === true);
  }, [promptHistory]);

  // Get most used items (sorted by access count)
  const mostUsedItems = React.useMemo(() => {
    return promptHistory
      .filter((item) => (item.accessCount || 0) > 0)
      .sort((a, b) => (b.accessCount || 0) - (a.accessCount || 0))
      .slice(0, 10); // Top 10 most used
  }, [promptHistory]);

  const handleSearchTextChange = (text: string) => {
    setSearchText(text);
    if (text.trim() !== '') {
      setShowFavorites(false);
    }
  };

  const handleToggleFavorites = () => {
    setShowFavorites(!showFavorites);
    if (!showFavorites) {
      setSearchText('');
    }
  };

  const handleClearSearch = () => {
    setSearchText('');
    setShowFavorites(false);
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaView style={styles.container} edges={[]}>
        <StatusBar translucent backgroundColor="transparent" />
        
        {/* Main 3D Stack */}
        <Scrollable3DStack
          items={filteredItems}
          onNavigateToApp={handleNavigateToApp}
          onShowSnackbar={handleShowSnackbar}
        />

        {/* Search Bar with Favorites */}
        <SearchBarWithFavorites
          searchText={searchText}
          onSearchTextChange={handleSearchTextChange}
          showFavorites={showFavorites}
          onToggleFavorites={handleToggleFavorites}
          onClearSearch={handleClearSearch}
          favoriteItems={favoriteItems}
          mostUsedItems={mostUsedItems}
          onNavigateToApp={handleNavigateToApp}
        />

        {/* Floating Toolbar */}
        <FloatingToolbar
          onNavigateToMain={handleNavigateToMain}
          onNavigateToCreate={() => navigation.navigate('CreateApp')}
          onNavigateToSettings={() => navigation.navigate('Settings')}
        />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.Primary,
  },
});