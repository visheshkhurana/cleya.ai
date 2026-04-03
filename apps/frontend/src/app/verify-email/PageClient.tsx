'use client';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import AppShell from '@/components/AppShell';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) { setStatus('error'); setError('Missing verification token'); return; }
    api.verifyEmail(token)
      .then(() => setStatus('success'))
      .catch((err: any) => { setStatus('error'); setError(err.message || 'Verification failed'); });
  }, [token]);

  return (
    <AppShell>
      <div className="text-center max-w-sm">
        {status === 'loading' && (
          <>
            <div className="w-10 h-10 border-2 border-cleya-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white">Verifying your email...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: '#10B981' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M20 6L9 17l-5-5" /></svg>
            </div>
            <h1 className="text-xl font-semibold text-white mb-2">Email Verified!</h1>
            <p className="text-sm mb-6" style={{ color: '#94A3B8' }}>Your email has been verified successfully.</p>
            <a href="/dashboard" className="inline-block px-6 py-2.5 rounded-lg text-sm font-medium text-white" style={{ background: '#3B82F6' }}>Go to Dashboard</a>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: '#EF4444' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </div>
            <h1 className="text-xl font-semibold text-white mb-2">Verification Failed</h1>
            <p className="text-sm mb-6" style={{ color: '#94A3B8' }}>{error}</p>
            <a href="/" className="inline-block px-6 py-2.5 rounded-lg text-sm font-medium text-white" style={{ background: '#3B82F6' }}>Back to Home</a>
          </>
        )}
      </div>
    </AppShell>
  );
}
