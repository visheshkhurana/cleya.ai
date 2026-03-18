'use client';

import { useEffect } from 'react';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || '';

export default function SentryProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!SENTRY_DSN || typeof window === 'undefined') return;
    if ((window as any).Sentry) return;

    const script = document.createElement('script');
    script.src = 'https://browser.sentry-cdn.com/8.45.0/bundle.tracing.min.js';
    script.crossOrigin = 'anonymous';
    script.async = true;
    script.onload = () => {
      if ((window as any).Sentry) {
        (window as any).Sentry.init({
          dsn: SENTRY_DSN,
          environment: process.env.NODE_ENV || 'development',
          tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
          integrations: [
            (window as any).Sentry.browserTracingIntegration(),
          ],
        });

        window.addEventListener('error', (event) => {
          (window as any).Sentry?.captureException(event.error);
        });

        window.addEventListener('unhandledrejection', (event) => {
          (window as any).Sentry?.captureException(event.reason);
        });
      }
    };
    document.head.appendChild(script);
  }, []);

  return <>{children}</>;
}
