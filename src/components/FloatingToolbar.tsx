import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../types/PromptHistory';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface FloatingToolbarProps {
  onNavigateToMain: () => void;
  onNavigateToCreate: () => void;
  onNavigateToSettings: () => void;
}

export default function FloatingToolbar({
  onNavigateToMain,
  onNavigateToCreate,
  onNavigateToSettings,
}: FloatingToolbarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [scaleAnim] = useState(new Animated.Value(0));
  const [opacityAnim] = useState(new Animated.Value(0));

  const toggleExpanded = () => {
    const toValue = isExpanded ? 0 : 1;
    
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }),
      Animated.timing(opacityAnim, {
        toValue,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    setIsExpanded(!isExpanded);
  };

  const handleMenuItemPress = (action: () => void) => {
    action();
    toggleExpanded();
  };

  const menuItems = [
    {
      icon: 'home-outline' as const,
      label: 'My Apps',
      backgroundColor: AppColors.FABDarkOrange,
      onPress: () => handleMenuItemPress(onNavigateToMain),
    },
    {
      icon: 'add-outline' as const,
      label: 'Create',
      backgroundColor: AppColors.FABDarkerOrange,
      onPress: () => handleMenuItemPress(onNavigateToCreate),
    },
    {
      icon: 'settings-outline' as const,
      label: 'Settings',
      backgroundColor: AppColors.FABDeepOrange,
      onPress: () => handleMenuItemPress(onNavigateToSettings),
    },
  ];

  return (
    <View style={styles.container}>
      {/* Backdrop overlay */}
      {isExpanded && (
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={toggleExpanded}
        />
      )}

      {/* Menu items */}
      <Animated.View
        style={[
          styles.menuContainer,
          {
            opacity: opacityAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {menuItems.map((item, index) => (
          <Animated.View
            key={index}
            style={[
              styles.menuItemContainer,
              {
                opacity: opacityAnim,
                transform: [
                  {
                    translateY: scaleAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [50, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.menuItemRow}>
              {/* Label */}
              <View
                style={[
                  styles.labelContainer,
                  { backgroundColor: item.backgroundColor },
                ]}
              >
                <Text style={styles.labelText}>{item.label}</Text>
              </View>

              {/* Button */}
              <TouchableOpacity
                style={[
                  styles.menuButton,
                  { backgroundColor: item.backgroundColor },
                ]}
                onPress={item.onPress}
                activeOpacity={0.8}
              >
                <Ionicons name={item.icon} size={20} color={AppColors.White} />
              </TouchableOpacity>
            </View>
          </Animated.View>
        ))}
      </Animated.View>

      {/* Main FAB */}
      <TouchableOpacity
        style={[styles.mainFab, { backgroundColor: AppColors.FABMain }]}
        onPress={toggleExpanded}
        activeOpacity={0.8}
      >
        <Ionicons
          name={isExpanded ? 'close' : 'menu'}
          size={24}
          color={AppColors.White}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    alignItems: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: -screenHeight,
    left: -screenWidth,
    width: screenWidth * 2,
    height: screenHeight * 2,
    backgroundColor: AppColors.BackdropOverlay,
  },
  menuContainer: {
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  menuItemContainer: {
    marginBottom: 12,
  },
  menuItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  labelContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    width: 100,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  labelText: {
    color: AppColors.White,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  menuButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  mainFab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
});