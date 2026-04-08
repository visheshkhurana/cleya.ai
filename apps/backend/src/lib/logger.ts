import { env } from '../config/env';

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const LOG_LEVELS: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const PII_PATTERNS: RegExp[] = [
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  /\b\d{10,12}\b/g,
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
];

const PII_KEYS = new Set([
  'password', 'passwordHash', 'token', 'accessToken', 'refreshToken',
  'apiKey', 'secret', 'authorization', 'cookie', 'creditCard',
  'ssn', 'phoneNumber', 'phone',
]);

function sanitizeValue(value: string): string {
  let sanitized = value;
  for (const pattern of PII_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }
  return sanitized;
}

function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (PII_KEYS.has(key.toLowerCase())) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'string') {
      result[key] = sanitizeValue(value);
    } else if (Array.isArray(value)) {
      result[key] = value.map(item => {
        if (typeof item === 'string') return sanitizeValue(item);
        if (item && typeof item === 'object') return sanitizeObject(item as Record<string, unknown>);
        return item;
      });
    } else if (value && typeof value === 'object') {
      result[key] = sanitizeObject(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function getConfiguredLevel(): LogLevel {
  const level = (process.env.LOG_LEVEL || 'info').toLowerCase();
  if (level in LOG_LEVELS) return level as LogLevel;
  return 'info';
}

class Logger {
  private level: LogLevel;
  private service: string;
  private environment: string;

  constructor() {
    this.level = getConfiguredLevel();
    this.service = 'cleya-backend';
    this.environment = process.env.NODE_ENV || 'development';
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] <= LOG_LEVELS[this.level];
  }

  private formatMessage(level: LogLevel, message: string, meta?: Record<string, unknown>) {
    const entry: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      environment: this.environment,
      message: sanitizeValue(message),
    };

    if (meta) {
      entry.meta = sanitizeObject(meta);
    }

    return JSON.stringify(entry);
  }

  error(message: string, meta?: Record<string, unknown>) {
    if (!this.shouldLog('error')) return;
    console.error(this.formatMessage('error', message, meta));
  }

  warn(message: string, meta?: Record<string, unknown>) {
    if (!this.shouldLog('warn')) return;
    console.warn(this.formatMessage('warn', message, meta));
  }

  info(message: string, meta?: Record<string, unknown>) {
    if (!this.shouldLog('info')) return;
    console.log(this.formatMessage('info', message, meta));
  }

  debug(message: string, meta?: Record<string, unknown>) {
    if (!this.shouldLog('debug')) return;
    console.debug(this.formatMessage('debug', message, meta));
  }

  child(context: Record<string, unknown>): ChildLogger {
    return new ChildLogger(this, context);
  }
}

class ChildLogger {
  constructor(
    private parent: Logger,
    private context: Record<string, unknown>
  ) {}

  error(message: string, meta?: Record<string, unknown>) {
    this.parent.error(message, { ...this.context, ...meta });
  }

  warn(message: string, meta?: Record<string, unknown>) {
    this.parent.warn(message, { ...this.context, ...meta });
  }

  info(message: string, meta?: Record<string, unknown>) {
    this.parent.info(message, { ...this.context, ...meta });
  }

  debug(message: string, meta?: Record<string, unknown>) {
    this.parent.debug(message, { ...this.context, ...meta });
  }
}

export const logger = new Logger();
export { Logger, ChildLogger };
