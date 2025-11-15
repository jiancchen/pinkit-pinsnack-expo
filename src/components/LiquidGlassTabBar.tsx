import React from 'react';
import { StyleSheet, useWindowDimensions, Platform, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
import {
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useDerivedValue,
  withRepeat,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useEffect } from 'react';

interface LiquidGlassTabBarProps extends BottomTabBarProps {}

export default function LiquidGlassTabBar({ state, descriptors, navigation }: LiquidGlassTabBarProps) {
  const { width } = useWindowDimensions();
  
  // Animation values
  const progress = useSharedValue(0);
  const rotation = useSharedValue(0);

  useEffect(() => {
    // Slow radial movement animation
    progress.value = withRepeat(
      withTiming(1, { duration: 4000 }),
      -1,
      true
    );
    
    // Slow rotation animation
    rotation.value = withRepeat(
      withTiming(360, { duration: 8000 }),
      -1,
      false
    );
  }, []);

  // Animated gradient positions
  const animatedGradient = useDerivedValue(() => {
    const centerX = interpolate(progress.value, [0, 1], [0.2, 0.8]);
    const centerY = interpolate(progress.value, [0, 1], [0.3, 0.7]);
    
    return {
      centerX,
      centerY,
      rotation: rotation.value,
    };
  });

  // Animated gradient style
  const animatedGradientStyle = useDerivedValue(() => {
    return {
      transform: [
        { 
          translateX: interpolate(
            animatedGradient.value.centerX, 
            [0, 1], 
            [-50, 50]
          ) 
        },
        { 
          translateY: interpolate(
            animatedGradient.value.centerY, 
            [0, 1], 
            [-20, 20]
          ) 
        },
        { rotate: `${animatedGradient.value.rotation}deg` }
      ]
    };
  });

  return (
    <GestureHandlerRootView style={[styles.container, { height: Platform.OS === 'ios' ? 100 : 80 }]}>
      {/* Blur background layer */}
      <BlurView 
        intensity={80} 
        tint="dark"
        style={styles.blurContainer}
      >
        {/* Animated gradient overlay */}
        <Animated.View style={[styles.gradientContainer, animatedGradientStyle]}>
          <LinearGradient
            colors={[
              'rgba(255, 255, 255, 0.3)',
              'rgba(100, 200, 255, 0.4)',
              'rgba(100, 255, 227, 0.3)',
              'rgba(200, 100, 255, 0.4)',
              'rgba(100, 255, 200, 0.3)',
              'rgba(255, 255, 255, 0.2)'
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradient}
          />
        </Animated.View>
      </BlurView>

      {/* Tab items overlay */}
      <Animated.View style={styles.tabContainer}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
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

          const getIconName = (routeName: string, focused: boolean) => {
            switch (routeName) {
              case 'index':
                return focused ? 'home' : 'home-outline';
              case 'create':
                return focused ? 'add-circle' : 'add-circle-outline';
              case 'settings':
                return focused ? 'settings' : 'settings-outline';
              default:
                return 'ellipse-outline';
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              style={[
                styles.tabItem,
                { 
                  opacity: isFocused ? 1 : 0.7,
                  transform: [{ scale: isFocused ? 1.1 : 1 }]
                }
              ]}
            >
              <Ionicons
                name={getIconName(route.name, isFocused) as any}
                size={24}
                color={isFocused ? '#FFFFFF' : '#E0E0E0'}
                style={{
                  textShadowColor: 'rgba(0, 0, 0, 0.8)',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 3,
                }}
              />
            </TouchableOpacity>
          );
        })}
      </Animated.View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
  },
  blurContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 30 : 20,
    left: 60,
    right: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
  },
  gradientContainer: {
    position: 'absolute',
    top: -50,
    left: -50,
    right: -50,
    bottom: -50,
  },
  gradient: {
    flex: 1,
    borderRadius: 50,
  },
  tabContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 30 : 20,
    left: 60,
    right: 60,
    height: 60,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderRadius: 30,
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    minWidth: 60,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
});