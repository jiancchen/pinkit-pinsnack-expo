# PinSnacks (Expo SDK 55)

Mobile app built with Expo + Expo Router.

## Project Layout

- Routes live in `src/app` (Expo Router root).
- Shared app code lives in `src/`.

## Prerequisites

- Node.js 22+
- Yarn 1.x (`yarn --version`)
- Xcode + CocoaPods (only for native `run:*` iOS builds)
- Android Studio + SDK (only for native `run:*` Android builds)
- EAS CLI account access (for cloud builds)

## Install

```bash
yarn install
```

## Local Development

### Start Metro (Expo Go)

```bash
yarn start
```

### Start Metro for Dev Client

```bash
yarn start:dev
```

### Run iOS (Expo Go)

```bash
yarn ios
```

This script forces Expo Go (`expo start --go --ios`).

For native local build (dev client):

```bash
yarn ios:native
yarn ios:dev
```

### Run Android (Expo Go)

```bash
yarn android
```

This script forces Expo Go (`expo start --go --android`).

For native local build (dev client):

```bash
yarn android:native
yarn android:dev
```

### Run Web

```bash
yarn web
```

## Quality Checks

### Type check

```bash
yarn typecheck
```

### Expo health check

```bash
yarn doctor
```

### Tests

```bash
yarn test
yarn test:unit
yarn test:functional
```

## Builds

### Local dev-client native builds

```bash
yarn build:dev:ios
yarn build:dev:android
```

### EAS development builds

```bash
yarn build:eas:dev:ios
yarn build:eas:dev:android
```

### EAS production builds

```bash
yarn build:prod:ios
yarn build:prod:android
```

## Notes

- `samples:refresh` runs automatically before app start/build scripts.
- If iOS pods drift after dependency changes, run:

```bash
env -u NODE_OPTIONS npx pod-install
```

- If you see `Debugger attached` / `Waiting for the debugger to disconnect` during `pod install`,
  your shell likely has `NODE_OPTIONS=--inspect...` set globally. Run native commands with
  `env -u NODE_OPTIONS` (the package scripts already do this).
