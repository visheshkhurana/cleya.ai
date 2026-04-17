'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { initGA, trackPageView } from '@/lib/ga';

declare global {
  interface Window {
    posthog?: any;
    Sentry?: {
      init: (config: Record<string, unknown>) => void;
      captureException: (error: Error, context?: Record<string, unknown>) => void;
      captureMessage: (message: string, level?: string) => void;
      setUser: (user: { id: string; email?: string } | null) => void;
    };
    __sentryLoaded?: boolean;
    __cleyaPostHogLoaded?: boolean;
    __cleyaGALoaded?: boolean;
    openCookiePreferences?: () => void;
  }
}

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || '';
const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-NQZFDW5CGZ';
const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || '';

const CONSENT_KEY = 'cleya_cookie_consent_v2';
const LEGACY_KEY = 'cleo_cookie_consent';

export interface ConsentState {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
  version: 'v2';
  updatedAt: string;
}

function readConsent(): ConsentState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.version === 'v2') return parsed;
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy === 'accepted') {
      return { essential: true, analytics: true, marketing: true, version: 'v2', updatedAt: new Date().toISOString() };
    }
    if (legacy === 'declined') {
      return { essential: true, analytics: false, marketing: false, version: 'v2', updatedAt: new Date().toISOString() };
    }
  } catch {}
  return null;
}

function writeConsent(consent: Omit<ConsentState, 'version' | 'updatedAt'>) {
  if (typeof window === 'undefined') return;
  const full: ConsentState = { ...consent, essential: true, version: 'v2', updatedAt: new Date().toISOString() };
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(full));
    localStorage.setItem(LEGACY_KEY, consent.analytics || consent.marketing ? 'accepted' : 'declined');
  } catch {}
  // Best-effort sync to backend (logged-in users)
  try {
    fetch('/api/cookie-consent', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ analytics: consent.analytics, marketing: consent.marketing }),
    }).catch(() => {});
  } catch {}
}

function initPostHog() {
  if (!POSTHOG_KEY || typeof window === 'undefined' || window.__cleyaPostHogLoaded || window.posthog) return;
  window.__cleyaPostHogLoaded = true;
  const script = document.createElement('script');
  script.src = 'https://us.i.posthog.com/static/array.js';
  script.async = true;
  script.onload = () => {
    if (window.posthog) {
      window.posthog.init(POSTHOG_KEY, {
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
}

function initGAWithConsent() {
  if (!GA_ID || typeof window === 'undefined' || window.__cleyaGALoaded) return;
  window.__cleyaGALoaded = true;
  const s1 = document.createElement('script');
  s1.async = true;
  s1.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s1);
  const s2 = document.createElement('script');
  s2.text = `window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', '${GA_ID}');`;
  document.head.appendChild(s2);
  initGA();
}

function initSentry() {
  if (!SENTRY_DSN || typeof window === 'undefined' || window.__sentryLoaded) return;
  window.__sentryLoaded = true;
  const script = document.createElement('script');
  script.src = 'https://browser.sentry-cdn.com/8.48.0/bundle.min.js';
  script.crossOrigin = 'anonymous';
  script.async = true;
  script.onload = () => {
    if (window.Sentry) {
      window.Sentry.init({
        dsn: SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
      });
    }
  };
  document.head.appendChild(script);
}

function applyConsent(consent: ConsentState | null) {
  if (!consent) return;
  if (consent.analytics && POSTHOG_KEY) initPostHog();
  if (consent.marketing && GA_ID) initGAWithConsent();
}

function renderBanner(initial?: ConsentState | null) {
  if (typeof window === 'undefined') return;
  const existing = document.getElementById('cookie-consent-banner');
  if (existing) existing.remove();

  const wrapper = document.createElement('div');
  wrapper.id = 'cookie-consent-banner';
  wrapper.setAttribute('role', 'dialog');
  wrapper.setAttribute('aria-label', 'Cookie consent');
  wrapper.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:60;width:100%;max-width:560px;padding:0 16px;pointer-events:auto';

  const customize = !!initial;
  const analyticsChecked = initial?.analytics ?? true;
  const marketingChecked = initial?.marketing ?? false;

  wrapper.innerHTML = `
    <div style="background:rgba(15,22,41,0.96);border:1px solid rgba(108,99,255,0.2);border-radius:16px;padding:20px 24px;box-shadow:0 20px 60px rgba(0,0,0,0.5);backdrop-filter:blur(20px)">
      <div data-view="main" style="display:${customize ? 'none' : 'block'}">
        <div style="display:flex;align-items:flex-start;gap:12px">
          <span style="font-size:20px;margin-top:2px" aria-hidden="true">🍪</span>
          <div style="flex:1">
            <p style="color:#fff;font-size:14px;font-weight:600;margin:0 0 4px">We use cookies</p>
            <p style="color:rgba(255,255,255,0.5);font-size:12px;line-height:1.5;margin:0 0 16px">
              Essential cookies make Cleya work. Analytics and marketing cookies help us improve.
              <a href="/privacy" style="color:#6C63FF;text-decoration:underline">Privacy Policy</a>
            </p>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button data-action="accept-all" style="padding:8px 18px;border-radius:10px;background:#6C63FF;color:#fff;font-size:13px;font-weight:600;border:none;cursor:pointer">Accept all</button>
              <button data-action="essential" style="padding:8px 18px;border-radius:10px;background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.7);font-size:13px;font-weight:500;border:1px solid rgba(255,255,255,0.1);cursor:pointer">Essential only</button>
              <button data-action="customize" style="padding:8px 18px;border-radius:10px;background:transparent;color:rgba(255,255,255,0.6);font-size:13px;font-weight:500;border:1px solid rgba(255,255,255,0.1);cursor:pointer">Customize</button>
            </div>
          </div>
        </div>
      </div>
      <div data-view="customize" style="display:${customize ? 'block' : 'none'}">
        <p style="color:#fff;font-size:14px;font-weight:600;margin:0 0 12px">Cookie preferences</p>
        <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px">
          <label style="display:flex;align-items:flex-start;gap:10px;padding:10px;border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.05)">
            <input type="checkbox" checked disabled style="margin-top:3px"/>
            <div style="flex:1">
              <div style="color:#fff;font-size:13px;font-weight:500">Essential</div>
              <div style="color:rgba(255,255,255,0.45);font-size:11px">Required for the site to work — login, security, error tracking. Always on.</div>
            </div>
          </label>
          <label style="display:flex;align-items:flex-start;gap:10px;padding:10px;border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.05);cursor:pointer">
            <input type="checkbox" data-toggle="analytics" ${analyticsChecked ? 'checked' : ''} style="margin-top:3px"/>
            <div style="flex:1">
              <div style="color:#fff;font-size:13px;font-weight:500">Analytics</div>
              <div style="color:rgba(255,255,255,0.45);font-size:11px">Helps us understand how Cleya is used (PostHog).</div>
            </div>
          </label>
          <label style="display:flex;align-items:flex-start;gap:10px;padding:10px;border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.05);cursor:pointer">
            <input type="checkbox" data-toggle="marketing" ${marketingChecked ? 'checked' : ''} style="margin-top:3px"/>
            <div style="flex:1">
              <div style="color:#fff;font-size:13px;font-weight:500">Marketing</div>
              <div style="color:rgba(255,255,255,0.45);font-size:11px">Used to measure ad campaigns (Google Analytics).</div>
            </div>
          </label>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">
          <button data-action="back" style="padding:8px 18px;border-radius:10px;background:transparent;color:rgba(255,255,255,0.5);font-size:13px;font-weight:500;border:1px solid rgba(255,255,255,0.1);cursor:pointer">Back</button>
          <button data-action="save" style="padding:8px 18px;border-radius:10px;background:#6C63FF;color:#fff;font-size:13px;font-weight:600;border:none;cursor:pointer">Save preferences</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(wrapper);

  const mainView = wrapper.querySelector('[data-view="main"]') as HTMLElement | null;
  const customView = wrapper.querySelector('[data-view="customize"]') as HTMLElement | null;
  const handle = (analytics: boolean, marketing: boolean) => {
    writeConsent({ essential: true, analytics, marketing });
    wrapper.remove();
    applyConsent({ essential: true, analytics, marketing, version: 'v2', updatedAt: new Date().toISOString() });
    setTimeout(() => trackPageView(window.location.pathname), 100);
  };

  wrapper.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const action = target.getAttribute('data-action');
    if (action === 'accept-all') handle(true, true);
    else if (action === 'essential') handle(false, false);
    else if (action === 'customize') {
      if (mainView) mainView.style.display = 'none';
      if (customView) customView.style.display = 'block';
    } else if (action === 'back') {
      if (customView) customView.style.display = 'none';
      if (mainView) mainView.style.display = 'block';
    } else if (action === 'save') {
      const a = (wrapper.querySelector('[data-toggle="analytics"]') as HTMLInputElement | null)?.checked ?? false;
      const m = (wrapper.querySelector('[data-toggle="marketing"]') as HTMLInputElement | null)?.checked ?? false;
      handle(a, m);
    }
  });
}

export default function BootstrapClient() {
  const pathname = usePathname();
  const prevPathname = useRef<string | null>(null);

  useEffect(() => {
    initSentry();
    const consent = readConsent();
    applyConsent(consent);

    if (typeof window !== 'undefined') {
      window.openCookiePreferences = () => renderBanner(readConsent());
    }
  }, []);

  useEffect(() => {
    if (pathname && pathname !== prevPathname.current) {
      prevPathname.current = pathname;
      trackPageView(pathname);
    }
  }, [pathname]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (readConsent()) return;
    const timer = setTimeout(() => renderBanner(null), 1500);
    return () => clearTimeout(timer);
  }, []);

  return null;
}
