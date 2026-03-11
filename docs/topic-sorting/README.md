# Topic Sorting Pipeline

This document explains how app projects get sorted into topics, when Claude is called, and why request bursts happen.

## Core Files

- `src/services/TopicClassificationService.ts`
- `src/services/ClaudeApiService.ts`
- `src/services/TopicPreferencesService.ts`
- `src/app/(tabs)/universe.tsx`

## End-to-End Flow

1. UI action triggers sorting (for example `AI Sort` in Universe).
2. `TopicClassificationService.classifyAllApps()` loads all apps and iterates through them.
3. Each app is processed in `classifyForApp()`:
   - Builds a payload (`title`, `description`, `prompt`, `category`, `style`, `htmlSnippet`).
   - Computes a deterministic signature hash from payload content.
   - Builds taxonomy (built-in topics + custom topics).
   - Creates a local heuristic fallback result first.
4. If an API key is configured, it calls Claude via:
   - `ClaudeApiService.classifyProjectTopics()`
   - internally this uses `sendMessage()` with operation `project_topic_classification`.
5. Claude result is validated and merged with fallback.
6. App is updated with:
   - `primaryTopic`
   - `topics`
   - `topicClassification` metadata
   - `topicSortHistory` (last 5 entries)

## Why Many Claude Requests Can Happen

`classifyAllApps()` currently runs one classification pass per app. In a force re-sort flow, this means:

- `N apps` -> up to `N Claude topic classification requests`

So if there are 30 apps and force mode is used, you can see around 30 request logs in quick sequence.

## When Requests Are Skipped

Requests are skipped for unchanged apps only when both are true:

- `force` is `false`
- existing classification signature matches current payload signature

If `force: true` is used, unchanged apps are still reclassified.

## Local Fallback Behavior

If Claude is unavailable (no key, network issue, parse issue), topic assignment still happens using:

- keyword scoring
- category-to-topic mapping
- taxonomy normalization

Source is marked as `heuristic` instead of `claude`.

## History Retention

Per app, `topicSortHistory` keeps the latest 5 sort events:

- timestamp
- source (`claude` or `heuristic`)
- confidence
- primary topic and topics
- optional model and summary
- sort reason

## Operational Notes

- Backfill runs are triggered for legacy apps missing topic metadata.
- `scheduleForApp()` includes a debounce path for per-app updates.
- Bulk manual sort in Universe uses `classifyAllApps()` and is the main source of request spikes.

## If You Want Fewer Requests

Typical options:

- Prefer non-force sorting unless taxonomy changed.
- Sort only stale/missing-topic apps.
- Add per-run max batch size / chunking.
- Add UI affordance for "re-sort changed only" vs "force all".
