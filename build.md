# Build Guide

This project has two tracks:

- Dev build: installs a development client that connects to Metro.
- Production build: store/TestFlight/Play build.

## Yarn Scripts

- `yarn start:dev`
- `yarn build:dev:ios`
- `yarn build:dev:android`
- `yarn build:eas:dev:ios`
- `yarn build:eas:dev:android`
- `yarn build:prod:ios`
- `yarn build:prod:android`

## Commands

### Dev client with Metro

```bash
yarn start:dev
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

## EAS Profiles Used

- `development` profile for dev-client builds.
- `production` profile for release builds.
