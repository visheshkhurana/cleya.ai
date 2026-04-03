'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { motion, SafeAnimatePresence as AnimatePresence } from '@/components/SafeMotion';
import { api } from '@/lib/api';
import { analytics, identifyUser } from '@/lib/posthog';
import { useI18n } from '@/lib/i18n';
import { translations } from '@/lib/i18n/translations';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import ThreeBackground from '@/components/3d/ThreeBackground';

function getPasswordStrength(pw: string): { label: string; color: string; width: string } {
  if (!pw) return { label: '', color: '', width: '0%' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { label: 'Weak', color: '#ef4444', width: '20%' };
  if (score === 2) return { label: 'Fair', color: '#f59e0b', width: '40%' };
  if (score === 3) return { label: 'Good', color: '#60A5FA', width: '65%' };
  return { label: 'Strong', color: '#10b981', width: '100%' };
}

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.15 } },
};

function useInView(ref: React.RefObject<Element | null>, options?: { once?: boolean; margin?: string }) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (options?.once) observer.disconnect();
        }
      },
      { rootMargin: options?.margin || '0px' }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return inView;
}

function AnimatedSection({ children, className = '', style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={stagger}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}

export default function Home() {
  const { locale } = useI18n();
  const t = useCallback(
    (key: string) => translations[locale]?.[key] || translations.en[key] || key,
    [locale]
  );
  const [showAuth, setShowAuth] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [linkedinEnabled, setLinkedinEnabled] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const [consent, setConsent] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [platformStats, setPlatformStats] = useState<{ memberCount: number; matchCount: number; introductionCount: number } | null>(null);
  const [selectedPersona, setSelectedPersona] = useState<string>('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    fetch('/api/stats/public').then(r => r.json()).then(d => {
      if (d.success) setPlatformStats(d.data);
    }).catch(() => {});
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
      const urlError = params.get('error');
      const urlAction = params.get('action');
      if (urlError) {
        setError('Sign-in failed. Please try again or use email.');
        setShowAuth(true);
        window.history.replaceState({}, '', '/');
      }
      if (urlAction === 'login') {
        setMode('login');
        setShowAuth(true);
        const toastMsg = sessionStorage.getItem('cleo_login_toast');
        setError(toastMsg || 'Please log in to continue');
        sessionStorage.removeItem('cleo_login_toast');
        window.history.replaceState({}, '', '/');
      }
    }
    api.getGoogleAuthStatus().then(d => { if (d && typeof d.enabled === 'boolean') setGoogleEnabled(d.enabled); }).catch(() => {});
    api.getLinkedInAuthStatus().then(d => { if (d && typeof d.enabled === 'boolean') setLinkedinEnabled(d.enabled); }).catch(() => {});
    api.getMe().then(async (user) => {
      if (!user) { setChecking(false); return; }
      api.setToken('authenticated');
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
    }).catch(() => { setChecking(false); });
  }, []);

  const resetForm = () => {
    setFullName(''); setEmail(''); setPassword(''); setConfirmPassword('');
    setSelectedPersona(''); setConsent(false); setError(''); setFieldErrors({});
    setShowForgotPassword(false); setForgotEmail(''); setForgotSent(false);
  };
  const closeModal = () => { resetForm(); setShowAuth(false); };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape' && showAuth) closeModal(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [showAuth]);

  const isValidEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  const hasHtmlTags = (val: string) => /[<>]/.test(val);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    try { await api.forgotPassword(forgotEmail); setForgotSent(true); } catch {}
    setForgotLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const errs: Record<string, string> = {};
    if (mode === 'signup') {
      if (!fullName.trim()) errs.fullName = 'Name is required';
      else if (hasHtmlTags(fullName)) errs.fullName = 'Name cannot contain special characters like < or >';
      if (!selectedPersona) errs.persona = 'Please select a role';
      if (!email.trim()) errs.email = 'Email is required';
      else if (!isValidEmail(email)) errs.email = 'Please enter a valid email address';
      if (!password) errs.password = 'Password is required';
      else if (password.length < 8) errs.password = 'Password must be at least 8 characters';
      else if (!/[A-Za-z]/.test(password)) errs.password = 'Password must contain at least one letter';
      else if (!/[0-9]/.test(password)) errs.password = 'Password must contain at least one number';
      if (!confirmPassword) errs.confirmPassword = 'Please confirm your password';
      else if (password !== confirmPassword) errs.confirmPassword = 'Passwords do not match';
      if (!consent) errs.consent = 'You must agree to the terms';
    } else {
      if (!email.trim()) errs.email = 'Email is required';
      else if (!isValidEmail(email)) errs.email = 'Please enter a valid email address';
      if (!password) errs.password = 'Password is required';
    }
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setLoading(true);
    try {
      if (mode === 'signup') {
        const utmRaw = localStorage.getItem('cleo_utm');
        const utmData = utmRaw ? JSON.parse(utmRaw) : {};
        await api.signup(email, password, undefined, {
          utmSource: utmData.utm_source, utmMedium: utmData.utm_medium, utmCampaign: utmData.utm_campaign,
        }, fullName || undefined, selectedPersona || undefined);
        localStorage.removeItem('cleo_utm');
        analytics.signupCompleted('email');
        window.location.href = '/chat';
      } else {
        const data = await api.login(email, password);
        identifyUser(data.user?.id || '', { email });
        analytics.login('email');
        const profile = await api.getProfile().catch(() => null);
        if (data.user?.role === 'ADMIN') { window.location.href = '/admin'; }
        else if (profile?.isComplete) { window.location.href = '/dashboard'; }
        else { window.location.href = '/chat'; }
      }
    } catch (err: any) {
      if (err.details) { setError(err.details.map((d: any) => d.message).join('. ')); }
      else { setError(err.message || 'Something went wrong'); }
    } finally { setLoading(false); }
  };

  useEffect(() => {
    const banner = document.getElementById('cookie-consent-banner');
    if (banner) { banner.style.display = showAuth ? 'none' : ''; }
  }, [showAuth]);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#050510' }}>
        <div className="w-10 h-10 border-2 border-electric-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const testimonials = [
    { initials: 'AM', quote: 'Met my lead investor within a week of joining.', name: 'Arjun M.', title: 'Founder · Fintech · Bangalore' },
    { initials: 'MI', quote: 'The deal flow quality is leagues ahead of cold inbound.', name: 'Meera I.', title: 'Partner · Blume Ventures' },
    { initials: 'PS', quote: 'Found a CTO match for my healthtech startup in Tier-2.', name: 'Priya S.', title: 'Founder · HealthTech · Delhi NCR' },
    { initials: 'RV', quote: 'Landed my founding engineer role through a Cleya intro.', name: 'Rahul V.', title: 'Founding Engineer · Bangalore' },
    { initials: 'NK', quote: 'Cleya connected me to 3 portfolio founders in one day.', name: 'Nandini R.', title: 'Venture Partner · Elevation Capital' },
  ];

  return (
    <div className="min-h-screen font-sans" style={{ background: '#050510' }} suppressHydrationWarning>
      <ThreeBackground />

      {/* NAVBAR */}
      <nav
        role="navigation"
        aria-label="Main navigation"
        suppressHydrationWarning
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-500"
        style={{
          background: scrolled ? 'rgba(5,5,16,0.85)' : 'transparent',
          backdropFilter: scrolled ? 'blur(20px) saturate(180%)' : 'none',
          borderBottom: scrolled ? '1px solid rgba(255,255,255,0.04)' : '1px solid transparent',
        }}
      >
        <div className={`max-w-6xl mx-auto px-6 flex items-center justify-between transition-[padding] duration-300 ${scrolled ? 'py-3' : 'py-5'}`}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}>
              <span className="text-white font-bold text-sm">C</span>
            </div>
            <span className="text-white font-bold text-lg tracking-tight">Cleya.ai</span>
          </div>

          <div className="hidden md:flex items-center gap-1">
            <button onClick={() => scrollToSection('how-it-works')} className="px-4 py-2 text-sm text-white/40 hover:text-white transition-colors rounded-lg hover:bg-white/[0.03]">
              {t('nav.howItWorks')}
            </button>
            <Link href="/pricing" className="px-4 py-2 text-sm text-white/40 hover:text-white transition-colors rounded-lg hover:bg-white/[0.03]">
              {t('nav.pricing')}
            </Link>
            <Link href="/blog" className="px-4 py-2 text-sm text-white/40 hover:text-white transition-colors rounded-lg hover:bg-white/[0.03]">
              {t('nav.blog')}
            </Link>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <LanguageSwitcher />
            <button onClick={() => { setShowAuth(true); setMode('login'); }}
              className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors">{t('nav.login')}</button>
            <button onClick={() => { setShowAuth(true); setMode('signup'); }}
              className="px-6 py-2.5 text-sm font-medium text-white rounded-full transition-all hover:scale-[1.03] hover:shadow-[0_0_30px_rgba(59,130,246,0.3)]"
              style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}>
              {t('nav.getStarted')}
            </button>
          </div>

          <button className="md:hidden p-2 text-white/60 hover:text-white transition" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Toggle menu">
            {mobileMenuOpen ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
            )}
          </button>
        </div>

        {mounted && (
          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="md:hidden border-t border-white/[0.04] px-6 py-4 space-y-2 overflow-hidden"
                style={{ background: 'rgba(5,5,16,0.97)' }}
              >
                <button onClick={() => { scrollToSection('how-it-works'); setMobileMenuOpen(false); }}
                  className="block w-full text-left px-3 py-3 text-sm text-white/60 hover:text-white rounded-lg hover:bg-white/5 transition min-h-[44px]">{t('nav.howItWorks')}</button>
                <Link href="/pricing" className="block w-full text-left px-3 py-3 text-sm text-white/60 hover:text-white rounded-lg hover:bg-white/5 transition min-h-[44px]">{t('nav.pricing')}</Link>
                <Link href="/blog" className="block w-full text-left px-3 py-3 text-sm text-white/60 hover:text-white rounded-lg hover:bg-white/5 transition min-h-[44px]">{t('nav.blog')}</Link>
                <div className="px-3 py-2"><LanguageSwitcher /></div>
                <button onClick={() => { setShowAuth(true); setMode('login'); setMobileMenuOpen(false); }}
                  className="block w-full text-left px-3 py-3 text-sm text-white/60 hover:text-white rounded-lg hover:bg-white/5 transition min-h-[44px]">{t('nav.login')}</button>
                <button onClick={() => { setShowAuth(true); setMode('signup'); setMobileMenuOpen(false); }}
                  className="block w-full text-left px-3 py-3 text-sm font-medium rounded-lg min-h-[44px] text-white"
                  style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}>{t('nav.getStarted')}</button>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </nav>

      {/* ════════════════════════════════════════════
          SCENE 1: HERO — NETWORK BIRTH
          ════════════════════════════════════════════ */}
      <section className="relative z-10 min-h-screen flex items-center">
        <div className="relative max-w-6xl mx-auto px-6 w-full pt-28 pb-20">
          <div className="max-w-3xl">
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-medium uppercase tracking-[0.2em] mb-8 hero-fade-in"
              style={{ background: 'rgba(59,130,246,0.08)', color: '#60A5FA', border: '1px solid rgba(59,130,246,0.15)', animationDelay: '0.3s' }}
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#60A5FA' }} />
              {t('hero.badge')}
            </div>

            <h1
              className="font-sans font-bold text-white leading-[1.05] mb-8 tracking-tight hero-fade-in"
              style={{ fontSize: 'clamp(40px, 5vw + 16px, 76px)', animationDelay: '0.5s' }}
            >
              The AI Network That<br />
              <span className="gradient-text">Connects You to</span><br />
              <span className="gradient-text">What Matters</span>
            </h1>

            <p
              className="leading-relaxed mb-12 max-w-[520px] hero-fade-in"
              style={{ color: 'rgba(255,255,255,0.6)', fontSize: 'clamp(16px, 1vw + 12px, 20px)', animationDelay: '0.7s' }}
            >
              AI-powered matchmaking for founders, investors, and talent across India's startup ecosystem. Every connection is intentional.
            </p>

            <div
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 hero-fade-in"
              style={{ animationDelay: '0.9s' }}
            >
              <button onClick={() => { setShowAuth(true); setMode('signup'); }}
                className="group px-10 py-4 rounded-full text-white font-medium text-[15px] transition-all duration-300 hover:scale-[1.03]"
                style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)', boxShadow: '0 0 40px rgba(59,130,246,0.25)' }}>
                Enter the Network
                <span className="inline-block ml-2 transition-transform group-hover:translate-x-1">→</span>
              </button>
              <button onClick={() => scrollToSection('how-it-works')}
                className="group flex items-center gap-2 px-6 py-3 text-sm font-medium text-white/40 hover:text-white/70 transition-colors">
                <span>Explore</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="transition-transform group-hover:translate-y-1">
                  <path d="M12 5v14M19 12l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="w-6 h-10 rounded-full border border-white/10 flex justify-center pt-2"
          >
            <div className="w-1 h-2 rounded-full bg-white/30" />
          </motion.div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          SCENE 2: PROFILE LAYER — DATA VISUALIZATION
          ════════════════════════════════════════════ */}
      <section className="relative z-10 py-32 sm:py-40" style={{ background: '#050510' }}>
        <div className="max-w-6xl mx-auto px-6">
          <AnimatedSection className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div variants={fadeUp}>
              <div className="text-xs font-medium uppercase tracking-[0.2em] mb-4" style={{ color: '#8B5CF6' }}>
                Identity Layer
              </div>
              <h2 className="font-sans font-bold text-white mb-6 tracking-tight" style={{ fontSize: 'clamp(28px, 3vw + 8px, 44px)' }}>
                Your profile becomes<br />
                <span style={{ color: '#60A5FA' }}>structured intelligence</span>
              </h2>
              <p className="text-base leading-relaxed mb-8 max-w-lg" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Cleya transforms your professional identity into a rich data profile — sector, stage, check size, intent, geography — creating a multi-dimensional map of who you are and what you need.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {['Sector & Stage', 'Investment Thesis', 'Geographic Reach', 'Connection Intent'].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: i % 2 === 0 ? '#3B82F6' : '#8B5CF6' }} />
                    <span className="text-xs text-white/60">{item}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div variants={fadeUp} className="relative">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { name: 'Arjun M.', role: 'Founder · Fintech', match: '94%', color: '#3B82F6' },
                  { name: 'Meera I.', role: 'VC Partner · Seed', match: '91%', color: '#8B5CF6' },
                  { name: 'Siddharth A.', role: 'Angel · Pre-Seed', match: '88%', color: '#06B6D4' },
                  { name: 'Priya S.', role: 'Founder · HealthTech', match: '86%', color: '#A78BFA' },
                ].map((profile, i) => (
                  <div key={i} className="p-5 rounded-2xl float-subtle" style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    animationDelay: `${i * 0.5}s`,
                    backdropFilter: 'blur(20px)',
                  }}>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3 text-xs font-bold text-white"
                      style={{ background: `${profile.color}20`, border: `1px solid ${profile.color}30` }}>
                      {profile.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <p className="text-sm font-medium text-white mb-0.5">{profile.name}</p>
                    <p className="text-xs text-white/40 mb-3">{profile.role}</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                        <div className="h-full rounded-full" style={{ width: profile.match, background: profile.color }} />
                      </div>
                      <span className="text-[10px] font-medium" style={{ color: profile.color }}>{profile.match}</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </AnimatedSection>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          SCENE 3: AI MATCHING ENGINE
          ════════════════════════════════════════════ */}
      <section id="how-it-works" className="relative z-10 py-32 sm:py-40" style={{ background: '#050510' }}>
        <div className="max-w-6xl mx-auto px-6">
          <AnimatedSection className="text-center mb-20">
            <motion.div variants={fadeUp} className="text-xs font-medium uppercase tracking-[0.2em] mb-4" style={{ color: '#3B82F6' }}>
              Intelligence Engine
            </motion.div>
            <motion.h2 variants={fadeUp} className="font-sans font-bold text-white mb-5 tracking-tight" style={{ fontSize: 'clamp(28px, 3.5vw + 8px, 48px)' }}>
              {t('howItWorks.title')}
            </motion.h2>
            <motion.p variants={fadeUp} className="text-base max-w-lg mx-auto" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {t('howItWorks.subtitle')}
            </motion.p>
          </AnimatedSection>

          <AnimatedSection className="grid md:grid-cols-3 gap-6">
            {[
              {
                num: '01',
                title: t('howItWorks.step1.title'),
                desc: t('howItWorks.step1.desc'),
                color: '#3B82F6',
              },
              {
                num: '02',
                title: t('howItWorks.step2.title'),
                desc: t('howItWorks.step2.desc'),
                color: '#8B5CF6',
              },
              {
                num: '03',
                title: t('howItWorks.step3.title'),
                desc: t('howItWorks.step3.desc'),
                color: '#06B6D4',
              },
            ].map((step, i) => (
              <motion.div key={i} variants={fadeUp}>
                <div className="relative rounded-2xl p-8 h-full group hover:scale-[1.02] transition-transform duration-300"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="absolute top-4 right-6 font-sans text-[80px] font-bold leading-none pointer-events-none select-none"
                    style={{ color: `${step.color}08` }}>{step.num}</div>
                  <div className="relative">
                    <div className="mb-6 w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ background: `${step.color}10`, border: `1px solid ${step.color}20` }}>
                      <div className="w-3 h-3 rounded-full" style={{ background: step.color, boxShadow: `0 0 20px ${step.color}60` }} />
                    </div>
                    <h3 className="font-semibold text-white text-lg mb-3">{step.title}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>{step.desc}</p>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: `linear-gradient(90deg, transparent, ${step.color}40, transparent)` }} />
                </div>
              </motion.div>
            ))}
          </AnimatedSection>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          SCENE 4: USE CASES — FLOATING MODULES
          ════════════════════════════════════════════ */}
      <section className="relative z-10 py-32 sm:py-40" style={{ background: '#050510' }}>
        <div className="max-w-6xl mx-auto px-6">
          <AnimatedSection className="text-center mb-16">
            <motion.div variants={fadeUp} className="text-xs font-medium uppercase tracking-[0.2em] mb-4" style={{ color: '#A78BFA' }}>
              Built for Every Role
            </motion.div>
            <motion.h2 variants={fadeUp} className="font-sans font-bold text-white mb-5 tracking-tight" style={{ fontSize: 'clamp(28px, 3.5vw + 8px, 48px)' }}>
              Whether you're raising, investing,<br />or building
            </motion.h2>
          </AnimatedSection>

          <AnimatedSection className="grid md:grid-cols-3 gap-6">
            {[
              {
                title: 'Founders',
                tagline: 'Raise faster. Hire smarter.',
                desc: "Get in front of investors who've already backed companies like yours.",
                cta: "I'm a Founder",
                personaValue: 'FOUNDER',
                gradient: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(59,130,246,0.02))',
                borderColor: 'rgba(59,130,246,0.12)',
                accentColor: '#3B82F6',
              },
              {
                title: 'Investors',
                tagline: "Source deals before they're announced.",
                desc: "See pre-pitch founders in your thesis verticals before they hit the market.",
                cta: "I'm an Investor",
                personaValue: 'INVESTOR',
                gradient: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(139,92,246,0.02))',
                borderColor: 'rgba(139,92,246,0.12)',
                accentColor: '#8B5CF6',
              },
              {
                title: 'Talent & Operators',
                tagline: 'Land your next role through relationships.',
                desc: "Get introduced to founders who are hiring — before the job is posted.",
                cta: "I'm looking for a role",
                personaValue: 'TALENT',
                gradient: 'linear-gradient(135deg, rgba(6,182,212,0.08), rgba(6,182,212,0.02))',
                borderColor: 'rgba(6,182,212,0.12)',
                accentColor: '#06B6D4',
              },
            ].map((persona, i) => (
              <motion.div key={i} variants={fadeUp}>
                <div
                  className="relative rounded-2xl p-8 cursor-pointer h-full group hover:scale-[1.02] transition-all duration-300"
                  style={{ background: persona.gradient, border: `1px solid ${persona.borderColor}` }}
                  onClick={() => { setShowAuth(true); setMode('signup'); setSelectedPersona(persona.personaValue); }}
                >
                  <div className="mb-6 w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: `${persona.accentColor}15`, border: `1px solid ${persona.accentColor}25` }}>
                    <div className="w-4 h-4 rounded-sm rotate-45" style={{ background: persona.accentColor }} />
                  </div>
                  <h3 className="font-bold text-white text-xl mb-1">{persona.title}</h3>
                  <p className="text-sm font-medium mb-3" style={{ color: persona.accentColor }}>{persona.tagline}</p>
                  <p className="text-sm leading-relaxed mb-6" style={{ color: 'rgba(255,255,255,0.4)' }}>{persona.desc}</p>
                  <span className="inline-flex items-center gap-2 text-sm font-medium text-white/40 group-hover:text-white transition-colors">
                    {persona.cta}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="transition-transform group-hover:translate-x-1">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </span>
                  <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                    style={{ boxShadow: `0 0 40px ${persona.accentColor}15` }} />
                </div>
              </motion.div>
            ))}
          </AnimatedSection>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          SCENE 5: SOCIAL PROOF — TESTIMONIALS
          ════════════════════════════════════════════ */}
      <section className="relative z-10 py-24" style={{ background: '#050510' }}>
        <div className="overflow-hidden py-8">
          <div className="flex animate-marquee whitespace-nowrap">
            {[...testimonials, ...testimonials].map((t, i) => (
              <div key={i} className="inline-flex items-center gap-4 mx-8 flex-shrink-0 group">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: 'rgba(59,130,246,0.08)', color: '#60A5FA', border: '1px solid rgba(59,130,246,0.12)' }}>
                  {t.initials}
                </div>
                <div>
                  <p className="text-sm text-white/50 whitespace-normal max-w-[280px]">"{t.quote}"</p>
                  <p className="text-xs font-medium text-white/25 mt-1">— {t.name}, {t.title}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <AnimatedSection className="max-w-4xl mx-auto px-6 mt-20">
          <motion.div variants={fadeUp}>
            <div className="rounded-2xl p-8 sm:p-14 relative overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)' }}>
              <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full pointer-events-none"
                style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)' }} />
              <div className="absolute -left-4 top-6 font-sans text-[120px] font-bold leading-none pointer-events-none select-none"
                style={{ color: 'rgba(59,130,246,0.04)' }}>"</div>
              <blockquote className="font-sans leading-snug text-white/80 mb-8 relative" style={{ fontSize: 'clamp(18px, 2vw + 8px, 26px)' }}>
                "Cleya introduced me to my lead investor in 48 hours. The match was so precise it felt like Cleya had read my pitch deck."
              </blockquote>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{ background: 'rgba(139,92,246,0.1)', color: '#A78BFA', border: '1px solid rgba(139,92,246,0.15)' }}>PS</div>
                <div>
                  <p className="text-white font-semibold text-sm">Priya S.</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Founder, MedScan AI · Delhi NCR · Raised Series A</p>
                  <p className="text-[11px] mt-0.5" style={{ color: '#8B5CF6' }}>Matched with: Meera I. · Blume Ventures · HealthTech</p>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatedSection>
      </section>

      {/* ════════════════════════════════════════════
          SCENE 6: LIVE NETWORK — STATS
          ════════════════════════════════════════════ */}
      <section className="relative z-10 py-32" style={{ background: '#050510' }}>
        <div className="max-w-4xl mx-auto px-6">
          <AnimatedSection className="text-center mb-16">
            <motion.div variants={fadeUp} className="text-xs font-medium uppercase tracking-[0.2em] mb-4" style={{ color: '#06B6D4' }}>
              Live Network
            </motion.div>
            <motion.h2 variants={fadeUp} className="font-sans font-bold text-white mb-4 tracking-tight" style={{ fontSize: 'clamp(28px, 3vw + 8px, 44px)' }}>
              A growing ecosystem of builders
            </motion.h2>
          </AnimatedSection>

          <AnimatedSection className="grid grid-cols-3 gap-6 max-w-2xl mx-auto">
            {[
              { label: 'Members', value: platformStats?.memberCount || 24, suffix: '+', color: '#3B82F6' },
              { label: 'Matches', value: platformStats?.matchCount || 150, suffix: '+', color: '#8B5CF6' },
              { label: 'Intros Made', value: platformStats?.introductionCount || 89, suffix: '+', color: '#06B6D4' },
            ].map((stat, i) => (
              <motion.div key={i} variants={fadeUp} className="text-center p-6 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div className="font-bold text-3xl sm:text-4xl mb-1" style={{ color: stat.color }}>
                  {stat.value}{stat.suffix}
                </div>
                <div className="text-xs text-white/30 uppercase tracking-wider">{stat.label}</div>
              </motion.div>
            ))}
          </AnimatedSection>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          SCENE 7: FINAL CTA — INFINITE NETWORK
          ════════════════════════════════════════════ */}
      <section className="relative z-10 py-32 sm:py-44" style={{ background: '#050510' }}>
        <AnimatedSection className="relative max-w-3xl mx-auto px-6 text-center">
          <motion.div variants={fadeUp} className="mb-8">
            <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-8 pulse-ring"
              style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)', boxShadow: '0 0 60px rgba(59,130,246,0.3)' }}>
              <span className="text-white font-bold text-xl">C</span>
            </div>
          </motion.div>

          <motion.h2 variants={fadeUp} className="font-sans font-bold text-white mb-6 tracking-tight leading-tight" style={{ fontSize: 'clamp(28px, 4vw + 8px, 52px)' }}>
            Your next opportunity is<br />
            <span className="gradient-text">already in the network</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="text-base mb-14 max-w-lg mx-auto" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Join the founders, investors, and operators who are building meaningful connections through AI.
          </motion.p>
          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button onClick={() => { setShowAuth(true); setMode('signup'); }}
              className="group px-12 py-4 rounded-full text-white font-medium text-[15px] transition-all duration-300 hover:scale-[1.03]"
              style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)', boxShadow: '0 0 50px rgba(59,130,246,0.3)' }}>
              Enter the Network
              <span className="inline-block ml-2 transition-transform group-hover:translate-x-1">→</span>
            </button>
            <button onClick={() => { setShowAuth(true); setMode('login'); }}
              className="px-8 py-[14px] rounded-full text-sm font-medium border border-white/8 hover:border-white/15 text-white/40 hover:text-white/70 transition-all">
              Log In
            </button>
          </motion.div>
        </AnimatedSection>
      </section>

      {/* FOOTER */}
      <footer role="contentinfo" className="relative z-10 border-t border-white/[0.04] py-12" style={{ background: '#050510' }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}>
                <span className="text-white font-bold text-[10px]">C</span>
              </div>
              <span className="text-white font-semibold text-sm">Cleya.ai</span>
            </div>
            <div className="flex items-center gap-6 flex-wrap justify-center">
              {[
                { label: t('nav.about'), href: '/about' },
                { label: t('nav.pricing'), href: '/pricing' },
                { label: t('nav.blog'), href: '/blog' },
                { label: t('footer.privacy'), href: '/privacy' },
                { label: t('footer.terms'), href: '/terms' },
                { label: t('nav.contact'), href: '/contact' },
              ].map((link) => (
                <Link key={link.href} href={link.href} className="text-xs transition-colors hover:text-white/50" style={{ color: 'rgba(255,255,255,0.25)' }}>{link.label}</Link>
              ))}
              <span className="w-px h-3 bg-white/10" />
              {[
                { label: 'Twitter', href: 'https://twitter.com/cleyaai', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> },
                { label: 'LinkedIn', href: 'https://linkedin.com/company/cleyaai', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg> },
                { label: 'Instagram', href: 'https://instagram.com/cleyaai', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg> },
              ].map((link) => (
                <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" className="text-white/20 hover:text-white/50 transition-colors" aria-label={link.label}>{link.icon}</a>
              ))}
            </div>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.15)' }}>
              &copy; {new Date().getFullYear()} Cleya.ai — AI-Powered Professional Networking
            </p>
          </div>
        </div>
      </footer>

      {/* AUTH MODAL */}
      {showAuth && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center"
          role="dialog" aria-modal="true" aria-label={mode === 'signup' ? 'Sign up' : 'Log in'}
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
          tabIndex={-1}>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.25 }}
            className="relative w-full max-w-sm mx-4"
          >
            <button onClick={() => closeModal()}
              className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full text-white/40 hover:text-white/80 hover:bg-white/10 transition"
              aria-label="Close">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>

            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3"
                style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)', boxShadow: '0 0 30px rgba(59,130,246,0.3)' }}>
                <span className="text-white text-xl font-bold">C</span>
              </div>
              <h2 className="font-sans text-2xl font-bold text-white">Welcome to Cleya.ai</h2>
              <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>AI Superconnector</p>
            </div>

            <div className="rounded-2xl border border-white/[0.06] p-8" style={{ background: 'rgba(15,15,26,0.95)', backdropFilter: 'blur(20px)' }}>
              <div className="flex gap-1 mb-6 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <button onClick={() => { setMode('signup'); setError(''); setFieldErrors({}); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${mode === 'signup' ? 'text-white shadow-sm' : 'text-white/40 hover:text-white/70'}`}
                  style={mode === 'signup' ? { background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' } : {}}>Sign Up</button>
                <button onClick={() => { setMode('login'); setError(''); setFieldErrors({}); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${mode === 'login' ? 'text-white shadow-sm' : 'text-white/40 hover:text-white/70'}`}
                  style={mode === 'login' ? { background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' } : {}}>Log In</button>
              </div>

              {showForgotPassword ? (
                forgotSent ? (
                  <div className="text-center py-4">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(16,185,129,0.1)' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2"><path d="M20 6L9 17l-5-5" /></svg>
                    </div>
                    <p className="text-white text-sm font-medium mb-1">Check your email</p>
                    <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>If an account exists with that email, we sent a reset link.</p>
                    <button type="button" onClick={() => { setShowForgotPassword(false); setForgotSent(false); setError(''); setFieldErrors({}); }} className="text-xs font-medium" style={{ color: '#60A5FA' }}>Back to Login</button>
                  </div>
                ) : (
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <p className="text-sm mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Enter your email and we&apos;ll send you a reset link.</p>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>Email</label>
                      <input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} placeholder="you@example.com" required className="input-dark" />
                    </div>
                    <button type="submit" disabled={forgotLoading} className="btn-primary">{forgotLoading ? 'Sending...' : 'Send Reset Link'}</button>
                    <button type="button" onClick={() => { setShowForgotPassword(false); setError(''); setFieldErrors({}); }} className="w-full text-xs text-center font-medium" style={{ color: '#60A5FA' }}>Back to Login</button>
                  </form>
                )
              ) : (
                <>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {mode === 'signup' && (
                      <div>
                        <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>Full Name</label>
                        <input type="text" value={fullName} onChange={(e) => { setFullName(e.target.value); setFieldErrors(prev => { const n = {...prev}; delete n.fullName; return n; }); }}
                          placeholder="Your full name" autoComplete="name" className="input-dark"
                          style={fieldErrors.fullName ? { borderColor: '#ef4444' } : {}} />
                        {fieldErrors.fullName && <p className="text-[10px] mt-1 text-red-400">{fieldErrors.fullName}</p>}
                      </div>
                    )}
                    {mode === 'signup' && (
                      <div>
                        <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>I am a</label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { value: 'FOUNDER', label: 'Founder', icon: '🚀' },
                            { value: 'INVESTOR', label: 'Investor', icon: '💰' },
                            { value: 'TALENT', label: 'Talent', icon: '⚡' },
                          ].map((p) => (
                            <button key={p.value} type="button" onClick={() => { setSelectedPersona(p.value); setFieldErrors(prev => { const n = {...prev}; delete n.persona; return n; }); }}
                              className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl border transition-all duration-200"
                              style={{
                                background: selectedPersona === p.value ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.03)',
                                borderColor: selectedPersona === p.value ? '#3B82F6' : fieldErrors.persona ? '#ef4444' : 'rgba(255,255,255,0.06)',
                              }}>
                              <span className="text-lg">{p.icon}</span>
                              <span className="text-xs font-medium" style={{ color: selectedPersona === p.value ? '#60A5FA' : 'rgba(255,255,255,0.4)' }}>{p.label}</span>
                            </button>
                          ))}
                        </div>
                        {fieldErrors.persona && <p className="text-[10px] mt-1 text-red-400">{fieldErrors.persona}</p>}
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>Email</label>
                      <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setFieldErrors(prev => { const n = {...prev}; delete n.email; return n; }); }}
                        placeholder="you@example.com" className="input-dark" autoFocus
                        style={fieldErrors.email ? { borderColor: '#ef4444' } : {}}
                        onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} />
                      {fieldErrors.email && <p className="text-[10px] mt-1 text-red-400">{fieldErrors.email}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>Password</label>
                      <input type="password" value={password} onChange={(e) => { setPassword(e.target.value); setFieldErrors(prev => { const n = {...prev}; delete n.password; return n; }); }}
                        placeholder={mode === 'signup' ? 'Min 8 chars, letter + number' : 'Your password'}
                        className="input-dark" style={fieldErrors.password ? { borderColor: '#ef4444' } : {}}
                        onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} />
                      {fieldErrors.password && <p className="text-[10px] mt-1 text-red-400">{fieldErrors.password}</p>}
                      {mode === 'signup' && password.length > 0 && (() => {
                        const strength = getPasswordStrength(password);
                        return (
                          <div className="mt-2">
                            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                              <div className="h-full rounded-full transition-all duration-300" style={{ width: strength.width, background: strength.color }} />
                            </div>
                            <p className="text-[10px] mt-1 text-right" style={{ color: strength.color }}>{strength.label}</p>
                          </div>
                        );
                      })()}
                    </div>
                    {mode === 'signup' && (
                      <div>
                        <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>Confirm Password</label>
                        <input type="password" value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); setFieldErrors(prev => { const n = {...prev}; delete n.confirmPassword; return n; }); }}
                          placeholder="Confirm your password" className="input-dark"
                          style={fieldErrors.confirmPassword ? { borderColor: '#ef4444' } : {}}
                          onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} />
                        {fieldErrors.confirmPassword && <p className="text-[10px] mt-1 text-red-400">{fieldErrors.confirmPassword}</p>}
                      </div>
                    )}
                    {mode === 'signup' && (
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); setFieldErrors(prev => { const n = {...prev}; delete n.consent; return n; }); }}
                          className="mt-0.5 w-4 h-4 rounded border-white/20 bg-white/5 text-electric-500 focus:ring-electric-500" />
                        <span className="text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
                          I agree to the <Link href="/terms" className="underline hover:text-white/70">Terms</Link> and <Link href="/privacy" className="underline hover:text-white/70">Privacy Policy</Link>
                        </span>
                      </label>
                    )}
                    {fieldErrors.consent && <p className="text-[10px] text-red-400">{fieldErrors.consent}</p>}
                    {error && <p className="text-sm text-red-400 text-center bg-red-500/5 rounded-xl py-2 px-3">{error}</p>}
                    <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Please wait...' : (mode === 'signup' ? 'Create Account' : 'Log In')}</button>
                  </form>

                  {mode === 'login' && (
                    <button type="button" onClick={() => { setShowForgotPassword(true); setError(''); setFieldErrors({}); }}
                      className="w-full text-xs text-center font-medium mt-3" style={{ color: '#60A5FA' }}>Forgot password?</button>
                  )}

                  {(googleEnabled || linkedinEnabled) && (
                    <>
                      <div className="flex items-center gap-3 my-5">
                        <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
                        <span className="text-[11px] text-white/30">or</span>
                        <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
                      </div>
                      <div className="space-y-2">
                        {linkedinEnabled && (
                          <a href="/api/auth/linkedin" className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-white/[0.06] text-sm text-white/60 hover:text-white hover:border-white/10 transition-all"
                            style={{ background: 'rgba(255,255,255,0.02)' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                            Continue with LinkedIn
                          </a>
                        )}
                        {googleEnabled && (
                          <a href="/api/auth/google" className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-white/[0.06] text-sm text-white/60 hover:text-white hover:border-white/10 transition-all"
                            style={{ background: 'rgba(255,255,255,0.02)' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                            Continue with Google
                          </a>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
