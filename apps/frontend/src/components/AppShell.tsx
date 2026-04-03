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
    <div className={`min-h-screen relative ${className}`} style={{ background: '#050510' }}>
      {particles && <ParticleNetwork />}
      <div className="dot-grid fixed inset-0 pointer-events-none" style={{ zIndex: 1, opacity: 0.4 }} />
      <div className="relative" style={{ zIndex: 2 }}>
        {children}
      </div>
    </div>
  );
}
