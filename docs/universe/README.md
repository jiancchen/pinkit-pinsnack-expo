# Universe Screen

Universe is the topic-orbit visualization for projects.

## Main File

- `app/(tabs)/universe.tsx`

## Current Behavior

- Groups apps by primary topic and renders each topic as a planet in orbit.
- Planet size tracks app count.
- Topic labels remain upright.
- Tap a planet to:
  - pause orbit motion
  - zoom/focus to that planet
  - show a project list panel inside the same galaxy scene
- Tap `X` to exit focus and return to full orbital view.
- Manual `AI Sort` triggers full topic reclassification and refreshes the map.

## Gesture/Animation Rules

- Pan + pinch are enabled in map mode.
- Pan + pinch are disabled while a focused topic panel is active.
- Orbit rotation runs on an interval and pauses while focused.

## Feature Flags

- `ENABLE_TOPIC_PLANET_BUILDER` in `app/(tabs)/universe.tsx`
  - currently `false`
  - hides the topic/planet builder UI and guards related handlers
  - useful while isolating crash/debug work on add-topic flow

## Data Dependencies

- Apps: `AppStorageService`
- Classification: `TopicClassificationService`
- Custom topic taxonomy: `TopicPreferencesService`

## Notes for Contributors

- Most logic is in one file today; if adding major features, prefer extracting:
  - orbit math helpers
  - focused panel component
  - gesture state machine
  - topic manager/add-topic flow
