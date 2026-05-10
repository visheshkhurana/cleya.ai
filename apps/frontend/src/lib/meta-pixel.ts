'use client';

// Meta Pixel — fire conversion + custom events from anywhere in the app.
// Pixel base script is loaded in app/layout.tsx behind NEXT_PUBLIC_META_PIXEL_ID.
// All helpers here are no-ops when the Pixel ID isn't set, so calls
// from components are safe to leave in regardless of env config.

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
  }
}

function ready(): boolean {
  return typeof window !== 'undefined' && typeof window.fbq === 'function';
}

// Standard Meta event for completed signup. Fire once on the page where
// the user lands after successful registration (Clerk's onSignUpComplete
// hook, the dashboard's first-load effect, etc).
export function trackSignupComplete(metadata?: { email?: string; user_id?: string }) {
  if (!ready()) return;
  window.fbq!('track', 'CompleteRegistration', {
    content_name: 'cleya_signup',
    ...(metadata ?? {}),
  });
}

// Earlier-funnel signal — fire when a user clicks a signup CTA (button
// on the homepage, ad landing page, etc). Useful for ad optimisation
// even before the Pixel has accumulated enough conversions for the
// CompleteRegistration event to be the optimisation goal.
export function trackSignupClick(source?: string) {
  if (!ready()) return;
  window.fbq!('trackCustom', 'CleyaSignupClick', {
    source: source ?? 'unknown',
  });
}

// Generic passthrough for arbitrary custom events.
export function trackPixelEvent(name: string, params?: Record<string, unknown>) {
  if (!ready()) return;
  window.fbq!('trackCustom', name, params ?? {});
}
