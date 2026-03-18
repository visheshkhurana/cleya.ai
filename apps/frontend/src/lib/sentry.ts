'use client';

declare global {
  interface Window {
    Sentry?: any;
  }
}

function sentry() {
  if (typeof window === 'undefined') return null;
  return window.Sentry || null;
}

export function captureException(error: Error, context?: Record<string, any>) {
  sentry()?.captureException(error, context ? { extra: context } : undefined);
}

export function captureMessage(message: string, level?: 'info' | 'warning' | 'error') {
  sentry()?.captureMessage(message, level || 'info');
}

export function setUser(user: { id: string; email?: string } | null) {
  sentry()?.setUser(user);
}
