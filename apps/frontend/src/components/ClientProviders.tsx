'use client';

import { useState, useEffect } from 'react';
import { ToastProvider } from './Toast';
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
      <ToastProvider>{children}</ToastProvider>
    </I18nContext.Provider>
  );
}
