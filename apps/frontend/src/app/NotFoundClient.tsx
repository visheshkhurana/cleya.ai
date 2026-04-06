'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';

export default function NotFoundClient() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    try {
      const token = localStorage.getItem('token') || document.cookie.includes('token=');
      setIsLoggedIn(!!token);
    } catch {}
  }, []);

  return (
    <AppShell className="flex flex-col">
      <nav className="border-b border-white/[0.06] relative z-20" style={{ background: 'rgba(11,9,24,0.85)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6C63FF, #4ECDC4)' }}>
              <span className="text-white font-bold text-sm">C</span>
            </div>
            <span className="text-white font-bold text-lg tracking-tight">Cleya.ai</span>
          </Link>
          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <>
                <Link href="/dashboard" className="px-3 py-2 text-sm text-white/50 hover:text-white transition-colors">Dashboard</Link>
                <Link href="/matches" className="px-3 py-2 text-sm text-white/50 hover:text-white transition-colors">Matches</Link>
              </>
            ) : (
              <>
                <Link href="/about" className="hidden sm:inline-block px-3 py-2 text-sm text-white/50 hover:text-white transition-colors">About</Link>
                <Link href="/features" className="hidden sm:inline-block px-3 py-2 text-sm text-white/50 hover:text-white transition-colors">Features</Link>
                <Link href="/?action=login" className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors">Log In</Link>
                <Link href="/?action=signup" className="px-5 py-2.5 text-sm font-medium text-white rounded-full transition-all hover:scale-[1.02]"
                  style={{ background: 'linear-gradient(135deg, #6C63FF, #4ECDC4)', boxShadow: '0 0 20px rgba(108,99,255,0.2)' }}>
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <div className="flex-1 flex items-center justify-center" style={{ textAlign: 'center', padding: '0 1rem' }}>
        <div>
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center text-4xl glass-card-glow">
            🔮
          </div>
          <h1 className="text-7xl font-bold gradient-text mb-2">404</h1>
          <p className="text-xl text-white/60 mb-2">Page not found</p>
          <p className="text-sm text-white/40 mb-8 max-w-sm mx-auto">
            The page you are looking for does not exist or has been moved.
          </p>
          <div className="flex flex-col gap-3 items-center">
            <a href={isLoggedIn ? '/dashboard' : '/'} className="inline-block px-6 py-3 rounded-2xl text-sm font-medium text-white bg-gradient-to-r from-[#6C63FF] to-[#4ECDC4] cta-shimmer">
              {isLoggedIn ? 'Go to Dashboard' : 'Go to Homepage'}
            </a>
            {isLoggedIn && (
              <a href="/" className="inline-block px-6 py-3 rounded-2xl text-sm font-medium text-white/50 border border-white/10 hover:border-white/20 transition">
                Back to Home
              </a>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
