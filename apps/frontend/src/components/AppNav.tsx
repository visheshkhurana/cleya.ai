'use client';

import { useRouter, usePathname } from 'next/navigation';
import MobileNav from './MobileNav';

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/matches', label: 'Matches' },
  { href: '/introductions', label: 'Intros' },
  { href: '/secretary', label: 'AI Secretary' },
  { href: '/profile', label: 'Profile' },
  { href: '/settings', label: 'Settings' },
];

interface AppNavProps {
  rightContent?: React.ReactNode;
}

export default function AppNav({ rightContent }: AppNavProps) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <header className="glass-header">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2.5 hover:opacity-90 transition">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-blue-500/20"
              style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}>
              C
            </div>
            <span className="font-semibold text-white text-sm hidden sm:inline">Cleya.ai</span>
          </button>
        </div>
        <div className="hidden md:flex items-center gap-1">
          {navItems.map(item => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={`px-3 py-1.5 text-xs rounded-lg transition ${
                  isActive
                    ? 'text-white font-medium'
                    : 'text-white/50 hover:text-white/80 border border-transparent hover:border-white/10'
                }`}
                style={isActive ? { background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)' } : {}}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          {rightContent}
          <div className="md:hidden"><MobileNav /></div>
        </div>
      </div>
    </header>
  );
}
