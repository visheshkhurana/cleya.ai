'use client';

declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '';

let initialized = false;

export function initGA() {
  if (initialized || !GA_ID || typeof window === 'undefined') return;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', GA_ID, {
    send_page_view: true,
  });

  initialized = true;
}

export function trackPageView(url: string) {
  if (typeof window === 'undefined' || !window.gtag || !GA_ID) return;
  window.gtag('config', GA_ID, { page_path: url });
}

export function trackGAEvent(
  action: string,
  category?: string,
  label?: string,
  value?: number
) {
  if (typeof window === 'undefined' || !window.gtag) return;
  window.gtag('event', action, {
    event_category: category,
    event_label: label,
    value,
  });
}
