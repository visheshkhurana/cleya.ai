'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { trackEvent } from '@/lib/posthog';

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || '';

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

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
    if (pathname) {
      trackEvent('$pageview', { path: pathname });
    }
  }, [pathname]);

  return <>{children}</>;
}
