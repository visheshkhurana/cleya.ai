'use client';

import * as Sentry from '@sentry/browser';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || '';

let initialized = false;

function ensureInit() {
  if (initialized || !SENTRY_DSN || typeof window === 'undefined') return;
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
  });
  initialized = true;
}

if (typeof window !== 'undefined' && SENTRY_DSN) {
  ensureInit();
}

export function captureException(error: Error, context?: Record<string, any>) {
  ensureInit();
  if (!initialized) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

export function captureMessage(message: string, level?: 'info' | 'warning' | 'error') {
  ensureInit();
  if (!initialized) return;
  Sentry.captureMessage(message, level);
}

export function setUser(user: { id: string; email?: string } | null) {
  ensureInit();
  if (!initialized) return;
  Sentry.setUser(user);
}
