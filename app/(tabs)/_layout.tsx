import { Tabs } from 'expo-router';
import LiquidGlassTabBar from '../../src/components/LiquidGlassTabBar';
import { useStrings } from '../../src/i18n/strings';

export default function TabLayout() {
  const { t } = useStrings();
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
          title: t('tabs.myApps'),
        }}
      />
      <Tabs.Screen
        name="universe"
        options={{
          title: t('tabs.universe'),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: t('tabs.create'),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: t('tabs.assistant'),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
        }}
      />
    </Tabs>
  );
}
