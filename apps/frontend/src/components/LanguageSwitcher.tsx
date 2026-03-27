'use client';

import { useTranslation } from '../lib/i18n';
import type { Locale } from '../lib/i18n';

export default function LanguageSwitcher() {
  const { locale, setLocale } = useTranslation();

  const toggleLocale = () => {
    const next: Locale = locale === 'en' ? 'hi' : 'en';
    setLocale(next);
  };

  return (
    <button
      onClick={toggleLocale}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 hover:bg-white/10"
      style={{
        color: 'rgba(255,255,255,0.7)',
        border: '1px solid rgba(255,255,255,0.15)',
      }}
      aria-label={locale === 'en' ? 'Switch to Hindi' : 'Switch to English'}
      title={locale === 'en' ? 'हिंदी में बदलें' : 'Switch to English'}
    >
      <span className="text-sm">{locale === 'en' ? '🇮🇳' : '🇬🇧'}</span>
      <span>{locale === 'en' ? 'हिं' : 'EN'}</span>
    </button>
  );
}
