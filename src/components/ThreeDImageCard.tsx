import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { PromptHistory, AppColors } from '../types/PromptHistory';
import { Ionicons } from '@expo/vector-icons';

const { width: screenWidth } = Dimensions.get('window');

interface ThreeDImageCardProps {
  historyItem: PromptHistory;
  rotationX: number;
  rotationY: number;
  scale: number;
  depth: number;
  alpha: number;
  backgroundColor: string;
  onNavigateToApp: (id: string) => void;
  onShowSnackbar?: (message: string) => void;
}

export default function ThreeDImageCard({
  historyItem,
  rotationX,
  rotationY,
  scale,
  depth,
  alpha,
  backgroundColor,
  onNavigateToApp,
  onShowSnackbar,
}: ThreeDImageCardProps) {
  const displayTitle = historyItem.title?.trim() || 
    (historyItem.prompt.substring(0, 50) + '...');

  // Check different states
  const isGenerating = historyItem.html === 'GENERATING...';
  const isNewItem = (historyItem.accessCount || 0) < 1 && !isGenerating;
  const isFavorite = historyItem.favorite === true;

  const handlePress = () => {
    if (isGenerating) {
      onShowSnackbar?.('Item is still generating, please wait...');
    } else {
      onNavigateToApp(historyItem.id);
    }
  };

  const cardTransform = [
    { perspective: 1000 },
    { rotateX: `${rotationX}deg` },
    { rotateY: `${rotationY}deg` },
    { scale: scale },
    { translateY: depth * 40 },
  ];

  const backgroundTransform = [
    { perspective: 1000 },
    { rotateX: `${rotationX}deg` },
    { rotateY: `${rotationY}deg` },
    { scale: scale },
    { translateY: depth * 40 + 8 },
    { translateX: 6 },
  ];

  return (
    <View style={styles.cardContainer}>
      {/* Background card (colorful offset) */}
      <View
        style={[
          styles.backgroundCard,
          {
            backgroundColor: backgroundColor,
            opacity: alpha * 0.8,
            transform: backgroundTransform,
          },
        ]}
      />

      {/* Main card */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={handlePress}
        style={[
          styles.mainCard,
          {
            opacity: alpha,
            transform: cardTransform,
          },
        ]}
      >
        {/* Card background with gradient overlay */}
        <View style={styles.cardBackground}>
          {/* Simulated screenshot area */}
          <View style={styles.screenshotArea}>
            {isGenerating && (
              <View style={styles.generatingOverlay}>
                <ActivityIndicator size="large" color={AppColors.White} />
              </View>
            )}
          </View>

          {/* Gradient overlay for text readability */}
          <View style={styles.gradientOverlay} />

          {/* Badge system */}
          <View style={styles.badgeContainer}>
            {isNewItem && (
              <View style={[styles.badge, styles.newBadge]}>
                <Text style={styles.badgeText}>NEW</Text>
              </View>
            )}
            {isGenerating && (
              <View style={[styles.badge, styles.generatingBadge]}>
                <ActivityIndicator size="small" color={AppColors.White} />
              </View>
            )}
            {isFavorite && !isGenerating && !isNewItem && (
              <View style={[styles.badge, styles.favoriteBadge]}>
                <Ionicons name="heart" size={14} color={AppColors.White} />
              </View>
            )}
          </View>

          {/* Title text */}
          <View style={styles.titleContainer}>
            <Text style={styles.titleText} numberOfLines={2}>
              {displayTitle}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    width: 300,
    height: 160,
    marginVertical: 12,
  },
  backgroundCard: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  mainCard: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  cardBackground: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    position: 'relative',
  },
  screenshotArea: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    position: 'relative',
  },
  generatingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  badgeContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  newBadge: {
    backgroundColor: '#EF4444',
  },
  generatingBadge: {
    backgroundColor: '#FFD700',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  favoriteBadge: {
    backgroundColor: '#E91E63',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  badgeText: {
    color: AppColors.White,
    fontSize: 10,
    fontWeight: 'bold',
  },
  titleContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
  },
  titleText: {
    color: AppColors.White,
    fontSize: 18,
    fontWeight: 'bold',
    textShadowColor: '#000',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
});