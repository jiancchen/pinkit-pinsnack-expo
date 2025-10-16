import React, { useState, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  Animated,
  Dimensions,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Canvas,
  Group,
  RoundedRect,
  LinearGradient,
  vec,
  Blur,
  BackdropFilter,
} from '@shopify/react-native-skia';
import { AppColors } from '../constants/AppColors';

const { width: screenWidth } = Dimensions.get('window');

interface LiquidGlassNavigationProps {
  onNavigateToMain: () => void;
  onNavigateToCreate: () => void;
  onNavigateToSettings: () => void;
}

export default function LiquidGlassNavigation({
  onNavigateToMain,
  onNavigateToCreate,
  onNavigateToSettings,
}: LiquidGlassNavigationProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandAnim] = useState(new Animated.Value(0));
  const [menuButtonOpacity] = useState(new Animated.Value(1));

  const toggleExpanded = () => {
    const toValue = isExpanded ? 0 : 1;
    
    Animated.parallel([
      Animated.spring(expandAnim, {
        toValue,
        useNativeDriver: false, // Can't use native driver for width/borderRadius
        tension: 80,
        friction: 8,
      }),
      Animated.timing(menuButtonOpacity, {
        toValue: isExpanded ? 1 : 0.8,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    setIsExpanded(!isExpanded);
  };

  const handleMenuItemPress = (action: () => void) => {
    action();
    // Don't auto-collapse, let user manually close
  };

  const menuItems = [
    {
      icon: 'home' as const,
      onPress: () => handleMenuItemPress(onNavigateToMain),
    },
    {
      icon: 'add' as const,
      onPress: () => handleMenuItemPress(onNavigateToCreate),
    },
    {
      icon: 'settings' as const,
      onPress: () => handleMenuItemPress(onNavigateToSettings),
    },
  ];

  // Calculate pill width based on expanded state
  const pillWidth = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [60, Math.min(screenWidth - 40, 300)], // Menu button size to expanded width
  });

  const pillHeight = 60;
  const borderRadius = pillHeight / 2;

  return (
    <View style={styles.container}>
      {/* Liquid Glass Pill Container */}
      <Animated.View
        style={[
          styles.pillContainer,
          {
            width: pillWidth,
            height: pillHeight,
            borderRadius: borderRadius,
          },
        ]}
      >
        {/* Skia Canvas for Liquid Glass Effect */}
        <Canvas style={StyleSheet.absoluteFillObject}>
          <Group>
            {/* Background blur and glass effect */}
            <BackdropFilter filter={<Blur blur={20} />}>
              <RoundedRect
                x={0}
                y={0}
                width={300} // Use max width instead of screenWidth
                height={pillHeight}
                r={borderRadius}
              />
            </BackdropFilter>
            
            {/* Gradient overlay for glass effect */}
            <RoundedRect
              x={2}
              y={2}
              width={296} // Adjusted for max width
              height={pillHeight - 4}
              r={borderRadius - 2}
            >
              <LinearGradient
                start={vec(0, 0)}
                end={vec(0, pillHeight)}
                colors={[
                  'rgba(255, 255, 255, 0.25)',
                  'rgba(255, 255, 255, 0.05)',
                  'rgba(255, 255, 255, 0.15)',
                ]}
              />
            </RoundedRect>

            {/* Inner glow */}
            <RoundedRect
              x={1}
              y={1}
              width={298} // Adjusted for max width
              height={pillHeight - 2}
              r={borderRadius - 1}
            >
              <LinearGradient
                start={vec(0, 0)}
                end={vec(300, 0)} // Adjusted for max width
                colors={[
                  'rgba(139, 195, 74, 0.2)',
                  'rgba(33, 150, 243, 0.2)',
                  'rgba(156, 39, 176, 0.2)',
                ]}
              />
            </RoundedRect>
          </Group>
        </Canvas>

        {/* Navigation Content */}
        <View style={styles.contentContainer}>
          {/* Menu Button (Always Visible) */}
          <Animated.View
            style={[
              styles.menuButtonContainer,
              {
                opacity: menuButtonOpacity,
              },
            ]}
          >
            <TouchableOpacity
              style={styles.menuButton}
              onPress={toggleExpanded}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isExpanded ? 'close' : 'menu'}
                size={24}
                color="rgba(255, 255, 255, 0.9)"
              />
            </TouchableOpacity>
          </Animated.View>

          {/* Navigation Icons (Visible when expanded) */}
          {isExpanded && (
            <Animated.View
              style={[
                styles.navIconsContainer,
                {
                  opacity: expandAnim,
                },
              ]}
            >
              {menuItems.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.navIcon}
                  onPress={item.onPress}
                  activeOpacity={0.6}
                >
                  <Ionicons
                    name={item.icon}
                    size={22}
                    color="rgba(255, 255, 255, 0.8)"
                  />
                </TouchableOpacity>
              ))}
            </Animated.View>
          )}
        </View>

        {/* Animated liquid ripple effect */}
        <Canvas style={StyleSheet.absoluteFillObject} pointerEvents="none">
          <Group>
            {/* Animated liquid ripples can be added here */}
            <RoundedRect
              x={0}
              y={0}
              width={300} // Use max width
              height={pillHeight}
              r={borderRadius}
            >
              <LinearGradient
                start={vec(0, 0)}
                end={vec(300, pillHeight)} // Adjusted for max width
                colors={[
                  'rgba(255, 255, 255, 0.1)',
                  'rgba(255, 255, 255, 0.05)',
                  'rgba(255, 255, 255, 0.1)',
                ]}
              />
            </RoundedRect>
          </Group>
        </Canvas>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 30,
    left: (screenWidth - Math.min(screenWidth - 40, 300)) / 2, // Center the container
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillContainer: {
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)', // Fallback background
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  contentContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    zIndex: 1,
  },
  menuButtonContainer: {
    position: 'absolute',
    right: 8,
    zIndex: 2,
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(95, 15, 64, 0.8)', // AppColors.FABMain with transparency
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  navIconsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    marginRight: 60, // Make space for menu button
  },
  navIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
});