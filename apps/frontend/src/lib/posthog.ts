'use client';

import posthog from 'posthog-js';

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || '';
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

let initialized = false;

export function initPostHog() {
  if (initialized || !POSTHOG_KEY || typeof window === 'undefined') return;

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    person_profiles: 'identified_only',
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: true,
    persistence: 'localStorage+cookie',
    loaded: (ph) => {
      if (process.env.NODE_ENV === 'development') {
        ph.debug(false);
      }
    },
  });

  initialized = true;
}

export function identifyUser(userId: string, properties?: Record<string, any>) {
  if (!POSTHOG_KEY) return;
  posthog.identify(userId, properties);
}

export function resetUser() {
  if (!POSTHOG_KEY) return;
  posthog.reset();
}

export function trackEvent(event: string, properties?: Record<string, any>) {
  if (!POSTHOG_KEY) return;
  posthog.capture(event, properties);
}

export function setUserProperties(properties: Record<string, any>) {
  if (!POSTHOG_KEY) return;
  posthog.people.set(properties);
}

export const analytics = {
  signup: (method: string, persona?: string) =>
    trackEvent('user_signed_up', { method, persona }),

  login: (method: string) =>
    trackEvent('user_logged_in', { method }),

  onboardingStarted: () =>
    trackEvent('onboarding_started'),

  onboardingCompleted: (persona: string) =>
    trackEvent('onboarding_completed', { persona }),

  profileUpdated: (fields: string[]) =>
    trackEvent('profile_updated', { fields_changed: fields }),

  matchViewed: (matchId: string) =>
    trackEvent('match_viewed', { match_id: matchId }),

  matchAccepted: (matchId: string) =>
    trackEvent('match_accepted', { match_id: matchId }),

  matchDeclined: (matchId: string) =>
    trackEvent('match_declined', { match_id: matchId }),

  introRequested: (matchId: string) =>
    trackEvent('intro_requested', { match_id: matchId }),

  messagesSent: (channel: string) =>
    trackEvent('message_sent', { channel }),

  pageViewed: (page: string) =>
    trackEvent('page_viewed', { page }),

  searchPerformed: (query: string) =>
    trackEvent('search_performed', { query_length: query.length }),

  featureUsed: (feature: string, details?: Record<string, any>) =>
    trackEvent('feature_used', { feature, ...details }),
};

export { posthog };
