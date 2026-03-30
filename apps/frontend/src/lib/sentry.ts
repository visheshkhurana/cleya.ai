'use client';

export function captureException(error: Error, context?: Record<string, any>) {
  if (typeof window === 'undefined' || !(window as any).Sentry) return;
  (window as any).Sentry.captureException(error, context ? { extra: context } : undefined);
}

export function captureMessage(message: string, level?: 'info' | 'warning' | 'error') {
  if (typeof window === 'undefined' || !(window as any).Sentry) return;
  (window as any).Sentry.captureMessage(message, level);
}

export function setUser(user: { id: string; email?: string } | null) {
  if (typeof window === 'undefined' || !(window as any).Sentry) return;
  (window as any).Sentry.setUser(user);
}
