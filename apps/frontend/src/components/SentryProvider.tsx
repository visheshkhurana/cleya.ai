'use client';

// Frontend Sentry integration placeholder
// To add Sentry to the frontend, install @sentry/nextjs and follow their Next.js setup guide:
// https://docs.sentry.io/platforms/javascript/guides/nextjs/
// Use NEXT_PUBLIC_SENTRY_DSN env var for the client-side DSN.
// Note: @sentry/nextjs is heavy (~200KB) — only add if error volume justifies the bundle size.

export default function SentryProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
