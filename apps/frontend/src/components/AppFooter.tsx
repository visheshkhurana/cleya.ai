'use client';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';

export default function AppFooter() {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-white/[0.04] py-10 mt-auto" style={{ background: '#080D1A' }}>
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-8">
          <div className="col-span-2 sm:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-3">
              <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: '#6C63FF' }}>
                <span className="text-white font-bold text-[10px]">C</span>
              </div>
              <span className="text-white/50 font-medium text-xs">Cleya.ai</span>
            </Link>
            <p className="text-xs sm:text-[11px] leading-relaxed text-muted">
              {t('footer.tagline')}
            </p>
          </div>

          <div>
            <h4 className="text-label font-semibold text-white/30 uppercase tracking-wider mb-3">{t('footer.navigate')}</h4>
            <div className="space-y-2">
              {[
                { label: t('nav.dashboard'), href: '/dashboard' },
                { label: t('nav.matches'), href: '/matches' },
                { label: t('nav.profile'), href: '/profile' },
                { label: t('nav.introductions'), href: '/introductions' },
              ].map((link) => (
                <Link key={link.href} href={link.href} className="block text-xs sm:text-[11px] text-muted transition-colors hover:text-white/60 py-2 sm:py-1 min-h-[44px] sm:min-h-0 flex items-center">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-label font-semibold text-white/30 uppercase tracking-wider mb-3">{t('footer.product')}</h4>
            <div className="space-y-2">
              {[
                { label: t('nav.features'), href: '/features' },
                { label: t('nav.pricing'), href: '/pricing' },
                { label: t('nav.about'), href: '/about' },
                { label: t('nav.blog'), href: '/blog' },
              ].map((link) => (
                <Link key={link.href} href={link.href} className="block text-xs sm:text-[11px] text-muted transition-colors hover:text-white/60 py-2 sm:py-1 min-h-[44px] sm:min-h-0 flex items-center">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-label font-semibold text-white/30 uppercase tracking-wider mb-3">{t('footer.company')}</h4>
            <div className="space-y-2">
              {[
                { label: t('nav.contact'), href: '/contact' },
                { label: t('footer.privacyPolicy'), href: '/privacy' },
                { label: t('footer.termsOfService'), href: '/terms' },
              ].map((link) => (
                <Link key={link.href} href={link.href} className="block text-xs sm:text-[11px] text-muted transition-colors hover:text-white/60 py-2 sm:py-1 min-h-[44px] sm:min-h-0 flex items-center">
                  {link.label}
                </Link>
              ))}
              <a href="mailto:hello@cleya.ai" className="block text-xs sm:text-[11px] text-muted transition-colors hover:text-white/60 py-2 sm:py-1 min-h-[44px] sm:min-h-0 flex items-center">
                hello@cleya.ai
              </a>
              <button
                type="button"
                onClick={() => { if (typeof window !== 'undefined' && window.openCookiePreferences) window.openCookiePreferences(); }}
                className="block text-[11px] text-muted transition-colors hover:text-white/60 text-left"
              >
                Cookie preferences
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-white/[0.04] pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs sm:text-[11px] text-muted">
            {t('footer.copyright')}
          </p>
          <p className="text-xs sm:text-[11px] text-muted">
            {t('footer.location')}
          </p>
        </div>
      </div>
    </footer>
  );
}
