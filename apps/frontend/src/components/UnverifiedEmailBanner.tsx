'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Status = 'idle' | 'sending' | 'sent' | 'error';

export default function UnverifiedEmailBanner() {
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  useEffect(() => {
    let cancelled = false;
    api
      .getMe()
      .then((me: any) => {
        if (cancelled) return;
        if (me && me.emailVerified === false) {
          setEmail(me.email || '');
          setShow(true);
        }
      })
      .catch(() => { /* not logged in */ });
    return () => { cancelled = true; };
  }, []);

  if (!show) return null;

  const onResend = async () => {
    if (!email) return;
    setStatus('sending');
    try {
      await api.resendVerification(email);
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  };

  return (
    <div
      role="status"
      className="w-full px-4 py-2 text-sm flex flex-wrap items-center justify-center gap-3"
      style={{ background: 'rgba(234,179,8,0.12)', borderBottom: '1px solid rgba(234,179,8,0.35)', color: '#FDE68A' }}
    >
      <span>
        Please verify your email{email ? ` (${email})` : ''} to unlock matches and messaging.
      </span>
      {status === 'sent' ? (
        <span style={{ color: '#86EFAC' }}>Verification email sent — check your inbox.</span>
      ) : (
        <button
          type="button"
          onClick={onResend}
          disabled={status === 'sending'}
          className="underline hover:text-white disabled:opacity-60"
        >
          {status === 'sending' ? 'Sending…' : 'Resend verification email'}
        </button>
      )}
      {status === 'error' && <span style={{ color: '#FCA5A5' }}>Something went wrong. Try again later.</span>}
    </div>
  );
}
