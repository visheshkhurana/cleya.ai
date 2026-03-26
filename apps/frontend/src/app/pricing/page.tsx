'use client';
import Link from 'next/link';
import { useState } from 'react';

const plans = [
  {
    name: 'Free',
    price: '0',
    period: 'forever',
    description: 'Perfect for exploring the platform',
    features: [
      'AI-powered profile creation',
      'Up to 3 matches per month',
      'Basic match insights',
      'Community access',
      'Email notifications',
    ],
    cta: 'Get Started',
    href: '/?action=signup',
    highlight: false,
  },
  {
    name: 'Professional',
    price: '999',
    period: '/month',
    description: 'For founders and investors actively networking',
    features: [
      'Unlimited AI matches',
      'Detailed match explanations',
      'In-app messaging',
      'Priority introductions',
      'LinkedIn verification badge',
      'Meeting scheduling',
      'Advanced filters & search',
      'Weekly match digest',
    ],
    cta: 'Start Free Trial',
    href: '/?action=signup',
    highlight: true,
    badge: 'Most Popular',
  },
  {
    name: 'Growth',
    price: '2,999',
    period: '/month',
    description: 'For power networkers and deal partners',
    features: [
      'Everything in Professional',
      'Unlimited introductions',
      'Deal tracking dashboard',
      'Custom matching criteria',
      'Priority support',
      'Analytics & reporting',
      'API access (beta)',
      'Team collaboration (up to 3)',
    ],
    cta: 'Start Free Trial',
    href: '/?action=signup',
    highlight: false,
  },
];

const faqs = [
  {
    q: 'How does the AI matching work?',
    a: 'Cleya uses a conversational AI to understand your goals, industry, stage, and preferences. Our matching engine then scores compatibility across multiple dimensions — sector fit, stage alignment, geographic proximity, and complementary strengths — to surface the most relevant connections.',
  },
  {
    q: 'Can I try before I pay?',
    a: 'Yes. The Free plan gives you access to core features with a limited number of matches. Professional and Growth plans include a 14-day free trial so you can experience the full platform before committing.',
  },
  {
    q: 'What makes Cleya different from LinkedIn?',
    a: 'LinkedIn is a broadcast platform — you connect with thousands but rarely get meaningful introductions. Cleya is curated and AI-driven. Every match comes with context, mutual interest confirmation, and facilitated warm intros. Quality over quantity.',
  },
  {
    q: 'Is my data safe?',
    a: 'Absolutely. We use end-to-end encryption for messages, never share your data with third parties, and comply with Indian data protection regulations. Your contact information is only revealed after both parties accept a match.',
  },
  {
    q: 'Do you offer enterprise plans?',
    a: 'Yes. For accelerators, VCs, and large teams, we offer custom enterprise plans with dedicated support, SSO, custom matching rules, and API access. Contact us at enterprise@cleya.ai.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. All paid plans are month-to-month with no lock-in. You can cancel or downgrade at any time from your account settings.',
  },
];

export default function PricingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [annual, setAnnual] = useState(false);

  return (
    <div className="min-h-screen font-sans" style={{ background: '#0F172A' }}>
      <nav className="border-b border-white/[0.06]" style={{ background: 'rgba(11,9,24,0.85)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-boardy-400">
              <circle cx="8" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="16" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
              <line x1="11" y1="12" x2="13" y2="12" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <span className="text-white font-semibold text-lg tracking-tight">Cleya.ai</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/about" className="hidden sm:inline-block px-3 py-2 text-sm text-white/50 hover:text-white transition-colors">About</Link>
            <Link href="/blog" className="hidden sm:inline-block px-3 py-2 text-sm text-white/50 hover:text-white transition-colors">Blog</Link>
            <Link href="/" className="px-5 py-2.5 text-sm font-medium text-white rounded-[10px] transition-all hover:scale-[1.02]"
              style={{ background: '#0D9488' }}>
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <section className="pt-16 pb-8 text-center">
        <div className="max-w-4xl mx-auto px-6">
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-white tracking-tight mb-4">
            Simple, transparent pricing
          </h1>
          <p className="text-lg max-w-xl mx-auto mb-8" style={{ color: '#94A3B8' }}>
            Start free. Upgrade when you need more matches, messaging, and premium features.
          </p>
          <div className="inline-flex items-center gap-3 p-1 rounded-full border border-white/10" style={{ background: 'rgba(30,41,59,0.6)' }}>
            <button
              onClick={() => setAnnual(false)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${!annual ? 'text-white' : 'text-white/40'}`}
              style={!annual ? { background: '#0D9488' } : {}}>
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${annual ? 'text-white' : 'text-white/40'}`}
              style={annual ? { background: '#0D9488' } : {}}>
              Annual <span className="text-xs opacity-75">(-20%)</span>
            </button>
          </div>
        </div>
      </section>

      <section className="pb-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const displayPrice = plan.price === '0' ? '0' :
                annual ? Math.round(parseInt(plan.price.replace(',', '')) * 0.8).toLocaleString('en-IN') : plan.price;
              return (
                <div key={plan.name} className={`relative rounded-2xl border p-6 flex flex-col ${
                  plan.highlight ? 'border-teal-500/30' : 'border-white/5'
                }`} style={{ background: plan.highlight ? 'rgba(13,148,136,0.06)' : 'rgba(30,41,59,0.6)' }}>
                  {plan.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white"
                      style={{ background: '#0D9488' }}>
                      {plan.badge}
                    </div>
                  )}
                  <h3 className="text-lg font-semibold text-white mb-1">{plan.name}</h3>
                  <p className="text-sm mb-4" style={{ color: '#94A3B8' }}>{plan.description}</p>
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-sm" style={{ color: '#94A3B8' }}>&#8377;</span>
                    <span className="text-4xl font-bold text-white">{displayPrice}</span>
                    <span className="text-sm" style={{ color: '#94A3B8' }}>{plan.period}</span>
                  </div>
                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm" style={{ color: '#CBD5E1' }}>
                        <svg className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#0D9488' }} viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link href={plan.href}
                    className={`block text-center py-3 rounded-xl text-sm font-medium transition hover:scale-[1.02] ${
                      plan.highlight ? 'text-white' : 'text-white border border-white/10 hover:border-white/20'
                    }`}
                    style={plan.highlight ? { background: '#0D9488', boxShadow: '0 0 20px rgba(13,148,136,0.2)' } : {}}>
                    {plan.cta}
                  </Link>
                </div>
              );
            })}
          </div>

          <div className="mt-12 text-center rounded-2xl border border-white/5 p-8" style={{ background: 'rgba(30,41,59,0.4)' }}>
            <h3 className="text-xl font-semibold text-white mb-2">Enterprise</h3>
            <p className="text-sm mb-4" style={{ color: '#94A3B8' }}>
              Custom plans for accelerators, VC funds, and large teams. SSO, API access, dedicated support, and custom matching rules.
            </p>
            <a href="mailto:enterprise@cleya.ai"
              className="inline-block px-6 py-3 rounded-xl text-sm font-medium text-teal-300 border border-teal-500/20 hover:bg-teal-500/5 transition">
              Contact Sales
            </a>
          </div>
        </div>
      </section>

      <section className="border-t border-white/[0.04] py-16">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-white text-center mb-10">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="rounded-xl border border-white/5 overflow-hidden" style={{ background: 'rgba(30,41,59,0.4)' }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left">
                  <span className="text-sm font-medium text-white pr-4">{faq.q}</span>
                  <svg className={`w-4 h-4 flex-shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`}
                    style={{ color: '#94A3B8' }} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4">
                    <p className="text-sm leading-relaxed" style={{ color: '#94A3B8' }}>{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/[0.04] py-16 text-center">
        <div className="max-w-xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-white mb-3">Ready to find your next big connection?</h2>
          <p className="text-sm mb-6" style={{ color: '#94A3B8' }}>Join thousands of founders and investors already on Cleya.ai.</p>
          <Link href="/"
            className="inline-block px-8 py-3 rounded-[10px] text-white font-medium text-sm transition-all hover:scale-[1.02]"
            style={{ background: '#0D9488', boxShadow: '0 0 30px rgba(13,148,136,0.25)' }}>
            Get Started Free →
          </Link>
        </div>
      </section>
    </div>
  );
}
