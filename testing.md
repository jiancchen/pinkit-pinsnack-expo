# Testing rollout notes

## Current status
- Added initial test scaffold with Jest config: `jest.config.js`
- Added unit tests:
  - `tests/unit/claude-api.unit.test.js`
- Added functional tests:
  - `tests/functional/prompt-generator.functional.test.js`

## Dependency/install blocker
- Test dependencies are not installed in this environment because package registry access failed (`getaddrinfo ENOTFOUND registry.yarnpkg.com`).
- Install when network is available:
  - `yarn add -D jest jest-expo @types/jest react-test-renderer`

## Code areas that need refactor for stronger testability

### 1) `app/(tabs)/create.tsx`
- Issue:
  - UI rendering, request validation, prompt construction, queueing, alert side-effects, and modal state are tightly coupled in one large component.
- Refactor note:
  - Extract pure logic into testable modules/hooks:
    - `createRequestBuilder.ts`
    - `useCreatePageState.ts`
    - `createValidation.ts`
  - Keep component focused on rendering and event wiring.

### 2) `app/_layout.tsx`
- Issue:
  - App bootstrap combines multiple async side effects (notifications, secure storage, queue worker, seed initialization, splash) directly in component lifecycle hooks.
- Refactor note:
  - Introduce an `AppBootstrapService` with injected dependencies and an explicit `initialize()` contract.
  - Unit-test bootstrap decisions without mounting React components.

### 3) `src/services/TopicClassificationService.ts`
- Issue:
  - Static class with direct calls to storage/API singletons and global timers makes isolated testing hard.
- Refactor note:
  - Convert to instance-based service and inject:
    - storage adapter
    - topic preferences adapter
    - classifier adapter (Claude/local heuristic)
    - scheduler/timer adapter
  - This enables deterministic tests for retries, debouncing, and fallback logic.

### 4) `src/utils/Logger.ts`
- Issue:
  - Logger depends on Expo constants/runtime globals and writes side effects directly.
- Refactor note:
  - Add environment adapter + pluggable sink so tests can use a pure in-memory logger.
