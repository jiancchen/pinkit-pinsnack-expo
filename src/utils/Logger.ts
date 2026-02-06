import Constants from 'expo-constants';

export enum LogLevel {
  NONE = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
  VERBOSE = 5,
}

export interface LoggerConfig {
  level: LogLevel;
  enableTimestamps: boolean;
  enableColors: boolean;
  prefix?: string;
}

type LogMethod = (...args: unknown[]) => void;

interface LoggerInstance {
  error: LogMethod;
  warn: LogMethod;
  info: LogMethod;
  debug: LogMethod;
  verbose: LogMethod;
  setLevel: (level: LogLevel) => void;
  getLevel: () => LogLevel;
}

const isProduction = (): boolean => {
  const releaseChannel = Constants.expoConfig?.extra?.releaseChannel;
  const nodeEnv = process.env.NODE_ENV;
  
  return (
    releaseChannel === 'production' ||
    releaseChannel === 'prod' ||
    nodeEnv === 'production' ||
    !__DEV__
  );
};

const DEFAULT_CONFIG: LoggerConfig = {
  level: isProduction() ? LogLevel.ERROR : LogLevel.DEBUG,
  enableTimestamps: true,
  enableColors: true,
};

const MAX_LOG_STRING_LENGTH = 2000;

const REDACTED = '[REDACTED]';

const SENSITIVE_FIELD_NAMES = new Set([
  'apikey',
  'api_key',
  'x-api-key',
  'x_api_key',
  'authorization',
  'access_token',
  'accesstoken',
  'refresh_token',
  'refreshtoken',
  'password',
  'secret',
]);

const API_KEY_PATTERN = /sk-ant-[a-zA-Z0-9_-]{20,}/g;
const BEARER_PATTERN = /Bearer\s+[a-zA-Z0-9._-]{10,}/g;

function sanitizeStringForLog(value: string): string {
  let sanitized = value;

  sanitized = sanitized.replace(API_KEY_PATTERN, 'sk-ant-***');
  sanitized = sanitized.replace(BEARER_PATTERN, 'Bearer ***');

  if (sanitized.length > MAX_LOG_STRING_LENGTH) {
    return `${sanitized.slice(0, MAX_LOG_STRING_LENGTH)}… (truncated, ${sanitized.length} chars)`;
  }

  return sanitized;
}

function sanitizeForLog(value: unknown, depth: number, seen: WeakMap<object, unknown>): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') return sanitizeStringForLog(value);
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return value;
  if (typeof value === 'symbol' || typeof value === 'function') return String(value);

  if (value instanceof Date) return value.toISOString();
  if (value instanceof RegExp) return value.toString();
  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeStringForLog(value.message),
      stack: value.stack ? sanitizeStringForLog(value.stack) : undefined,
    };
  }

  if (typeof value !== 'object') return value;

  if (depth > 6) return '[Object]';

  const obj = value as object;
  const cached = seen.get(obj);
  if (cached) return cached;

  if (Array.isArray(value)) {
    const arr: unknown[] = [];
    seen.set(obj, arr);
    for (const item of value) {
      arr.push(sanitizeForLog(item, depth + 1, seen));
    }
    return arr;
  }

  // Map/Set: convert to arrays for stable logging.
  if (value instanceof Map) {
    const entries: unknown[] = [];
    seen.set(obj, entries);
    for (const [k, v] of value.entries()) {
      entries.push([sanitizeForLog(k, depth + 1, seen), sanitizeForLog(v, depth + 1, seen)]);
    }
    return { type: 'Map', entries };
  }
  if (value instanceof Set) {
    const entries: unknown[] = [];
    seen.set(obj, entries);
    for (const v of value.values()) {
      entries.push(sanitizeForLog(v, depth + 1, seen));
    }
    return { type: 'Set', entries };
  }

  const out: Record<string, unknown> = {};
  seen.set(obj, out);

  for (const [rawKey, rawVal] of Object.entries(value as Record<string, unknown>)) {
    const key = rawKey.toLowerCase();
    if (SENSITIVE_FIELD_NAMES.has(key)) {
      out[rawKey] = REDACTED;
      continue;
    }

    out[rawKey] = sanitizeForLog(rawVal, depth + 1, seen);
  }

  return out;
}

function sanitizeArgsForLog(args: unknown[]): unknown[] {
  const seen = new WeakMap<object, unknown>();
  return args.map((arg) => sanitizeForLog(arg, 0, seen));
}

class LoggerManager {
  private static instance: LoggerManager;
  private config: LoggerConfig = DEFAULT_CONFIG;
  private loggers: Map<string, LoggerInstance> = new Map();

  private constructor() {
    if (isProduction()) {
      this.config.level = LogLevel.ERROR;
    }
  }

  static getInstance(): LoggerManager {
    if (!LoggerManager.instance) {
      LoggerManager.instance = new LoggerManager();
    }
    return LoggerManager.instance;
  }

  setGlobalLevel(level: LogLevel): void {
    this.config.level = level;
  }

  getGlobalLevel(): LogLevel {
    return this.config.level;
  }

  setConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): LoggerConfig {
    return { ...this.config };
  }

  createLogger(tag: string, overrideLevel?: LogLevel): LoggerInstance {
    if (this.loggers.has(tag)) {
      return this.loggers.get(tag)!;
    }

    let localLevel: LogLevel | undefined = overrideLevel;

    const shouldLog = (level: LogLevel): boolean => {
      const effectiveLevel = localLevel ?? this.config.level;
      return level <= effectiveLevel;
    };

    const formatMessage = (level: string, args: unknown[]): string[] => {
      const parts: string[] = [];
      
      if (this.config.enableTimestamps) {
        const now = new Date();
        const time = now.toISOString().split('T')[1].slice(0, 12);
        parts.push(`[${time}]`);
      }
      
      parts.push(`[${tag}]`);
      parts.push(`[${level}]`);
      
      return parts;
    };

    const getEmoji = (level: LogLevel): string => {
      if (!this.config.enableColors) return '';
      switch (level) {
        case LogLevel.ERROR: return '❌';
        case LogLevel.WARN: return '⚠️';
        case LogLevel.INFO: return 'ℹ️';
        case LogLevel.DEBUG: return '🔧';
        case LogLevel.VERBOSE: return '📝';
        default: return '';
      }
    };

    const log = (level: LogLevel, levelName: string, ...args: unknown[]): void => {
      if (!shouldLog(level)) return;
      
      const prefix = formatMessage(levelName, args);
      const emoji = getEmoji(level);
      const fullPrefix = emoji ? `${emoji} ${prefix.join(' ')}` : prefix.join(' ');
      const safeArgs = sanitizeArgsForLog(args);
      
      switch (level) {
        case LogLevel.ERROR:
          console.error(fullPrefix, ...safeArgs);
          break;
        case LogLevel.WARN:
          console.warn(fullPrefix, ...safeArgs);
          break;
        default:
          console.log(fullPrefix, ...safeArgs);
      }
    };

    const logger: LoggerInstance = {
      error: (...args: unknown[]) => log(LogLevel.ERROR, 'ERROR', ...args),
      warn: (...args: unknown[]) => log(LogLevel.WARN, 'WARN', ...args),
      info: (...args: unknown[]) => log(LogLevel.INFO, 'INFO', ...args),
      debug: (...args: unknown[]) => log(LogLevel.DEBUG, 'DEBUG', ...args),
      verbose: (...args: unknown[]) => log(LogLevel.VERBOSE, 'VERBOSE', ...args),
      setLevel: (level: LogLevel) => { localLevel = level; },
      getLevel: () => localLevel ?? this.config.level,
    };

    this.loggers.set(tag, logger);
    return logger;
  }

  enableAllLogs(): void {
    this.config.level = LogLevel.VERBOSE;
  }

  disableAllLogs(): void {
    this.config.level = LogLevel.NONE;
  }

  enableProductionMode(): void {
    this.config.level = LogLevel.ERROR;
  }

  enableDevelopmentMode(): void {
    this.config.level = LogLevel.DEBUG;
  }
}

export const Logger = LoggerManager.getInstance();

export const createLogger = (tag: string, overrideLevel?: LogLevel): LoggerInstance => {
  return Logger.createLogger(tag, overrideLevel);
};

export const AppLogger = createLogger('App');
export const ApiLogger = createLogger('API');
export const StorageLogger = createLogger('Storage');
export const ScreenshotLogger = createLogger('Screenshot');
export const TokenLogger = createLogger('Token');
export const SeedLogger = createLogger('Seed');
export const WebViewLogger = createLogger('WebView');

export default Logger;
