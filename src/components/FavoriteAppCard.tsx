import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
} from 'react-native';
import { PromptHistory } from '../types/PromptHistory';
import { useScreenshotState } from '../stores/ScreenshotStore';

interface FavoriteAppCardProps {
  historyItem: PromptHistory;
  onNavigateToApp: (appId: string) => void;
  isUniverseTheme?: boolean;
}

const FavoriteAppCard: React.FC<FavoriteAppCardProps> = ({
  historyItem,
  onNavigateToApp,
  isUniverseTheme = false,
}) => {
  const screenshotState = useScreenshotState(historyItem.id);
  const [imageError, setImageError] = useState(false);
  const isGenerating = historyItem.status === 'generating';
  const isSample = historyItem.isSample === true || historyItem.id.startsWith('sample_');

  const screenshot = screenshotState?.uri;
  const showImage = screenshot && !imageError;

  return (
    <TouchableOpacity
      style={[
        styles.container,
        isUniverseTheme ? styles.containerUniverse : undefined,
        isGenerating && styles.containerDisabled,
      ]}
      onPress={() => {
        if (!isGenerating) onNavigateToApp(historyItem.id);
      }}
      activeOpacity={0.8}
      disabled={isGenerating}
    >
      <View style={[styles.imageContainer, isUniverseTheme ? styles.imageContainerUniverse : undefined]}>
        {isSample && (
          <View style={[styles.sampleBadge, isUniverseTheme ? styles.sampleBadgeUniverse : undefined]}>
            <Text style={styles.sampleBadgeText}>SAMPLE</Text>
          </View>
        )}
        {screenshotState?.isLoading && (
          <View style={[styles.loadingContainer, isUniverseTheme ? styles.loadingContainerUniverse : undefined]}>
            <ActivityIndicator size="small" color={isUniverseTheme ? 'rgba(206, 230, 255, 0.86)' : '#999'} />
          </View>
        )}

        {isGenerating && (
          <View style={styles.generatingOverlay}>
            <ActivityIndicator size="small" color="#fff" />
          </View>
        )}
        
        {showImage ? (
          <Image
            source={{ uri: screenshot }}
            style={styles.screenshot}
            resizeMode="cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <View
            style={[styles.placeholderContainer, isUniverseTheme ? styles.placeholderContainerUniverse : undefined]}
          >
            <Text style={[styles.placeholderText, isUniverseTheme ? styles.placeholderTextUniverse : undefined]}>
              {historyItem.title?.charAt(0)?.toUpperCase() || '?'}
            </Text>
          </View>
        )}
      </View>
      
      <Text style={[styles.title, isUniverseTheme ? styles.titleUniverse : undefined]} numberOfLines={2}>
        {historyItem.title || 'Untitled App'}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 120,
    height: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 12,
    padding: 8,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  containerUniverse: {
    backgroundColor: 'rgba(8, 27, 49, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(125, 171, 222, 0.32)',
    shadowOpacity: 0.2,
  },
  containerDisabled: {
    opacity: 0.6,
  },
  imageContainer: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
    marginBottom: 4,
  },
  imageContainerUniverse: {
    backgroundColor: 'rgba(10, 35, 61, 0.9)',
  },
  screenshot: {
    width: '100%',
    height: '100%',
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e0e0e0',
  },
  placeholderContainerUniverse: {
    backgroundColor: 'rgba(16, 49, 83, 0.86)',
  },
  placeholderText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#999',
  },
  placeholderTextUniverse: {
    color: 'rgba(206, 228, 250, 0.86)',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    zIndex: 1,
  },
  loadingContainerUniverse: {
    backgroundColor: 'rgba(7, 20, 38, 0.7)',
  },
  generatingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    zIndex: 2,
  },
  sampleBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    zIndex: 3,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: 'rgba(14, 116, 144, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(196, 240, 255, 0.8)',
  },
  sampleBadgeUniverse: {
    backgroundColor: 'rgba(8, 120, 160, 0.88)',
    borderColor: 'rgba(176, 231, 255, 0.8)',
  },
  sampleBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.4,
    color: '#fff',
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(0, 0, 0, 0.8)',
    textAlign: 'center',
    lineHeight: 14,
  },
  titleUniverse: {
    color: 'rgba(226, 240, 255, 0.95)',
  },
});

export default FavoriteAppCard;
