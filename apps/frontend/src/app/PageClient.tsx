'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { motion, useInView as useFramerInView, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { analytics, identifyUser } from '@/lib/posthog';
import { useTranslation } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import TiltCard from '@/components/ui/TiltCard';
import ScrollProgress from '@/components/ui/ScrollProgress';
import SmoothScroll from '@/components/ui/SmoothScroll';
import ParticleNetwork from '@/components/3d/ParticleNetwork';
import AnimatedOrb from '@/components/3d/AnimatedOrb';

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
  if (score === 3) return { label: 'Good', color: '#5EEAD4', width: '65%' };
  return { label: 'Strong', color: '#10b981', width: '100%' };
}

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.15 } },
};

function AnimatedSection({ children, className = '', style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const ref = useRef(null);
  const isInView = useFramerInView(ref, { once: true, margin: '-80px' });
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
  const { t } = useTranslation();
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
  const [linkedinEnabled, setLinkedinEnabled] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [consent, setConsent] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [platformStats, setPlatformStats] = useState<{ memberCount: number; matchCount: number; introductionCount: number } | null>(null);
  const [selectedPersona, setSelectedPersona] = useState<string>('');

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
    api.getGoogleAuthStatus().then(d => setGoogleEnabled(d.enabled)).catch(() => {});
    api.getLinkedInAuthStatus().then(d => setLinkedinEnabled(d.enabled)).catch(() => {});
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0F172A' }}>
        <div className="w-10 h-10 border-2 border-cleya-400 border-t-transparent rounded-full animate-spin" />
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

  const chatMessages = [
    { type: 'bot', text: "Hey! I'm Cleya. What brings you here today?" },
    { type: 'user', text: "I'm raising a seed round for my fintech startup in Bangalore" },
    { type: 'bot', text: "I found 3 investors that match your profile perfectly." },
  ];

  const matchCards = [
    { name: 'Meera Iyer', role: 'VC Partner', sector: 'Fintech · Seed', match: 94 },
    { name: 'Siddharth A.', role: 'Angel Investor', sector: 'SaaS · Pre-Seed', match: 91 },
    { name: 'Ananya Bhat', role: 'Associate', sector: 'AI/ML · Seed-A', match: 88 },
  ];

  return (
    <SmoothScroll>
      <div className="min-h-screen font-sans" style={{ background: '#0F172A' }} suppressHydrationWarning>
        <ScrollProgress />

        {/* NAVBAR */}
        <nav
          role="navigation"
          aria-label="Main navigation"
          className="fixed top-0 left-0 right-0 z-50 transition-all duration-500"
          style={{
            background: scrolled ? 'rgba(15,23,42,0.85)' : 'transparent',
            backdropFilter: scrolled ? 'blur(20px) saturate(180%)' : 'none',
            borderBottom: scrolled ? '1px solid rgba(255,255,255,0.05)' : '1px solid transparent',
          }}
        >
          <div className={`max-w-6xl mx-auto px-6 flex items-center justify-between transition-all duration-300 ${scrolled ? 'py-3' : 'py-5'}`}>
            <div className="flex items-center gap-2.5">
              <svg width="28" height="16" viewBox="0 0 28 16" fill="none">
                <path d="M8 1C4.134 1 1 4.134 1 8s3.134 7 7 7 7-3.134 7-7" stroke="#2DD4BF" strokeWidth="1.8" strokeLinecap="round"/>
                <path d="M20 15c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7" stroke="#2DD4BF" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              <span className="text-white font-bold text-lg tracking-tight">Cleya.ai</span>
            </div>

            <div className="hidden md:flex items-center gap-1">
              <button onClick={() => scrollToSection('how-it-works')} className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors rounded-lg hover:bg-white/[0.03]">
                {t('nav.howItWorks')}
              </button>
              <Link href="/pricing" className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors rounded-lg hover:bg-white/[0.03]">
                {t('nav.pricing')}
              </Link>
              <Link href="/blog" className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors rounded-lg hover:bg-white/[0.03]">
                {t('nav.blog')}
              </Link>
            </div>

            <div className="hidden md:flex items-center gap-3">
              <LanguageSwitcher />
              <button onClick={() => { setShowAuth(true); setMode('login'); }}
                className="px-4 py-2 text-sm text-white/60 hover:text-white transition-colors">{t('nav.login')}</button>
              <button onClick={() => { setShowAuth(true); setMode('signup'); }}
                className="px-6 py-2.5 text-sm font-medium text-white rounded-full transition-all hover:scale-[1.03] hover:shadow-[0_0_30px_rgba(13,148,136,0.3)]"
                style={{ background: 'linear-gradient(135deg, #0D9488, #0F766E)' }}>
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

          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="md:hidden border-t border-white/[0.06] px-6 py-4 space-y-2 overflow-hidden"
                style={{ background: 'rgba(15,23,42,0.97)' }}
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
                  style={{ background: 'linear-gradient(135deg, #0D9488, #0F766E)' }}>{t('nav.getStarted')}</button>
              </motion.div>
            )}
          </AnimatePresence>
        </nav>

        {/* HERO */}
        <section className="relative min-h-screen flex items-center overflow-hidden">
          <ParticleNetwork />
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(13,148,136,0.12) 0%, transparent 70%)' }} />

          <div className="relative max-w-6xl mx-auto px-6 w-full pt-28 pb-20">
            <div className="grid lg:grid-cols-[55%_45%] gap-12 lg:gap-16 items-center">
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              >
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.6 }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-medium uppercase tracking-[0.15em] mb-8 border border-white/[0.08]"
                  style={{ background: 'rgba(13,148,136,0.06)', color: '#2DD4BF' }}
                >
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#2DD4BF' }} />
                  {t('hero.badge')}
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                  className="font-display text-[44px] sm:text-[58px] lg:text-[72px] font-bold text-white leading-[1.05] mb-7 tracking-tight"
                >
                  {t('hero.title1')}<br />
                  <span className="italic" style={{ color: '#2DD4BF' }}>{t('hero.title2')}</span>
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.6 }}
                  className="text-base sm:text-lg leading-relaxed mb-10 max-w-[440px]"
                  style={{ color: '#94A3B8' }}
                >
                  {t('hero.subtitle')}
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6, duration: 0.6 }}
                  className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4"
                >
                  <button onClick={() => { setShowAuth(true); setMode('signup'); }}
                    className="group px-8 py-[14px] rounded-full text-white font-medium text-sm transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_0_40px_rgba(13,148,136,0.35)]"
                    style={{ background: 'linear-gradient(135deg, #0D9488, #0F766E)' }}>
                    {t('hero.cta')}
                    <span className="inline-block ml-1 transition-transform group-hover:translate-x-1">→</span>
                  </button>
                  <button onClick={() => scrollToSection('how-it-works')}
                    className="group flex items-center gap-2 px-4 py-3 text-sm font-medium text-white/50 hover:text-white/80 transition-colors">
                    <span>{t('hero.secondary')}</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="transition-transform group-hover:translate-x-1">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </button>
                </motion.div>
              </motion.div>

              {/* Chat Mockup - 3D floating */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9, rotateY: -10 }}
                animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                transition={{ delay: 0.4, duration: 1, ease: [0.22, 1, 0.36, 1] }}
                className="relative hidden lg:flex justify-center"
                style={{ perspective: '1200px' }}
              >
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                  className="relative"
                  style={{ transform: 'rotateY(-5deg) rotateX(2deg)', transformStyle: 'preserve-3d' }}
                >
                  <div className="absolute -inset-8 rounded-3xl pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(13,148,136,0.15) 0%, transparent 70%)', filter: 'blur(30px)' }} />

                  <div className="relative w-[320px] rounded-2xl border border-white/[0.08] overflow-hidden shadow-2xl"
                    style={{ background: '#0F172A', boxShadow: '0 25px 60px -12px rgba(0,0,0,0.5), 0 0 40px rgba(13,148,136,0.08)' }}>
                    <div className="px-4 py-3 flex items-center gap-3 border-b border-white/[0.06]" style={{ background: 'rgba(30,41,59,0.5)' }}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                        style={{ background: 'linear-gradient(135deg, #0D9488, #0F766E)' }}>C</div>
                      <div>
                        <p className="text-white text-sm font-medium">Cleya.ai</p>
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <p className="text-[11px] text-white/40">Active now</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 space-y-3">
                      {chatMessages.map((msg, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.8 + i * 0.6, duration: 0.5 }}
                          className={`flex ${msg.type === 'user' ? 'justify-end' : 'gap-2 items-end'}`}
                        >
                          {msg.type === 'bot' && (
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] text-white font-bold flex-shrink-0"
                              style={{ background: 'linear-gradient(135deg, #0D9488, #0F766E)' }}>C</div>
                          )}
                          <div className={`rounded-xl px-3 py-2.5 max-w-[82%] ${
                            msg.type === 'user'
                              ? 'rounded-tr-sm bg-gradient-to-r from-[#0D9488] to-[#0F766E]'
                              : 'rounded-tl-sm'
                          }`} style={msg.type === 'bot' ? { background: '#1E293B' } : {}}>
                            <p className={`text-[11px] leading-relaxed ${msg.type === 'user' ? 'text-white' : 'text-white/80'}`}>{msg.text}</p>
                          </div>
                        </motion.div>
                      ))}

                      <div className="space-y-2 ml-8">
                        {matchCards.map((m, i) => (
                          <motion.div
                            key={m.name}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 2.6 + i * 0.2, duration: 0.4, type: 'spring', stiffness: 100 }}
                            className="rounded-xl border border-white/[0.06] p-2.5"
                            style={{ background: 'rgba(13,148,136,0.04)' }}
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold"
                                style={{ background: 'rgba(13,148,136,0.2)', color: '#2DD4BF' }}>
                                {m.name.split(' ').map(n => n[0]).join('')}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] text-white font-medium">{m.name} — {m.role}</p>
                                <p className="text-[10px] text-white/40">{m.sector} · {m.match}% match</p>
                              </div>
                            </div>
                            <div className="mt-2 h-[3px] rounded-full overflow-hidden" style={{ background: 'rgba(13,148,136,0.15)' }}>
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${m.match}%` }}
                                transition={{ delay: 3 + i * 0.2, duration: 0.8, ease: 'easeOut' }}
                                className="h-full rounded-full"
                                style={{ background: 'linear-gradient(90deg, #0D9488, #2DD4BF)' }}
                              />
                            </div>
                          </motion.div>
                        ))}
                      </div>

                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 3.5, duration: 0.3 }}
                        className="flex gap-2 items-end"
                      >
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] text-white font-bold flex-shrink-0"
                          style={{ background: 'linear-gradient(135deg, #0D9488, #0F766E)' }}>C</div>
                        <div className="rounded-xl rounded-tl-sm px-3 py-2.5 flex gap-1.5" style={{ background: '#1E293B' }}>
                          <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#94A3B8', animationDelay: '0ms' }} />
                          <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#94A3B8', animationDelay: '150ms' }} />
                          <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#94A3B8', animationDelay: '300ms' }} />
                        </div>
                      </motion.div>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* SOCIAL PROOF STATS + TESTIMONIAL MARQUEE */}
        <section className="border-y border-white/[0.04]">
          <AnimatedSection className="max-w-6xl mx-auto px-6 py-14">
            <motion.div variants={fadeUp} className="text-center mb-10">
              <p className="text-lg sm:text-xl font-medium text-white/70 max-w-2xl mx-auto leading-relaxed">
                A growing community of founders, investors, and operators building India's startup future.
              </p>
            </motion.div>
          </AnimatedSection>

          <div className="border-t border-white/[0.04] py-6 overflow-hidden">
            <div className="flex animate-marquee whitespace-nowrap">
              {[...testimonials, ...testimonials].map((t, i) => (
                <div key={i} className="inline-flex items-center gap-3 mx-6 flex-shrink-0 group">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-transform group-hover:scale-110"
                    style={{ background: 'rgba(13,148,136,0.12)', color: '#2DD4BF', border: '1px solid rgba(45,212,191,0.1)' }}>
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-sm italic text-white/70 whitespace-normal max-w-[260px]">"{t.quote}"</p>
                    <p className="text-xs font-medium text-white/30 mt-0.5">— {t.name}, {t.title}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* HOW CLEYA WORKS */}
        <section id="how-it-works" className="py-24 sm:py-32">
          <div className="max-w-6xl mx-auto px-6">
            <AnimatedSection className="text-center mb-16">
              <motion.h2 variants={fadeUp} className="font-display text-3xl sm:text-[44px] font-bold text-white mb-4 tracking-tight">
                {t('howItWorks.title')}
              </motion.h2>
              <motion.p variants={fadeUp} className="text-base max-w-md mx-auto" style={{ color: '#94A3B8' }}>
                {t('howItWorks.subtitle')}
              </motion.p>
            </AnimatedSection>

            <AnimatedSection className="grid md:grid-cols-3 gap-6 sm:gap-8">
              {[
                {
                  num: '01',
                  icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2DD4BF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><path d="M8 9h8M8 13h4" /></svg>,
                  title: t('howItWorks.step1.title'),
                  desc: t('howItWorks.step1.desc'),
                },
                {
                  num: '02',
                  icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2DD4BF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /><path d="M8 11h6M11 8v6" /></svg>,
                  title: t('howItWorks.step2.title'),
                  desc: t('howItWorks.step2.desc'),
                },
                {
                  num: '03',
                  icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2DD4BF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
                  title: t('howItWorks.step3.title'),
                  desc: t('howItWorks.step3.desc'),
                },
              ].map((step, i) => (
                <motion.div key={i} variants={fadeUp}>
                  <TiltCard className="relative rounded-2xl border border-white/[0.06] p-8 hover:border-[#2DD4BF]/20 transition-all duration-300 h-full" style={{ background: '#1E293B' }}>
                    <div className="absolute top-4 right-6 font-display text-[72px] font-bold leading-none pointer-events-none select-none"
                      style={{ color: 'rgba(13,148,136,0.06)' }}>{step.num}</div>
                    <div className="relative">
                      <div className="mb-5 w-12 h-12 rounded-xl flex items-center justify-center border border-white/[0.06]"
                        style={{ background: 'rgba(13,148,136,0.08)' }}>
                        {step.icon}
                      </div>
                      <h3 className="font-semibold text-white text-lg mb-3">{step.title}</h3>
                      <p className="text-sm leading-relaxed" style={{ color: '#94A3B8' }}>{step.desc}</p>
                    </div>
                  </TiltCard>
                </motion.div>
              ))}
            </AnimatedSection>
          </div>
        </section>

        {/* BUILT FOR EVERY SIDE */}
        <section className="py-24 sm:py-32 border-t border-white/[0.04]">
          <div className="max-w-6xl mx-auto px-6">
            <AnimatedSection className="text-center mb-16">
              <motion.h2 variants={fadeUp} className="font-display text-3xl sm:text-[44px] font-bold text-white mb-4 tracking-tight">
                Built for every side of the table
              </motion.h2>
              <motion.p variants={fadeUp} className="text-base max-w-md mx-auto" style={{ color: '#94A3B8' }}>
                Whether you're raising, investing, or building — Cleya speaks your language.
              </motion.p>
            </AnimatedSection>

            <AnimatedSection className="grid md:grid-cols-3 gap-6">
              {[
                {
                  icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2DD4BF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2z" /></svg>,
                  title: 'Founders',
                  tagline: 'Raise faster. Hire smarter.',
                  desc: "Get in front of investors who've already backed companies like yours.",
                  cta: "I'm a Founder →",
                  personaValue: 'FOUNDER',
                },
                {
                  icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2DD4BF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>,
                  title: 'Investors',
                  tagline: "Source deals before they're announced.",
                  desc: "See pre-pitch founders in your thesis verticals before they hit the market — from Bangalore to Tier-2 India.",
                  cta: "I'm an Investor →",
                  personaValue: 'INVESTOR',
                },
                {
                  icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2DD4BF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
                  title: 'Talent & Operators',
                  tagline: 'Land your next role through relationships.',
                  desc: "Get introduced to founders who are hiring — before the job is posted.",
                  cta: "I'm looking for a role →",
                  personaValue: 'TALENT',
                },
              ].map((persona, i) => (
                <motion.div key={i} variants={fadeUp}>
                  <TiltCard
                    className="relative rounded-2xl border border-white/[0.06] p-8 hover:border-[#2DD4BF]/20 transition-all duration-300 cursor-pointer h-full group"
                    style={{ background: '#1E293B' }}
                    onClick={() => { setShowAuth(true); setMode('signup'); setSelectedPersona(persona.personaValue); }}
                  >
                    <div className="relative">
                      <div className="mb-5 w-12 h-12 rounded-xl flex items-center justify-center border border-white/[0.06]"
                        style={{ background: 'rgba(13,148,136,0.08)' }}>
                        {persona.icon}
                      </div>
                      <h3 className="font-semibold text-white text-xl mb-1">{persona.title}</h3>
                      <p className="text-sm font-medium mb-3" style={{ color: '#2DD4BF' }}>{persona.tagline}</p>
                      <p className="text-sm leading-relaxed mb-5" style={{ color: '#94A3B8' }}>{persona.desc}</p>
                      <span className="inline-flex items-center text-sm font-medium text-white/50 group-hover:text-white transition-colors">
                        {persona.cta}
                      </span>
                    </div>
                  </TiltCard>
                </motion.div>
              ))}
            </AnimatedSection>
          </div>
        </section>

        {/* FEATURED TESTIMONIAL */}
        <section className="py-24 sm:py-32 border-t border-white/[0.04]">
          <AnimatedSection className="max-w-4xl mx-auto px-6">
            <motion.div variants={fadeUp}>
              <div className="rounded-2xl border border-white/[0.06] p-8 sm:p-14 relative overflow-hidden"
                style={{ background: 'rgba(30,41,59,0.6)', backdropFilter: 'blur(20px)', boxShadow: '0 0 80px rgba(13,148,136,0.06)' }}>
                <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full pointer-events-none"
                  style={{ background: 'radial-gradient(circle, rgba(13,148,136,0.08) 0%, transparent 70%)' }} />
                <div className="absolute -left-4 top-8 font-display text-[120px] font-bold leading-none pointer-events-none select-none"
                  style={{ color: 'rgba(13,148,136,0.06)' }}>"</div>
                <blockquote className="font-display text-xl sm:text-[28px] leading-snug text-white/90 mb-8 relative italic">
                  "Cleya introduced me to my lead investor in 48 hours. The match was so precise it felt like Cleya had read my pitch deck."
                </blockquote>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{ background: 'rgba(13,148,136,0.15)', color: '#2DD4BF', border: '1px solid rgba(45,212,191,0.15)' }}>PS</div>
                  <div>
                    <p className="text-white font-semibold text-sm">Priya S.</p>
                    <p className="text-xs" style={{ color: '#94A3B8' }}>Founder, MedScan AI · Delhi NCR · Raised Series A</p>
                    <p className="text-[11px] mt-0.5" style={{ color: '#0D9488' }}>Matched with: Meera I. · Blume Ventures · HealthTech</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatedSection>
        </section>

        {/* FINAL CTA */}
        <section className="py-28 sm:py-40 relative overflow-hidden border-t border-white/[0.04]">
          <AnimatedOrb />
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at center, rgba(13,148,136,0.08) 0%, transparent 60%)' }} />

          <AnimatedSection className="relative max-w-3xl mx-auto px-6 text-center">
            <motion.h2 variants={fadeUp} className="font-display text-3xl sm:text-[48px] font-bold text-white mb-6 tracking-tight leading-tight">
              Your next co-founder, investor, or hire is already on Cleya.
            </motion.h2>
            <motion.p variants={fadeUp} className="text-base mb-12 max-w-lg mx-auto" style={{ color: '#94A3B8' }}>
              Apply for early access or log in if you're already a member.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button onClick={() => { setShowAuth(true); setMode('signup'); }}
                className="group px-10 py-[15px] rounded-full text-white font-medium text-sm transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_0_50px_rgba(13,148,136,0.4)]"
                style={{ background: 'linear-gradient(135deg, #0D9488, #0F766E)' }}>
                Apply for Access
                <span className="inline-block ml-1 transition-transform group-hover:translate-x-1">→</span>
              </button>
              <button onClick={() => { setShowAuth(true); setMode('login'); }}
                className="px-8 py-[14px] rounded-full text-sm font-medium border border-white/10 hover:border-white/20 text-white/50 hover:text-white/80 transition-all">
                Log In
              </button>
            </motion.div>
          </AnimatedSection>
        </section>

        {/* FOOTER */}
        <footer role="contentinfo" className="border-t border-white/[0.04] py-12">
          <div className="max-w-6xl mx-auto px-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-2.5">
                <svg width="24" height="14" viewBox="0 0 28 16" fill="none">
                  <path d="M8 1C4.134 1 1 4.134 1 8s3.134 7 7 7 7-3.134 7-7" stroke="#2DD4BF" strokeWidth="1.8" strokeLinecap="round"/>
                  <path d="M20 15c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7" stroke="#2DD4BF" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
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
                  <Link key={link.href} href={link.href} className="text-xs transition-colors hover:text-white/60" style={{ color: '#94A3B8' }}>{link.label}</Link>
                ))}
                <span className="w-px h-3 bg-white/10" />
                {[
                  { label: 'Twitter', href: 'https://twitter.com/cleyaai', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> },
                  { label: 'LinkedIn', href: 'https://linkedin.com/company/cleyaai', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg> },
                  { label: 'Instagram', href: 'https://instagram.com/cleyaai', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg> },
                ].map((link) => (
                  <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" className="text-white/30 hover:text-white/60 transition-colors" aria-label={link.label}>{link.icon}</a>
                ))}
              </div>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
                &copy; {new Date().getFullYear()} Cleya.ai — AI-Powered Professional Networking
              </p>
            </div>
          </div>
        </footer>

        {/* AUTH MODAL - preserved exactly */}
        {showAuth && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center"
            role="dialog" aria-modal="true" aria-label={mode === 'signup' ? 'Sign up' : 'Log in'}
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
            onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
            tabIndex={-1}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
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
                  style={{ background: 'linear-gradient(135deg, #0D9488, #0F766E)', boxShadow: '0 0 30px rgba(13,148,136,0.3)' }}>
                  <span className="text-white text-xl font-bold">C</span>
                </div>
                <h2 className="font-display text-2xl font-bold text-white">Welcome to Cleya.ai</h2>
                <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>AI Superconnector</p>
              </div>

              <div className="rounded-2xl border border-white/[0.08] p-8" style={{ background: 'rgba(30,41,59,0.95)', backdropFilter: 'blur(20px)' }}>
                <div className="flex gap-1 mb-6 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <button onClick={() => { setMode('signup'); setError(''); setFieldErrors({}); }}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${mode === 'signup' ? 'text-white shadow-sm' : 'text-white/40 hover:text-white/70'}`}
                    style={mode === 'signup' ? { background: '#0D9488' } : {}}>Sign Up</button>
                  <button onClick={() => { setMode('login'); setError(''); setFieldErrors({}); }}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${mode === 'login' ? 'text-white shadow-sm' : 'text-white/40 hover:text-white/70'}`}
                    style={mode === 'login' ? { background: '#0D9488' } : {}}>Log In</button>
                </div>

                {showForgotPassword ? (
                  forgotSent ? (
                    <div className="text-center py-4">
                      <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(16,185,129,0.1)' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2"><path d="M20 6L9 17l-5-5" /></svg>
                      </div>
                      <p className="text-white text-sm font-medium mb-1">Check your email</p>
                      <p className="text-xs mb-4" style={{ color: '#94A3B8' }}>If an account exists with that email, we sent a reset link.</p>
                      <button type="button" onClick={() => { setShowForgotPassword(false); setForgotSent(false); setError(''); setFieldErrors({}); }} className="text-xs font-medium" style={{ color: '#5EEAD4' }}>Back to Login</button>
                    </div>
                  ) : (
                    <form onSubmit={handleForgotPassword} className="space-y-4">
                      <p className="text-sm mb-1" style={{ color: '#94A3B8' }}>Enter your email and we&apos;ll send you a reset link.</p>
                      <div>
                        <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#94A3B8' }}>Email</label>
                        <input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} placeholder="you@example.com" required className="input-dark" />
                      </div>
                      <button type="submit" disabled={forgotLoading} className="btn-primary">{forgotLoading ? 'Sending...' : 'Send Reset Link'}</button>
                      <button type="button" onClick={() => { setShowForgotPassword(false); setError(''); setFieldErrors({}); }} className="w-full text-xs text-center font-medium" style={{ color: '#5EEAD4' }}>Back to Login</button>
                    </form>
                  )
                ) : (
                  <>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      {mode === 'signup' && (
                        <div>
                          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#94A3B8' }}>Full Name</label>
                          <input type="text" value={fullName} onChange={(e) => { setFullName(e.target.value); setFieldErrors(prev => { const n = {...prev}; delete n.fullName; return n; }); }}
                            placeholder="Your full name" autoComplete="name" className="input-dark"
                            style={fieldErrors.fullName ? { borderColor: '#ef4444' } : {}} />
                          {fieldErrors.fullName && <p className="text-[10px] mt-1 text-red-400">{fieldErrors.fullName}</p>}
                        </div>
                      )}
                      {mode === 'signup' && (
                        <div>
                          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#94A3B8' }}>I am a</label>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { value: 'FOUNDER', label: 'Founder', icon: '🚀' },
                              { value: 'INVESTOR', label: 'Investor', icon: '💰' },
                              { value: 'TALENT', label: 'Talent', icon: '⚡' },
                            ].map((p) => (
                              <button key={p.value} type="button" onClick={() => { setSelectedPersona(p.value); setFieldErrors(prev => { const n = {...prev}; delete n.persona; return n; }); }}
                                className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl border transition-all duration-200"
                                style={{
                                  background: selectedPersona === p.value ? 'rgba(13,148,136,0.15)' : 'rgba(255,255,255,0.03)',
                                  borderColor: selectedPersona === p.value ? '#0D9488' : fieldErrors.persona ? '#ef4444' : 'rgba(255,255,255,0.08)',
                                }}>
                                <span className="text-lg">{p.icon}</span>
                                <span className="text-xs font-medium" style={{ color: selectedPersona === p.value ? '#5EEAD4' : '#94A3B8' }}>{p.label}</span>
                              </button>
                            ))}
                          </div>
                          {fieldErrors.persona && <p className="text-[10px] mt-1 text-red-400">{fieldErrors.persona}</p>}
                        </div>
                      )}
                      <div>
                        <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#94A3B8' }}>Email</label>
                        <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setFieldErrors(prev => { const n = {...prev}; delete n.email; return n; }); }}
                          placeholder="you@example.com" className="input-dark" autoFocus
                          style={fieldErrors.email ? { borderColor: '#ef4444' } : {}}
                          onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} />
                        {fieldErrors.email && <p className="text-[10px] mt-1 text-red-400">{fieldErrors.email}</p>}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#94A3B8' }}>Password</label>
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
                          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#94A3B8' }}>Confirm Password</label>
                          <input type="password" value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); setFieldErrors(prev => { const n = {...prev}; delete n.confirmPassword; return n; }); }}
                            placeholder="Confirm your password" className="input-dark"
                            style={fieldErrors.confirmPassword ? { borderColor: '#ef4444' } : {}} />
                          {fieldErrors.confirmPassword && <p className="text-[10px] mt-1 text-red-400">{fieldErrors.confirmPassword}</p>}
                        </div>
                      )}
                      {mode === 'login' && (
                        <button type="button" onClick={() => setShowForgotPassword(true)} className="text-xs font-medium" style={{ color: '#5EEAD4' }}>Forgot password?</button>
                      )}
                      {error && (
                        <div className="px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.08)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.15)' }}>
                          {error}
                        </div>
                      )}
                      {mode === 'signup' && (
                        <label className="flex items-start gap-2 cursor-pointer text-[11px]" style={{ color: '#94A3B8' }}>
                          <input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); setFieldErrors(prev => { const n = {...prev}; delete n.consent; return n; }); }}
                            className="mt-0.5 accent-[#0D9488]" />
                          <span>I agree to the <Link href="/terms" className="underline hover:text-white/80" target="_blank">Terms</Link> and <Link href="/privacy" className="underline hover:text-white/80" target="_blank">Privacy Policy</Link></span>
                        </label>
                      )}
                      {fieldErrors.consent && <p className="text-[10px] mt-1 text-red-400">{fieldErrors.consent}</p>}
                      <button type="submit" disabled={loading} className="btn-primary">
                        {loading ? (mode === 'signup' ? 'Creating account...' : 'Signing in...') : (mode === 'signup' ? 'Create Account →' : 'Log In →')}
                      </button>
                    </form>

                    {(googleEnabled || linkedinEnabled) && (
                      <>
                        <div className="flex items-center gap-3 my-5">
                          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
                          <span className="text-[11px] uppercase tracking-wider" style={{ color: '#94A3B8' }}>or</span>
                          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
                        </div>
                        <div className="space-y-2">
                          {googleEnabled && (
                            <a href="/api/auth/google" className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium border border-white/[0.08] text-white/70 hover:text-white hover:bg-white/[0.04] transition-all">
                              <svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                              Continue with Google
                            </a>
                          )}
                          {linkedinEnabled && (
                            <a href="/api/auth/linkedin" className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium border border-white/[0.08] text-white/70 hover:text-white hover:bg-white/[0.04] transition-all">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="#0A66C2"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                              Continue with LinkedIn
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
    </SmoothScroll>
  );
}
