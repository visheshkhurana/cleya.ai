'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

export default function Home() {
  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        await api.signup(email, password);
      } else {
        await api.login(email, password);
      }
      window.location.href = '/chat';
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ background: 'radial-gradient(ellipse at center top, #2D1899 0%, #0D0B1A 65%)' }}>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-20 blur-[120px]" style={{ background: '#6C47FF' }} />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full opacity-10 blur-[100px]" style={{ background: '#4E2FD8' }} />

      <div className="relative w-full max-w-sm mx-4 fade-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 glow-pulse" style={{ background: 'linear-gradient(135deg, #6C47FF, #4E2FD8)' }}>
            <span className="text-white text-2xl font-bold">C</span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Cleo.ai</h1>
          <p className="text-white/50 mt-2 text-sm">AI Superconnector. Meet the right people.</p>
        </div>

        <div className="glass-card p-8">
          <div className="flex gap-1 mb-6 p-1 rounded-2xl" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <button
              onClick={() => setMode('signup')}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                mode === 'signup'
                  ? 'bg-boardy-500 text-white shadow-boardy-sm'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              Sign Up
            </button>
            <button
              onClick={() => setMode('login')}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                mode === 'login'
                  ? 'bg-boardy-500 text-white shadow-boardy-sm'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              Log In
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wide">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="input-dark"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wide">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'Min 8 characters' : 'Your password'}
                required
                minLength={mode === 'signup' ? 8 : undefined}
                className="input-dark"
              />
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
              ) : mode === 'signup' ? (
                'Get Started →'
              ) : (
                'Log In →'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-white/20 mt-6">
          By continuing, you agree to Cleo.ai&apos;s{' '}
          <span className="text-boardy-400 hover:text-boardy-300 cursor-pointer">Terms</span> and{' '}
          <span className="text-boardy-400 hover:text-boardy-300 cursor-pointer">Privacy Policy</span>.
        </p>
      </div>
    </div>
  );
}
