'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function PublicNav() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-white/[0.06]" style={{ background: 'rgba(11,9,24,0.85)', backdropFilter: 'blur(12px)' }} role="navigation" aria-label="Main navigation">
      <div className="max-w-6xl mx-auto px-6 lg:px-8 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6C63FF, #4ECDC4)' }}>
            <span className="text-white font-bold text-sm">C</span>
          </div>
          <span className="text-white font-bold text-lg tracking-tight">Cleya.ai</span>
        </Link>
        <div className="hidden sm:flex items-center gap-1">
          {[
            { href: '/about', label: 'About' },
            { href: '/features', label: 'Features' },
            { href: '/pricing', label: 'Pricing' },
            { href: '/blog', label: 'Blog' },
            { href: '/contact', label: 'Contact' },
          ].map(link => (
            <Link key={link.href} href={link.href}
              className={`px-3 py-2 text-sm transition-colors rounded-lg hover:bg-white/[0.03] ${pathname === link.href ? 'text-white' : 'text-white/50 hover:text-white'}`}>
              {link.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Link href="/?action=login" className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors">Log In</Link>
          <Link href="/?action=signup" className="px-5 py-2.5 text-sm font-medium text-white rounded-full transition-all hover:scale-[1.02]"
            style={{ background: 'linear-gradient(135deg, #6C63FF, #4ECDC4)', boxShadow: '0 0 20px rgba(108,99,255,0.2)' }}>
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  );
}
