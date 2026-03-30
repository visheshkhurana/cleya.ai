'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { initGA, trackPageView } from '@/lib/ga';

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || '';
const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '';
const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || '';

function hasAnalyticsConsent(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('cleo_cookie_consent') === 'accepted';
}

function initPostHog() {
  if (!POSTHOG_KEY || typeof window === 'undefined' || (window as any).posthog) return;

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
}

function initSentry() {
  if (!SENTRY_DSN || typeof window === 'undefined' || (window as any).__sentryLoaded) return;
  (window as any).__sentryLoaded = true;

  const script = document.createElement('script');
  script.src = 'https://browser.sentry-cdn.com/8.48.0/bundle.min.js';
  script.crossOrigin = 'anonymous';
  script.async = true;
  script.onload = () => {
    if ((window as any).Sentry) {
      (window as any).Sentry.init({
        dsn: SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
      });
    }
  };
  document.head.appendChild(script);
}

function initAnalyticsIfConsented() {
  if (!hasAnalyticsConsent()) return;
  if (POSTHOG_KEY) initPostHog();
  if (GA_ID) initGA();
}

export default function BootstrapClient() {
  const pathname = usePathname();
  const prevPathname = useRef<string | null>(null);

  useEffect(() => {
    initSentry();
    initAnalyticsIfConsented();
  }, []);

  useEffect(() => {
    if (pathname && pathname !== prevPathname.current) {
      prevPathname.current = pathname;
      trackPageView(pathname);
    }
  }, [pathname]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('cleo_cookie_consent');
    if (stored) return;

    const timer = setTimeout(() => {
      const wrapper = document.createElement('div');
      wrapper.id = 'cookie-consent-banner';
      wrapper.setAttribute('role', 'dialog');
      wrapper.setAttribute('aria-label', 'Cookie consent');
      wrapper.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:40;width:100%;max-width:480px;padding:0 16px;pointer-events:auto';
      wrapper.innerHTML = `
        <div style="background:#1E293B;border:1px solid rgba(13,148,136,0.2);border-radius:16px;padding:20px 24px;box-shadow:0 20px 60px rgba(0,0,0,0.5)">
          <div style="display:flex;align-items:flex-start;gap:12px">
            <span style="font-size:20px;margin-top:2px" aria-hidden="true">\u{1F36A}</span>
            <div style="flex:1">
              <p style="color:#fff;font-size:14px;font-weight:600;margin:0 0 4px">We use cookies</p>
              <p style="color:rgba(255,255,255,0.45);font-size:12px;line-height:1.5;margin:0 0 16px">
                We use essential cookies to make Cleya work. We\u2019d also like to use analytics cookies to understand how you use our platform and improve your experience.
                <a href="/privacy" style="color:#0D9488;text-decoration:underline">Privacy Policy</a>
              </p>
              <div style="display:flex;gap:8px" id="cookie-consent-buttons"></div>
            </div>
          </div>
        </div>`;
      document.body.appendChild(wrapper);

      const btnContainer = document.getElementById('cookie-consent-buttons');
      if (btnContainer) {
        const acceptBtn = document.createElement('button');
        acceptBtn.textContent = 'Accept all';
        acceptBtn.style.cssText = 'padding:8px 20px;border-radius:10px;background:#0D9488;color:#fff;font-size:13px;font-weight:600;border:none;cursor:pointer';
        acceptBtn.onclick = () => {
          localStorage.setItem('cleo_cookie_consent', 'accepted');
          wrapper.remove();
          initAnalyticsIfConsented();
        };

        const declineBtn = document.createElement('button');
        declineBtn.textContent = 'Essential only';
        declineBtn.style.cssText = 'padding:8px 20px;border-radius:10px;background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.6);font-size:13px;font-weight:500;border:1px solid rgba(255,255,255,0.1);cursor:pointer';
        declineBtn.onclick = () => {
          localStorage.setItem('cleo_cookie_consent', 'declined');
          wrapper.remove();
        };

        btnContainer.appendChild(acceptBtn);
        btnContainer.appendChild(declineBtn);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  return null;
}
