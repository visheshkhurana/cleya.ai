'use client';
import Link from 'next/link';
import { useState } from 'react';
import PublicNav from '@/components/PublicNav';
import AppShell from '@/components/AppShell';
import PricingErrorBoundary from '@/components/PricingErrorBoundary';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';

const plans = [
  {
    name: 'Free',
    price: '0',
    period: 'forever',
    description: 'Perfect for exploring the platform',
    features: [
      'AI-powered profile creation',
      '10 free matches per month',
      'Basic match insights',
      'Community access',
      'Email notifications',
    ],
    cta: 'Get Started',
    href: '/?action=signup',
    highlight: false,
    isSubscription: false,
  },
  {
    name: 'Pro',
    price: '2,999',
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
    cta: 'Subscribe Now',
    href: '/?action=signup',
    highlight: true,
    badge: 'Most Popular',
    isSubscription: true,
  },
];

const faqs = [
  {
    q: 'How does the AI matching work?',
    a: 'Cleya uses a conversational AI to understand your goals, industry, stage, and preferences. Our matching engine then scores compatibility across multiple dimensions — sector fit, stage alignment, geographic proximity, and complementary strengths — to surface the most relevant connections.',
  },
  {
    q: 'Can I try before I pay?',
    a: 'Yes! Every user gets 10 free matches every month to experience the platform. The free allowance refreshes automatically. Once you need more, you can subscribe to the Pro plan for unlimited matches and premium features.',
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

export default function PricingClient() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [annual, setAnnual] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const toast = useToast();

  const handleSubscribe = async () => {
    setSubscribing(true);
    try {
      const data = await api.createSubscription();
      if (data.subscriptionId && data.keyId && typeof window !== 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => {
          const options = {
            key: data.keyId,
            subscription_id: data.subscriptionId,
            name: 'Cleya.ai',
            description: 'Pro Subscription - Unlimited Matches',
            handler: () => {
              toast.success('Subscription activated! You now have unlimited matches.');
              window.location.href = '/matches';
            },
            modal: {
              ondismiss: () => {
                setSubscribing(false);
              },
            },
            theme: { color: '#6C63FF' },
          };
          const rzp = new (window as any).Razorpay(options);
          rzp.open();
        };
        document.body.appendChild(script);
      } else if (data.shortUrl) {
        window.open(data.shortUrl, '_blank');
      }
    } catch (err: any) {
      console.error('Subscription failed:', err);
      if (err.message?.includes('Missing or invalid authorization') || err.message?.includes('Unauthorized')) {
        window.location.href = '/?action=signup';
      } else {
        toast.error(err.message || 'Unable to start subscription. Please try again.');
      }
    } finally {
      setSubscribing(false);
    }
  };

  return (
    <PricingErrorBoundary>
    <AppShell className="font-sans">
      <PublicNav />

      <section className="pt-16 pb-8 text-center">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          <h1 className="font-sans text-4xl sm:text-5xl font-bold text-white tracking-tight mb-4">
            Simple, transparent pricing
          </h1>
          <p className="text-lg max-w-xl mx-auto mb-8" style={{ color: '#94A3B8' }}>
            Start free. Upgrade when you need more matches, messaging, and premium features.
          </p>
          <div className="inline-flex items-center gap-3 p-1 rounded-full border border-white/10" style={{ background: 'rgba(15,22,41,0.8)' }}>
            <button
              onClick={() => setAnnual(false)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${!annual ? 'text-white' : 'text-white/40'}`}
              style={!annual ? { background: '#6C63FF' } : {}}>
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${annual ? 'text-white' : 'text-white/40'}`}
              style={annual ? { background: '#6C63FF' } : {}}>
              Annual <span className="text-xs opacity-75">(-20%)</span>
            </button>
          </div>
        </div>
      </section>

      <section className="pb-20">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const displayPrice = plan.price === '0' ? '0' :
                annual ? Math.round(parseInt(plan.price.replace(',', '')) * 0.8).toLocaleString('en-IN') : plan.price;
              return (
                <div key={plan.name} className={`relative rounded-2xl border p-6 flex flex-col ${
                  plan.highlight ? 'border-brand-violet/30' : 'border-white/5'
                }`} style={{ background: plan.highlight ? 'rgba(108,99,255,0.06)' : 'rgba(15,22,41,0.8)' }}>
                  {plan.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white"
                      style={{ background: '#6C63FF' }}>
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
                        <svg className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#6C63FF' }} viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                  {plan.isSubscription ? (
                    <button
                      onClick={handleSubscribe}
                      disabled={subscribing}
                      className="block w-full text-center py-3 rounded-xl text-sm font-medium text-white transition hover:scale-[1.02] disabled:opacity-50"
                      style={{ background: '#6C63FF', boxShadow: '0 0 20px rgba(108,99,255,0.2)' }}>
                      {subscribing ? 'Setting up...' : plan.cta}
                    </button>
                  ) : (
                    <Link href={plan.href}
                      className={`block text-center py-3 rounded-xl text-sm font-medium transition hover:scale-[1.02] ${
                        plan.highlight ? 'text-white' : 'text-white border border-white/10 hover:border-white/20'
                      }`}
                      style={plan.highlight ? { background: '#6C63FF', boxShadow: '0 0 20px rgba(108,99,255,0.2)' } : {}}>
                      {plan.cta}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-12 text-center rounded-2xl border border-white/5 p-8" style={{ background: 'rgba(15,22,41,0.8)' }}>
            <h3 className="text-xl font-semibold text-white mb-2">Enterprise</h3>
            <p className="text-sm mb-4" style={{ color: '#94A3B8' }}>
              Custom plans for accelerators, VC funds, and large teams. SSO, API access, dedicated support, and custom matching rules.
            </p>
            <a href="mailto:enterprise@cleya.ai"
              className="inline-block px-6 py-3 rounded-xl text-sm font-medium text-brand-violet-hover border border-brand-violet/20 hover:bg-brand-violet/5 transition">
              Contact Sales
            </a>
          </div>
        </div>
      </section>

      <section className="border-t border-white/[0.04] py-16">
        <div className="max-w-3xl mx-auto px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-white text-center mb-10">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="rounded-xl border border-white/5 overflow-hidden" style={{ background: 'rgba(15,22,41,0.8)' }}>
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
        <div className="max-w-xl mx-auto px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-white mb-3">Ready to find your next big connection?</h2>
          <p className="text-sm mb-6" style={{ color: '#94A3B8' }}>Join founders and investors already on Cleya.ai.</p>
          <Link href="/?action=signup"
            className="inline-block px-8 py-3 rounded-[10px] text-white font-medium text-sm transition-all hover:scale-[1.02]"
            style={{ background: '#6C63FF', boxShadow: '0 0 30px rgba(108,99,255,0.25)' }}>
            Get Started Free →
          </Link>
        </div>
      </section>
    </AppShell>
    </PricingErrorBoundary>
  );
}
