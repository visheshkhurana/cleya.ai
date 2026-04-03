'use client';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<'form' | 'success' | 'error'>('form');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (!token) { setError('Missing reset token'); return; }
    setLoading(true);
    setError('');
    try {
      await api.resetPassword(token, password);
      setStatus('success');
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
      setStatus('error');
    }
    setLoading(false);
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#050510' }}>
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: '#3B82F6' }}>
            <span className="text-white text-xl font-bold">C</span>
          </div>
          <h1 className="text-xl font-semibold text-white mb-2">Invalid Reset Link</h1>
          <p className="text-sm mb-6" style={{ color: '#94A3B8' }}>This password reset link is invalid or has expired.</p>
          <a href="/" className="inline-block px-6 py-2.5 rounded-lg text-sm font-medium text-white" style={{ background: '#3B82F6' }}>Back to Home</a>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#050510' }}>
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: '#10B981' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M20 6L9 17l-5-5" /></svg>
          </div>
          <h1 className="text-xl font-semibold text-white mb-2">Password Reset Successfully</h1>
          <p className="text-sm mb-6" style={{ color: '#94A3B8' }}>You can now log in with your new password.</p>
          <a href="/" className="inline-block px-6 py-2.5 rounded-lg text-sm font-medium text-white" style={{ background: '#3B82F6' }}>Log In</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#050510' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: '#3B82F6' }}>
            <span className="text-white text-xl font-bold">C</span>
          </div>
          <h1 className="text-xl font-semibold text-white mb-1">Reset Your Password</h1>
          <p className="text-sm" style={{ color: '#94A3B8' }}>Enter your new password below.</p>
        </div>
        <form onSubmit={handleSubmit} className="rounded-2xl border border-white/[0.08] p-8 space-y-4" style={{ background: 'rgba(10,10,26,0.8)' }}>
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#94A3B8' }}>New Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 characters" required minLength={8} className="input-dark" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#94A3B8' }}>Confirm Password</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Confirm password" required className="input-dark" />
          </div>
          {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
