import React, { useState, useEffect } from 'react';
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
}

const FavoriteAppCard: React.FC<FavoriteAppCardProps> = ({
  historyItem,
  onNavigateToApp,
}) => {
  const screenshotState = useScreenshotState(historyItem.id);
  const [imageError, setImageError] = useState(false);

  const screenshot = screenshotState?.uri;
  const showImage = screenshot && !imageError;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onNavigateToApp(historyItem.id)}
      activeOpacity={0.8}
    >
      <View style={styles.imageContainer}>
        {screenshotState?.isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#999" />
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
          <View style={styles.placeholderContainer}>
            <Text style={styles.placeholderText}>
              {historyItem.title?.charAt(0)?.toUpperCase() || '?'}
            </Text>
          </View>
        )}
      </View>
      
      <Text style={styles.title} numberOfLines={2}>
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
  imageContainer: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
    marginBottom: 4,
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
  placeholderText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#999',
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
  title: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(0, 0, 0, 0.8)',
    textAlign: 'center',
    lineHeight: 14,
  },
});

export default FavoriteAppCard;