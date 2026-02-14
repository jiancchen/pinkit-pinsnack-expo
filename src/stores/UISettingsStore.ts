import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type TabBarVariant = 'tinted' | 'clear';
export type AppTheme = 'yellow' | 'universe';
export type AppLanguage = 'en-US' | 'es-ES';

export interface TabBarSettings {
  variant: TabBarVariant;
  tintColor: string; // Hex color, e.g. #7C3AED
  blurIntensity: number; // 0-100 (expo-blur)
}

export interface UISettingsState {
  appTheme: AppTheme;
  appLanguage: AppLanguage;
  tabBar: TabBarSettings;
  setAppTheme: (theme: AppTheme) => void;
  setAppLanguage: (language: AppLanguage) => void;
  setTabBarVariant: (variant: TabBarVariant) => void;
  setTabBarTintColor: (tintColor: string) => void;
  setTabBarBlurIntensity: (blurIntensity: number) => void;
}

const DEFAULT_APP_THEME: AppTheme = 'yellow';
const DEFAULT_APP_LANGUAGE: AppLanguage = 'en-US';

const DEFAULT_TAB_BAR_SETTINGS: TabBarSettings = {
  variant: 'tinted',
  tintColor: '#7C3AED',
  blurIntensity: 80,
};

function normalizeHexColor(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return DEFAULT_TAB_BAR_SETTINGS.tintColor;

  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  const hex = withHash.slice(1);

  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(hex)) {
    return DEFAULT_TAB_BAR_SETTINGS.tintColor;
  }

  return withHash.toUpperCase();
}

function clampBlurIntensity(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_TAB_BAR_SETTINGS.blurIntensity;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export const useUISettingsStore = create<UISettingsState>()(
  persist(
    (set, get) => ({
      appTheme: DEFAULT_APP_THEME,
      appLanguage: DEFAULT_APP_LANGUAGE,
      tabBar: DEFAULT_TAB_BAR_SETTINGS,
      setAppTheme: (theme: AppTheme) =>
        set(() => ({
          appTheme: theme === 'universe' ? 'universe' : 'yellow',
        })),
      setAppLanguage: (language: AppLanguage) =>
        set(() => ({
          appLanguage: language === 'es-ES' ? 'es-ES' : 'en-US',
        })),
      setTabBarVariant: (variant: TabBarVariant) =>
        set((state) => ({
          tabBar: {
            ...state.tabBar,
            variant,
          },
        })),
      setTabBarTintColor: (tintColor: string) =>
        set((state) => ({
          tabBar: {
            ...state.tabBar,
            tintColor: normalizeHexColor(tintColor),
          },
        })),
      setTabBarBlurIntensity: (blurIntensity: number) =>
        set((state) => ({
          tabBar: {
            ...state.tabBar,
            blurIntensity: clampBlurIntensity(blurIntensity),
          },
        })),
    }),
    {
      name: 'ui_settings',
      version: 3,
      storage: createJSONStorage(() => AsyncStorage),
      // Future-proofing: if schema changes, we can migrate here.
      migrate: (persistedState: any) => {
        if (!persistedState || typeof persistedState !== 'object') {
          return {
            appTheme: DEFAULT_APP_THEME,
            appLanguage: DEFAULT_APP_LANGUAGE,
            tabBar: DEFAULT_TAB_BAR_SETTINGS,
          };
        }

        const tabBar = persistedState.tabBar ?? {};
        const appTheme = persistedState.appTheme === 'universe' ? 'universe' : 'yellow';
        const appLanguage = persistedState.appLanguage === 'es-ES' ? 'es-ES' : 'en-US';
        return {
          appTheme,
          appLanguage,
          tabBar: {
            variant: tabBar.variant === 'clear' ? 'clear' : 'tinted',
            tintColor: normalizeHexColor(typeof tabBar.tintColor === 'string' ? tabBar.tintColor : ''),
            blurIntensity: clampBlurIntensity(tabBar.blurIntensity),
          },
        };
      },
      partialize: (state) => ({
        appTheme: state.appTheme,
        appLanguage: state.appLanguage,
        tabBar: state.tabBar,
      }),
    }
  )
);
