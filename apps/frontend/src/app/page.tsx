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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-boardy-50 via-white to-boardy-100">
      <div className="w-full max-w-md mx-4">
        {/* Logo & Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-boardy-600 text-white text-2xl font-bold mb-4">
            B
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Boardy AI</h1>
          <p className="text-gray-500 mt-2">AI-powered networking. Meet the right people.</p>
        </div>

        {/* Auth Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setMode('signup')}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                mode === 'signup'
                  ? 'bg-white shadow text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Sign Up
            </button>
            <button
              onClick={() => setMode('login')}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                mode === 'login'
                  ? 'bg-white shadow text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Log In
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm
                           focus:outline-none focus:ring-2 focus:ring-boardy-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'Min 8 characters' : 'Your password'}
                required
                minLength={mode === 'signup' ? 8 : undefined}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm
                           focus:outline-none focus:ring-2 focus:ring-boardy-500 focus:border-transparent"
              />
            </div>

            {error && (
              <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-boardy-600 text-white font-semibold text-sm
                         hover:bg-boardy-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Loading...' : mode === 'signup' ? 'Get Started' : 'Log In'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          By continuing, you agree to Boardy&apos;s Terms and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
