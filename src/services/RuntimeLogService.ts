import AsyncStorage from '@react-native-async-storage/async-storage';

export type RuntimeLogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'VERBOSE' | 'FATAL';

export type RuntimeLogEntry = {
  id: string;
  timestamp: number;
  level: RuntimeLogLevel;
  tag: string;
  message: string;
  details?: string;
};

export type RuntimeLogInput = {
  timestamp?: number;
  level: RuntimeLogLevel;
  tag: string;
  message: string;
  details?: string;
};

export type CrashLogInput = {
  source: string;
  isFatal: boolean;
  name?: string;
  message: string;
  stack?: string;
};

const STORAGE_KEY = 'runtime_logs_v1';
const MAX_ENTRIES = 500;
const MAX_MESSAGE_LENGTH = 420;
const MAX_DETAILS_LENGTH = 3200;

function createLogId(timestamp: number): string {
  return `runtime_${timestamp}_${Math.random().toString(36).slice(2, 10)}`;
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}… (truncated)`;
}

function normalizeMessage(value: string): string {
  const compact = value.trim().replace(/\s+/g, ' ');
  if (!compact) return '(no message)';
  return truncate(compact, MAX_MESSAGE_LENGTH);
}

function normalizeDetails(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return truncate(trimmed, MAX_DETAILS_LENGTH);
}

function asString(value: unknown): string {
  if (typeof value === 'string') return value;
  return String(value);
}

function coerceEntry(raw: unknown): RuntimeLogEntry | null {
  if (!raw || typeof raw !== 'object') return null;

  const candidate = raw as Partial<RuntimeLogEntry>;
  const timestamp = Number(candidate.timestamp);
  const level = asString(candidate.level ?? '').toUpperCase() as RuntimeLogLevel;
  const tag = asString(candidate.tag ?? '').trim();
  const message = asString(candidate.message ?? '').trim();

  if (!Number.isFinite(timestamp) || timestamp <= 0) return null;
  if (!tag || !message) return null;

  if (
    level !== 'ERROR' &&
    level !== 'WARN' &&
    level !== 'INFO' &&
    level !== 'DEBUG' &&
    level !== 'VERBOSE' &&
    level !== 'FATAL'
  ) {
    return null;
  }

  const details = typeof candidate.details === 'string' ? candidate.details : undefined;
  const id = typeof candidate.id === 'string' && candidate.id ? candidate.id : createLogId(timestamp);

  return {
    id,
    timestamp,
    level,
    tag,
    message: normalizeMessage(message),
    details: normalizeDetails(details),
  };
}

class RuntimeLogServiceClass {
  private cache: RuntimeLogEntry[] | null = null;
  private pending: RuntimeLogEntry[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private flushPromise: Promise<void> = Promise.resolve();

  private async loadFromStorage(): Promise<RuntimeLogEntry[]> {
    if (this.cache) return this.cache;

    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) {
        this.cache = [];
        return this.cache;
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        this.cache = [];
        return this.cache;
      }

      const normalized = parsed
        .map((item: unknown) => coerceEntry(item))
        .filter((item: RuntimeLogEntry | null): item is RuntimeLogEntry => item !== null)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, MAX_ENTRIES);

      this.cache = normalized;
      return normalized;
    } catch {
      this.cache = [];
      return this.cache;
    }
  }

  private createEntry(input: RuntimeLogInput): RuntimeLogEntry {
    const timestamp = input.timestamp ?? Date.now();
    const level = input.level.toUpperCase() as RuntimeLogLevel;
    const tag = input.tag.trim() || 'Unknown';

    return {
      id: createLogId(timestamp),
      timestamp,
      level,
      tag: truncate(tag, 80),
      message: normalizeMessage(input.message || '(no message)'),
      details: normalizeDetails(input.details),
    };
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flush();
    }, 160);
  }

  async append(input: RuntimeLogInput): Promise<void> {
    const entry = this.createEntry(input);
    this.pending.push(entry);

    if (entry.level === 'ERROR' || entry.level === 'FATAL') {
      await this.flush();
      return;
    }

    this.scheduleFlush();
  }

  async appendCrash(input: CrashLogInput): Promise<void> {
    const details = [
      `source=${input.source}`,
      `fatal=${input.isFatal ? 'yes' : 'no'}`,
      input.name ? `name=${input.name}` : '',
      input.stack || '',
    ]
      .filter(Boolean)
      .join('\n\n');

    await this.append({
      level: input.isFatal ? 'FATAL' : 'ERROR',
      tag: 'Crash',
      message: input.message || 'Unhandled exception',
      details,
    });
  }

  async flush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    this.flushPromise = this.flushPromise
      .then(async () => {
        if (this.pending.length === 0) return;

        const pendingEntries = this.pending.splice(0, this.pending.length);
        const existing = await this.loadFromStorage();
        const merged = [...pendingEntries.reverse(), ...existing].slice(0, MAX_ENTRIES);

        this.cache = merged;
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      })
      .catch(() => {
        // Keep failures silent; runtime logging should never crash app flow.
      });

    return this.flushPromise;
  }

  async list(limit: number = 250): Promise<RuntimeLogEntry[]> {
    await this.flush();
    const entries = await this.loadFromStorage();
    const normalizedLimit = Math.max(0, Math.min(MAX_ENTRIES, Math.floor(limit)));
    return entries.slice(0, normalizedLimit);
  }

  async clear(): Promise<void> {
    this.pending = [];
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    try {
      await this.flushPromise;
    } catch {
      // No-op.
    }

    this.cache = [];
    await AsyncStorage.removeItem(STORAGE_KEY);
  }

  async exportText(limit: number = 250, levels?: RuntimeLogLevel[]): Promise<string> {
    const entries = await this.list(limit);
    const filtered =
      levels && levels.length > 0
        ? entries.filter((entry) => levels.includes(entry.level))
        : entries;

    if (filtered.length === 0) {
      return 'No runtime logs recorded.';
    }

    return filtered
      .map((entry) => {
        const header = `[${new Date(entry.timestamp).toISOString()}] [${entry.level}] [${entry.tag}] ${entry.message}`;
        return entry.details ? `${header}\n${entry.details}` : header;
      })
      .join('\n\n');
  }
}

export const RuntimeLogService = new RuntimeLogServiceClass();
