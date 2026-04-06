'use client';

import { useRouter, usePathname } from 'next/navigation';
import MobileNav from './MobileNav';
import LanguageSwitcher from './LanguageSwitcher';
import { useTranslation } from '@/lib/i18n';

const navItems = [
  { href: '/dashboard', labelKey: 'nav.dashboard' },
  { href: '/matches', labelKey: 'nav.matches' },
  { href: '/introductions', labelKey: 'nav.introductions' },
  { href: '/chat', labelKey: 'nav.chat' },
  { href: '/profile', labelKey: 'nav.profile' },
  { href: '/settings', labelKey: 'nav.settings' },
];

interface AppNavProps {
  rightContent?: React.ReactNode;
}

export default function AppNav({ rightContent }: AppNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <header className="glass-header">
      <div className="max-w-5xl mx-auto w-full flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2.5 hover:opacity-90 transition">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold"
              style={{ background: '#6C63FF' }}>
              C
            </div>
            <span className="font-semibold text-white text-[13px] hidden sm:inline">Cleya.ai</span>
          </button>
        </div>
        <div className="hidden md:flex items-center gap-1">
          {navItems.map(item => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={`px-3 py-1.5 text-[13px] rounded-lg transition ${
                  isActive
                    ? 'text-white font-medium'
                    : 'text-white/40 hover:text-white/70 border border-transparent hover:border-white/8'
                }`}
                style={isActive ? { background: 'rgba(108,99,255,0.12)', border: '1px solid rgba(108,99,255,0.25)' } : {}}
              >
                {t(item.labelKey)}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          {rightContent}
          <div className="md:hidden"><MobileNav /></div>
        </div>
      </div>
    </header>
  );
}
