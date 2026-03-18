'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0D0B1A' }}>
      <div className="text-center px-4">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center text-4xl"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
          ⚠️
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
        <p className="text-sm text-white/40 mb-8 max-w-sm mx-auto">
          An unexpected error occurred. Please try again or return to the dashboard.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => reset()}
            className="px-6 py-3 rounded-2xl text-sm font-medium text-white transition"
            style={{ background: 'linear-gradient(135deg, #0D9488, #0F766E)' }}>
            Try Again
          </button>
          <a href="/dashboard"
            className="px-6 py-3 rounded-2xl text-sm font-medium text-white/50 border border-white/10 hover:border-white/20 transition">
            Go to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
