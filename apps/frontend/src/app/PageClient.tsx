'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function Home() {
  const [showAuth, setShowAuth] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get('token');
      const urlError = params.get('error');
      if (urlToken) {
        api.setToken(urlToken);
        window.history.replaceState({}, '', '/');
      }
      if (urlError) {
        setError('Google sign-in failed. Please try again or use email.');
        setShowAuth(true);
        window.history.replaceState({}, '', '/');
      }
    }
    api.getGoogleAuthStatus().then(d => setGoogleEnabled(d.enabled)).catch(() => {});
    const token = api.getToken();
    if (token) {
      api.getMe().then(async (user) => {
        if (user?.role === 'ADMIN') {
          window.location.href = '/admin';
        } else {
          const profile = await api.getProfile().catch(() => null);
          if (profile?.isComplete) {
            window.location.href = '/dashboard';
          } else {
            window.location.href = '/chat';
          }
        }
      }).catch(() => {
        setChecking(false);
      });
    } else {
      setChecking(false);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'signup') {
        await api.signup(email, password);
        window.location.href = '/chat';
      } else {
        const data = await api.login(email, password);
        const profile = await api.getProfile().catch(() => null);
        if (data.user?.role === 'ADMIN') {
          window.location.href = '/admin';
        } else if (profile?.isComplete) {
          window.location.href = '/dashboard';
        } else {
          window.location.href = '/chat';
        }
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0D0B1A' }}>
        <div className="w-10 h-10 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const features = [
    { icon: '🤖', title: 'AI-Powered Matching', desc: 'Intelligent algorithms find your ideal connections based on goals, industry, and experience.' },
    { icon: '🔒', title: 'Secure Introductions', desc: 'Both parties must accept before any contact info is shared. Your privacy comes first.' },
    { icon: '👥', title: 'Multi-Persona Support', desc: 'Whether you\'re a founder, investor, talent, or advisor — Cleo speaks your language.' },
    { icon: '⚡', title: 'Real-Time Notifications', desc: 'Get notified instantly when someone wants to connect or when a match is made.' },
    { icon: '📊', title: 'Deal Tracking', desc: 'Track introductions from first meeting to closed deal with built-in pipeline management.' },
    { icon: '🎪', title: 'Event Networking', desc: 'Join curated events and get matched with the most relevant attendees before you arrive.' },
  ];

  const steps = [
    { num: '01', title: 'Tell Cleo about yourself', desc: 'Have a quick AI-powered conversation. Cleo learns your goals, expertise, and what you\'re looking for.' },
    { num: '02', title: 'AI matches you with the right people', desc: 'Our matching engine analyzes hundreds of signals to find your most valuable connections.' },
    { num: '03', title: 'Get introduced and connect', desc: 'Review matches, accept intros, and start building relationships that matter.' },
  ];

  return (
    <div className="min-h-screen" style={{ background: '#0D0B1A' }}>
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5" style={{ background: 'rgba(13,11,26,0.85)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold"
              style={{ background: 'linear-gradient(135deg, #6C47FF, #4E2FD8)' }}>C</div>
            <span className="text-white font-semibold text-lg">Cleo.ai</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button onClick={() => { setShowAuth(true); setMode('login'); }}
              className="px-3 sm:px-4 py-2 text-xs sm:text-sm text-white/60 hover:text-white transition">Log In</button>
            <button onClick={() => { setShowAuth(true); setMode('signup'); }}
              className="px-4 sm:px-5 py-2 text-xs sm:text-sm font-medium text-white rounded-xl transition"
              style={{ background: 'linear-gradient(135deg, #6C47FF, #4E2FD8)' }}>Get Started</button>
          </div>
        </div>
      </nav>

      <section className="relative pt-24 sm:pt-32 pb-16 sm:pb-24 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full opacity-20 blur-[150px] pointer-events-none" style={{ background: '#6C47FF' }} />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full opacity-10 blur-[120px] pointer-events-none" style={{ background: '#4E2FD8' }} />
        <div className="absolute top-20 left-10 w-[300px] h-[300px] rounded-full opacity-10 blur-[100px] pointer-events-none" style={{ background: '#2D1899' }} />

        <div className="relative max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="fade-up">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-6 border"
                style={{ background: 'rgba(108,71,255,0.08)', borderColor: 'rgba(108,71,255,0.2)', color: '#a78bfa' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                AI-Powered Networking
              </div>
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-4 sm:mb-6">
                Meet the right people. <span style={{ color: '#a78bfa' }}>Faster.</span>
              </h1>
              <p className="text-base sm:text-lg text-white/50 leading-relaxed mb-6 sm:mb-8 max-w-lg">
                Cleo is your AI Superconnector — matching founders, investors, talent, and partners through intelligent conversations.
              </p>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                <button onClick={() => { setShowAuth(true); setMode('signup'); }}
                  className="px-6 sm:px-8 py-3 sm:py-3.5 rounded-2xl text-white font-semibold text-sm transition-all duration-200 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40"
                  style={{ background: 'linear-gradient(135deg, #6C47FF, #4E2FD8)' }}>
                  Get Started →
                </button>
                <button onClick={() => { setShowAuth(true); setMode('login'); }}
                  className="px-6 py-3.5 rounded-2xl text-white/60 font-medium text-sm border border-white/10 hover:border-white/20 hover:text-white/80 transition">
                  Log In
                </button>
              </div>
            </div>

            <div className="relative hidden lg:flex justify-center">
              <div className="relative w-[280px] rounded-[40px] border-[6px] p-2 shadow-2xl shadow-purple-900/30"
                style={{ borderColor: 'rgba(255,255,255,0.1)', background: '#0D0B1A' }}>
                <div className="w-20 h-5 bg-black rounded-full absolute top-2 left-1/2 -translate-x-1/2 z-10" />
                <div className="rounded-[32px] overflow-hidden" style={{ background: '#0D0B1A' }}>
                  <div className="px-3 py-2.5 flex items-center gap-2 border-b border-white/5">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                      style={{ background: 'linear-gradient(135deg, #6C47FF, #4E2FD8)' }}>C</div>
                    <div>
                      <p className="text-white text-[11px] font-medium">Cleo.ai</p>
                      <div className="flex items-center gap-1">
                        <div className="w-1 h-1 rounded-full bg-green-400" />
                        <p className="text-[9px] text-white/30">Active now</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 space-y-2.5 h-[380px]">
                    <div className="flex gap-2 items-end">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] text-white font-bold flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, #6C47FF, #4E2FD8)' }}>C</div>
                      <div className="bg-white rounded-xl rounded-tl-sm px-3 py-2 max-w-[80%]">
                        <p className="text-[10px] text-gray-800 leading-relaxed">Hey! I'm Cleo, your AI superconnector. What brings you here today?</p>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <div className="rounded-xl rounded-tr-sm px-3 py-2 max-w-[80%]" style={{ background: '#6C47FF' }}>
                        <p className="text-[10px] text-white leading-relaxed">I'm a founder looking for investors in fintech</p>
                      </div>
                    </div>
                    <div className="flex gap-2 items-end">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] text-white font-bold flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, #6C47FF, #4E2FD8)' }}>C</div>
                      <div className="bg-white rounded-xl rounded-tl-sm px-3 py-2 max-w-[80%]">
                        <p className="text-[10px] text-gray-800 leading-relaxed">Great! I've found 3 investors who match your profile perfectly. Let me introduce you.</p>
                      </div>
                    </div>
                    <div className="space-y-1.5 ml-7">
                      <div className="rounded-lg border border-white/10 p-2" style={{ background: 'rgba(108,71,255,0.06)' }}>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">💰</span>
                          <div>
                            <p className="text-[10px] text-white font-medium">Sarah Chen — Investor</p>
                            <p className="text-[9px] text-white/40">Fintech · Series A · 92% match</p>
                          </div>
                        </div>
                      </div>
                      <div className="rounded-lg border border-white/10 p-2" style={{ background: 'rgba(108,71,255,0.06)' }}>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">💰</span>
                          <div>
                            <p className="text-[10px] text-white font-medium">Marcus Rivera — VC Partner</p>
                            <p className="text-[9px] text-white/40">Fintech · Seed-A · 87% match</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 items-end">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] text-white font-bold flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, #6C47FF, #4E2FD8)' }}>C</div>
                      <div className="bg-white rounded-xl rounded-tl-sm px-3 py-2 flex gap-1">
                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full typing-dot" />
                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full typing-dot" />
                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full typing-dot" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute -z-10 w-full h-full rounded-full opacity-30 blur-[60px] pointer-events-none" style={{ background: 'radial-gradient(circle, #6C47FF 0%, transparent 70%)' }} />
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <p className="text-sm text-white/30 uppercase tracking-wider mb-8">Trusted by founders, investors, and talent worldwide</p>
          <div className="flex items-center justify-center gap-6 sm:gap-12 flex-wrap opacity-30">
            {['TechCrunch', 'Y Combinator', 'Sequoia', 'a16z', 'Stripe'].map((name) => (
              <div key={name} className="text-white/60 font-semibold text-lg tracking-wide">{name}</div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">How it works</h2>
            <p className="text-white/40 max-w-md mx-auto">Three simple steps to start building meaningful professional connections.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step) => (
              <div key={step.num} className="relative rounded-2xl border border-white/5 p-8 group hover:border-purple-500/15 transition"
                style={{ background: 'rgba(26,18,48,0.4)' }}>
                <div className="text-4xl font-bold mb-4" style={{ color: 'rgba(108,71,255,0.15)' }}>{step.num}</div>
                <h3 className="text-lg font-semibold text-white mb-3">{step.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">Everything you need to connect</h2>
            <p className="text-white/40 max-w-md mx-auto">Powerful features designed for professional networking at scale.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="rounded-2xl border border-white/5 p-6 hover:border-purple-500/15 transition"
                style={{ background: 'rgba(26,18,48,0.4)' }}>
                <span className="text-3xl block mb-4">{f.icon}</span>
                <h3 className="font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 border-t border-white/5">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to meet your next big connection?</h2>
          <p className="text-white/40 mb-8">Join thousands of professionals already using Cleo to build relationships that matter.</p>
          <button onClick={() => { setShowAuth(true); setMode('signup'); }}
            className="px-10 py-4 rounded-2xl text-white font-semibold transition-all duration-200 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40"
            style={{ background: 'linear-gradient(135deg, #6C47FF, #4E2FD8)' }}>
            Get Started Free →
          </button>
        </div>
      </section>

      <footer className="border-t border-white/5 py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold"
                style={{ background: 'linear-gradient(135deg, #6C47FF, #4E2FD8)' }}>C</div>
              <span className="text-white font-semibold">Cleo.ai</span>
            </div>
            <div className="flex items-center gap-6">
              {['About', 'Privacy', 'Terms', 'Contact'].map((link) => (
                <span key={link} className="text-sm text-white/30 hover:text-white/60 cursor-pointer transition">{link}</span>
              ))}
            </div>
            <p className="text-xs text-white/20">&copy; {new Date().getFullYear()} Cleo.ai. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {showAuth && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
          <div className="relative w-full max-w-sm mx-4 fade-up">
            <button onClick={() => setShowAuth(false)}
              className="absolute -top-12 right-0 text-white/40 hover:text-white/80 transition text-sm">✕ Close</button>
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3 glow-pulse"
                style={{ background: 'linear-gradient(135deg, #6C47FF, #4E2FD8)' }}>
                <span className="text-white text-xl font-bold">C</span>
              </div>
              <h2 className="text-2xl font-bold text-white">Welcome to Cleo.ai</h2>
              <p className="text-white/40 text-sm mt-1">AI Superconnector</p>
            </div>

            <div className="glass-card p-8">
              <div className="flex gap-1 mb-6 p-1 rounded-2xl" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <button onClick={() => setMode('signup')}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                    mode === 'signup' ? 'bg-boardy-500 text-white shadow-boardy-sm' : 'text-white/40 hover:text-white/70'
                  }`}>Sign Up</button>
                <button onClick={() => setMode('login')}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                    mode === 'login' ? 'bg-boardy-500 text-white shadow-boardy-sm' : 'text-white/40 hover:text-white/70'
                  }`}>Log In</button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wide">Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com" required className="input-dark" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wide">Password</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === 'signup' ? 'Min 8 characters' : 'Your password'} required
                    minLength={mode === 'signup' ? 8 : undefined} className="input-dark" />
                </div>
                {error && (
                  <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>
                )}
                <button type="submit" disabled={loading} className="btn-primary mt-2">
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Loading...
                    </span>
                  ) : mode === 'signup' ? 'Get Started →' : 'Log In →'}
                </button>
              </form>

              {googleEnabled && (
                <>
                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-white/10" />
                    <span className="text-xs text-white/30">or</span>
                    <div className="flex-1 h-px bg-white/10" />
                  </div>
                  <a
                    href="/api/auth/google"
                    className="w-full flex items-center justify-center gap-3 py-3 rounded-2xl border border-white/10 text-white/70 text-sm font-medium hover:bg-white/5 hover:border-white/20 transition"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Continue with Google
                  </a>
                </>
              )}
            </div>

            <p className="text-center text-xs text-white/20 mt-6">
              By continuing, you agree to Cleo.ai&apos;s{' '}
              <span className="text-boardy-400 hover:text-boardy-300 cursor-pointer">Terms</span> and{' '}
              <span className="text-boardy-400 hover:text-boardy-300 cursor-pointer">Privacy Policy</span>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
