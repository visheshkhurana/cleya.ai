'use client';

import { useEffect, useState } from 'react';
import PostHogProvider from './PostHogProvider';
import SentryProvider from './SentryProvider';
import CookieConsent from './CookieConsent';

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <SentryProvider>
      <PostHogProvider>
        {children}
        <CookieConsent />
      </PostHogProvider>
    </SentryProvider>
  );
}
