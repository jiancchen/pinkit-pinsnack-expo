import { Platform } from 'react-native';

// Shared layout constants for `LiquidGlassTabBar` and tab screen scroll padding.
export const LIQUID_GLASS_TAB_BAR_PILL_HEIGHT = 60;
export const LIQUID_GLASS_TAB_BAR_PILL_PADDING = 6;

const IOS_BOTTOM_OFFSET = 10;
const ANDROID_BOTTOM_OFFSET = 12;
const CONTAINER_EXTRA_HEIGHT = 14;

export function getLiquidGlassTabBarBottomOffset(insetsBottom: number): number {
  const base = Platform.OS === 'ios' ? IOS_BOTTOM_OFFSET : ANDROID_BOTTOM_OFFSET;
  return base + insetsBottom;
}

// How much vertical space the pill + bottom offset occupies on screen.
export function getLiquidGlassTabBarOverlapHeight(insetsBottom: number): number {
  return getLiquidGlassTabBarBottomOffset(insetsBottom) + LIQUID_GLASS_TAB_BAR_PILL_HEIGHT;
}

// Matches the tab bar container height (includes a bit of extra headroom above the pill).
export function getLiquidGlassTabBarContainerHeight(insetsBottom: number): number {
  return getLiquidGlassTabBarOverlapHeight(insetsBottom) + CONTAINER_EXTRA_HEIGHT;
}

// A convenient paddingBottom value for ScrollViews/Lists so the last item can scroll above the pill.
export function getLiquidGlassTabBarContentPaddingBottom(
  insetsBottom: number,
  extraPadding: number = 24
): number {
  return getLiquidGlassTabBarOverlapHeight(insetsBottom) + extraPadding;
}
