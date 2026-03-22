'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginRedirect() {
  const router = useRouter();

  useEffect(() => {
    window.location.href = '/?action=login';
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0B0918' }}>
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-white/60 text-sm">Redirecting to login...</p>
      </div>
    </div>
  );
}
