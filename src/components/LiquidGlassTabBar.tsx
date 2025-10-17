import React from 'react';
import { StyleSheet, useWindowDimensions, Platform, TouchableOpacity, Text } from 'react-native';
import {
  Canvas,
  Skia,
  Fill,
  Shader,
  vec,
  BackdropFilter,
  Blur,
  RoundedRect,
  Group,
} from '@shopify/react-native-skia';
import {
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  useDerivedValue,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';

interface LiquidGlassTabBarProps extends BottomTabBarProps {}

export default function LiquidGlassTabBar({ state, descriptors, navigation }: LiquidGlassTabBarProps) {
  const { width, height } = useWindowDimensions();
  
  // Calculate pill position and size
  const bottomOffset = Platform.OS === 'ios' ? 30 : 20;
  const tabHeight = 60;
  const pillWidth = width - 40;
  const pillHeight = 60;
  const pillX = 20; // Left position
  const pillY = height - bottomOffset - tabHeight; // Top position

  return (
    <GestureHandlerRootView style={[styles.container, { height: Platform.OS === 'ios' ? 100 : 80 }]}>

      
      {/* Tab items overlay */}
      <Animated.View style={styles.tabContainer}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = options.tabBarLabel ?? options.title ?? route.name;
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
                  opacity: isFocused ? 1 : 0.6,
                  transform: [{ scale: isFocused ? 1.1 : 1 }]
                }
              ]}
            >
              <Ionicons
                name={getIconName(route.name, isFocused) as any}
                size={24}
                color={isFocused ? '#FFFFFF' : '#B0B0B0'}
                style={{
                  textShadowColor: 'rgba(0, 0, 0, 0.5)',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 2,
                }}
              />
              <Text style={[
                styles.tabLabel,
                { 
                  color: isFocused ? '#FFFFFF' : '#B0B0B0',
                  textShadowColor: 'rgba(0, 0, 0, 0.5)',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 2,
                }
              ]}>
                {typeof label === 'string' ? label : route.name}
              </Text>
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
  tabContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 30 : 20,
    left: 20,
    right: 20,
    height: 60,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderRadius: 30,
    paddingHorizontal: 20,
    backgroundColor: '#bbaaffdd', // Completely transparent to show shader below
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