import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useGenerationStatusStore } from '../stores/GenerationStatusStore';
import { useUISettingsStore } from '../stores/UISettingsStore';

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

export default function GenerationInlineProgressBar() {
  const queue = useGenerationStatusStore((s) => s.queue);
  const tintColor = useUISettingsStore((s) => s.tabBar.tintColor);

  const pendingCount = useMemo(
    () => queue.filter((j) => j.status === 'queued' || j.status === 'running').length,
    [queue]
  );

  const isVisible = pendingCount > 0;

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
        duration: 950,
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

  const segmentWidth = trackWidth > 0 ? Math.max(60, Math.round(trackWidth * 0.4)) : 0;
  const translateX =
    trackWidth > 0
      ? shimmer.interpolate({
          inputRange: [0, 1],
          outputRange: [-segmentWidth, trackWidth],
        })
      : 0;

  const trackColor = 'rgba(0, 0, 0, 0.08)';
  const segmentStart = rgba(tintColor, 0.75);
  const segmentEnd = rgba(tintColor, 0.10);

  return (
    <View
      pointerEvents="none"
      style={[styles.track, { backgroundColor: trackColor }]}
      onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {trackWidth > 0 && (
        <Animated.View
          style={[
            styles.segment,
            {
              width: segmentWidth,
              backgroundColor: segmentStart,
              transform: [{ translateX: translateX as any }],
              shadowColor: segmentStart,
            },
          ]}
        >
          <View style={[StyleSheet.absoluteFill, { backgroundColor: segmentEnd, opacity: 0.25 }]} />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  segment: {
    height: '100%',
    borderRadius: 999,
    overflow: 'hidden',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
});

