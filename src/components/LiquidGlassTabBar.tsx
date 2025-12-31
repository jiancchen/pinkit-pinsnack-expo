import React from 'react';
import { StyleSheet, Platform, TouchableOpacity, Keyboard } from 'react-native';
import { BlurView } from 'expo-blur';
import {
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  withSpring,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useEffect } from 'react';

interface LiquidGlassTabBarProps extends BottomTabBarProps {}

export default function LiquidGlassTabBar({ state, descriptors, navigation }: LiquidGlassTabBarProps) {
  const tabBarOffset = useSharedValue(0);

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

  return (
    <Animated.View style={[styles.container, { height: Platform.OS === 'ios' ? 100 : 80 }, containerAnimatedStyle]}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        {/* Blur background layer */}
        <BlurView 
          intensity={80} 
          tint="dark"
          style={styles.blurContainer}
        >
        {/* Static gradient overlay */}
        <LinearGradient
          colors={[
            'rgba(95, 42, 194, 0.48)',
            'rgba(180, 41, 255, 0.4)'
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        />
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
  blurContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 30 : 20,
    left: 60,
    right: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
  },
  gradient: {
    flex: 1,
    borderRadius: 30,
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