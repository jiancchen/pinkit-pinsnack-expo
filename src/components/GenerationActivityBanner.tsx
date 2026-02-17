import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUISettingsStore, type TabBarVariant } from '../stores/UISettingsStore';
import { useGenerationStatusStore } from '../stores/GenerationStatusStore';

function hexToRgb(hexColor: string): { r: number; g: number; b: number } | null {
  const normalized = hexColor.trim().replace('#', '');
  const hex =
    normalized.length === 3
      ? normalized
          .split('')
          .map((c) => c + c)
          .join('')
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
  const clamped = Math.max(0, Math.min(1, alpha));
  if (!rgb) return `rgba(124, 58, 237, ${clamped})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${clamped})`;
}

function getBannerColors(variant: TabBarVariant, tintColor: string) {
  return {
    overlayGradient: [
      rgba(tintColor, variant === 'tinted' ? 0.18 : 0.08),
      rgba(tintColor, variant === 'tinted' ? 0.10 : 0.04),
    ] as const,
    highlightGradient: ['rgba(255, 255, 255, 0.55)', 'rgba(255, 255, 255, 0)'] as const,
    borderColor: rgba(tintColor, variant === 'tinted' ? 0.20 : 0.22),
    baseFallback: variant === 'tinted' ? 'rgba(255, 255, 255, 0.55)' : 'rgba(255, 255, 255, 0.35)',
    progressGradient: [rgba(tintColor, 0.75), rgba(tintColor, 0.15)] as const,
    progressTrack: 'rgba(0, 0, 0, 0.10)',
  };
}

export default function GenerationActivityBanner() {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const queue = useGenerationStatusStore((s) => s.queue);

  const tabBarVariant = useUISettingsStore((s) => s.tabBar.variant);
  const tabBarTintColor = useUISettingsStore((s) => s.tabBar.tintColor);
  const tabBarBlurIntensity = useUISettingsStore((s) => s.tabBar.blurIntensity);

  const pendingJobs = useMemo(
    () => queue.filter((j) => j.status === 'queued' || j.status === 'running'),
    [queue]
  );

  const runningJob = useMemo(
    () => pendingJobs.find((j) => j.status === 'running') ?? null,
    [pendingJobs]
  );

  const queuedCount = useMemo(
    () => pendingJobs.filter((j) => j.status === 'queued').length,
    [pendingJobs]
  );

  const pendingCount = pendingJobs.length;
  const isVisible = pendingCount > 0;

  const label = runningJob
    ? queuedCount > 0
        ? `Generating • keep open • ${queuedCount} queued`
        : 'Generating • keep open'
    : 'Queued • keep open';

  const iconName = runningJob ? 'sparkles' : 'time-outline';

  const colors = useMemo(
    () => getBannerColors(tabBarVariant, tabBarTintColor),
    [tabBarVariant, tabBarTintColor]
  );

  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0
  );

  const BANNER_HEIGHT = 46;
  const bannerWidth = Math.min(420, Math.max(240, screenWidth - 24));
  const topOffset = topInset + 6;

  const shimmer = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef<Animated.CompositeAnimation | null>(null);
  const [trackWidth, setTrackWidth] = useState(0);

  useEffect(() => {
    shimmer.setValue(0);
    shimmerAnim.current?.stop();

    if (!isVisible) return;

    shimmerAnim.current = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1100,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      })
    );

    shimmerAnim.current.start();

    return () => {
      shimmerAnim.current?.stop();
    };
  }, [isVisible, shimmer]);

  if (!isVisible) return null;

  const segmentWidth = trackWidth > 0 ? Math.max(70, Math.round(trackWidth * 0.45)) : 0;
  const translateX =
    trackWidth > 0
      ? shimmer.interpolate({
          inputRange: [0, 1],
          outputRange: [-segmentWidth, trackWidth],
        })
      : 0;

  return (
    <View pointerEvents="none" style={[styles.container, { top: topOffset }]}>
      <BlurView
        intensity={tabBarBlurIntensity}
        tint="light"
        style={[
          styles.pill,
          {
            width: bannerWidth,
            height: BANNER_HEIGHT,
            borderRadius: 16,
            backgroundColor: colors.baseFallback,
            borderColor: colors.borderColor,
          },
        ]}
      >
        <LinearGradient
          colors={colors.overlayGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <LinearGradient
          colors={colors.highlightGradient}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <View style={styles.row}>
          <View style={styles.iconWrap}>
            <Ionicons name={iconName as any} size={16} color="rgba(0, 0, 0, 0.82)" />
          </View>

          <Text style={styles.label} numberOfLines={1}>
            {label}
          </Text>

          <Text style={styles.count} numberOfLines={1}>
            {pendingCount}
          </Text>
        </View>

        <View
          style={[styles.progressTrack, { backgroundColor: colors.progressTrack }]}
          onLayout={(event) => {
            setTrackWidth(event.nativeEvent.layout.width);
          }}
        >
          {trackWidth > 0 && (
            <Animated.View
              style={[
                styles.progressSegment,
                {
                  width: segmentWidth,
                  transform: [{ translateX: translateX as any }],
                },
              ]}
            >
              <LinearGradient
                colors={colors.progressGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          )}
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 2000,
  },
  pill: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flex: 1,
    paddingHorizontal: 12,
    paddingBottom: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconWrap: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    color: 'rgba(0, 0, 0, 0.84)',
  },
  count: {
    fontSize: 12,
    fontWeight: '900',
    color: 'rgba(0, 0, 0, 0.70)',
    minWidth: 18,
    textAlign: 'right',
  },
  progressTrack: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 6,
    height: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressSegment: {
    height: '100%',
    borderRadius: 999,
    overflow: 'hidden',
  },
});
