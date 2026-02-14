# App Theme System

This app now supports two top-level visual themes:

- `yellow` (original look)
- `universe` (galaxy gradient + starfield background)

## State Source of Truth

- `src/stores/UISettingsStore.ts`
  - `appTheme: 'yellow' | 'universe'`
  - `setAppTheme(theme)`
  - persisted with zustand persist (`ui_settings`)

## Background Renderer

- `src/components/AppThemeBackground.tsx`
  - reads `appTheme` from store
  - renders nothing in `yellow`
  - renders gradient + stars + nebula glows in `universe`

## Screens Wired to Theme

- `app/(tabs)/index.tsx`
- `app/(tabs)/create.tsx`
- `app/(tabs)/settings.tsx`
- `src/components/Scrollable3DStack.tsx` (made transparent in universe mode so stars are visible)

## Settings UI

- `app/(tabs)/settings.tsx` -> Appearance section
  - segmented control for `Yellow` / `Universe`
  - updates `appTheme` immediately
  - persists across app restarts

## Extension Guide

When adding a new screen:

1. Read `appTheme` via `useUISettingsStore((s) => s.appTheme)`.
2. Make root container transparent for universe mode.
3. Add `<AppThemeBackground />` near the top of the screen tree.
4. Ensure high-level header text remains readable on dark background.
