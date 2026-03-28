'use client';
import Link from 'next/link';

export default function PublicNav() {
  return (
    <nav className="border-b border-white/[0.06]" style={{ background: 'rgba(11,9,24,0.85)', backdropFilter: 'blur(12px)' }} role="navigation" aria-label="Main navigation">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-cleya-400">
            <circle cx="8" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="16" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
            <line x1="11" y1="12" x2="13" y2="12" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <span className="text-white font-semibold text-lg tracking-tight">Cleya.ai</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/about" className="hidden sm:inline-block px-3 py-2 text-sm text-white/50 hover:text-white transition-colors">About</Link>
          <Link href="/features" className="hidden sm:inline-block px-3 py-2 text-sm text-white/50 hover:text-white transition-colors">Features</Link>
          <Link href="/contact" className="hidden sm:inline-block px-3 py-2 text-sm text-white/50 hover:text-white transition-colors">Contact</Link>
          <Link href="/?action=login" className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors">Log In</Link>
          <Link href="/" className="px-5 py-2.5 text-sm font-medium text-white rounded-[10px] transition-all hover:scale-[1.02]"
            style={{ background: '#0D9488', boxShadow: '0 0 20px rgba(13,148,136,0.2)' }}>
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  );
}
