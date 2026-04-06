'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';

const navItems = [
  { href: '/dashboard', labelKey: 'nav.dashboard', icon: '📊' },
  { href: '/matches', labelKey: 'nav.matches', icon: '🤝' },
  { href: '/messages', labelKey: 'nav.messages', icon: '💬' },
  { href: '/introductions', labelKey: 'nav.introductions', icon: '📨' },
  { href: '/secretary', labelKey: 'nav.secretary', icon: '🤖' },
  { href: '/chat', labelKey: 'nav.onboardingChat', icon: '💭' },
  { href: '/profile', labelKey: 'nav.profile', icon: '👤' },
  { href: '/settings', labelKey: 'nav.settings', icon: '⚙️' },
];

export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      closeRef.current?.focus();
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (toggleRef.current && toggleRef.current.contains(e.target as Node)) return;
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      toggleRef.current?.focus();
    }
    if (e.key === 'Tab' && drawerRef.current) {
      const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  }, []);

  useEffect(() => {
    if (open) document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, handleKeyDown]);

  return (
    <>
      <button
        ref={toggleRef}
        onClick={() => setOpen(!open)}
        className="flex flex-col gap-1.5 p-2 -m-2"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        aria-controls="mobile-nav-drawer"
      >
        <span className={`block w-5 h-0.5 bg-white/60 transition-all duration-200 ${open ? 'rotate-45 translate-y-2' : ''}`} />
        <span className={`block w-5 h-0.5 bg-white/60 transition-all duration-200 ${open ? 'opacity-0' : ''}`} />
        <span className={`block w-5 h-0.5 bg-white/60 transition-all duration-200 ${open ? '-rotate-45 -translate-y-2' : ''}`} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          <div
            ref={drawerRef}
            id="mobile-nav-drawer"
            className="absolute top-0 right-0 w-72 h-full border-l border-white/5 overflow-y-auto"
            style={{ background: '#050510' }}
          >
            <div className="flex items-center justify-between p-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                  style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}>C</div>
                <span className="text-white font-semibold text-sm">Cleya.ai</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  ref={closeRef}
                  onClick={() => { setOpen(false); toggleRef.current?.focus(); }}
                  className="text-white/40 hover:text-white/70 transition p-1"
                  aria-label="Close menu"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <nav className="p-3 space-y-1" aria-label="Main navigation">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <button
                    key={item.href}
                    onClick={() => router.push(item.href)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition ${
                      isActive ? 'text-white' : 'text-white/50 hover:text-white/80'
                    }`}
                    style={isActive ? { background: 'rgba(59,130,246,0.12)', borderLeft: '2px solid #3B82F6' } : {}}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <span className="text-base" aria-hidden="true">{item.icon}</span>
                    {t(item.labelKey)}
                  </button>
                );
              })}
            </nav>

            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/5">
              <button
                onClick={() => { api.logout().then(() => router.push('/')); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-400/60 hover:text-red-400 hover:bg-red-500/5 transition"
              >
                <span className="text-base" aria-hidden="true">🚪</span>
                {t('nav.signOut')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
