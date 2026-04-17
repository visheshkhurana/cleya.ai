'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import LanguageSwitcher from './LanguageSwitcher';

const NAV_LINKS = [
  { href: '/about', label: 'About' },
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/blog', label: 'Blog' },
  { href: '/contact', label: 'Contact' },
];

export default function PublicNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = open ? 'hidden' : '';
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    if (open) window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  return (
    <>
      <nav className="border-b border-white/[0.06] relative z-50" style={{ background: 'rgba(11,9,24,0.85)', backdropFilter: 'blur(12px)' }} role="navigation" aria-label="Main navigation">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 py-4 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6C63FF, #4ECDC4)' }}>
              <span className="text-white font-bold text-sm">C</span>
            </div>
            <span className="text-white font-bold text-lg tracking-tight">Cleya.ai</span>
          </Link>
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(link => (
              <Link key={link.href} href={link.href}
                className={`px-3 py-2 text-sm transition-colors rounded-lg hover:bg-white/[0.03] ${pathname === link.href ? 'text-white' : 'text-white/50 hover:text-white'}`}>
                {link.label}
              </Link>
            ))}
          </div>
          <div className="hidden md:flex items-center gap-3">
            <LanguageSwitcher />
            <Link href="/?action=login" className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors">Log In</Link>
            <Link href="/?action=signup" className="px-5 py-2.5 text-sm font-medium text-white rounded-full transition-all hover:scale-[1.02]"
              style={{ background: 'linear-gradient(135deg, #6C63FF, #4ECDC4)', boxShadow: '0 0 20px rgba(108,99,255,0.2)' }}>
              Get Started
            </Link>
          </div>
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="public-mobile-drawer"
            className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition"
          >
            {open ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
            )}
          </button>
        </div>
      </nav>

      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden="true"
        className={`md:hidden fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      />

      {/* Slide-in drawer */}
      <aside
        id="public-mobile-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Mobile menu"
        className={`md:hidden fixed top-0 right-0 z-[70] h-full w-[82%] max-w-sm transform transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ background: 'rgba(8,13,26,0.98)', backdropFilter: 'blur(16px)', borderLeft: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <span className="text-white font-bold text-lg">Cleya.ai</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="inline-flex items-center justify-center w-11 h-11 rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="px-5 py-4 flex flex-col gap-1 overflow-y-auto" style={{ maxHeight: 'calc(100% - 73px)' }}>
          {NAV_LINKS.map(link => (
            <Link key={link.href} href={link.href}
              className={`px-3 py-3 rounded-lg text-sm min-h-[44px] flex items-center transition-colors ${pathname === link.href ? 'text-white bg-white/[0.05]' : 'text-white/70 hover:text-white hover:bg-white/[0.04]'}`}>
              {link.label}
            </Link>
          ))}
          <div className="h-px bg-white/[0.06] my-3" />
          <div className="px-1 pb-3">
            <p className="text-xs uppercase tracking-wide mb-2" style={{ color: '#94A3B8' }}>Language</p>
            <LanguageSwitcher />
          </div>
          <div className="h-px bg-white/[0.06] my-1" />
          <Link href="/?action=login" className="px-3 py-3 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/[0.04] min-h-[44px] flex items-center">Log In</Link>
          <Link href="/?action=signup"
            className="px-3 py-3 rounded-lg text-sm font-medium text-white text-center min-h-[44px] flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #6C63FF, #4ECDC4)' }}>
            Get Started
          </Link>
        </div>
      </aside>
    </>
  );
}
