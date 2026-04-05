'use client';
import Link from 'next/link';

export default function AppFooter() {
  return (
    <footer className="border-t border-white/[0.04] py-10 mt-auto" style={{ background: '#050510' }}>
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="col-span-2 sm:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-3">
              <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}>
                <span className="text-white font-bold text-[10px]">C</span>
              </div>
              <span className="text-white/60 font-medium text-xs">Cleya.ai</span>
            </Link>
            <p className="text-[11px] leading-relaxed" style={{ color: '#475569' }}>
              AI-powered networking for India&apos;s startup ecosystem.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-3">Product</h4>
            <div className="space-y-2">
              {[
                { label: 'Features', href: '/features' },
                { label: 'Pricing', href: '/pricing' },
                { label: 'About', href: '/about' },
                { label: 'Blog', href: '/blog' },
              ].map((link) => (
                <Link key={link.href} href={link.href} className="block text-[11px] transition-colors hover:text-white/60" style={{ color: '#64748B' }}>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Cities */}
          <div>
            <h4 className="text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-3">Cities</h4>
            <div className="space-y-2">
              {[
                { label: 'Bangalore', href: '/cities/bangalore' },
                { label: 'Mumbai', href: '/cities/mumbai' },
                { label: 'Delhi NCR', href: '/cities/delhi' },
                { label: 'Hyderabad', href: '/cities/hyderabad' },
                { label: 'Pune', href: '/cities/pune' },
                { label: 'Chennai', href: '/cities/chennai' },
              ].map((link) => (
                <Link key={link.href} href={link.href} className="block text-[11px] transition-colors hover:text-white/60" style={{ color: '#64748B' }}>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Legal & Contact */}
          <div>
            <h4 className="text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-3">Company</h4>
            <div className="space-y-2">
              {[
                { label: 'Contact', href: '/contact' },
                { label: 'Privacy Policy', href: '/privacy' },
                { label: 'Terms of Service', href: '/terms' },
              ].map((link) => (
                <Link key={link.href} href={link.href} className="block text-[11px] transition-colors hover:text-white/60" style={{ color: '#64748B' }}>
                  {link.label}
                </Link>
              ))}
              <a href="mailto:hello@cleya.ai" className="block text-[11px] transition-colors hover:text-white/60" style={{ color: '#64748B' }}>
                hello@cleya.ai
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-white/[0.04] pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[11px]" style={{ color: '#475569' }}>
            &copy; {new Date().getFullYear()} Cleya.ai. All rights reserved.
          </p>
          <p className="text-[11px]" style={{ color: '#475569' }}>
            Bangalore, India
          </p>
        </div>
      </div>
    </footer>
  );
}
