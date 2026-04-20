'use client';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import AppShell from '@/components/AppShell';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'already' | 'error'>('loading');
  const [error, setError] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle');

  useEffect(() => {
    if (!token) { setStatus('error'); setError('Missing verification token. Please use the link from your verification email.'); return; }
    api.verifyEmail(token)
      .then((res) => {
        if (res?.alreadyVerified) setStatus('already');
        else setStatus('success');
      })
      .catch((err: Error & { code?: string }) => {
        const msg = (err?.message || '').toLowerCase();
        if (msg.includes('already')) { setStatus('already'); return; }
        setStatus('error');
        setError(err.message || 'This verification link is invalid or has expired.');
      });
  }, [token]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail) return;
    setResendState('sending');
    try { await api.resendVerification(resendEmail); } catch { /* generic response */ }
    setResendState('sent');
  };

  return (
    <AppShell>
      <div className="text-center max-w-sm">
        {status === 'loading' && (
          <>
            <div className="w-10 h-10 border-2 border-brand-teal border-t-transparent rounded-full animate-spin mx-auto mb-4" />
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
            <a href="/dashboard" className="inline-block px-6 py-2.5 rounded-lg text-sm font-medium text-white" style={{ background: '#6C63FF' }}>Go to Dashboard</a>
          </>
        )}
        {status === 'already' && (
          <>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.5)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2"><path d="M20 6L9 17l-5-5" /></svg>
            </div>
            <h1 className="text-xl font-semibold text-white mb-2">Already verified</h1>
            <p className="text-sm mb-6" style={{ color: '#94A3B8' }}>This email is already confirmed — you&apos;re good to go.</p>
            <a href="/dashboard" className="inline-block px-6 py-2.5 rounded-lg text-sm font-medium text-white" style={{ background: '#6C63FF' }}>Go to Dashboard</a>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: '#EF4444' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </div>
            <h1 className="text-xl font-semibold text-white mb-2">Verification Failed</h1>
            <p className="text-sm mb-4" style={{ color: '#94A3B8' }}>{error}</p>
            {resendState === 'sent' ? (
              <p className="text-sm mb-6" style={{ color: '#10B981' }}>If an account exists for that email and is unverified, a new link has been sent.</p>
            ) : (
              <form onSubmit={handleResend} className="mb-6 space-y-2 text-left">
                <label htmlFor="resend-email" className="block text-xs uppercase tracking-wide" style={{ color: '#94A3B8' }}>Resend verification link</label>
                <div className="flex gap-2">
                  <input id="resend-email" type="email" required value={resendEmail} onChange={e => setResendEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="flex-1 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} />
                  <button type="submit" disabled={resendState === 'sending'}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                    style={{ background: '#6C63FF' }}>
                    {resendState === 'sending' ? 'Sending…' : 'Resend'}
                  </button>
                </div>
              </form>
            )}
            <a href="/" className="inline-block px-6 py-2.5 rounded-lg text-sm font-medium text-white" style={{ background: '#6C63FF' }}>Back to Home</a>
          </>
        )}
      </div>
    </AppShell>
  );
}
