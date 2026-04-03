'use client';

import { useEffect, useState } from 'react';
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
    <AppShell className="flex items-center justify-center">
      <div style={{ textAlign: 'center', padding: '0 1rem' }}>
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center text-4xl glass-card-glow">
          🔮
        </div>
        <h1 className="text-7xl font-bold gradient-text mb-2">404</h1>
        <p className="text-xl text-white/60 mb-2">Page not found</p>
        <p className="text-sm text-white/30 mb-8 max-w-sm mx-auto">
          The page you are looking for does not exist or has been moved.
        </p>
        <div className="flex flex-col gap-3 items-center">
          <a href={isLoggedIn ? '/dashboard' : '/'} className="inline-block px-6 py-3 rounded-2xl text-sm font-medium text-white bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] cta-shimmer">
            {isLoggedIn ? 'Go to Dashboard' : 'Go to Homepage'}
          </a>
          {isLoggedIn && (
            <a href="/" className="inline-block px-6 py-3 rounded-2xl text-sm font-medium text-white/50 border border-white/10 hover:border-white/20 transition">
              Back to Home
            </a>
          )}
        </div>
      </div>
    </AppShell>
  );
}
