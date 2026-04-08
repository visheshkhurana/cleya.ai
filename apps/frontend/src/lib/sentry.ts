'use client';

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
