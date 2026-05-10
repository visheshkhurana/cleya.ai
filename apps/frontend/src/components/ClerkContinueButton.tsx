'use client';

import { useEffect, useRef, useState } from 'react';
import { useClerk, useSession, useUser } from '@clerk/nextjs';
import { api } from '@/lib/api';
import { trackSignupComplete } from '@/lib/meta-pixel';

interface Props {
  mode: 'login' | 'signup';
  onSuccess: () => void;
  onError: (msg: string) => void;
}

export default function ClerkContinueButton({ mode, onSuccess, onError }: Props) {
  const { openSignIn, openSignUp, signOut } = useClerk();
  const { session, isLoaded } = useSession();
  const { user } = useUser();
  const [waiting, setWaiting] = useState(false);
  const exchangedRef = useRef(false);

  useEffect(() => {
    if (!waiting || !isLoaded || !session) return;
    if (exchangedRef.current) return;
    exchangedRef.current = true;
    (async () => {
      try {
        const token = await session.getToken();
        if (!token) throw new Error('No Clerk session token');
        const result = await api.clerkExchange(token);
        api.setToken(result.token || 'authenticated');
        // Fire Meta Pixel CompleteRegistration only for genuinely new
        // signups: mode='signup' AND the Clerk user was created within
        // the last ~2 minutes. Avoids inflating conversion counts when
        // existing users hit the signup CTA.
        if (mode === 'signup' && user?.createdAt) {
          const ageMs = Date.now() - new Date(user.createdAt).getTime();
          if (ageMs < 2 * 60_000) {
            trackSignupComplete({
              user_id: user.id,
              email: user.primaryEmailAddress?.emailAddress,
            });
          }
        }
        setWaiting(false);
        onSuccess();
      } catch (err) {
        setWaiting(false);
        exchangedRef.current = false;
        try { await signOut(); } catch {}
        const message = err instanceof Error ? err.message : 'Clerk sign-in failed';
        onError(message);
      }
    })();
  }, [waiting, isLoaded, session, user, mode, onSuccess, onError, signOut]);

  const handleClick = async () => {
    exchangedRef.current = false;
    setWaiting(true);
    if (session) {
      try { await signOut(); } catch {}
    }
    if (mode === 'signup') {
      openSignUp({});
    } else {
      openSignIn({});
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={waiting}
      className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-white/[0.06] text-sm text-white/60 hover:text-white hover:border-white/10 transition-all disabled:opacity-60"
      style={{ background: 'rgba(255,255,255,0.02)' }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="3" fill="currentColor" />
      </svg>
      {waiting ? 'Signing in…' : 'Continue with Clerk'}
    </button>
  );
}
