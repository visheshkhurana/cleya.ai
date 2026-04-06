'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';

export default function LoginRedirect() {
  const router = useRouter();

  useEffect(() => {
    window.location.href = '/?action=login';
  }, []);

  return (
    <AppShell>
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-brand-violet border-t-transparent rounded-full animate-spin" />
        <p className="text-white/60 text-sm">Redirecting to login...</p>
      </div>
    </AppShell>
  );
}
