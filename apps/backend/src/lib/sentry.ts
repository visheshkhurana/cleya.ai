import * as Sentry from '@sentry/node';

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

function sanitizeData(data: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (PII_FIELDS.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
      sanitized[key] = '[FILTERED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeData(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

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
        event.request.data = sanitizeData(event.request.data as Record<string, any>);
      }

      if (event.extra && typeof event.extra === 'object') {
        event.extra = sanitizeData(event.extra as Record<string, any>);
      }

      return event;
    },
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.category === 'http' && breadcrumb.data?.url) {
        const url = breadcrumb.data.url as string;
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
