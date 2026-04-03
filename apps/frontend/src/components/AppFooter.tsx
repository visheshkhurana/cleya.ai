'use client';
import Link from 'next/link';

export default function AppFooter() {
  return (
    <footer className="border-t border-white/[0.04] py-8 mt-auto" style={{ background: '#050510' }}>
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}>
              <span className="text-white font-bold text-[10px]">C</span>
            </div>
            <span className="text-white/60 font-medium text-xs">Cleya.ai</span>
          </div>
          <div className="flex items-center gap-5 flex-wrap justify-center">
            {[
              { label: 'Dashboard', href: '/dashboard' },
              { label: 'Matches', href: '/matches' },
              { label: 'Profile', href: '/profile' },
              { label: 'Privacy', href: '/privacy' },
              { label: 'Terms', href: '/terms' },
              { label: 'Contact', href: '/contact' },
            ].map((link) => (
              <Link key={link.href} href={link.href} className="text-[11px] transition-colors hover:text-white/60" style={{ color: '#64748B' }}>
                {link.label}
              </Link>
            ))}
          </div>
          <p className="text-[11px]" style={{ color: '#475569' }}>
            © {new Date().getFullYear()} Cleya.ai
          </p>
        </div>
      </div>
    </footer>
  );
}
