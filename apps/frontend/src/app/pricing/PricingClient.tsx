'use client';
import Link from 'next/link';
import { Fragment, useState } from 'react';
import PublicNav from '@/components/PublicNav';
import AppShell from '@/components/AppShell';
import PricingErrorBoundary from '@/components/PricingErrorBoundary';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { Check, X, Minus, Shield, Sparkles, ChevronDown } from 'lucide-react';

type PlanId = 'free' | 'starter' | 'pro';

const plans: Array<{
  id: PlanId;
  name: string;
  monthly: number;
  description: string;
  features: string[];
  cta: string;
  href?: string;
  highlight: boolean;
  badge?: string;
  trial?: string;
  isSubscription: boolean;
}> = [
  {
    id: 'free',
    name: 'Free',
    monthly: 0,
    description: 'Try Cleya — perfect for exploring the network.',
    features: [
      '10 AI matches every month',
      'AI-powered profile builder',
      'Basic match insights',
      'Community access',
      'Email notifications',
    ],
    cta: 'Get Started Free',
    href: '/?action=signup',
    highlight: false,
    isSubscription: false,
  },
  {
    id: 'starter',
    name: 'Starter',
    monthly: 999,
    description: 'For founders and operators warming up their network.',
    features: [
      '50 AI matches every month',
      'In-app messaging',
      'Detailed match explanations',
      'LinkedIn verification badge',
      'Weekly match digest',
    ],
    cta: 'Start 7-day Free Trial',
    href: '/?action=signup',
    highlight: false,
    badge: 'Best for new users',
    trial: '7-day free trial',
    isSubscription: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    monthly: 2999,
    description: 'For founders and investors actively networking.',
    features: [
      'Unlimited AI matches',
      'In-app messaging',
      'Detailed match explanations',
      'Priority introductions',
      'LinkedIn verification badge',
      'Meeting scheduling',
      'Advanced filters & search',
      'Weekly match digest',
    ],
    cta: 'Start 14-day Free Trial',
    highlight: true,
    badge: 'Most Popular',
    trial: '14-day free trial',
    isSubscription: true,
  },
];

const COMPARISON_FEATURES: Array<{
  group: string;
  rows: Array<{ label: string; free: string | boolean; starter: string | boolean; pro: string | boolean }>;
}> = [
  {
    group: 'Matching',
    rows: [
      { label: 'Monthly AI matches', free: '10', starter: '50', pro: 'Unlimited' },
      { label: 'AI-powered profile builder', free: true, starter: true, pro: true },
      { label: 'Detailed match explanations', free: false, starter: true, pro: true },
      { label: 'Advanced filters & search', free: false, starter: false, pro: true },
      { label: 'Priority introductions', free: false, starter: false, pro: true },
    ],
  },
  {
    group: 'Communication',
    rows: [
      { label: 'In-app messaging', free: false, starter: true, pro: true },
      { label: 'Meeting scheduling', free: false, starter: false, pro: true },
      { label: 'Weekly match digest', free: false, starter: true, pro: true },
    ],
  },
  {
    group: 'Trust & Verification',
    rows: [
      { label: 'LinkedIn verification badge', free: false, starter: true, pro: true },
      { label: 'Community access', free: true, starter: true, pro: true },
      { label: 'Email support', free: true, starter: true, pro: true },
      { label: 'Priority support', free: false, starter: false, pro: true },
    ],
  },
];

const faqs = [
  {
    q: 'How does the AI matching work?',
    a: 'Cleya uses a conversational AI to understand your goals, industry, stage, and preferences. Our matching engine then scores compatibility across multiple dimensions — sector fit, stage alignment, geographic proximity, and complementary strengths — to surface the most relevant connections.',
  },
  {
    q: 'Do I need a credit card to start?',
    a: 'No. The Free plan requires no credit card and gives you 10 AI matches every month. You can upgrade to Starter or Pro at any time to unlock more matches and premium features.',
  },
  {
    q: 'How do the free trials work?',
    a: 'Starter includes a 7-day free trial and Pro includes a 14-day free trial. You can cancel any time during the trial and you will not be charged.',
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

function CellValue({ value }: { value: string | boolean }) {
  if (value === true) return <Check size={16} className="text-success mx-auto" />;
  if (value === false) return <Minus size={16} className="mx-auto" style={{ color: 'rgba(255,255,255,0.2)' }} />;
  return <span className="text-sm text-white/85 font-medium">{value}</span>;
}

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

  const priceFor = (monthly: number) => {
    if (monthly === 0) return '0';
    const value = annual ? Math.round(monthly * 0.8) : monthly;
    return value.toLocaleString('en-IN');
  };

  return (
    <PricingErrorBoundary>
    <AppShell className="font-sans">
      <PublicNav />

      <section className="pt-20 pb-10 text-center relative">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] font-medium uppercase tracking-[0.2em] mb-6"
            style={{ background: 'rgba(201,169,98,0.1)', color: '#D4B976', border: '1px solid rgba(201,169,98,0.25)' }}>
            <Sparkles size={12} />
            No credit card required
          </div>
          <h1 className="font-sans text-4xl sm:text-5xl font-bold text-white tracking-tight mb-4">
            Simple, transparent pricing
          </h1>
          <p className="text-lg max-w-xl mx-auto mb-8" style={{ color: '#94A3B8' }}>
            Start free with 10 matches a month. Upgrade when you need messaging, more matches, and premium features.
          </p>
          <div className="inline-flex items-center gap-3 p-1 rounded-full border border-white/10" style={{ background: 'rgba(15,22,41,0.8)' }}>
            <button
              onClick={() => setAnnual(false)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition ${!annual ? 'text-white' : 'text-white/40'}`}
              style={!annual ? { background: '#6C63FF' } : {}}>
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition flex items-center gap-2 ${annual ? 'text-white' : 'text-white/40'}`}
              style={annual ? { background: '#6C63FF' } : {}}>
              Annual
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                style={{ background: annual ? 'rgba(255,255,255,0.18)' : 'rgba(201,169,98,0.18)', color: annual ? '#fff' : '#D4B976' }}>
                -20%
              </span>
            </button>
          </div>
        </div>
      </section>

      <section className="pb-20">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div key={plan.id} className={`relative rounded-2xl border p-6 flex flex-col ${
                plan.highlight ? 'border-brand-violet/40' : 'border-white/[0.06]'
              }`} style={{
                background: plan.highlight ? 'linear-gradient(180deg, rgba(108,99,255,0.10), rgba(15,22,41,0.85))' : 'rgba(15,22,41,0.85)',
                backdropFilter: 'blur(16px)',
                boxShadow: plan.highlight ? '0 0 60px rgba(108,99,255,0.18)' : 'none',
              }}>
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap"
                    style={plan.highlight
                      ? { background: 'linear-gradient(135deg, #6C63FF, #4ECDC4)', color: '#fff' }
                      : { background: 'rgba(201,169,98,0.15)', color: '#D4B976', border: '1px solid rgba(201,169,98,0.3)' }}>
                    {plan.badge}
                  </div>
                )}
                <h3 className="text-lg font-semibold text-white mb-1">{plan.name}</h3>
                <p className="text-sm mb-4 min-h-[40px]" style={{ color: '#94A3B8' }}>{plan.description}</p>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-sm" style={{ color: '#94A3B8' }}>&#8377;</span>
                  <span className="text-4xl font-bold text-white">{priceFor(plan.monthly)}</span>
                  <span className="text-sm" style={{ color: '#94A3B8' }}>{plan.monthly === 0 ? 'forever' : '/mo'}</span>
                </div>
                {plan.trial ? (
                  <p className="text-xs mb-5 flex items-center gap-1.5" style={{ color: '#10B981' }}>
                    <Check size={12} /> {plan.trial} · cancel anytime
                  </p>
                ) : (
                  <p className="text-xs mb-5" style={{ color: 'rgba(255,255,255,0.35)' }}>No credit card required</p>
                )}
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm" style={{ color: '#CBD5E1' }}>
                      <Check size={16} className="mt-0.5 flex-shrink-0" style={{ color: plan.highlight ? '#9B95FF' : '#6C63FF' }} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                {plan.isSubscription ? (
                  <button
                    onClick={handleSubscribe}
                    disabled={subscribing}
                    className="block w-full text-center py-3 rounded-xl text-sm font-semibold text-white transition hover:scale-[1.02] disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #6C63FF, #4ECDC4)', boxShadow: '0 0 24px rgba(108,99,255,0.25)' }}>
                    {subscribing ? 'Setting up...' : plan.cta}
                  </button>
                ) : (
                  <Link href={plan.href || '/?action=signup'}
                    className={`block text-center py-3 rounded-xl text-sm font-semibold transition hover:scale-[1.02] ${
                      plan.highlight ? 'text-white' : 'text-white border border-white/10 hover:border-white/20'
                    }`}
                    style={plan.highlight ? { background: '#6C63FF', boxShadow: '0 0 24px rgba(108,99,255,0.25)' } : {}}>
                    {plan.cta}
                  </Link>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center justify-center gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
            <Shield size={14} /> Secure payments by Razorpay · GST included · Cancel anytime
          </div>

          <div className="mt-12 text-center rounded-2xl border border-white/[0.06] p-8" style={{ background: 'rgba(15,22,41,0.8)' }}>
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
        <div className="max-w-5xl mx-auto px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-white text-center mb-3">Compare plans</h2>
          <p className="text-center text-sm mb-10" style={{ color: '#94A3B8' }}>See exactly what's included in every plan.</p>
          <div className="rounded-2xl border border-white/[0.06] overflow-hidden" style={{ background: 'rgba(15,22,41,0.6)', backdropFilter: 'blur(16px)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <th className="text-left px-5 py-4 font-semibold text-white text-sm w-[40%]">Feature</th>
                  <th className="px-4 py-4 font-semibold text-white text-sm text-center">Free</th>
                  <th className="px-4 py-4 font-semibold text-white text-sm text-center">Starter</th>
                  <th className="px-4 py-4 font-semibold text-sm text-center" style={{ color: '#9B95FF' }}>Pro</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_FEATURES.map((group) => (
                  <Fragment key={group.group}>
                    <tr>
                      <td colSpan={4} className="px-5 pt-6 pb-2 text-[11px] font-bold uppercase tracking-wider" style={{ color: '#9B95FF' }}>
                        {group.group}
                      </td>
                    </tr>
                    {group.rows.map((row) => (
                      <tr key={row.label} className="border-t border-white/[0.04]">
                        <td className="px-5 py-3 text-white/75">{row.label}</td>
                        <td className="px-4 py-3 text-center"><CellValue value={row.free} /></td>
                        <td className="px-4 py-3 text-center"><CellValue value={row.starter} /></td>
                        <td className="px-4 py-3 text-center"><CellValue value={row.pro} /></td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="border-t border-white/[0.04] py-16">
        <div className="max-w-3xl mx-auto px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-white text-center mb-10">Frequently asked questions</h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="rounded-xl border border-white/[0.06] overflow-hidden" style={{ background: 'rgba(15,22,41,0.8)' }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left">
                  <span className="text-sm font-medium text-white pr-4">{faq.q}</span>
                  <ChevronDown size={16} className={`flex-shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} style={{ color: '#94A3B8' }} />
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
          <p className="text-sm mb-6" style={{ color: '#94A3B8' }}>Join 10,000+ founders, investors, and operators on Cleya.ai.</p>
          <Link href="/?action=signup" className="btn-gold inline-flex">
            Join Free — 10 Matches/Month
          </Link>
          <p className="text-xs mt-4" style={{ color: 'rgba(255,255,255,0.4)' }}>No credit card required</p>
        </div>
      </section>
    </AppShell>
    </PricingErrorBoundary>
  );
}
