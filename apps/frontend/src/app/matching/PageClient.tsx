'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import AppNav from '@/components/AppNav';
import AppFooter from '@/components/AppFooter';
import NotificationCenter from '@/components/NotificationCenter';
import { useTranslation } from '@/lib/i18n';
import { api } from '@/lib/api';
import { analytics } from '@/lib/posthog';

/**
 * Dedicated "We are matching you" screen shown immediately after the user
 * submits their final onboarding answer. Replaces the previous behaviour of
 * dropping the user onto an empty dashboard with no feedback.
 *
 * Animation is CSS-only (no Lottie dependency) — three concentric pulsing
 * rings around the brand mark match the rest of our design language.
 */
export default function MatchingPageClient() {
  const router = useRouter();
  const { t } = useTranslation();

  useEffect(() => {
    // Soft auth check — if not signed in, bounce to login
    api.getMe().then((user) => {
      if (!user) {
        router.push('/?action=login');
        return;
      }
      analytics.pageView('matching');
    }).catch(() => {
      router.push('/?action=login');
    });
  }, [router]);

  return (
    <AppShell className="flex flex-col">
      <AppNav rightContent={<NotificationCenter />} />
      <div
        className="flex flex-col items-center justify-center px-6 text-center"
        style={{ minHeight: 'calc(100dvh - 52px)' }}
      >
        <div className="max-w-md mx-auto">
          {/* Animated rings + brand mark */}
          <div className="relative w-32 h-32 mx-auto mb-10">
            <span
              className="absolute inset-0 rounded-full match-ring match-ring-1"
              style={{ background: 'radial-gradient(circle, rgba(108,99,255,0.35), transparent 70%)' }}
            />
            <span
              className="absolute inset-0 rounded-full match-ring match-ring-2"
              style={{ background: 'radial-gradient(circle, rgba(78,205,196,0.30), transparent 70%)' }}
            />
            <span
              className="absolute inset-0 rounded-full match-ring match-ring-3"
              style={{ background: 'radial-gradient(circle, rgba(255,107,157,0.25), transparent 70%)' }}
            />
            <div
              className="absolute inset-6 rounded-2xl flex items-center justify-center text-white font-bold text-3xl"
              style={{
                background: 'linear-gradient(135deg, #6C63FF, #4ECDC4)',
                boxShadow: '0 12px 40px rgba(108,99,255,0.45)',
              }}
            >
              C
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3">
            {t('matching.title')}
          </h1>
          <p className="text-sm text-white/60 mb-2 leading-relaxed">
            {t('matching.subtitle')}
          </p>
          <p className="text-xs text-white/35 mb-8 leading-relaxed">
            {t('matching.eta')}
          </p>

          <button
            onClick={() => router.push('/dashboard')}
            className="px-7 py-3.5 rounded-2xl font-semibold text-white text-sm transition-all duration-200 hover:scale-105 hover:shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #6C63FF, #4ECDC4)',
              boxShadow: '0 4px 20px rgba(108,99,255,0.35)',
            }}
          >
            {t('matching.goToDashboard')}
          </button>
          <button
            onClick={() => router.push('/chat')}
            className="block mx-auto mt-4 text-xs text-white/35 hover:text-white/60 transition"
          >
            {t('matching.orChatWithCleya')}
          </button>
        </div>
      </div>
      <AppFooter />

      <style jsx>{`
        .match-ring {
          opacity: 0;
          transform: scale(0.4);
          animation: matchPulse 2.4s ease-out infinite;
        }
        .match-ring-2 {
          animation-delay: 0.8s;
        }
        .match-ring-3 {
          animation-delay: 1.6s;
        }
        @keyframes matchPulse {
          0% { transform: scale(0.4); opacity: 0; }
          20% { opacity: 0.9; }
          100% { transform: scale(1.4); opacity: 0; }
        }
      `}</style>
    </AppShell>
  );
}
