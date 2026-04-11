"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChildLogger = exports.Logger = exports.logger = void 0;
const LOG_LEVELS = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
};
const PII_PATTERNS = [
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
function sanitizeValue(value) {
    let sanitized = value;
    for (const pattern of PII_PATTERNS) {
        sanitized = sanitized.replace(pattern, '[REDACTED]');
    }
    return sanitized;
}
function sanitizeObject(obj) {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        if (PII_KEYS.has(key.toLowerCase())) {
            result[key] = '[REDACTED]';
        }
        else if (typeof value === 'string') {
            result[key] = sanitizeValue(value);
        }
        else if (Array.isArray(value)) {
            result[key] = value.map(item => {
                if (typeof item === 'string')
                    return sanitizeValue(item);
                if (item && typeof item === 'object')
                    return sanitizeObject(item);
                return item;
            });
        }
        else if (value && typeof value === 'object') {
            result[key] = sanitizeObject(value);
        }
        else {
            result[key] = value;
        }
    }
    return result;
}
function getConfiguredLevel() {
    const level = (process.env.LOG_LEVEL || 'info').toLowerCase();
    if (level in LOG_LEVELS)
        return level;
    return 'info';
}
class Logger {
    level;
    service;
    environment;
    constructor() {
        this.level = getConfiguredLevel();
        this.service = 'cleya-backend';
        this.environment = process.env.NODE_ENV || 'development';
    }
    shouldLog(level) {
        return LOG_LEVELS[level] <= LOG_LEVELS[this.level];
    }
    formatMessage(level, message, meta) {
        const entry = {
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
    error(message, meta) {
        if (!this.shouldLog('error'))
            return;
        console.error(this.formatMessage('error', message, meta));
    }
    warn(message, meta) {
        if (!this.shouldLog('warn'))
            return;
        console.warn(this.formatMessage('warn', message, meta));
    }
    info(message, meta) {
        if (!this.shouldLog('info'))
            return;
        console.log(this.formatMessage('info', message, meta));
    }
    debug(message, meta) {
        if (!this.shouldLog('debug'))
            return;
        console.debug(this.formatMessage('debug', message, meta));
    }
    child(context) {
        return new ChildLogger(this, context);
    }
}
exports.Logger = Logger;
class ChildLogger {
    parent;
    context;
    constructor(parent, context) {
        this.parent = parent;
        this.context = context;
    }
    error(message, meta) {
        this.parent.error(message, { ...this.context, ...meta });
    }
    warn(message, meta) {
        this.parent.warn(message, { ...this.context, ...meta });
    }
    info(message, meta) {
        this.parent.info(message, { ...this.context, ...meta });
    }
    debug(message, meta) {
        this.parent.debug(message, { ...this.context, ...meta });
    }
}
exports.ChildLogger = ChildLogger;
exports.logger = new Logger();
//# sourceMappingURL=logger.js.map