import React, { useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useUISettingsStore } from '../stores/UISettingsStore';

type Star = {
  x: number;
  y: number;
  size: number;
  opacity: number;
};

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export default function AppThemeBackground() {
  const appTheme = useUISettingsStore((s) => s.appTheme);
  const { width, height } = useWindowDimensions();
  const isUniverseTheme = appTheme === 'universe';

  const stars = useMemo<Star[]>(() => {
    if (!isUniverseTheme) return [];

    const count = 150;
    return Array.from({ length: count }, (_, index) => {
      const x = seededRandom(index * 11 + width * 0.09) * width;
      const y = seededRandom(index * 17 + height * 0.07) * height;
      const size = 0.9 + seededRandom(index * 23 + 5) * 2.1;
      const opacity = 0.22 + seededRandom(index * 29 + 13) * 0.72;
      return { x, y, size, opacity };
    });
  }, [height, isUniverseTheme, width]);

  if (!isUniverseTheme) {
    return null;
  }

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={['#01030a', '#050d20', '#07182f', '#0a2343', '#09172e']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {stars.map((star, index) => (
        <View
          key={`theme-star-${index}`}
          style={[
            styles.star,
            {
              left: star.x,
              top: star.y,
              width: star.size,
              height: star.size,
              borderRadius: star.size / 2,
              opacity: star.opacity,
            },
          ]}
        />
      ))}

      <View style={styles.nebulaTop} />
      <View style={styles.nebulaBottom} />
    </View>
  );
}

const styles = StyleSheet.create({
  star: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
  },
  nebulaTop: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    top: -110,
    right: -70,
    backgroundColor: 'rgba(66,141,255,0.20)',
  },
  nebulaBottom: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    bottom: -130,
    left: -80,
    backgroundColor: 'rgba(163,76,255,0.16)',
  },
});
