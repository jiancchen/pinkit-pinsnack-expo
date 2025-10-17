import { Tabs } from 'expo-router';
import LiquidGlassTabBar from '../../src/components/LiquidGlassTabBar';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
      }}
      tabBar={(props) => <LiquidGlassTabBar {...props} />}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'My Apps',
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: 'Create',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
        }}
      />
    </Tabs>
  );
}