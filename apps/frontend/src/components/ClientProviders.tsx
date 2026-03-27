'use client';

import { useState, useEffect } from 'react';
import { ToastProvider } from './Toast';
import { I18nContext, getInitialLocale, createI18nValue, type Locale } from '../lib/i18n';

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>('en');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setLocale(getInitialLocale());
    setMounted(true);
  }, []);

  const i18nValue = createI18nValue(locale, setLocale);

  return (
    <I18nContext.Provider value={i18nValue}>
      <ToastProvider>{children}</ToastProvider>
    </I18nContext.Provider>
  );
}
