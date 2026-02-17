import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, StatusBar, TouchableOpacity } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Scrollable3DStack from '../../src/components/Scrollable3DStack';
import SearchBarWithFavorites from '../../src/components/SearchBarWithFavorites';
import AppThemeBackground from '../../src/components/AppThemeBackground';
import { PromptHistory } from '../../src/types/PromptHistory';
import { AppColors } from '../../src/constants/AppColors';
import { AppStorageService, StoredApp } from '../../src/services/AppStorageService';
import { SecureStorageService } from '../../src/services/SecureStorageService';
import { SeedService } from '../../src/services/SeedService';
import { useGenerationStatusStore } from '../../src/stores/GenerationStatusStore';
import { useUISettingsStore } from '../../src/stores/UISettingsStore';
import { createLogger } from '../../src/utils/Logger';
import { useStrings } from '../../src/i18n/strings';

const log = createLogger('MyApps');

export default function MyAppsPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const appTheme = useUISettingsStore((s) => s.appTheme);
  const isUniverseTheme = appTheme === 'universe';
  const { t } = useStrings();
  const [promptHistory, setPromptHistory] = useState<PromptHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [showFavorites, setShowFavorites] = useState(false);
  const queue = useGenerationStatusStore((s) => s.queue);
  const lastTerminalUpdateRef = React.useRef<number>(0);

  const loadApps = async () => {
    try {
      setIsLoading(true);
      await SeedService.initializeSeeding();
      const [storedApps, hasKey] = await Promise.all([
        AppStorageService.getAllApps(),
        SecureStorageService.hasApiKey(),
      ]);
      setHasApiKey(hasKey);
      
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
        isSample: app.isSample === true || typeof app.sampleKey === 'string' || app.id.startsWith('sample_'),
        sampleKey: app.sampleKey,
        generatedConcept: app.generatedConcept
      }));
      
      setPromptHistory(converted);
    } catch (error) {
      log.error('Failed to load apps:', error);
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

  useEffect(() => {
    // When a generation job finishes (success/fail/cancel), refresh app list so cards become clickable.
    const latestTerminalUpdatedAt = queue.reduce((best, job) => {
      if (job.status !== 'completed' && job.status !== 'failed' && job.status !== 'canceled') return best;
      return Math.max(best, job.updatedAt);
    }, 0);

    if (latestTerminalUpdatedAt > lastTerminalUpdateRef.current) {
      lastTerminalUpdateRef.current = latestTerminalUpdatedAt;
      void loadApps();
    }
  }, [queue]);

  const handleNavigateToApp = async (appId: string) => {
    const app = promptHistory.find((item: PromptHistory) => item.id === appId);
    if (app) {
      if (app.status === 'generating') {
        Alert.alert('Still generating', 'This app is still generating. Please wait for it to finish.');
        return;
      }
      try {
        // Update access count
        await AppStorageService.incrementAccessCount(appId);
        
        // Navigate to the app view screen using Expo Router
        router.push(`/app-view?appId=${appId}`);
        
        // Reload apps to update access count
        loadApps();
      } catch (error) {
        log.error('Error updating access count:', error);
        // Navigate anyway even if access count update fails
        router.push(`/app-view?appId=${appId}`);
      }
    }
  };

  const handleShowSnackbar = (message: string) => {
    Alert.alert('Info', message, [{ text: 'OK' }]);
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

  const showSetupBanner = !hasApiKey;
  const searchBarTopPadding = insets.top + 56;
  const stackTopPadding = Math.max(150, searchBarTopPadding + 70 + (showSetupBanner ? 52 : 0));

  return (
    <View style={[styles.container, isUniverseTheme ? styles.containerUniverse : undefined]}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle={isUniverseTheme ? 'light-content' : 'dark-content'}
      />
      <AppThemeBackground />

      <View pointerEvents="none" style={[styles.brandWrap, { top: insets.top + 4 }]}>
        <Text style={[styles.brandText, isUniverseTheme ? styles.brandTextUniverse : undefined]}>
          {t('home.brand')}
        </Text>
      </View>

      {showSetupBanner ? (
        <TouchableOpacity
          style={[
            styles.setupBanner,
            isUniverseTheme ? styles.setupBannerUniverse : undefined,
            { top: searchBarTopPadding + 64 },
          ]}
          onPress={() => router.push('/welcome')}
          accessibilityRole="button"
          accessibilityLabel="Open setup tutorial"
        >
          <Ionicons
            name="key-outline"
            size={16}
            color={isUniverseTheme ? 'rgba(222, 239, 255, 0.96)' : '#1f2937'}
          />
          <Text style={[styles.setupBannerText, isUniverseTheme ? styles.setupBannerTextUniverse : undefined]}>
            API key not configured. Tap to start setup tutorial.
          </Text>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={isUniverseTheme ? 'rgba(222, 239, 255, 0.92)' : '#1f2937'}
          />
        </TouchableOpacity>
      ) : null}
      
      {/* Main 3D Stack */}
      <Scrollable3DStack
        items={filteredItems}
        onNavigateToApp={handleNavigateToApp}
        onShowSnackbar={handleShowSnackbar}
        topPadding={stackTopPadding}
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
        style={{ paddingTop: searchBarTopPadding }}
      />
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
  brandWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1101,
  },
  brandText: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1.4,
    color: 'rgba(37, 37, 37, 0.88)',
    textShadowColor: 'rgba(255, 255, 255, 0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  brandTextUniverse: {
    color: 'rgba(233, 246, 255, 0.95)',
    textShadowColor: 'rgba(52, 135, 226, 0.55)',
    textShadowRadius: 8,
  },
  setupBanner: {
    position: 'absolute',
    left: 18,
    right: 18,
    zIndex: 950,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.93)',
    borderWidth: 1,
    borderColor: 'rgba(17, 24, 39, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  setupBannerUniverse: {
    backgroundColor: 'rgba(9, 30, 54, 0.94)',
    borderColor: 'rgba(123, 169, 220, 0.5)',
    shadowOpacity: 0.25,
  },
  setupBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#1f2937',
  },
  setupBannerTextUniverse: {
    color: 'rgba(225, 239, 255, 0.95)',
  },
});
