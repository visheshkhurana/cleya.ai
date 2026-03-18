'use client';

// Frontend Sentry placeholder — these are no-ops until @sentry/nextjs is installed.
// See SentryProvider.tsx for setup instructions.

export function captureException(_error: Error, _context?: Record<string, any>) {}

export function captureMessage(_message: string, _level?: 'info' | 'warning' | 'error') {}

export function setUser(_user: { id: string; email?: string } | null) {}
