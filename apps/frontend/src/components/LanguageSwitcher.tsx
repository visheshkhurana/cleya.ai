'use client';

import { useTranslation } from '../lib/i18n';
import type { Locale } from '../lib/i18n';

export default function LanguageSwitcher() {
  const { locale, setLocale } = useTranslation();

  const toggleLocale = () => {
    const next: Locale = locale === 'en' ? 'hi' : 'en';
    setLocale(next);
  };

  const flag = locale === 'en' ? '\u{1F1EE}\u{1F1F3}' : '\u{1F1EC}\u{1F1E7}';
  const label = locale === 'en' ? '\u0939\u093F\u0902' : 'EN';

  return (
    <button
      onClick={toggleLocale}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 hover:bg-white/10"
      style={{
        color: 'rgba(255,255,255,0.7)',
        border: '1px solid rgba(255,255,255,0.15)',
      }}
      aria-label={locale === 'en' ? 'Switch to Hindi' : 'Switch to English'}
      title={locale === 'en' ? '\u0939\u093F\u0902\u0926\u0940 \u092E\u0947\u0902 \u092C\u0926\u0932\u0947\u0902' : 'Switch to English'}
    >
      <span className="text-sm">{flag}</span>
      <span>{label}</span>
    </button>
  );
}
