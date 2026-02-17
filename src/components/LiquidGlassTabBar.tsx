import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Platform, TouchableOpacity, Keyboard, View, useWindowDimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  withSpring,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabBarVariant, useUISettingsStore } from '../stores/UISettingsStore';
import {
  getLiquidGlassTabBarBottomOffset,
  getLiquidGlassTabBarContainerHeight,
  LIQUID_GLASS_TAB_BAR_PILL_HEIGHT,
  LIQUID_GLASS_TAB_BAR_PILL_PADDING,
} from '../constants/LiquidGlassTabBarLayout';

interface LiquidGlassTabBarProps extends BottomTabBarProps {}

function hexToRgb(hexColor: string): { r: number; g: number; b: number } | null {
  const normalized = hexColor.trim().replace('#', '');
  const hex = normalized.length === 3
    ? normalized.split('').map((c) => c + c).join('')
    : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;

  const int = parseInt(hex, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

function rgba(hexColor: string, alpha: number): string {
  const rgb = hexToRgb(hexColor);
  if (!rgb) return `rgba(124, 58, 237, ${alpha})`;
  const clamped = Math.max(0, Math.min(1, alpha));
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${clamped})`;
}

function getTabBarColors(variant: TabBarVariant, tintColor: string) {
  const overlayAlphaA = variant === 'tinted' ? 0.18 : 0.08;
  const overlayAlphaB = variant === 'tinted' ? 0.10 : 0.04;
  const indicatorAlphaA = variant === 'tinted' ? 0.24 : 0.16;
  const indicatorAlphaB = variant === 'tinted' ? 0.12 : 0.08;
  const borderAlpha = variant === 'tinted' ? 0.20 : 0.22;

  return {
    overlayGradient: [rgba(tintColor, overlayAlphaA), rgba(tintColor, overlayAlphaB)] as const,
    highlightGradient: ['rgba(255, 255, 255, 0.55)', 'rgba(255, 255, 255, 0)'] as const,
    indicatorGradient: [rgba(tintColor, indicatorAlphaA), rgba(tintColor, indicatorAlphaB)] as const,
    borderColor: rgba(tintColor, borderAlpha),
    baseFallback: variant === 'tinted' ? 'rgba(255, 255, 255, 0.55)' : 'rgba(255, 255, 255, 0.35)',
  };
}

interface TabButtonProps {
  routeName: string;
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
}

function TabButton({ routeName, isFocused, onPress, onLongPress }: TabButtonProps) {
  const focus = useSharedValue(isFocused ? 1 : 0);

  useEffect(() => {
    focus.value = withSpring(isFocused ? 1 : 0, { damping: 18, stiffness: 180 });
  }, [isFocused]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: 0.75 + focus.value * 0.25,
      transform: [{ scale: 1 + focus.value * 0.08 }],
    };
  });

  const iconName = useMemo(() => {
    switch (routeName) {
      case 'index':
        return isFocused ? 'home' : 'home-outline';
      case 'universe':
        return isFocused ? 'planet' : 'planet-outline';
      case 'create':
        return isFocused ? 'add-circle' : 'add-circle-outline';
      case 'stats':
        return isFocused ? 'stats-chart' : 'stats-chart-outline';
      case 'settings':
        return isFocused ? 'settings' : 'settings-outline';
      default:
        return 'ellipse-outline';
    }
  }, [routeName, isFocused]);

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.tabItem}
      accessibilityRole="button"
    >
      <Animated.View style={[styles.tabItemInner, animatedStyle]}>
        <Ionicons
          name={iconName as any}
          size={24}
          color={isFocused ? 'rgba(0, 0, 0, 0.92)' : 'rgba(0, 0, 0, 0.62)'}
          style={styles.iconShadow}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function LiquidGlassTabBar({ state, navigation }: LiquidGlassTabBarProps) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const tabBarVariant = useUISettingsStore((s) => s.tabBar.variant);
  const tabBarTintColor = useUISettingsStore((s) => s.tabBar.tintColor);
  const tabBarBlurIntensity = useUISettingsStore((s) => s.tabBar.blurIntensity);

  const tabBarOffset = useSharedValue(0);
  const activeIndex = useSharedValue(state.index);
  const pillWidth = useSharedValue(0);
  const routesCount = state.routes.length;

  useEffect(() => {
    activeIndex.value = withSpring(state.index, { damping: 18, stiffness: 180 });
  }, [state.index]);

  useEffect(() => {
    // Hide tab bar when keyboard appears on Android
    if (Platform.OS === 'android') {
      const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
        tabBarOffset.value = withSpring(300, { damping: 20 });
      });
      const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
        tabBarOffset.value = withSpring(0, { damping: 20 });
      });

      return () => {
        keyboardDidShowListener.remove();
        keyboardDidHideListener.remove();
      };
    }
  }, []);

  const containerAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: tabBarOffset.value }]
    };
  });

  const indicatorAnimatedStyle = useAnimatedStyle(() => {
    if (pillWidth.value <= 0) {
      return { opacity: 0 };
    }

    const innerWidth = pillWidth.value - LIQUID_GLASS_TAB_BAR_PILL_PADDING * 2;
    const tabWidth = innerWidth / Math.max(1, routesCount);

    return {
      opacity: 1,
      width: tabWidth,
      transform: [{ translateX: activeIndex.value * tabWidth }],
    };
  });

  const horizontalMargin = Math.max(18, Math.min(60, Math.round(screenWidth * 0.18)));
  const bottomOffset = getLiquidGlassTabBarBottomOffset(insets.bottom);
  const containerHeight = getLiquidGlassTabBarContainerHeight(insets.bottom);

  const colors = useMemo(
    () => getTabBarColors(tabBarVariant, tabBarTintColor),
    [tabBarVariant, tabBarTintColor]
  );

  return (
    <Animated.View style={[styles.container, { height: containerHeight }, containerAnimatedStyle]}>
      <BlurView
        intensity={tabBarBlurIntensity}
        tint="light"
        style={[
          styles.pill,
          {
            left: horizontalMargin,
            right: horizontalMargin,
            bottom: bottomOffset,
            backgroundColor: colors.baseFallback,
            borderColor: colors.borderColor,
          }
        ]}
        onLayout={(event) => {
          pillWidth.value = event.nativeEvent.layout.width;
        }}
      >
        {/* Subtle tint overlay */}
        <LinearGradient
          colors={colors.overlayGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* Glass highlight sheen */}
        <LinearGradient
          colors={colors.highlightGradient}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* Animated active pill */}
        <Animated.View style={[styles.activeIndicator, indicatorAnimatedStyle]} pointerEvents="none">
          <LinearGradient
            colors={colors.indicatorGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.activeIndicatorBorder} />
        </Animated.View>

        <View style={styles.tabRow}>
          {state.routes.map((route, index) => {
            const isFocused = state.index === index;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            const onLongPress = () => {
              navigation.emit({
                type: 'tabLongPress',
                target: route.key,
              });
            };

            return (
              <TabButton
                key={route.key}
                routeName={route.name}
                isFocused={isFocused}
                onPress={onPress}
                onLongPress={onLongPress}
              />
            );
          })}
        </View>
      </BlurView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    zIndex: 100,
  },
  pill: {
    position: 'absolute',
    height: LIQUID_GLASS_TAB_BAR_PILL_HEIGHT,
    borderRadius: LIQUID_GLASS_TAB_BAR_PILL_HEIGHT / 2,
    overflow: 'hidden',
    padding: LIQUID_GLASS_TAB_BAR_PILL_PADDING,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 10,
  },
  activeIndicator: {
    position: 'absolute',
    top: LIQUID_GLASS_TAB_BAR_PILL_PADDING,
    bottom: LIQUID_GLASS_TAB_BAR_PILL_PADDING,
    left: LIQUID_GLASS_TAB_BAR_PILL_PADDING,
    borderRadius: (LIQUID_GLASS_TAB_BAR_PILL_HEIGHT - LIQUID_GLASS_TAB_BAR_PILL_PADDING * 2) / 2,
    overflow: 'hidden',
  },
  activeIndicatorBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: (LIQUID_GLASS_TAB_BAR_PILL_HEIGHT - LIQUID_GLASS_TAB_BAR_PILL_PADDING * 2) / 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.55)',
  },
  tabRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabItemInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconShadow: {
    textShadowColor: 'rgba(255, 255, 255, 0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
