"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSentry = initSentry;
const Sentry = __importStar(require("@sentry/node"));
const IGNORED_ERRORS = [
    'Not allowed by CORS',
    'Request aborted',
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'EPIPE',
    'ERR_ABORTED',
    'AbortError',
    'Network request failed',
];
const PII_FIELDS = ['password', 'passwordHash', 'token', 'accessToken', 'refreshToken', 'apiKey', 'secret', 'authorization', 'cookie'];
function sanitizeData(data) {
    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
        if (PII_FIELDS.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
            sanitized[key] = '[FILTERED]';
        }
        else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            sanitized[key] = sanitizeData(value);
        }
        else {
            sanitized[key] = value;
        }
    }
    return sanitized;
}
function initSentry() {
    const dsn = process.env.SENTRY_DSN;
    if (!dsn)
        return;
    const nodeEnv = process.env.NODE_ENV || 'development';
    Sentry.init({
        dsn,
        environment: nodeEnv,
        tracesSampleRate: nodeEnv === 'production' ? 0.1 : 1.0,
        profilesSampleRate: nodeEnv === 'production' ? 0.1 : 0,
        beforeSend(event) {
            const message = event.exception?.values?.[0]?.value || '';
            if (IGNORED_ERRORS.some(ignored => message.includes(ignored))) {
                return null;
            }
            if (event.request?.headers) {
                delete event.request.headers['authorization'];
                delete event.request.headers['cookie'];
            }
            if (event.request?.data && typeof event.request.data === 'object') {
                event.request.data = sanitizeData(event.request.data);
            }
            if (event.extra && typeof event.extra === 'object') {
                event.extra = sanitizeData(event.extra);
            }
            return event;
        },
        beforeBreadcrumb(breadcrumb) {
            if (breadcrumb.category === 'http' && breadcrumb.data?.url) {
                const url = breadcrumb.data.url;
                if (url.includes('password') || url.includes('token') || url.includes('secret')) {
                    breadcrumb.data.url = '[FILTERED]';
                }
            }
            return breadcrumb;
        },
        integrations: [
            Sentry.httpIntegration(),
            Sentry.expressIntegration(),
        ],
    });
}
//# sourceMappingURL=sentry.js.map