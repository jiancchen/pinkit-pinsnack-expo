import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ThreeDImageCard from './ThreeDImageCard';
import { PromptHistory } from '../types/PromptHistory';
import { AppColors } from '../constants/AppColors';
import { getLiquidGlassTabBarOverlapHeight } from '../constants/LiquidGlassTabBarLayout';
import { useUISettingsStore } from '../stores/UISettingsStore';

const { height: screenHeight } = Dimensions.get('window');

interface Scrollable3DStackProps {
  items: PromptHistory[];
  onNavigateToApp: (id: string) => void;
  onShowSnackbar?: (message: string) => void;
}

interface CardTransform {
  scale: number;
  depth: number;
  alpha: number;
  rotationX: number;
  rotationY: number;
}

export default function Scrollable3DStack({
  items,
  onNavigateToApp,
  onShowSnackbar,
}: Scrollable3DStackProps) {
  const appTheme = useUISettingsStore((s) => s.appTheme);
  const isUniverseTheme = appTheme === 'universe';
  const scrollViewRef = useRef<ScrollView>(null);
  const [scrollY, setScrollY] = useState(0);
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(100, getLiquidGlassTabBarOverlapHeight(insets.bottom) + 40);

  // Calculate 3D transforms based on scroll position
  const calculateCardTransform = useCallback((index: number): CardTransform => {
    const cardHeight = 184; // 160 card height + 24 margin
    const screenCenterY = screenHeight / 2;
    
    // Calculate card position relative to screen center
    const cardCenterY = (index * cardHeight) + (cardHeight / 2) - scrollY + 100; // 100 is contentPadding
    const distanceFromCenter = Math.abs(cardCenterY - screenCenterY) / screenCenterY;
    const normalizedDistance = Math.min(distanceFromCenter, 2);

    // Calculate transforms
    const scale = Math.max(0.7, 1 - (normalizedDistance * 0.3));
    const depth = Math.min(4, normalizedDistance);
    const alpha = Math.max(0.2, 1 - (normalizedDistance * 0.2));
    const rotationX = 8 + (depth * 6);
    const rotationY = -10;

    return {
      scale,
      depth,
      alpha,
      rotationX,
      rotationY,
    };
  }, [scrollY]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setScrollY(event.nativeEvent.contentOffset.y);
  };

  // Background colors for the offset cards
  const getBackgroundColor = (index: number): string => {
    return AppColors.StackColors[index % AppColors.StackColors.length];
  };

  return (
    <View style={[styles.container, isUniverseTheme ? styles.containerUniverse : undefined]}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: bottomPadding }]}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        decelerationRate="normal"
      >
        {items.map((item, index) => {
          const transform = calculateCardTransform(index);
          const backgroundColor = getBackgroundColor(index);

          return (
            <View key={`${index}-${item.id}`} style={styles.cardWrapper}>
              <ThreeDImageCard
                historyItem={item}
                rotationX={transform.rotationX}
                rotationY={transform.rotationY}
                scale={transform.scale}
                depth={transform.depth}
                alpha={transform.alpha}
                backgroundColor={backgroundColor}
                onNavigateToApp={onNavigateToApp}
                onShowSnackbar={onShowSnackbar}
              />
            </View>
          );
        })}
      </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    alignItems: 'center',
    paddingVertical: 100,
  },
  cardWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
