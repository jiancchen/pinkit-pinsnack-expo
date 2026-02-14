import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  Animated,
  View,
  ScrollView,
  Text,
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
  onFocusedItemChange?: (item: PromptHistory | null) => void;
  topPadding?: number;
}

interface CardTransform {
  scale: number;
  depth: number;
  alpha: number;
  rotationX: number;
  rotationY: number;
  centerIntensity: number;
}

export default function Scrollable3DStack({
  items,
  onNavigateToApp,
  onShowSnackbar,
  onFocusedItemChange,
  topPadding = 100,
}: Scrollable3DStackProps) {
  const appTheme = useUISettingsStore((s) => s.appTheme);
  const isUniverseTheme = appTheme === 'universe';
  const scrollViewRef = useRef<ScrollView>(null);
  const [scrollY, setScrollY] = useState(0);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [focusedDateText, setFocusedDateText] = useState<string>('');
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(100, getLiquidGlassTabBarOverlapHeight(insets.bottom) + 40);
  const dateOpacity = useRef(new Animated.Value(0)).current;
  const dateScale = useRef(new Animated.Value(0.95)).current;
  const dateTranslateY = useRef(new Animated.Value(8)).current;

  const contentTopPadding = Math.max(0, topPadding);

  // Calculate 3D transforms based on scroll position
  const calculateCardTransform = useCallback((index: number): CardTransform => {
    const cardHeight = 184; // 160 card height + 24 margin
    const screenCenterY = screenHeight / 2;
    
    // Calculate card position relative to screen center
    const cardCenterY = (index * cardHeight) + (cardHeight / 2) - scrollY + contentTopPadding;
    const distanceFromCenter = Math.abs(cardCenterY - screenCenterY) / screenCenterY;
    const normalizedDistance = Math.min(distanceFromCenter, 2);

    // Calculate transforms
    const scale = Math.max(0.7, 1 - (normalizedDistance * 0.3));
    const depth = Math.min(4, normalizedDistance);
    const alpha = Math.max(0.2, 1 - (normalizedDistance * 0.2));
    const rotationX = 8 + (depth * 6);
    const rotationY = -10;
    const centerIntensity = Math.max(0, 1 - normalizedDistance);

    return {
      scale,
      depth,
      alpha,
      rotationX,
      rotationY,
      centerIntensity,
    };
  }, [scrollY, contentTopPadding]);

  const getNearestIndex = useCallback(
    (offsetY: number): number => {
      if (items.length === 0) return 0;
      const cardHeight = 184;
      const screenCenterY = screenHeight / 2;
      const relative = (offsetY + screenCenterY - contentTopPadding - cardHeight / 2) / cardHeight;
      const nearest = Math.round(relative);
      return Math.max(0, Math.min(items.length - 1, nearest));
    },
    [items.length, contentTopPadding]
  );

  const formatCreatedDate = useCallback((value?: Date | string): string => {
    const date = value ? new Date(value) : new Date();
    if (!Number.isFinite(date.getTime())) return '';
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, []);

  useEffect(() => {
    if (items.length === 0) {
      setFocusedDateText('');
      onFocusedItemChange?.(null);
      return;
    }

    const nextItem = items[Math.max(0, Math.min(focusedIndex, items.length - 1))];
    onFocusedItemChange?.(nextItem);

    const nextText = formatCreatedDate(nextItem.timestamp);
    if (nextText === focusedDateText) return;

    Animated.parallel([
      Animated.timing(dateOpacity, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(dateScale, {
        toValue: 0.97,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setFocusedDateText(nextText);
      dateTranslateY.setValue(8);
      Animated.parallel([
        Animated.timing(dateOpacity, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true,
        }),
        Animated.spring(dateScale, {
          toValue: 1,
          friction: 9,
          tension: 75,
          useNativeDriver: true,
        }),
        Animated.spring(dateTranslateY, {
          toValue: 0,
          friction: 10,
          tension: 70,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [
    items,
    focusedIndex,
    onFocusedItemChange,
    formatCreatedDate,
    focusedDateText,
    dateOpacity,
    dateScale,
    dateTranslateY,
  ]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextY = event.nativeEvent.contentOffset.y;
    setScrollY(nextY);
    const nearestIndex = getNearestIndex(nextY);
    if (nearestIndex !== focusedIndex) {
      setFocusedIndex(nearestIndex);
    }
  };

  // Background colors for the offset cards
  const getBackgroundColor = (index: number): string => {
    return AppColors.StackColors[index % AppColors.StackColors.length];
  };

  return (
    <View style={[styles.container, isUniverseTheme ? styles.containerUniverse : undefined]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.dateBackdrop,
          {
            opacity: dateOpacity,
            transform: [{ translateY: dateTranslateY }, { scale: dateScale }],
          },
        ]}
      >
        <Text style={[styles.dateBackdropText, isUniverseTheme ? styles.dateBackdropTextUniverse : undefined]}>
          {focusedDateText}
        </Text>
      </Animated.View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingTop: contentTopPadding, paddingBottom: bottomPadding },
        ]}
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
                centerIntensity={transform.centerIntensity}
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
  dateBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 0,
  },
  dateBackdropText: {
    fontSize: 62,
    lineHeight: 66,
    letterSpacing: 1.4,
    fontWeight: '900',
    color: 'rgba(34, 34, 34, 0.24)',
    textTransform: 'uppercase',
  },
  dateBackdropTextUniverse: {
    color: 'rgba(194, 220, 248, 0.18)',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    alignItems: 'center',
  },
  cardWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
