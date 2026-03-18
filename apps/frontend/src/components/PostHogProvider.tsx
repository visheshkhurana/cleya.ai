'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { initPostHog, trackEvent } from '@/lib/posthog';

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    initPostHog();
  }, []);

  useEffect(() => {
    if (pathname) {
      trackEvent('$pageview', { path: pathname });
    }
  }, [pathname]);

  return <>{children}</>;
}
