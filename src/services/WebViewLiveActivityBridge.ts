import { Platform } from 'react-native';
import { buildCounterLiveActivityVariants, buildTimerLiveActivityVariants } from '../liveActivities/WebAppLiveActivity';
import { createLogger } from '../utils/Logger';

const log = createLogger('WebViewLiveActivity');

type LiveActivityDismissalPolicy = 'immediate' | { afterMs: number };

const observedActivityKeysByAppId = new Map<string, Set<string>>();
const liveActivityQueueByName = new Map<string, Promise<void>>();

type WebViewLiveActivityBaseMessage = {
  activityKey?: string;
  tintColor?: string;
  title?: string;
  subtitle?: string;
  relevanceScore?: number;
  staleDateMs?: number;
};

type WebViewStartTimerMessage = WebViewLiveActivityBaseMessage & {
  type: 'live_activity_start_timer';
  startAtMs?: number;
  endAtMs?: number;
  durationMs?: number;
  direction?: 'up' | 'down';
  showHours?: boolean;
  textStyle?: 'timer' | 'relative';
  autoHideOnEnd?: boolean;
};

type WebViewStartCounterMessage = WebViewLiveActivityBaseMessage & {
  type: 'live_activity_start_counter';
  count: number;
  unit?: string;
};

type WebViewUpdateCounterMessage = WebViewLiveActivityBaseMessage & {
  type: 'live_activity_update_counter';
  count: number;
  unit?: string;
};

type WebViewStopMessage = {
  type: 'live_activity_stop';
  activityKey?: string;
  dismissalPolicy?: LiveActivityDismissalPolicy;
};

type WebViewIsActiveMessage = {
  type: 'live_activity_is_active';
  activityKey?: string;
};

export type WebViewLiveActivityMessage =
  | WebViewStartTimerMessage
  | WebViewStartCounterMessage
  | WebViewUpdateCounterMessage
  | WebViewStopMessage
  | WebViewIsActiveMessage;

type WebViewLiveActivityResponse =
  | {
      type: 'live_activity_is_active_response';
      activityKey: string;
      isActive: boolean;
    }
  | {
      type: 'live_activity_error';
      activityKey: string;
      message: string;
    };

type SendToWebView = (message: WebViewLiveActivityResponse) => void;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function toOptionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function toOptionalBoolean(value: unknown): boolean | undefined {
  if (typeof value !== 'boolean') return undefined;
  return value;
}

function sanitizeActivityKey(value: unknown): string {
  const raw = toOptionalString(value) ?? 'main';
  const safe = raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48);
  return safe || 'main';
}

function buildActivityName(appId: string, activityKey: string): string {
  // Keep the name stable across app restarts, and unique per generated WebView app.
  return `droplets-${appId}-${activityKey}`;
}

function buildDeepLinkUrl(appId: string): string {
  return `/app-view?appId=${encodeURIComponent(appId)}`;
}

function enqueueLiveActivityOperation(activityName: string, operation: () => Promise<void>): Promise<void> {
  const previous = liveActivityQueueByName.get(activityName) ?? Promise.resolve();
  let current: Promise<void>;

  current = previous
    .catch(() => undefined)
    .then(operation)
    .finally(() => {
      if (liveActivityQueueByName.get(activityName) === current) {
        liveActivityQueueByName.delete(activityName);
      }
    });

  liveActivityQueueByName.set(activityName, current);
  return current;
}

async function loadVoltraClient(): Promise<any | null> {
  try {
    return await import('voltra/client');
  } catch (error) {
    return null;
  }
}

function normalizeRelevanceScore(value: unknown): number | undefined {
  const score = toOptionalNumber(value);
  if (score === undefined) return undefined;
  if (score < 0 || score > 1) return undefined;
  return score;
}

function normalizeStaleDate(value: unknown): number | undefined {
  const staleDateMs = toOptionalNumber(value);
  if (staleDateMs === undefined) return undefined;
  if (staleDateMs <= Date.now()) return undefined;
  return staleDateMs;
}

function normalizeDismissalPolicy(value: unknown): { dismissalPolicy: 'immediate' | { after: number } } | undefined {
  if (value === 'immediate') return { dismissalPolicy: 'immediate' };
  if (isPlainObject(value)) {
    const afterMs = toOptionalNumber(value.afterMs);
    if (afterMs !== undefined && afterMs > Date.now()) {
      return { dismissalPolicy: { after: afterMs } };
    }
  }
  return undefined;
}

function parseMessage(raw: Record<string, unknown>): WebViewLiveActivityMessage | null {
  const type = toOptionalString(raw.type);
  if (!type) return null;

  if (type === 'live_activity_start_timer') {
    return {
      type,
      activityKey: toOptionalString(raw.activityKey),
      tintColor: toOptionalString(raw.tintColor),
      title: toOptionalString(raw.title),
      subtitle: toOptionalString(raw.subtitle),
      relevanceScore: normalizeRelevanceScore(raw.relevanceScore),
      staleDateMs: normalizeStaleDate(raw.staleDateMs),
      startAtMs: toOptionalNumber(raw.startAtMs),
      endAtMs: toOptionalNumber(raw.endAtMs),
      durationMs: toOptionalNumber(raw.durationMs),
      direction: raw.direction === 'up' ? 'up' : raw.direction === 'down' ? 'down' : undefined,
      showHours: toOptionalBoolean(raw.showHours),
      textStyle: raw.textStyle === 'relative' ? 'relative' : raw.textStyle === 'timer' ? 'timer' : undefined,
      autoHideOnEnd: toOptionalBoolean(raw.autoHideOnEnd),
    };
  }

  if (type === 'live_activity_start_counter' || type === 'live_activity_update_counter') {
    const count = toOptionalNumber(raw.count);
    if (count === undefined) return null;
    const base = {
      activityKey: toOptionalString(raw.activityKey),
      tintColor: toOptionalString(raw.tintColor),
      title: toOptionalString(raw.title),
      subtitle: toOptionalString(raw.subtitle),
      relevanceScore: normalizeRelevanceScore(raw.relevanceScore),
      staleDateMs: normalizeStaleDate(raw.staleDateMs),
      count,
      unit: toOptionalString(raw.unit),
    };
    return type === 'live_activity_start_counter' ? { type, ...base } : { type, ...base };
  }

  if (type === 'live_activity_stop') {
    return {
      type,
      activityKey: toOptionalString(raw.activityKey),
      dismissalPolicy: raw.dismissalPolicy as LiveActivityDismissalPolicy | undefined,
    };
  }

  if (type === 'live_activity_is_active') {
    return {
      type,
      activityKey: toOptionalString(raw.activityKey),
    };
  }

  return null;
}

function rememberActivityKey(appId: string, activityKey: string): void {
  const existing = observedActivityKeysByAppId.get(appId);
  if (existing) {
    existing.add(activityKey);
    return;
  }
  observedActivityKeysByAppId.set(appId, new Set([activityKey]));
}

function forgetActivityKey(appId: string, activityKey: string): void {
  const existing = observedActivityKeysByAppId.get(appId);
  if (!existing) return;
  existing.delete(activityKey);
  if (existing.size === 0) {
    observedActivityKeysByAppId.delete(appId);
  }
}

export async function stopWebViewLiveActivitiesForApp(appId: string): Promise<void> {
  if (Platform.OS !== 'ios') return;

  const client = await loadVoltraClient();
  if (!client) return;

  const { stopLiveActivity } = client as {
    stopLiveActivity: (targetId: string, options?: any) => Promise<void>;
  };

  const keys = new Set<string>(['main']);
  const observed = observedActivityKeysByAppId.get(appId);
  if (observed) {
    for (const key of observed) keys.add(key);
  }

  await Promise.all(
    Array.from(keys).map(async (activityKey) => {
      const activityName = buildActivityName(appId, activityKey);
      try {
        await stopLiveActivity(activityName, { dismissalPolicy: 'immediate' });
      } catch {
        // Ignore "not found" and other end errors for best-effort cleanup.
      }
    })
  );

  observedActivityKeysByAppId.delete(appId);
}

export async function stopAllWebViewLiveActivities(): Promise<void> {
  const appIds = Array.from(observedActivityKeysByAppId.keys());
  await Promise.all(appIds.map((appId) => stopWebViewLiveActivitiesForApp(appId)));
}

export async function handleWebViewLiveActivityMessage(args: {
  appId: string;
  rawMessage: Record<string, unknown>;
  sendToWebView?: SendToWebView;
}): Promise<void> {
  if (Platform.OS !== 'ios') return;

  const message = parseMessage(args.rawMessage);
  if (!message) return;

  const activityKey = sanitizeActivityKey(message.activityKey);
  const activityName = buildActivityName(args.appId, activityKey);
  const deepLinkUrl = buildDeepLinkUrl(args.appId);

  const client = await loadVoltraClient();
  if (!client) return;

  const { isLiveActivityActive, startLiveActivity, updateLiveActivity, stopLiveActivity } = client as {
    isLiveActivityActive: (activityName: string) => boolean;
    startLiveActivity: (variants: any, options?: any) => Promise<string>;
    updateLiveActivity: (targetId: string, variants: any, options?: any) => Promise<void>;
    stopLiveActivity: (targetId: string, options?: any) => Promise<void>;
  };

  if (message.type === 'live_activity_is_active') {
    args.sendToWebView?.({
      type: 'live_activity_is_active_response',
      activityKey,
      isActive: isLiveActivityActive(activityName),
    });
    return;
  }

  await enqueueLiveActivityOperation(activityName, async () => {
    try {
      if (message.type === 'live_activity_stop') {
        const dismissalPolicy = normalizeDismissalPolicy(message.dismissalPolicy) ?? { dismissalPolicy: 'immediate' };
        if (isLiveActivityActive(activityName)) {
          await stopLiveActivity(activityName, dismissalPolicy);
        }
        forgetActivityKey(args.appId, activityKey);
        return;
      }

      if (message.type === 'live_activity_start_timer') {
        rememberActivityKey(args.appId, activityKey);

        const inferredDirection: 'up' | 'down' = (() => {
          if (message.direction === 'up' || message.direction === 'down') return message.direction;
          const key = activityKey.toLowerCase();
          const title = (message.title ?? '').toLowerCase();
          if (key.includes('stopwatch') || title.includes('stopwatch')) return 'up';
          return 'down';
        })();

        const variants = await buildTimerLiveActivityVariants({
          title: message.title,
          subtitle: message.subtitle,
          tintColor: message.tintColor,
          startAtMs: message.startAtMs,
          endAtMs: message.endAtMs,
          durationMs: message.durationMs,
          direction: inferredDirection,
          showHours: message.showHours,
          textStyle: message.textStyle,
          autoHideOnEnd: message.autoHideOnEnd,
        });
        if (!variants) return;

        // For timers, default staleDate to the computed end time when available.
        const computedEndAtMs =
          message.endAtMs ??
          (message.durationMs !== undefined ? (message.startAtMs ?? Date.now()) + message.durationMs : undefined);
        const staleDate =
          message.staleDateMs ?? (computedEndAtMs && computedEndAtMs > Date.now() ? computedEndAtMs : undefined);

        const sharedOptions = {
          relevanceScore: message.relevanceScore,
          staleDate,
        };

        if (!isLiveActivityActive(activityName)) {
          await startLiveActivity(variants, {
            activityName,
            deepLinkUrl,
            ...sharedOptions,
          });
        } else {
          await updateLiveActivity(activityName, variants, sharedOptions);
        }

        return;
      }

      if (message.type === 'live_activity_start_counter' || message.type === 'live_activity_update_counter') {
        rememberActivityKey(args.appId, activityKey);
        const variants = await buildCounterLiveActivityVariants({
          title: message.title,
          subtitle: message.subtitle,
          tintColor: message.tintColor,
          count: message.count,
          unit: message.unit,
        });
        if (!variants) return;

        const sharedOptions = {
          relevanceScore: message.relevanceScore,
          staleDate: message.staleDateMs,
        };

        if (!isLiveActivityActive(activityName)) {
          await startLiveActivity(variants, {
            activityName,
            deepLinkUrl,
            ...sharedOptions,
          });
        } else {
          await updateLiveActivity(activityName, variants, sharedOptions);
        }

        return;
      }
    } catch (error: any) {
      log.warn('Live Activity bridge failed:', error);
      args.sendToWebView?.({
        type: 'live_activity_error',
        activityKey,
        message: error?.message || String(error),
      });
    }
  });
}
