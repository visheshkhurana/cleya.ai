'use client';

const IGNORED_ERRORS = [
  'ResizeObserver loop',
  'Non-Error promise rejection',
  'Load failed',
  'Failed to fetch',
  'NetworkError',
  'AbortError',
  'ChunkLoadError',
  'Loading chunk',
  'cancelled',
];

const DENY_URLS = [
  /extensions\//i,
  /^chrome:\/\//i,
  /^chrome-extension:\/\//i,
  /^moz-extension:\/\//i,
  /^safari-extension:\/\//i,
  /^safari-web-extension:\/\//i,
  /graph\.facebook\.com/i,
  /connect\.facebook\.net/i,
  /googletagmanager\.com/i,
  /analytics\.google\.com/i,
];

export function initSentryEnhanced(dsn: string) {
  if (typeof window === 'undefined' || !window.Sentry || window.__sentryEnhanced) return;
  window.__sentryEnhanced = true;

  window.Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
    beforeSend: (event: any) => {
      const message = event.exception?.values?.[0]?.value || '';
      if (IGNORED_ERRORS.some(ignored => message.includes(ignored))) {
        return null;
      }

      const frames = event.exception?.values?.[0]?.stacktrace?.frames || [];
      const hasBlockedUrl = frames.some((frame: any) =>
        frame.filename && DENY_URLS.some(pattern => pattern.test(frame.filename))
      );
      if (hasBlockedUrl) return null;

      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }

      return event;
    },
  });
}

export function captureException(error: Error, context?: Record<string, unknown>) {
  if (typeof window === 'undefined' || !window.Sentry) return;
  window.Sentry.captureException(error, context ? { extra: context } : undefined);
}

export function captureMessage(message: string, level?: 'info' | 'warning' | 'error') {
  if (typeof window === 'undefined' || !window.Sentry) return;
  window.Sentry.captureMessage(message, level);
}

export function setUser(user: { id: string; email?: string } | null) {
  if (typeof window === 'undefined' || !window.Sentry) return;
  window.Sentry.setUser(user);
}
