'use client';
import dynamic from 'next/dynamic';
import { ReactNode } from 'react';

const ParticleNetwork = dynamic(() => import('@/components/3d/ParticleNetwork'), { ssr: false });

interface AppShellProps {
  children: ReactNode;
  className?: string;
  particles?: boolean;
}

export default function AppShell({ children, className = '', particles = true }: AppShellProps) {
  return (
    <div className={`min-h-screen relative flex flex-col ${className}`} style={{ background: '#080D1A' }}>
      {particles && <ParticleNetwork />}
      <div className="dot-grid fixed inset-0 pointer-events-none" style={{ zIndex: 1, opacity: 0.3 }} />
      <div className="relative flex-1 flex flex-col min-h-0" style={{ zIndex: 2 }}>
        {children}
      </div>
    </div>
  );
}
