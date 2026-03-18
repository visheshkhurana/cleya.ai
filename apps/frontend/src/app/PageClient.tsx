'use client';
import { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/api';

function useInView(ref: React.RefObject<HTMLElement | null>) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold: 0.2 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);
  return inView;
}

function CountUp({ target, suffix = '', prefix = '', decimals = 0 }: { target: number; suffix?: string; prefix?: string; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref);
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const duration = 1500;
    const steps = 40;
    const inc = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += inc;
      if (current >= target) { setVal(target); clearInterval(timer); }
      else setVal(decimals > 0 ? parseFloat(current.toFixed(decimals)) : Math.floor(current));
    }, duration / steps);
    return () => clearInterval(timer);
  }, [inView, target, decimals]);
  return <span ref={ref}>{prefix}{decimals > 0 ? val.toFixed(decimals) : val.toLocaleString()}{suffix}</span>;
}

export default function Home() {
  const [showAuth, setShowAuth] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [consent, setConsent] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);

      const utmSource = params.get('utm_source');
      const utmMedium = params.get('utm_medium');
      const utmCampaign = params.get('utm_campaign');
      const utmContent = params.get('utm_content');
      const utmTerm = params.get('utm_term');
      if (utmSource || utmMedium || utmCampaign || utmContent || utmTerm) {
        const utmData: Record<string, string> = {};
        if (utmSource) utmData.utm_source = utmSource;
        if (utmMedium) utmData.utm_medium = utmMedium;
        if (utmCampaign) utmData.utm_campaign = utmCampaign;
        if (utmContent) utmData.utm_content = utmContent;
        if (utmTerm) utmData.utm_term = utmTerm;
        localStorage.setItem('cleo_utm', JSON.stringify(utmData));
      }

      const urlToken = params.get('token');
      const urlError = params.get('error');
      if (urlToken) {
        api.setToken(urlToken);
        window.history.replaceState({}, '', '/');
      }
      if (urlError) {
        setError('Google sign-in failed. Please try again or use email.');
        setShowAuth(true);
        window.history.replaceState({}, '', '/');
      }
    }
    api.getGoogleAuthStatus().then(d => setGoogleEnabled(d.enabled)).catch(() => {});
    const token = api.getToken();
    if (token) {
      api.getMe().then(async (user) => {
        if (user?.role === 'ADMIN') {
          window.location.href = '/admin';
        } else {
          const profile = await api.getProfile().catch(() => null);
          if (profile?.isComplete) {
            window.location.href = '/dashboard';
          } else {
            window.location.href = '/chat';
          }
        }
      }).catch(() => {
        setChecking(false);
      });
    } else {
      setChecking(false);
    }
  }, []);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    try {
      await api.forgotPassword(forgotEmail);
      setForgotSent(true);
    } catch {}
    setForgotLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (mode === 'signup' && !consent) {
      setError('Please agree to the Terms of Service and Privacy Policy');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'signup') {
        const utmRaw = localStorage.getItem('cleo_utm');
        const utmData = utmRaw ? JSON.parse(utmRaw) : {};
        await api.signup(email, password, undefined, {
          utmSource: utmData.utm_source,
          utmMedium: utmData.utm_medium,
          utmCampaign: utmData.utm_campaign,
        });
        localStorage.removeItem('cleo_utm');
        window.location.href = '/chat';
      } else {
        const data = await api.login(email, password);
        const profile = await api.getProfile().catch(() => null);
        if (data.user?.role === 'ADMIN') {
          window.location.href = '/admin';
        } else if (profile?.isComplete) {
          window.location.href = '/dashboard';
        } else {
          window.location.href = '/chat';
        }
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0B0918' }}>
        <div className="w-10 h-10 border-2 border-boardy-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const testimonials = [
    { initials: 'AM', quote: 'Met my lead investor within a week of joining.', name: 'Arjun M.', title: 'Founder · Fintech · Bangalore' },
    { initials: 'MI', quote: 'The deal flow quality is leagues ahead of cold inbound.', name: 'Meera I.', title: 'Partner · Blume Ventures' },
    { initials: 'PS', quote: 'Found a CTO match for my healthtech startup in Tier-2.', name: 'Priya S.', title: 'Founder · HealthTech · Delhi NCR' },
    { initials: 'RV', quote: 'Landed my founding engineer role through a Cleo intro.', name: 'Rahul V.', title: 'Founding Engineer · Bangalore' },
    { initials: 'NK', quote: 'Cleo connected me to 3 portfolio founders in one day.', name: 'Nandini R.', title: 'Venture Partner · Elevation Capital' },
  ];

  return (
    <div className="min-h-screen font-sans" style={{ background: '#0B0918' }}>

      {/* NAV */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'border-b border-white/[0.06]' : 'border-b border-transparent'
      }`} style={{
        background: scrolled ? 'rgba(11,9,24,0.85)' : 'transparent',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
      }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-boardy-400">
              <circle cx="8" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="16" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
              <line x1="11" y1="12" x2="13" y2="12" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <span className="text-white font-semibold text-lg tracking-tight">Cleo.ai</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => { setShowAuth(true); setMode('login'); }}
              className="px-4 py-2 text-sm text-muted hover:text-white transition-colors">Log In</button>
            <button onClick={() => { setShowAuth(true); setMode('signup'); }}
              className="px-5 py-2.5 text-sm font-medium text-white rounded-[10px] transition-all hover:scale-[1.02]"
              style={{ background: '#0D9488', boxShadow: '0 0 20px rgba(13,148,136,0.2)' }}>
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative pt-28 sm:pt-36 pb-20 sm:pb-28 overflow-hidden">
        <div className="absolute inset-0 dot-grid pointer-events-none" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(13,148,136,0.15) 0%, transparent 70%)' }} />

        <div className="relative max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-[55%_45%] gap-12 lg:gap-16 items-center">
            <div>
              <div className="fade-up inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-medium uppercase tracking-[0.15em] mb-8 border border-white/[0.08]"
                style={{ background: 'rgba(13,148,136,0.06)', color: '#2DD4BF' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#0D9488' }} />
                Members-only · Invite or apply
              </div>

              <h1 className="fade-up-d1 font-display text-[42px] sm:text-[56px] lg:text-[72px] font-bold text-white leading-[1.08] mb-6 tracking-tight">
                Meet the right<br />people.{' '}
                <span className="italic" style={{ color: '#2DD4BF' }}>Faster.</span>
              </h1>

              <p className="fade-up-d2 text-base sm:text-lg leading-relaxed mb-8 max-w-[420px]" style={{ color: '#A09FB5' }}>
                Cleo is your AI Superconnector — matching founders, investors, and talent across India's startup ecosystem.
              </p>

              <div className="fade-up-d3 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <button onClick={() => { setShowAuth(true); setMode('signup'); }}
                  className="px-8 py-[13px] rounded-[10px] text-white font-medium text-sm transition-all duration-200 hover:scale-[1.02]"
                  style={{ background: '#0D9488', boxShadow: '0 0 30px rgba(13,148,136,0.25)' }}>
                  Get Started →
                </button>
                <button onClick={() => scrollToSection('how-it-works')}
                  className="group flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors"
                  style={{ color: '#A09FB5' }}>
                  <span className="border-b border-transparent group-hover:border-white/40 transition-all">See How It Works</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="transition-transform group-hover:translate-x-0.5">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Chat Mockup */}
            <div className="relative hidden md:flex justify-center fade-up-d4">
              <div className="relative w-[300px] rounded-[36px] border-[5px] p-2 shadow-boardy-glow"
                style={{ borderColor: 'rgba(255,255,255,0.08)', background: '#0B0918' }}>
                <div className="w-20 h-5 bg-black rounded-full absolute top-2 left-1/2 -translate-x-1/2 z-10" />
                <div className="rounded-[28px] overflow-hidden" style={{ background: '#0B0918' }}>
                  <div className="px-3 py-2.5 flex items-center gap-2 border-b border-white/[0.06]">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                      style={{ background: '#0D9488' }}>C</div>
                    <div>
                      <p className="text-white text-[11px] font-medium">Cleo.ai</p>
                      <div className="flex items-center gap-1">
                        <div className="w-1 h-1 rounded-full bg-emerald-400" />
                        <p className="text-[9px]" style={{ color: '#A09FB5' }}>Active now</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 space-y-2.5 h-[400px]">
                    <div className="flex gap-2 items-end">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] text-white font-bold flex-shrink-0"
                        style={{ background: '#0D9488' }}>C</div>
                      <div className="rounded-xl rounded-tl-sm px-3 py-2 max-w-[80%]" style={{ background: '#1A1730' }}>
                        <p className="text-[10px] text-white/80 leading-relaxed">Hey! I'm Cleo. What brings you here today?</p>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <div className="rounded-xl rounded-tr-sm px-3 py-2 max-w-[80%]" style={{ background: '#14B8A6' }}>
                        <p className="text-[10px] text-white leading-relaxed">I'm raising a seed round for my fintech startup in Bangalore</p>
                      </div>
                    </div>
                    <div className="flex gap-2 items-end">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] text-white font-bold flex-shrink-0"
                        style={{ background: '#0D9488' }}>C</div>
                      <div className="rounded-xl rounded-tl-sm px-3 py-2 max-w-[80%]" style={{ background: '#1A1730' }}>
                        <p className="text-[10px] text-white/80 leading-relaxed">I found 3 investors who match your profile perfectly.</p>
                      </div>
                    </div>

                    <div className="space-y-1.5 ml-7">
                      {[
                        { name: 'Meera Iyer', role: 'VC Partner', sector: 'Fintech · Seed', match: 94, delay: 'slide-in-r1' },
                        { name: 'Siddharth A.', role: 'Angel Investor', sector: 'SaaS · Pre-Seed', match: 91, delay: 'slide-in-r2' },
                        { name: 'Ananya Bhat', role: 'Associate', sector: 'AI/ML · Seed-A', match: 88, delay: 'slide-in-r3' },
                      ].map((m) => (
                        <div key={m.name} className={`rounded-lg border border-white/[0.06] p-2 ${m.delay}`}
                          style={{ background: 'rgba(13,148,136,0.04)' }}>
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold"
                              style={{ background: 'rgba(13,148,136,0.2)', color: '#2DD4BF' }}>
                              {m.name.split(' ').map(n => n[0]).join('')}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] text-white font-medium">{m.name} — {m.role}</p>
                              <p className="text-[9px]" style={{ color: '#A09FB5' }}>{m.sector} · {m.match}% match</p>
                            </div>
                          </div>
                          <div className="mt-1.5 h-[3px] rounded-full overflow-hidden" style={{ background: 'rgba(13,148,136,0.15)' }}>
                            <div className="h-full rounded-full animate-bar" style={{ width: `${m.match}%`, background: '#10B981' }} />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2 items-end mt-2">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] text-white font-bold flex-shrink-0"
                        style={{ background: '#0D9488' }}>C</div>
                      <div className="rounded-xl rounded-tl-sm px-3 py-2 flex gap-1" style={{ background: '#1A1730' }}>
                        <div className="w-1.5 h-1.5 rounded-full typing-dot" style={{ background: '#A09FB5' }} />
                        <div className="w-1.5 h-1.5 rounded-full typing-dot" style={{ background: '#A09FB5' }} />
                        <div className="w-1.5 h-1.5 rounded-full typing-dot" style={{ background: '#A09FB5' }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF — METRICS */}
      <section className="border-y border-white/[0.04]" style={{ background: '#0D0B1E' }}>
        <div className="max-w-6xl mx-auto px-6 py-12 sm:py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-0 md:divide-x md:divide-white/[0.06]">
            {[
              { value: 12000, suffix: '+', label: 'Members across India' },
              { value: 94, suffix: '%', label: 'Match accuracy' },
              { value: 48, suffix: ' hrs', label: 'Avg. intro time' },
              { value: 1800, suffix: '+', label: 'Crores raised via Cleo', prefix: '₹' },
            ].map((m, i) => (
              <div key={i} className="text-center md:px-8">
                <p className="text-3xl sm:text-[44px] font-bold text-white tracking-tight leading-none mb-2">
                  <CountUp target={m.value} suffix={m.suffix} prefix={m.prefix || ''} decimals={0} />
                </p>
                <p className="text-xs sm:text-[13px] font-medium" style={{ color: '#A09FB5' }}>{m.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Testimonial Ticker */}
        <div className="border-t border-white/[0.04] py-5 overflow-hidden">
          <div className="flex animate-marquee whitespace-nowrap">
            {[...testimonials, ...testimonials].map((t, i) => (
              <div key={i} className="inline-flex items-center gap-3 mx-6 flex-shrink-0">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                  style={{ background: 'rgba(13,148,136,0.15)', color: '#2DD4BF' }}>
                  {t.initials}
                </div>
                <p className="text-sm italic" style={{ color: '#E8E4F0' }}>"{t.quote}"</p>
                <span className="text-xs font-medium" style={{ color: '#A09FB5' }}>— {t.name}, {t.title}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl sm:text-[40px] font-bold text-white mb-4 tracking-tight">How it works</h2>
            <p className="text-base max-w-md mx-auto" style={{ color: '#A09FB5' }}>
              Three steps to start building meaningful professional connections.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 sm:gap-8">
            {[
              {
                num: '01',
                icon: (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2DD4BF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    <path d="M8 9h8M8 13h4" />
                  </svg>
                ),
                title: 'Tell Cleo what you need',
                desc: 'Describe your goals in plain language — raise a round, find a co-founder, hire engineers, or source deals. Cleo listens like a person.',
              },
              {
                num: '02',
                icon: (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2DD4BF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.35-4.35" />
                    <path d="M8 11h6M11 8v6" />
                  </svg>
                ),
                title: 'Cleo finds your matches',
                desc: 'Our AI searches across 12,000+ verified members across India, weighing sector fit, stage, check size, and intent — not just keywords.',
              },
              {
                num: '03',
                icon: (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2DD4BF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                ),
                title: 'Get warm intros, instantly',
                desc: 'Cleo makes the introduction with context. No cold emails. No awkward LinkedIn DMs.',
              },
            ].map((step, i) => (
              <div key={i} className="relative rounded-2xl border border-white/[0.06] p-8 group hover:border-boardy-400/20 transition-all duration-300"
                style={{ background: '#13112A' }}>
                <div className="absolute top-4 right-6 font-display text-[64px] font-bold leading-none pointer-events-none"
                  style={{ color: 'rgba(13,148,136,0.06)' }}>{step.num}</div>
                <div className="mb-5 w-12 h-12 rounded-xl flex items-center justify-center border border-white/[0.06]"
                  style={{ background: 'rgba(13,148,136,0.06)' }}>
                  {step.icon}
                </div>
                <h3 className="font-semibold text-white text-lg mb-3">{step.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#A09FB5' }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHO IT'S FOR */}
      <section className="py-20 sm:py-28 border-t border-white/[0.04]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl sm:text-[40px] font-bold text-white mb-4 tracking-tight">Built for every side of the table</h2>
            <p className="text-base max-w-md mx-auto" style={{ color: '#A09FB5' }}>
              Whether you're raising, investing, or building — Cleo speaks your language.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2DD4BF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2z" />
                  </svg>
                ),
                title: 'Founders',
                tagline: 'Raise faster. Hire smarter.',
                desc: 'Get in front of investors who\'ve already backed companies like yours.',
                cta: 'I\'m a Founder →',
              },
              {
                icon: (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2DD4BF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                ),
                title: 'Investors',
                tagline: 'Source deals before they\'re announced.',
                desc: 'See pre-pitch founders in your thesis verticals before they hit the market — from Bangalore to Tier-2 India.',
                cta: 'I\'m an Investor →',
              },
              {
                icon: (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2DD4BF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                ),
                title: 'Talent & Operators',
                tagline: 'Land your next role through relationships.',
                desc: 'Get introduced to founders who are hiring — before the job is posted.',
                cta: 'I\'m looking for a role →',
              },
            ].map((persona, i) => (
              <div key={i}
                className="rounded-2xl border border-white/[0.06] p-8 group hover:border-boardy-400/20 transition-all duration-300 cursor-pointer"
                style={{ background: '#13112A' }}
                onClick={() => { setShowAuth(true); setMode('signup'); }}
              >
                <div className="mb-5 w-12 h-12 rounded-xl flex items-center justify-center border border-white/[0.06]"
                  style={{ background: 'rgba(13,148,136,0.06)' }}>
                  {persona.icon}
                </div>
                <h3 className="font-semibold text-white text-xl mb-1">{persona.title}</h3>
                <p className="text-sm font-medium mb-3" style={{ color: '#2DD4BF' }}>{persona.tagline}</p>
                <p className="text-sm leading-relaxed mb-5" style={{ color: '#A09FB5' }}>{persona.desc}</p>
                <span className="inline-flex items-center text-sm font-medium text-white/70 group-hover:text-white transition-colors">
                  {persona.cta}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURED MATCH STORY */}
      <section className="py-20 sm:py-28 border-t border-white/[0.04]">
        <div className="max-w-4xl mx-auto px-6">
          <div className="rounded-2xl border border-white/[0.06] p-8 sm:p-12 relative overflow-hidden"
            style={{ background: '#13112A', borderLeftWidth: '4px', borderLeftColor: '#0D9488' }}>
            <div className="absolute top-0 right-0 w-[300px] h-[300px] rounded-full pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(13,148,136,0.08) 0%, transparent 70%)' }} />
            <blockquote className="font-display text-xl sm:text-[28px] leading-snug text-white/90 mb-8 relative italic">
              "Cleo introduced me to my lead investor in 48 hours. The match was so precise it felt like Cleo had read my pitch deck."
            </blockquote>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold"
                style={{ background: 'rgba(13,148,136,0.15)', color: '#2DD4BF' }}>PS</div>
              <div>
                <p className="text-white font-semibold text-sm">Priya S.</p>
                <p className="text-xs" style={{ color: '#A09FB5' }}>Founder, MedScan AI · Delhi NCR · Raised Series A</p>
                <p className="text-[11px] mt-0.5" style={{ color: '#0D9488' }}>Matched with: Meera I. · Blume Ventures · HealthTech</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-24 sm:py-32 relative overflow-hidden border-t border-white/[0.04]">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(180deg, #0B0918 0%, #13112A 50%, #0B0918 100%)' }} />
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='10' cy='10' r='1' fill='%230D9488'/%3E%3Ccircle cx='30' cy='30' r='1' fill='%230D9488'/%3E%3Ccircle cx='50' cy='10' r='1' fill='%230D9488'/%3E%3Ccircle cx='10' cy='50' r='1' fill='%230D9488'/%3E%3Ccircle cx='50' cy='50' r='1' fill='%230D9488'/%3E%3Cline x1='10' y1='10' x2='30' y2='30' stroke='%230D9488' stroke-width='0.5'/%3E%3Cline x1='30' y1='30' x2='50' y2='10' stroke='%230D9488' stroke-width='0.5'/%3E%3C/svg%3E")`,
          }} />
        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <h2 className="font-display text-3xl sm:text-[44px] font-bold text-white mb-5 tracking-tight leading-tight">
            Your next co-founder, investor, or hire is already on Cleo.
          </h2>
          <p className="text-base mb-10 max-w-lg mx-auto" style={{ color: '#A09FB5' }}>
            Apply for early access or log in if you're already a member.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button onClick={() => { setShowAuth(true); setMode('signup'); }}
              className="px-10 py-[14px] rounded-[10px] text-white font-medium text-sm transition-all duration-200 hover:scale-[1.02]"
              style={{ background: '#0D9488', boxShadow: '0 0 40px rgba(13,148,136,0.3)' }}>
              Apply for Access →
            </button>
            <button onClick={() => { setShowAuth(true); setMode('login'); }}
              className="px-8 py-[14px] rounded-[10px] text-sm font-medium border border-white/10 hover:border-white/20 text-white/60 hover:text-white/80 transition-all">
              Log In
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/[0.04] py-10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-boardy-400">
                <circle cx="8" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="16" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
                <line x1="11" y1="12" x2="13" y2="12" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              <span className="text-white font-semibold text-sm">Cleo.ai</span>
            </div>
            <div className="flex items-center gap-6">
              {[
                { label: 'Privacy', href: '/privacy' },
                { label: 'Terms', href: '/terms' },
                { label: 'Contact', href: 'mailto:hello@cleo.ai' },
              ].map((link) => (
                <a key={link.label} href={link.href} className="text-xs transition-colors hover:text-white/60" style={{ color: '#A09FB5' }}>{link.label}</a>
              ))}
            </div>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
              &copy; {new Date().getFullYear()} Cleo.ai — AI-Powered Professional Networking
            </p>
          </div>
        </div>
      </footer>

      {/* AUTH MODAL */}
      {showAuth && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center"
          role="dialog" aria-modal="true" aria-label={mode === 'signup' ? 'Sign up' : 'Log in'}
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
          onKeyDown={(e) => { if (e.key === 'Escape') setShowAuth(false); }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAuth(false); }}
          tabIndex={-1}
          ref={(el) => el?.focus()}>
          <div className="relative w-full max-w-sm mx-4 fade-up">
            <button onClick={() => setShowAuth(false)}
              className="absolute -top-12 right-0 text-white/40 hover:text-white/80 transition text-sm flex items-center gap-1">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
              Close
            </button>

            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3"
                style={{ background: '#0D9488', boxShadow: '0 0 30px rgba(13,148,136,0.3)' }}>
                <span className="text-white text-xl font-bold">C</span>
              </div>
              <h2 className="font-display text-2xl font-bold text-white">Welcome to Cleo.ai</h2>
              <p className="text-sm mt-1" style={{ color: '#A09FB5' }}>AI Superconnector</p>
            </div>

            <div className="rounded-2xl border border-white/[0.08] p-8" style={{ background: 'rgba(26,23,48,0.95)', backdropFilter: 'blur(20px)' }}>
              <div className="flex gap-1 mb-6 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <button onClick={() => setMode('signup')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    mode === 'signup' ? 'text-white shadow-sm' : 'text-white/40 hover:text-white/70'
                  }`}
                  style={mode === 'signup' ? { background: '#0D9488' } : {}}>Sign Up</button>
                <button onClick={() => setMode('login')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    mode === 'login' ? 'text-white shadow-sm' : 'text-white/40 hover:text-white/70'
                  }`}
                  style={mode === 'login' ? { background: '#0D9488' } : {}}>Log In</button>
              </div>

              {showForgotPassword ? (
                forgotSent ? (
                  <div className="text-center py-4">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(16,185,129,0.1)' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2"><path d="M20 6L9 17l-5-5" /></svg>
                    </div>
                    <p className="text-white text-sm font-medium mb-1">Check your email</p>
                    <p className="text-xs mb-4" style={{ color: '#A09FB5' }}>If an account exists with that email, we sent a reset link.</p>
                    <button type="button" onClick={() => { setShowForgotPassword(false); setForgotSent(false); }} className="text-xs font-medium" style={{ color: '#2DD4BF' }}>Back to Login</button>
                  </div>
                ) : (
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <p className="text-sm mb-1" style={{ color: '#A09FB5' }}>Enter your email and we&apos;ll send you a reset link.</p>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#A09FB5' }}>Email</label>
                      <input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} placeholder="you@example.com" required className="input-dark" />
                    </div>
                    <button type="submit" disabled={forgotLoading} className="btn-primary">{forgotLoading ? 'Sending...' : 'Send Reset Link'}</button>
                    <button type="button" onClick={() => setShowForgotPassword(false)} className="w-full text-xs text-center font-medium" style={{ color: '#2DD4BF' }}>Back to Login</button>
                  </form>
                )
              ) : (
                <>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#A09FB5' }}>Email</label>
                      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com" required className="input-dark" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#A09FB5' }}>Password</label>
                      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                        placeholder={mode === 'signup' ? 'Min 8 characters' : 'Your password'} required
                        minLength={mode === 'signup' ? 8 : undefined} className="input-dark" />
                    </div>
                    {mode === 'login' && (
                      <button type="button" onClick={() => setShowForgotPassword(true)} className="text-xs font-medium" style={{ color: '#2DD4BF' }}>Forgot password?</button>
                    )}
                    {mode === 'signup' && (
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-0.5 rounded border-white/20 bg-white/5 accent-teal-600" />
                        <span className="text-xs leading-relaxed" style={{ color: '#A09FB5' }}>
                          I agree to the <a href="/terms" target="_blank" className="underline" style={{ color: '#2DD4BF' }}>Terms of Service</a> and <a href="/privacy" target="_blank" className="underline" style={{ color: '#2DD4BF' }}>Privacy Policy</a>
                        </span>
                      </label>
                    )}
                    {error && (
                      <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>
                    )}
                    <button type="submit" disabled={loading} className="btn-primary mt-2">
                      {loading ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Loading...
                        </span>
                      ) : mode === 'signup' ? 'Get Started →' : 'Log In →'}
                    </button>
                  </form>

                  {googleEnabled && (
                    <>
                      <div className="flex items-center gap-3 my-4">
                        <div className="flex-1 h-px bg-white/[0.06]" />
                        <span className="text-xs" style={{ color: '#A09FB5' }}>or</span>
                        <div className="flex-1 h-px bg-white/[0.06]" />
                      </div>
                      <a href="/api/auth/google"
                        className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-white/10 text-white/70 text-sm font-medium hover:bg-white/5 hover:border-white/20 transition">
                        <svg width="18" height="18" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        Continue with Google
                      </a>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
