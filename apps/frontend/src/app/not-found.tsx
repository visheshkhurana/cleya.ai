'use client';

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0D0B1A' }}>
      <div className="text-center px-4">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center text-4xl"
          style={{ background: 'linear-gradient(135deg, #6C47FF15, #4E2FD815)', border: '1px solid rgba(108,71,255,0.12)' }}>
          🔮
        </div>
        <h1 className="text-6xl font-bold text-white mb-2">404</h1>
        <p className="text-xl text-white/60 mb-2">Page not found</p>
        <p className="text-sm text-white/30 mb-8 max-w-sm mx-auto">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/dashboard"
            className="px-6 py-3 rounded-2xl text-sm font-medium text-white transition"
            style={{ background: 'linear-gradient(135deg, #6C47FF, #4E2FD8)' }}>
            Go to Dashboard
          </Link>
          <Link href="/"
            className="px-6 py-3 rounded-2xl text-sm font-medium text-white/50 border border-white/10 hover:border-white/20 transition">
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
