'use client';

declare global {
  interface Window {
    posthog?: any;
  }
}

function ph() {
  if (typeof window === 'undefined') return null;
  return window.posthog || null;
}

export function identifyUser(userId: string, properties?: Record<string, any>) {
  ph()?.identify(userId, properties);
}

export function resetUser() {
  ph()?.reset();
}

export function trackEvent(event: string, properties?: Record<string, any>) {
  ph()?.capture(event, properties);
}

export function setUserProperties(properties: Record<string, any>) {
  ph()?.people?.set(properties);
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
