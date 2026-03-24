'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface InviteInfo {
  valid: boolean;
  inviterName?: string;
  inviterTitle?: string;
}

export default function JoinPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedPersona, setSelectedPersona] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.getMe().then((user) => {
      if (user) { router.push('/dashboard'); return; }
    }).catch(() => {});
    fetch(`/api/invites/validate/${code}`)
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data?.valid) {
          setInviteInfo({ valid: true, inviterName: d.data.inviterName, inviterTitle: d.data.inviterTitle });
        } else {
          setInviteInfo({ valid: false });
        }
      })
      .catch(() => setInviteInfo({ valid: false }))
      .finally(() => setLoading(false));
  }, [code, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!consent) { setError('Please agree to the Terms of Service and Privacy Policy'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (!/[0-9]/.test(password)) { setError('Password must contain at least one number'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }

    setSubmitting(true);
    try {
      await api.signup(email, password, undefined, {}, fullName || undefined, selectedPersona || undefined);
      try {
        await api.useInviteCode(code);
      } catch {}
      window.location.href = '/chat';
    } catch (err: any) {
      if (err.details) {
        setError(err.details.map((d: any) => d.message).join('. '));
      } else {
        setError(err.message || 'Something went wrong');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0F172A' }}>
        <div className="w-10 h-10 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!inviteInfo?.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#0F172A' }}>
        <div className="max-w-md w-full text-center rounded-2xl border border-white/[0.08] p-8" style={{ background: 'rgba(30,41,59,0.95)' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(239,68,68,0.1)' }}>
            <span className="text-2xl">🔗</span>
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Invalid Invite Link</h1>
          <p className="text-sm mb-6" style={{ color: '#94A3B8' }}>
            This invite code is invalid or has already been used.
          </p>
          <a href="/" className="inline-block px-6 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:scale-[1.02]"
            style={{ background: '#0D9488' }}>
            Go to Homepage
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#0F172A' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3"
            style={{ background: '#0D9488', boxShadow: '0 0 30px rgba(13,148,136,0.3)' }}>
            <span className="text-white text-xl font-bold">C</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-white mb-1">You&apos;re invited to Cleya</h1>
          {inviteInfo.inviterName && (
            <p className="text-sm" style={{ color: '#94A3B8' }}>
              <span style={{ color: '#5EEAD4' }}>{inviteInfo.inviterName}</span>
              {inviteInfo.inviterTitle ? ` (${inviteInfo.inviterTitle})` : ''} thinks you should join India&apos;s AI networking community.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-white/[0.08] p-8" style={{ background: 'rgba(30,41,59,0.95)', backdropFilter: 'blur(20px)' }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#94A3B8' }}>Full Name</label>
              <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                placeholder="Your full name" className="input-dark" autoComplete="name" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#94A3B8' }}>I am a</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'FOUNDER', label: 'Founder', icon: '🚀' },
                  { value: 'INVESTOR', label: 'Investor', icon: '💰' },
                  { value: 'TALENT', label: 'Talent', icon: '⚡' },
                ].map((p) => (
                  <button key={p.value} type="button" onClick={() => setSelectedPersona(p.value)}
                    className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl border transition-all duration-200"
                    style={{
                      background: selectedPersona === p.value ? 'rgba(13,148,136,0.15)' : 'rgba(255,255,255,0.03)',
                      borderColor: selectedPersona === p.value ? '#0D9488' : 'rgba(255,255,255,0.08)',
                    }}>
                    <span className="text-lg">{p.icon}</span>
                    <span className="text-xs font-medium" style={{ color: selectedPersona === p.value ? '#5EEAD4' : '#94A3B8' }}>{p.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#94A3B8' }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" required className="input-dark" autoFocus />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#94A3B8' }}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Min 8 chars, letter + number" required minLength={8} className="input-dark" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#94A3B8' }}>Confirm Password</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password" className="input-dark" />
              {confirmPassword && password !== confirmPassword && (
                <p className="text-[10px] mt-1 text-red-400">Passwords do not match</p>
              )}
            </div>
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-0.5 rounded border-white/20 bg-white/5 accent-teal-600" />
              <span className="text-xs leading-relaxed" style={{ color: '#94A3B8' }}>
                I agree to the <a href="/terms" target="_blank" className="underline" style={{ color: '#5EEAD4' }}>Terms of Service</a> and <a href="/privacy" target="_blank" className="underline" style={{ color: '#5EEAD4' }}>Privacy Policy</a>
              </span>
            </label>
            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>
            )}
            <button type="submit" disabled={submitting} className="btn-primary mt-2">
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating account...
                </span>
              ) : 'Join Cleya →'}
            </button>
          </form>
          <p className="text-center text-xs mt-4" style={{ color: '#94A3B8' }}>
            Already have an account? <a href="/?action=login" className="font-medium" style={{ color: '#5EEAD4' }}>Log in</a>
          </p>
        </div>
      </div>
    </div>
  );
}
