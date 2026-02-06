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
      
      switch (level) {
        case LogLevel.ERROR:
          console.error(fullPrefix, ...args);
          break;
        case LogLevel.WARN:
          console.warn(fullPrefix, ...args);
          break;
        default:
          console.log(fullPrefix, ...args);
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
