'use client';

import { useEffect } from 'react';
import { trackEvent } from '@/lib/posthog';

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || '';

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!POSTHOG_KEY || typeof window === 'undefined') return;
    if ((window as any).posthog) return;

    const script = document.createElement('script');
    script.src = 'https://us.i.posthog.com/static/array.js';
    script.async = true;
    script.onload = () => {
      if ((window as any).posthog) {
        (window as any).posthog.init(POSTHOG_KEY, {
          api_host: 'https://us.i.posthog.com',
          person_profiles: 'identified_only',
          capture_pageview: true,
          capture_pageleave: true,
          autocapture: true,
          persistence: 'localStorage+cookie',
        });
      }
    };
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    trackEvent('$pageview', { path: window.location.pathname });

    const handleRouteChange = () => {
      trackEvent('$pageview', { path: window.location.pathname });
    };
    window.addEventListener('popstate', handleRouteChange);
    return () => window.removeEventListener('popstate', handleRouteChange);
  }, []);

  return <>{children}</>;
}
