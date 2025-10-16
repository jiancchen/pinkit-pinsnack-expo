import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

interface TabItem {
  key: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}

interface GlassBottomTabsProps {
  tabs: TabItem[];
  activeTab?: string;
}

export default function GlassBottomTabs({ tabs, activeTab }: GlassBottomTabsProps) {
  return (
    <View style={styles.container}>
      <BlurView
        intensity={50}
        tint="systemMaterialDark"
        style={styles.blurContainer}
      >
        <View style={styles.tabsRow}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={styles.tab}
              onPress={tab.onPress}
              activeOpacity={0.7}
            >
              <Ionicons
                name={tab.icon}
                size={24}
                color={activeTab === tab.key ? '#007AFF' : '#8E8E93'}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: activeTab === tab.key ? '#007AFF' : '#8E8E93' }
                ]}
              >
                {tab.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  blurContainer: {
    paddingBottom: Platform.OS === 'ios' ? 34 : 16, // Account for home indicator
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  tabsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 60,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  },
});