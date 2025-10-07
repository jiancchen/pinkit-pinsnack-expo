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

interface MostUsedAppCardProps {
  historyItem: PromptHistory;
  onNavigateToApp: (appId: string) => void;
}

const MostUsedAppCard: React.FC<MostUsedAppCardProps> = ({
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
      
      <View style={styles.textContainer}>
        <Text style={styles.title} numberOfLines={1}>
          {historyItem.title || 'Untitled App'}
        </Text>
        <Text style={styles.accessCount}>
          Used {historyItem.accessCount || 0} times
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 140,
    height: 120,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 10,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  imageContainer: {
    width: '100%',
    height: 70,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
    marginBottom: 8,
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
    fontSize: 20,
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
  textContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(0, 0, 0, 0.8)',
    lineHeight: 16,
  },
  accessCount: {
    fontSize: 11,
    color: 'rgba(0, 0, 0, 0.5)',
    fontWeight: '500',
  },
});

export default MostUsedAppCard;