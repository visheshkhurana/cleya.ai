'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { translations, type Locale } from './translations';

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const I18nContext = createContext<I18nContextType>({
  locale: 'en',
  setLocale: () => {},
});

export function useI18n() {
  return useContext(I18nContext);
}

export function useTranslation() {
  const { locale, setLocale } = useI18n();
  const t = useCallback(
    (key: string) => translations[locale]?.[key] || translations.en[key] || key,
    [locale]
  );
  return { t, locale, setLocale };
}

export function getInitialLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  const saved = localStorage.getItem('cleya_locale');
  if (saved === 'hi' || saved === 'en') return saved;
  const browserLang = navigator.language || (navigator as any).userLanguage || '';
  if (browserLang.startsWith('hi')) return 'hi';
  return 'en';
}

export function createI18nValue(locale: Locale, setLocaleState: (l: Locale) => void): I18nContextType {
  return {
    locale,
    setLocale: (newLocale: Locale) => {
      setLocaleState(newLocale);
      if (typeof window !== 'undefined') {
        localStorage.setItem('cleya_locale', newLocale);
        document.documentElement.lang = newLocale;
      }
    },
  };
}

export { type Locale } from './translations';
