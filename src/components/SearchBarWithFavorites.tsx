import React, { useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Text,
  Animated,
  ScrollView,
  Keyboard,
  Pressable,
} from 'react-native';
import { State } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {PromptHistory } from '../types/PromptHistory';
import { AppColors } from '../constants/AppColors';
import FavoriteAppCard from './FavoriteAppCard';
import MostUsedAppCard from './MostUsedAppCard';
import GenerationInlineProgressBar from './GenerationInlineProgressBar';
import { useUISettingsStore } from '../stores/UISettingsStore';

interface SearchBarWithFavoritesProps {
  searchText: string;
  onSearchTextChange: (text: string) => void;
  showFavorites: boolean;
  onToggleFavorites: () => void;
  onClearSearch: () => void;
  favoriteItems: PromptHistory[];
  mostUsedItems: PromptHistory[];
  onNavigateToApp: (appId: string) => void;
  style?: any;
}

const SearchBarWithFavorites: React.FC<SearchBarWithFavoritesProps> = ({
  searchText,
  onSearchTextChange,
  showFavorites,
  onToggleFavorites,
  onClearSearch,
  favoriteItems,
  mostUsedItems,
  onNavigateToApp,
  style,
}) => {
  const insets = useSafeAreaInsets();
  const appTheme = useUISettingsStore((s) => s.appTheme);
  const isUniverseTheme = appTheme === 'universe';

  const isPopupVisible = showFavorites && searchText.length === 0;
  const closePopup = React.useCallback(() => {
    if (showFavorites) {
      onToggleFavorites();
    }
  }, [showFavorites, onToggleFavorites]);
  
  // Use useRef for animated values to avoid conflicts
  const searchBarOffset = React.useRef(new Animated.Value(0)).current;
  const favoritesOffset = React.useRef(new Animated.Value(0)).current;
  const favoritesOpacity = React.useRef(new Animated.Value(1)).current;

  // Animation for showing/hiding favorites
  useEffect(() => {
    if (showFavorites) {
      Animated.parallel([
        Animated.timing(favoritesOffset, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(favoritesOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(favoritesOffset, {
          toValue: -100,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(favoritesOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showFavorites]);

  useEffect(() => {
    const onKeyboardHide = () => {
      if (isPopupVisible) {
        closePopup();
      }
    };

    const didHide = Keyboard.addListener('keyboardDidHide', onKeyboardHide);
    const willHide = Keyboard.addListener('keyboardWillHide', onKeyboardHide);

    return () => {
      didHide.remove();
      willHide.remove();
    };
  }, [closePopup, isPopupVisible]);

  // Gesture thresholds based on Android implementation
  const SWIPE_THRESHOLD = -100; // Swipe up threshold to dismiss favorites
  const SEARCH_BAR_SWIPE_THRESHOLD = 100; // Swipe down threshold on search bar to show favorites

  const handleSearchBarPanGesture = (event: any) => {
    const { translationY, velocityY, state } = event.nativeEvent;
    
    if (state === State.ACTIVE) {
      // Allow downward swipe to show favorites (limit to 50px)
      if (translationY > 0) {
        searchBarOffset.setValue(Math.min(translationY, 50));
      }
    } else if (state === State.END) {
      if (translationY > SEARCH_BAR_SWIPE_THRESHOLD || velocityY > 500) {
        // Show favorites if swiped down enough
        if (!showFavorites) {
          onToggleFavorites();
        }
      }
      // Reset search bar position
      Animated.spring(searchBarOffset, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
    }
  };

  const handleFavoritesPanGesture = (event: any) => {
    const { translationY, velocityY, state } = event.nativeEvent;
    
    if (state === State.ACTIVE) {
      // Allow upward swipe to dismiss favorites
      if (translationY < 0) {
        favoritesOffset.setValue(Math.max(translationY, SWIPE_THRESHOLD));
        favoritesOpacity.setValue(Math.max(1 + (translationY / Math.abs(SWIPE_THRESHOLD)), 0.3));
      }
    } else if (state === State.END) {
      if (translationY < SWIPE_THRESHOLD / 2 || velocityY < -500) {
        // Hide favorites if swiped up enough
        onToggleFavorites();
      } else {
        // Reset position
        Animated.parallel([
          Animated.spring(favoritesOffset, {
            toValue: 0,
            useNativeDriver: true,
          }),
          Animated.spring(favoritesOpacity, {
            toValue: 1,
            useNativeDriver: true,
          }),
        ]).start();
      }
    }
  };

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top },
        style,
        isPopupVisible ? styles.containerExpanded : null,
      ]}
    >
      {isPopupVisible && (
        <Pressable
          style={styles.backdrop}
          onPress={() => {
            Keyboard.dismiss();
            closePopup();
          }}
        />
      )}

        <View style={styles.content}>
        {/* Search Bar */}
        <View>
          <Animated.View
            style={[
              styles.searchBarContainer,
              {
                transform: [{ translateY: searchBarOffset }],
              },
            ]}
          >
            <View style={[styles.searchBar, isUniverseTheme ? styles.searchBarUniverse : undefined]}>
              {/* Star/Favorites Toggle */}
              <TouchableOpacity style={styles.starButton} onPress={onToggleFavorites}>
                <Ionicons
                  name="star"
                  size={24}
                  color={
                    showFavorites
                      ? AppColors.FABMain
                      : isUniverseTheme
                        ? 'rgba(196, 222, 250, 0.78)'
                        : '#999'
                  }
                />
              </TouchableOpacity>

              {/* Search Input */}
              <TextInput
                style={[styles.searchInput, isUniverseTheme ? styles.searchInputUniverse : undefined]}
                value={searchText}
                onChangeText={onSearchTextChange}
                onFocus={() => {
                  if (!showFavorites && searchText.length === 0) {
                    onToggleFavorites();
                  }
                }}
                placeholder="Search your apps..."
                placeholderTextColor={isUniverseTheme ? 'rgba(198, 220, 244, 0.6)' : '#999'}
                returnKeyType="search"
              />

              {/* Leading Search Icon */}
              <Ionicons
                name="search"
                size={20}
                color={isUniverseTheme ? 'rgba(198, 220, 244, 0.7)' : '#999'}
                style={styles.searchIcon}
              />

              {/* Clear Button */}
              {searchText.length > 0 && (
                <TouchableOpacity style={styles.clearButton} onPress={onClearSearch}>
                  <Ionicons
                    name="close"
                    size={20}
                    color={isUniverseTheme ? 'rgba(210, 232, 252, 0.8)' : '#999'}
                  />
                </TouchableOpacity>
              )}
            </View>

            {/* Thin generation progress (under search field) */}
            <View style={styles.inlineProgressWrap}>
              <GenerationInlineProgressBar />
            </View>
          </Animated.View>
        </View>

        {/* Favorites Section */}
        {isPopupVisible && (
          <View>
            <Animated.View
              style={[
                styles.favoritesContainer,
                isUniverseTheme ? styles.favoritesContainerUniverse : undefined,
                {
                  opacity: favoritesOpacity,
                  transform: [{ translateY: favoritesOffset }],
                },
              ]}
            >
              <View style={styles.favoritesContent}>
                {/* Favorite Apps Section */}
                <Text style={[styles.sectionTitle, isUniverseTheme ? styles.sectionTitleUniverse : undefined]}>
                  Favorite Apps
                </Text>
                {favoriteItems.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.horizontalScrollContent}
                  >
                    {favoriteItems.map((item) => (
                      <FavoriteAppCard
                        key={item.id}
                        historyItem={item}
                        isUniverseTheme={isUniverseTheme}
                        onNavigateToApp={onNavigateToApp}
                      />
                    ))}
                  </ScrollView>
                ) : (
                  <Text style={[styles.emptyText, isUniverseTheme ? styles.emptyTextUniverse : undefined]}>
                    No favorite apps yet
                  </Text>
                )}

                {/* Most Used Apps Section */}
                <Text
                  style={[
                    styles.sectionTitle,
                    isUniverseTheme ? styles.sectionTitleUniverse : undefined,
                    { marginTop: 20 },
                  ]}
                >
                  Most Used Apps
                </Text>
                {mostUsedItems.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.horizontalScrollContent}
                  >
                    {mostUsedItems.map((item) => (
                      <MostUsedAppCard
                        key={item.id}
                        historyItem={item}
                        isUniverseTheme={isUniverseTheme}
                        onNavigateToApp={onNavigateToApp}
                      />
                    ))}
                  </ScrollView>
                ) : (
                  <Text style={[styles.emptyText, isUniverseTheme ? styles.emptyTextUniverse : undefined]}>
                    No usage data yet
                  </Text>
                )}
              </View>
            </Animated.View>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  containerExpanded: {
    bottom: 0,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    zIndex: 1,
  },
  searchBarContainer: {
    marginBottom: 8,
  },
  inlineProgressWrap: {
    marginTop: 8,
    paddingHorizontal: 14,
  },
  searchBar: {
    height: 56,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  searchBarUniverse: {
    backgroundColor: 'rgba(8, 26, 48, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(136, 181, 228, 0.42)',
    shadowOpacity: 0.28,
  },
  starButton: {
    padding: 8,
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingHorizontal: 12,
    paddingLeft: 32, // Space for search icon
  },
  searchInputUniverse: {
    color: 'rgba(229, 242, 255, 0.95)',
  },
  searchIcon: {
    position: 'absolute',
    left: 60, // After star button
    top: 18,
  },
  clearButton: {
    padding: 8,
    marginLeft: 8,
  },
  favoritesContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  favoritesContainerUniverse: {
    backgroundColor: 'rgba(7, 20, 38, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(124, 171, 222, 0.4)',
    shadowOpacity: 0.25,
  },
  favoritesContent: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'rgba(0, 0, 0, 0.8)',
    marginBottom: 12,
  },
  sectionTitleUniverse: {
    color: 'rgba(223, 238, 255, 0.94)',
  },
  horizontalScrollContent: {
    paddingHorizontal: 4,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    marginBottom: 8,
  },
  emptyTextUniverse: {
    color: 'rgba(195, 219, 247, 0.82)',
  },
});

export default SearchBarWithFavorites;
