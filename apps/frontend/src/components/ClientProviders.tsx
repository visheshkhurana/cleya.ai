'use client';

import { useState, useEffect } from 'react';
import { ToastProvider } from './Toast';
import UnverifiedEmailBanner from './UnverifiedEmailBanner';
import { I18nContext, getInitialLocale, createI18nValue, type Locale } from '../lib/i18n';
import { notifyMounted } from '@/lib/mountState';
import { api } from '@/lib/api';

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>('en');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setLocale(getInitialLocale());
    setMounted(true);
    notifyMounted(true);
    return () => notifyMounted(false);
  }, []);

  // Recover from stale dynamic-import / chunk-load failures (commonly seen on
  // /pricing after a deploy). Force a single hard reload so the user gets the
  // current build instead of a blank page.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const STORAGE_KEY = 'cleya_chunk_reload_at';
    const RELOAD_COOLDOWN_MS = 30 * 1000;

    const isChunkError = (err: any) => {
      if (!err) return false;
      const name = err?.name || '';
      const msg = (err?.message || err?.reason?.message || '').toLowerCase();
      return name === 'ChunkLoadError'
        || msg.includes('chunkloaderror')
        || msg.includes('loading chunk')
        || msg.includes('failed to fetch dynamically imported module')
        || msg.includes('importing a module script failed');
    };

    const tryReload = () => {
      try {
        const last = Number(sessionStorage.getItem(STORAGE_KEY) || 0);
        if (Date.now() - last < RELOAD_COOLDOWN_MS) return;
        sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
      } catch { /* ignore */ }
      window.location.reload();
    };

    const onError = (e: ErrorEvent) => { if (isChunkError(e?.error || e)) tryReload(); };
    const onUnhandled = (e: PromiseRejectionEvent) => { if (isChunkError(e?.reason)) tryReload(); };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandled);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandled);
    };
  }, []);

  // Apply referral code from localStorage after login
  useEffect(() => {
    if (!mounted) return;
    const refCode = localStorage.getItem('cleya_ref');
    if (!refCode) return;
    api.applyReferralCode(refCode)
      .then(() => {
        localStorage.removeItem('cleya_ref');
      })
      .catch(() => {
        // User not logged in or referral already applied — ignore
      });
  }, [mounted]);

  const i18nValue = createI18nValue(locale, setLocale);

  return (
    <I18nContext.Provider value={i18nValue}>
      <ToastProvider>
        <UnverifiedEmailBanner />
        {children}
      </ToastProvider>
    </I18nContext.Provider>
  );
}
