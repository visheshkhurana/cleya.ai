'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { motion, SafeAnimatePresence as AnimatePresence } from '@/components/SafeMotion';
import { api } from '@/lib/api';
import { analytics, identifyUser } from '@/lib/posthog';
import { useI18n } from '@/lib/i18n';
import { translations } from '@/lib/i18n/translations';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import ClerkContinueButton from '@/components/ClerkContinueButton';
import ThreeBackground from '@/components/3d/ThreeBackground';
import TiltCard from '@/components/ui/TiltCard';

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
  if (score === 3) return { label: 'Good', color: '#9B95FF', width: '65%' };
  return { label: 'Strong', color: '#10b981', width: '100%' };
}

const HERO_PHRASES = [
  'raise a round',
  'find a co-founder',
  'source deals',
  'hire senior talent',
  'get warm intros',
];

function RotatingTypewriter() {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const phrase = HERO_PHRASES[phraseIndex];

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const speed = deleting ? 35 : 65;
    const timer = setTimeout(() => {
      if (!deleting && charIndex < phrase.length) {
        setCharIndex(charIndex + 1);
      } else if (!deleting && charIndex === phrase.length) {
        const pauseTimer = setTimeout(() => setDeleting(true), 1800);
        timers.push(pauseTimer);
      } else if (deleting && charIndex > 0) {
        setCharIndex(charIndex - 1);
      } else {
        setDeleting(false);
        setPhraseIndex((phraseIndex + 1) % HERO_PHRASES.length);
      }
    }, speed);
    timers.push(timer);
    return () => timers.forEach(t => clearTimeout(t));
  }, [charIndex, deleting, phrase, phraseIndex]);

  return (
    <span className="inline-block min-w-[180px]">
      <span className="gradient-text">{phrase.slice(0, charIndex)}</span>
      <span className="typing-cursor" />
    </span>
  );
}

const PROFILE_FIELDS = [
  { label: 'Name', value: 'Arjun Mehta', icon: '👤' },
  { label: 'Role', value: 'Founder & CEO', icon: '💼' },
  { label: 'Sector', value: 'Fintech · Payments', icon: '🏢' },
  { label: 'Stage', value: 'Series A · $2M ARR', icon: '📈' },
  { label: 'Location', value: 'Bangalore, India', icon: '📍' },
  { label: 'Looking for', value: 'Lead Investor · $5-8M', icon: '🎯' },
];

function ProfileBuilder({ active, onComplete }: { active: boolean; onComplete?: () => void }) {
  const [visibleFields, setVisibleFields] = useState(0);
  const [typingChars, setTypingChars] = useState(0);
  const [matchScore, setMatchScore] = useState(0);
  const completedRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    setVisibleFields(0);
    setTypingChars(0);
    setMatchScore(0);
    completedRef.current = false;
  }, [active]);

  useEffect(() => {
    if (!active || visibleFields >= PROFILE_FIELDS.length) {
      if (active && visibleFields >= PROFILE_FIELDS.length && matchScore < 94) {
        const t = setTimeout(() => setMatchScore(prev => Math.min(prev + 2, 94)), 30);
        return () => clearTimeout(t);
      }
      if (active && matchScore >= 94 && !completedRef.current) {
        completedRef.current = true;
        onComplete?.();
      }
      return;
    }
    const currentField = PROFILE_FIELDS[visibleFields];
    if (typingChars < currentField.value.length) {
      const t = setTimeout(() => setTypingChars(prev => prev + 1), 40);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setVisibleFields(prev => prev + 1);
      setTypingChars(0);
    }, 300);
    return () => clearTimeout(t);
  }, [active, visibleFields, typingChars, matchScore]);

  return (
    <div className="rounded-2xl p-6 relative overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(20px)' }}>
      <div className="flex items-center gap-3 mb-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg" style={{ background: 'linear-gradient(135deg, rgba(108,99,255,0.2), rgba(78,205,196,0.2))', border: '1px solid rgba(108,99,255,0.3)' }}>
          {visibleFields > 0 ? '👤' : '?'}
        </div>
        <div>
          <p className="text-sm font-medium text-white">{visibleFields > 0 ? PROFILE_FIELDS[0].value : 'Building profile...'}</p>
          <p className="text-xs text-white/30">{visibleFields > 1 ? PROFILE_FIELDS[1].value : 'Analyzing...'}</p>
        </div>
        {matchScore > 0 && (
          <div className="ml-auto text-right">
            <div className="text-xs text-white/30">AI Match Score</div>
            <div className="text-lg font-bold" style={{ color: '#6C63FF' }}>{matchScore}%</div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {PROFILE_FIELDS.map((field, i) => (
          <div key={i} className="flex items-center gap-3 transition-all duration-500" style={{ opacity: i <= visibleFields ? 1 : 0.15, transform: i <= visibleFields ? 'translateX(0)' : 'translateX(10px)' }}>
            <span className="text-sm w-5 text-center">{field.icon}</span>
            <span className="text-xs text-white/40 w-20 shrink-0">{field.label}</span>
            <div className="flex-1 h-8 rounded-lg flex items-center px-3" style={{ background: 'rgba(255,255,255,0.03)', border: i === visibleFields && i < PROFILE_FIELDS.length ? '1px solid rgba(108,99,255,0.3)' : '1px solid rgba(255,255,255,0.04)' }}>
              {i < visibleFields ? (
                <span className="text-sm text-white/80">{field.value}</span>
              ) : i === visibleFields ? (
                <span className="text-sm">
                  <span className="text-white/80">{field.value.slice(0, typingChars)}</span>
                  <span className="typing-cursor" />
                </span>
              ) : (
                <span className="text-sm text-white/15">—</span>
              )}
            </div>
            {i < visibleFields && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" className="shrink-0"><path d="M20 6L9 17l-5-5" /></svg>
            )}
          </div>
        ))}
      </div>

      {matchScore > 0 && (
        <div className="mt-5 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-white/40">Profile completeness</span>
            <span className="text-xs font-medium" style={{ color: '#10b981' }}>Complete</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${matchScore}%`, background: 'linear-gradient(90deg, #6C63FF, #4ECDC4)' }} />
          </div>
        </div>
      )}
    </div>
  );
}

const DIMENSION_TAGS = [
  { label: 'Sector & Stage', color: '#6C63FF' },
  { label: 'Investment Thesis', color: '#4ECDC4' },
  { label: 'Geographic Reach', color: '#6C63FF' },
  { label: 'Connection Intent', color: '#4ECDC4' },
];

const MATCH_RESULTS = [
  { name: 'Meera I.', role: 'VC Partner · Seed Stage', match: 94, color: '#6C63FF' },
  { name: 'Vikram R.', role: 'Angel · Fintech Focus', match: 91, color: '#4ECDC4' },
  { name: 'Siddharth A.', role: 'LP · Growth Capital', match: 88, color: '#06B6D4' },
  { name: 'Priya S.', role: 'Founder · Payments', match: 86, color: '#9B95FF' },
];

function MatchResultCards({ active }: { active: boolean }) {
  const [counters, setCounters] = useState<number[]>(MATCH_RESULTS.map(() => 0));
  const [visibleCards, setVisibleCards] = useState(-1);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!active) return;
    setCounters(MATCH_RESULTS.map(() => 0));
    setVisibleCards(-1);
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current = [];
    MATCH_RESULTS.forEach((_, i) => {
      const t = setTimeout(() => setVisibleCards(i), 100 + i * 200);
      timersRef.current.push(t);
    });
    return () => { timersRef.current.forEach(t => clearTimeout(t)); timersRef.current = []; };
  }, [active]);

  useEffect(() => {
    if (!active || visibleCards < 0) return;
    const allDone = counters.every((c, i) => i <= visibleCards ? c >= MATCH_RESULTS[i].match : true);
    if (allDone && visibleCards >= MATCH_RESULTS.length - 1) return;
    const t = setTimeout(() => {
      setCounters(prev => prev.map((c, i) => i <= visibleCards ? Math.min(c + 2, MATCH_RESULTS[i].match) : 0));
    }, 25);
    return () => clearTimeout(t);
  }, [active, counters, visibleCards]);

  return (
    <div className="grid grid-cols-2 gap-3 mt-6">
      {MATCH_RESULTS.map((profile, i) => (
        <div key={i} className="p-4 rounded-2xl transition-all duration-500"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            opacity: i <= visibleCards ? 1 : 0,
            transform: i <= visibleCards ? 'translateY(0)' : 'translateY(12px)',
          }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
              style={{ background: `${profile.color}20`, border: `1px solid ${profile.color}30` }}>
              {profile.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-white truncate">{profile.name}</p>
              <p className="text-[10px] text-white/35 truncate">{profile.role}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div className="h-full rounded-full transition-all duration-300" style={{ width: `${counters[i]}%`, background: profile.color }} />
            </div>
            <span className="text-[11px] font-bold tabular-nums w-8 text-right" style={{ color: profile.color }}>{counters[i]}%</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ProfileSection() {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [litTags, setLitTags] = useState(-1);
  const [showMatches, setShowMatches] = useState(false);
  const tagTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setActive(true); observer.disconnect(); } },
      { rootMargin: '-100px' }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    return () => { tagTimersRef.current.forEach(t => clearTimeout(t)); };
  }, []);

  const handleProfileComplete = useCallback(() => {
    tagTimersRef.current.forEach(t => clearTimeout(t));
    tagTimersRef.current = [];
    DIMENSION_TAGS.forEach((_, i) => {
      const t = setTimeout(() => setLitTags(i), 300 + i * 400);
      tagTimersRef.current.push(t);
    });
    const finalT = setTimeout(() => setShowMatches(true), 300 + DIMENSION_TAGS.length * 400 + 500);
    tagTimersRef.current.push(finalT);
  }, []);

  return (
    <div ref={ref} className="grid lg:grid-cols-2 gap-16 items-start">
      <div className={`scroll-section ${active ? 'scroll-visible' : ''}`}>
        <div className="scroll-item">
          <div className="text-xs font-medium uppercase tracking-[0.2em] mb-4" style={{ color: '#4ECDC4' }}>
            Watch It Work
          </div>
          <h2 className="font-sans font-bold text-white mb-6 tracking-tight" style={{ fontSize: 'clamp(28px, 3vw + 8px, 44px)' }}>
            Your profile becomes<br />
            <span style={{ color: '#9B95FF' }}>structured intelligence</span>
          </h2>
          <p className="text-base leading-relaxed mb-8 max-w-lg" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Cleya transforms your professional identity into a rich data profile — then instantly finds your best matches across the network.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {DIMENSION_TAGS.map((tag, i) => {
              const lit = i <= litTags;
              return (
                <div key={i} className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-all duration-500 ${lit ? 'dimension-tag-lit' : ''}`}
                  style={{
                    background: lit ? `${tag.color}12` : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${lit ? `${tag.color}40` : 'rgba(255,255,255,0.05)'}`,
                    boxShadow: lit ? `0 0 20px ${tag.color}15` : 'none',
                  }}>
                  <div className="w-1.5 h-1.5 rounded-full transition-all duration-500" style={{ background: tag.color, boxShadow: lit ? `0 0 8px ${tag.color}` : 'none', transform: lit ? 'scale(1.4)' : 'scale(1)' }} />
                  <span className={`text-xs transition-colors duration-500 ${lit ? 'text-white/90' : 'text-white/40'}`}>{tag.label}</span>
                  {lit && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={tag.color} strokeWidth="2.5" className="ml-auto shrink-0"><path d="M20 6L9 17l-5-5" /></svg>}
                </div>
              );
            })}
          </div>

          {showMatches && (
            <div className="mt-8">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-1 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs font-medium text-green-400/80 uppercase tracking-wider">Top Matches Found</span>
              </div>
              <MatchResultCards active={showMatches} />
            </div>
          )}
        </div>
      </div>
      <div className={`transition-all duration-700 ${active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`} style={{ transitionDelay: '0.3s' }}>
        <ProfileBuilder active={active} onComplete={handleProfileComplete} />
      </div>
    </div>
  );
}

const CHAT_MESSAGE = "I'm raising a Series A for my fintech startup. Looking for investors who've backed similar companies in India.";
const CHAT_MATCHES = [
  { name: 'Meera I.', role: 'VC Partner · Seed Stage', match: 94, color: '#6C63FF', initials: 'MI' },
  { name: 'Vikram R.', role: 'Angel · Fintech Focus', match: 91, color: '#4ECDC4', initials: 'VR' },
  { name: 'Siddharth A.', role: 'LP · Growth Capital', match: 88, color: '#06B6D4', initials: 'SA' },
];

function ChatDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [typedChars, setTypedChars] = useState(0);
  const [thinkingDots, setThinkingDots] = useState(0);
  const [visibleMatches, setVisibleMatches] = useState(-1);
  const [introSent, setIntroSent] = useState(false);
  const [btnClicked, setBtnClicked] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && step === 0) { setStep(1); observer.disconnect(); } },
      { rootMargin: '-120px' }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [step]);

  useEffect(() => {
    return () => { timersRef.current.forEach(t => clearTimeout(t)); };
  }, []);

  useEffect(() => {
    if (step !== 1) return;
    if (typedChars < CHAT_MESSAGE.length) {
      const t = setTimeout(() => setTypedChars(p => p + 1), 28);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStep(2), 600);
    timersRef.current.push(t);
    return () => clearTimeout(t);
  }, [step, typedChars]);

  useEffect(() => {
    if (step !== 2) return;
    if (thinkingDots < 6) {
      const t = setTimeout(() => setThinkingDots(p => p + 1), 350);
      return () => clearTimeout(t);
    }
    CHAT_MATCHES.forEach((_, i) => {
      const t = setTimeout(() => setVisibleMatches(i), 200 + i * 300);
      timersRef.current.push(t);
    });
    const t = setTimeout(() => setStep(3), 200 + CHAT_MATCHES.length * 300 + 500);
    timersRef.current.push(t);
  }, [step, thinkingDots]);

  useEffect(() => {
    if (step !== 3) return;
    const t1 = setTimeout(() => setBtnClicked(true), 800);
    const t2 = setTimeout(() => setIntroSent(true), 1600);
    timersRef.current.push(t1, t2);
  }, [step]);

  const activeStep = step >= 3 ? 2 : step >= 2 ? 1 : 0;

  return (
    <div ref={ref} className="grid lg:grid-cols-2 gap-12 items-center">
      <div>
        <div className="text-xs font-medium uppercase tracking-[0.2em] mb-4" style={{ color: '#6C63FF' }}>
          Intelligence Engine
        </div>
        <h2 className="font-sans font-bold text-white mb-6 tracking-tight" style={{ fontSize: 'clamp(28px, 3vw + 8px, 44px)' }}>
          See Cleya in action
        </h2>
        <p className="text-base leading-relaxed mb-10 max-w-lg" style={{ color: 'rgba(255,255,255,0.6)' }}>
          Tell Cleya what you need. Watch it find, rank, and introduce the right people — in seconds.
        </p>

        <div className="space-y-6">
          {[
            { label: 'You describe your intent', desc: "Type what you're looking for — a raise, a hire, a partner." },
            { label: 'Cleya finds your matches', desc: 'AI scores and ranks your network in real time.' },
            { label: 'One-click warm intro', desc: 'Send a contextual introduction with a single tap.' },
          ].map((s, i) => (
            <div key={i} className="flex gap-4 items-start transition-all duration-500"
              style={{ opacity: i <= activeStep ? 1 : 0.3 }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition-all duration-500"
                style={{
                  background: i <= activeStep ? `${['#6C63FF','#4ECDC4','#06B6D4'][i]}15` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${i <= activeStep ? `${['#6C63FF','#4ECDC4','#06B6D4'][i]}40` : 'rgba(255,255,255,0.06)'}`,
                  color: i <= activeStep ? ['#6C63FF','#4ECDC4','#06B6D4'][i] : 'rgba(255,255,255,0.2)',
                  boxShadow: i === activeStep ? `0 0 16px ${['#6C63FF','#4ECDC4','#06B6D4'][i]}25` : 'none',
                }}>
                {i + 1}
              </div>
              <div>
                <p className={`text-sm font-medium transition-colors duration-500 ${i <= activeStep ? 'text-white' : 'text-white/30'}`}>{s.label}</p>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-center">
        <div className="w-[320px] rounded-[2rem] p-3 relative" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 0 80px rgba(108,99,255,0.06)' }}>
          <div className="rounded-[1.4rem] overflow-hidden" style={{ background: '#0A0A1A' }}>
            <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6C63FF, #4ECDC4)' }}>
                <span className="text-white font-bold text-[10px]">C</span>
              </div>
              <span className="text-xs font-medium text-white/70">Cleya AI</span>
              <div className="ml-auto flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
              </div>
            </div>

            <div className="p-4 space-y-3 min-h-[380px]">
              <div className="flex justify-center">
                <span className="text-[10px] text-white/20 px-3 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.03)' }}>Today</span>
              </div>

              {step >= 1 && (
                <div className="flex justify-end">
                  <div className="max-w-[220px] px-3 py-2.5 rounded-2xl rounded-br-md text-[12px] leading-relaxed text-white/90" style={{ background: 'linear-gradient(135deg, rgba(108,99,255,0.2), rgba(78,205,196,0.15))', border: '1px solid rgba(108,99,255,0.15)' }}>
                    {CHAT_MESSAGE.slice(0, typedChars)}
                    {typedChars < CHAT_MESSAGE.length && <span className="typing-cursor" />}
                  </div>
                </div>
              )}

              {step >= 2 && thinkingDots < 6 && (
                <div className="flex justify-start">
                  <div className="px-4 py-3 rounded-2xl rounded-bl-md flex gap-1.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    {[0,1,2].map(d => (
                      <div key={d} className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: `${d * 150}ms` }} />
                    ))}
                  </div>
                </div>
              )}

              {step >= 2 && thinkingDots >= 6 && (
                <div className="flex justify-start">
                  <div className="px-3 py-2 rounded-2xl rounded-bl-md text-[11px] text-white/60" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    Found <span className="text-white font-medium">3 matches</span> in your network:
                  </div>
                </div>
              )}

              {visibleMatches >= 0 && CHAT_MATCHES.map((m, i) => (
                i <= visibleMatches && (
                  <div key={i} className="transition-all duration-400"
                    style={{ opacity: 1, transform: 'translateY(0)', animation: 'slideUp 0.3s ease-out' }}>
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
                        style={{ background: `${m.color}18`, color: m.color, border: `1px solid ${m.color}30` }}>
                        {m.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium text-white truncate">{m.name}</p>
                        <p className="text-[9px] text-white/30 truncate">{m.role}</p>
                      </div>
                      <div className="text-[11px] font-bold shrink-0" style={{ color: m.color }}>{m.match}%</div>
                    </div>
                  </div>
                )
              ))}

              {step >= 3 && !introSent && (
                <div className="flex justify-center pt-1">
                  <button className={`px-5 py-2 rounded-full text-[11px] font-medium text-white transition-all duration-300 ${btnClicked ? 'scale-95 opacity-70' : 'scale-100'}`}
                    style={{ background: 'linear-gradient(135deg, #6C63FF, #4ECDC4)' }}>
                    Send Intro to Meera I. →
                  </button>
                </div>
              )}

              {introSent && (
                <div className="flex justify-start">
                  <div className="px-3 py-2.5 rounded-2xl rounded-bl-md text-[11px] leading-relaxed" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg>
                      <span className="text-green-400 font-medium">Introduction sent</span>
                    </div>
                    <span className="text-white/50">to Meera I. with context about your Series A raise.</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const USE_CASE_PREVIEWS = {
  FOUNDER: [
    { label: 'Pre-Seed Round', status: 'Intro sent', statusColor: '#6C63FF', amount: '$500K' },
    { label: 'Series A Lead', status: 'Meeting set', statusColor: '#10b981', amount: '$4M' },
    { label: 'Strategic Angel', status: 'Matched', statusColor: '#4ECDC4', amount: '$100K' },
  ],
  INVESTOR: [
    { label: 'Fintech · Seed', stage: 'Pre-pitch', score: 96, color: '#6C63FF' },
    { label: 'HealthTech · A', stage: 'Deck received', score: 91, color: '#4ECDC4' },
    { label: 'SaaS · Pre-Seed', stage: 'New match', score: 88, color: '#06B6D4' },
  ],
  TALENT: [
    { label: 'Founding Engineer', company: 'Stealth Fintech', fit: 'Strong', fitColor: '#10b981' },
    { label: 'Head of Product', company: 'Series B SaaS', fit: 'Good', fitColor: '#6C63FF' },
    { label: 'Growth Lead', company: 'Seed HealthTech', fit: 'Strong', fitColor: '#10b981' },
  ],
};

function UseCaseCard({ persona, setShowAuth, setMode, setSelectedPersona }: {
  persona: { title: string; tagline: string; desc: string; cta: string; personaValue: string; accentColor: string; gradient: string; borderColor: string };
  setShowAuth: (v: boolean) => void; setMode: (v: 'login' | 'signup') => void; setSelectedPersona: (v: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [tapped, setTapped] = useState(false);
  const previews = USE_CASE_PREVIEWS[persona.personaValue as keyof typeof USE_CASE_PREVIEWS];
  const revealed = hovered || tapped;

  return (
    <TiltCard className="scroll-item" glowColor={`${persona.accentColor}20`} floatIntensity={0.8}>
      <div
        role="button"
        tabIndex={0}
        aria-label={`${persona.title}: ${persona.tagline}`}
        className="relative rounded-2xl cursor-pointer h-full group transition-all duration-500"
        style={{
          background: persona.gradient,
          border: `1px solid ${revealed ? `${persona.accentColor}30` : persona.borderColor}`,
          boxShadow: revealed ? `0 20px 60px ${persona.accentColor}12` : 'none',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onTouchStart={() => setTapped(p => !p)}
        onClick={() => { if (tapped) return; setShowAuth(true); setMode('signup'); setSelectedPersona(persona.personaValue); }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowAuth(true); setMode('signup'); setSelectedPersona(persona.personaValue); } }}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
      >
        <div className="p-8 pb-4">
          <div className="mb-5 w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-500"
            style={{
              background: `${persona.accentColor}15`,
              border: `1px solid ${persona.accentColor}25`,
              boxShadow: revealed ? `0 0 20px ${persona.accentColor}20` : 'none',
            }}>
            <div className="w-3.5 h-3.5 rounded-sm rotate-45 transition-transform duration-500" style={{ background: persona.accentColor, transform: revealed ? 'rotate(225deg) scale(1.1)' : 'rotate(45deg)' }} />
          </div>
          <h3 className="font-bold text-white text-xl mb-1">{persona.title}</h3>
          <p className="text-sm font-medium mb-3" style={{ color: persona.accentColor }}>{persona.tagline}</p>
          <p className="text-sm leading-relaxed mb-4" style={{ color: 'rgba(255,255,255,0.55)' }}>{persona.desc}</p>
        </div>

        <div className="overflow-hidden transition-all duration-500" style={{ maxHeight: revealed ? '200px' : '0', opacity: revealed ? 1 : 0 }}>
          <div className="px-8 pb-4">
            <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.04)' }}>
              {persona.personaValue === 'FOUNDER' && (previews as typeof USE_CASE_PREVIEWS.FOUNDER).map((p, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2.5" style={{ borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                  <div>
                    <p className="text-[11px] font-medium text-white/80">{p.label}</p>
                    <p className="text-[10px]" style={{ color: p.statusColor }}>{p.status}</p>
                  </div>
                  <span className="text-[11px] font-bold text-white/50">{p.amount}</span>
                </div>
              ))}
              {persona.personaValue === 'INVESTOR' && (previews as typeof USE_CASE_PREVIEWS.INVESTOR).map((p, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2.5" style={{ borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                  <div>
                    <p className="text-[11px] font-medium text-white/80">{p.label}</p>
                    <p className="text-[10px] text-white/30">{p.stage}</p>
                  </div>
                  <span className="text-[11px] font-bold" style={{ color: p.color }}>{p.score}%</span>
                </div>
              ))}
              {persona.personaValue === 'TALENT' && (previews as typeof USE_CASE_PREVIEWS.TALENT).map((p, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2.5" style={{ borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                  <div>
                    <p className="text-[11px] font-medium text-white/80">{p.label}</p>
                    <p className="text-[10px] text-white/30">{p.company}</p>
                  </div>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ color: p.fitColor, background: `${p.fitColor}15` }}>{p.fit}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-8 pb-6">
          <span className="inline-flex items-center gap-2 text-sm font-medium text-white/40 group-hover:text-white transition-colors">
            {persona.cta}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="transition-transform group-hover:translate-x-1">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </span>
        </div>

        <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
          style={{ boxShadow: `0 0 40px ${persona.accentColor}15` }} />
      </div>
    </TiltCard>
  );
}

const ACTIVITY_FEED = [
  { text: 'Meera matched with Vikram', time: '2min ago', color: '#6C63FF' },
  { text: 'Arjun sent intro to Nandini', time: '5min ago', color: '#4ECDC4' },
  { text: 'Priya matched with Siddharth', time: '8min ago', color: '#06B6D4' },
  { text: 'Rahul connected with Kavya', time: '12min ago', color: '#9B95FF' },
  { text: 'Deepak matched with Ananya', time: '15min ago', color: '#6C63FF' },
  { text: 'Sneha sent intro to Rohan', time: '18min ago', color: '#4ECDC4' },
  { text: 'Aditya matched with Pooja', time: '22min ago', color: '#06B6D4' },
  { text: 'Neha connected with Kartik', time: '25min ago', color: '#9B95FF' },
];

function FlipDigit({ digit, delay, color }: { digit: string; delay: number; color: string }) {
  return (
    <span
      className="flip-digit inline-block"
      style={{ animationDelay: `${delay}ms`, color, perspective: '600px' }}
    >
      {digit}
    </span>
  );
}

function AnimatedCounter({ target, suffix = '', color, label }: { target: number; suffix?: string; color: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(target);
  const [flipping, setFlipping] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!ref.current) return;
    setCount(target);
    startedRef.current = false;
    setFlipping(false);
    let rafId: number;
    const startFrom = Math.max(Math.floor(target * 0.7), 1);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !startedRef.current) {
          startedRef.current = true;
          setFlipping(true);
          setCount(startFrom);
          const duration = 1200;
          const startTime = performance.now();
          const step = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.round(startFrom + eased * (target - startFrom)));
            if (progress < 1) rafId = requestAnimationFrame(step);
          };
          rafId = requestAnimationFrame(step);
          observer.disconnect();
        }
      },
      { rootMargin: '-60px' }
    );
    observer.observe(ref.current);
    return () => { observer.disconnect(); cancelAnimationFrame(rafId); };
  }, [target]);

  const digits = `${count}${suffix}`.split('');

  return (
    <div ref={ref} className="text-center p-6 rounded-2xl relative overflow-hidden group"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: `radial-gradient(circle at 50% 50%, ${color}08, transparent 70%)` }} />
      <div className="font-bold text-3xl sm:text-4xl mb-1 tabular-nums relative" style={{ perspective: '600px' }}>
        {flipping ? digits.map((d, i) => (
          <FlipDigit key={`${i}-${d}`} digit={d} delay={i * 60} color={color} />
        )) : (
          <span style={{ color }}>{count}{suffix}</span>
        )}
      </div>
      <div className="text-xs text-white/30 uppercase tracking-wider">{label}</div>
    </div>
  );
}

function AnimatedSection({ children, className = '', style = {}, use3d = true }: { children: React.ReactNode; className?: string; style?: React.CSSProperties; use3d?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '-60px' }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const baseClass = use3d ? 'scroll-3d-enter' : 'scroll-section';
  const visibleClass = visible ? 'scroll-visible' : '';
  return (
    <div ref={ref} className={`${baseClass} ${visibleClass} ${className}`} style={style}>
      {children}
    </div>
  );
}

function GlowButton({ children, onClick, className = '', style = {} }: { children: React.ReactNode; onClick?: () => void; className?: string; style?: React.CSSProperties }) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    btnRef.current.style.setProperty('--glow-x', `${x}px`);
    btnRef.current.style.setProperty('--glow-y', `${y}px`);
  }, []);

  return (
    <button
      ref={btnRef}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      className={`btn-3d btn-glow-follow ${className}`}
      style={style}
    >
      {children}
    </button>
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
  const [clerkEnabled, setClerkEnabled] = useState(false);
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
      const refCode = params.get('ref');
      if (refCode) {
        localStorage.setItem('cleya_ref', refCode);
      }
      const urlError = params.get('error');
      const urlAction = params.get('action');
      if (urlError) {
        const errorMessages: Record<string, string> = {
          linkedin_auth_denied: 'LinkedIn sign-in was cancelled. Please try again.',
          linkedin_token_failed: 'LinkedIn sign-in failed. Please try again.',
          linkedin_no_email: 'Could not retrieve your email from LinkedIn. Please use email sign-in.',
          linkedin_auth_failed: 'LinkedIn sign-in failed. Please try again.',
          linkedin_auth_error: 'LinkedIn sign-in encountered an error. Please try again.',
          google_auth_denied: 'Google sign-in was cancelled. Please try again.',
          google_auth_failed: 'Google sign-in failed. Please try again.',
          google_auth_error: 'Google sign-in encountered an error. Please try again.',
        };
        setError(errorMessages[urlError] || 'Sign-in failed. Please try again or use email.');
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
      if (urlAction === 'signup') {
        setMode('signup');
        setShowAuth(true);
        window.history.replaceState({}, '', '/');
      }
    }
    api.getGoogleAuthStatus().then(d => { if (d && typeof d.enabled === 'boolean') setGoogleEnabled(d.enabled); }).catch(() => {});
    api.getLinkedInAuthStatus().then(d => { if (d && typeof d.enabled === 'boolean') setLinkedinEnabled(d.enabled); }).catch(() => {});
    if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
      api.getClerkAuthStatus().then(d => { if (d && typeof d.enabled === 'boolean') setClerkEnabled(d.enabled); }).catch(() => {});
    }
    api.getMe().then(async (user) => {
      if (!user) { setChecking(false); return; }
      api.setToken('authenticated');
      const profile = await api.getProfile().catch(() => null);
      if (profile?.isComplete) {
        window.location.href = '/dashboard';
      } else {
        window.location.href = '/chat';
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
    if (showAuth) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
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
        if (profile?.isComplete) { window.location.href = '/dashboard'; }
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080D1A' }}>
        <div className="w-10 h-10 border-2 border-brand-violet border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const testimonials = [
    { initials: 'DL', quote: 'Great app, finding some great connections on it.', name: 'Dhruv Lakra', title: 'Analyst · ISV Capital' },
    { initials: 'NS', quote: 'Loved finding new people on this app.', name: 'Navneet Kaur Sachar', title: 'Stride Ventures' },
    { initials: 'VB', quote: 'Very helpful to find serendipitous connections.', name: 'Varun Bengani', title: 'Entrepreneur' },
    { initials: 'KG', quote: 'Almost hired someone from Cleya, love it.', name: 'Kartikeya Gupta', title: 'Consumer Brand Entrepreneur' },
  ];

  return (
    <div className="min-h-screen font-sans" style={{ background: '#080D1A' }} suppressHydrationWarning>
      <ThreeBackground />

      {/* NAVBAR */}
      <nav
        role="navigation"
        aria-label="Main navigation"
        suppressHydrationWarning
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-500"
        style={{
          background: scrolled ? 'rgba(8,13,26,0.85)' : 'transparent',
          backdropFilter: scrolled ? 'blur(20px) saturate(180%)' : 'none',
          borderBottom: scrolled ? '1px solid rgba(255,255,255,0.04)' : '1px solid transparent',
        }}
      >
        <div className={`max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 flex items-center justify-between transition-[padding] duration-300 ${scrolled ? 'py-3' : 'py-5'}`}>
          <a href="/" className="flex items-center gap-2.5 no-underline">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6C63FF, #4ECDC4)' }}>
              <span className="text-white font-bold text-sm">C</span>
            </div>
            <span className="text-white font-bold text-lg tracking-tight">Cleya.ai</span>
          </a>

          <div className="hidden md:flex items-center gap-1">
            <button onClick={() => scrollToSection('how-it-works')} className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors rounded-lg hover:bg-white/[0.03]">
              {t('nav.howItWorks')}
            </button>
            <Link href="/about" className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors rounded-lg hover:bg-white/[0.03]">
              About
            </Link>
            <Link href="/features" className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors rounded-lg hover:bg-white/[0.03]">
              Features
            </Link>
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
              className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors">{t('nav.login')}</button>
            <button onClick={() => { setShowAuth(true); setMode('signup'); }}
              className="px-6 py-2.5 text-sm font-medium text-white rounded-full transition-all hover:scale-[1.03] hover:shadow-[0_0_30px_rgba(108,99,255,0.3)]"
              style={{ background: 'linear-gradient(135deg, #6C63FF, #4ECDC4)' }}>
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
                style={{ background: 'rgba(8,13,26,0.97)' }}
              >
                <button onClick={() => { scrollToSection('how-it-works'); setMobileMenuOpen(false); }}
                  className="block w-full text-left px-3 py-3 text-sm text-white/60 hover:text-white rounded-lg hover:bg-white/5 transition min-h-[44px]">{t('nav.howItWorks')}</button>
                <Link href="/about" className="block w-full text-left px-3 py-3 text-sm text-white/60 hover:text-white rounded-lg hover:bg-white/5 transition min-h-[44px]">About</Link>
                <Link href="/features" className="block w-full text-left px-3 py-3 text-sm text-white/60 hover:text-white rounded-lg hover:bg-white/5 transition min-h-[44px]">Features</Link>
                <Link href="/pricing" className="block w-full text-left px-3 py-3 text-sm text-white/60 hover:text-white rounded-lg hover:bg-white/5 transition min-h-[44px]">{t('nav.pricing')}</Link>
                <Link href="/blog" className="block w-full text-left px-3 py-3 text-sm text-white/60 hover:text-white rounded-lg hover:bg-white/5 transition min-h-[44px]">{t('nav.blog')}</Link>
                <Link href="/contact" className="block w-full text-left px-3 py-3 text-sm text-white/60 hover:text-white rounded-lg hover:bg-white/5 transition min-h-[44px]">Contact</Link>
                <div className="px-3 py-2"><LanguageSwitcher /></div>
                <button onClick={() => { setShowAuth(true); setMode('login'); setMobileMenuOpen(false); }}
                  className="block w-full text-left px-3 py-3 text-sm text-white/60 hover:text-white rounded-lg hover:bg-white/5 transition min-h-[44px]">{t('nav.login')}</button>
                <button onClick={() => { setShowAuth(true); setMode('signup'); setMobileMenuOpen(false); }}
                  className="block w-full text-left px-3 py-3 text-sm font-medium rounded-lg min-h-[44px] text-white"
                  style={{ background: 'linear-gradient(135deg, #6C63FF, #4ECDC4)' }}>{t('nav.getStarted')}</button>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </nav>

      {/* ════════════════════════════════════════════
          SCENE 1: HERO — NETWORK BIRTH
          ════════════════════════════════════════════ */}
      <section className="relative z-10 min-h-screen flex items-center">
        <div className="relative max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 w-full pt-28 pb-20">
          <div className="max-w-4xl lg:max-w-5xl">
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-medium uppercase tracking-[0.2em] mb-8 hero-fade-in"
              style={{ background: 'rgba(108,99,255,0.08)', color: '#9B95FF', border: '1px solid rgba(108,99,255,0.15)', animationDelay: '0.3s' }}
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#9B95FF' }} />
              {t('hero.badge')}
            </div>

            <h1
              className="font-sans font-bold text-white leading-[1.05] mb-8 tracking-tight hero-fade-in"
              style={{ fontSize: 'clamp(40px, 5.5vw + 16px, 84px)', animationDelay: '0.5s' }}
            >
              The AI Network That<br />
              <span className="gradient-text">Connects You to</span><br />
              <span className="gradient-text">What Matters</span>
            </h1>

            <div
              className="leading-relaxed mb-12 max-w-xl lg:max-w-2xl hero-fade-in"
              style={{ color: 'rgba(255,255,255,0.6)', fontSize: 'clamp(16px, 1.2vw + 12px, 22px)', animationDelay: '0.7s' }}
            >
              Whether you want to <RotatingTypewriter /><br />
              Cleya's AI finds the right people — so every connection is intentional.
            </div>

            <div
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 hero-fade-in"
              style={{ animationDelay: '0.9s' }}
            >
              <GlowButton onClick={() => { setShowAuth(true); setMode('signup'); }}
                className="group cta-glow px-10 py-4 rounded-full text-white font-medium text-[15px]"
                style={{ background: 'linear-gradient(135deg, #6C63FF, #4ECDC4)' }}>
                Enter the Network
                <span className="inline-block ml-2 transition-transform group-hover:translate-x-1">→</span>
              </GlowButton>
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
      <section className="relative z-10 py-20 sm:py-28" style={{ background: '#080D1A' }}>
        <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16">
          <ProfileSection />
        </div>
      </section>

      {/* ════════════════════════════════════════════
          SCENE 3: AI MATCHING ENGINE — INTERACTIVE CHAT DEMO
          ════════════════════════════════════════════ */}
      <section id="how-it-works" className="relative z-10 py-20 sm:py-28" style={{ background: '#080D1A' }}>
        <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16">
          <ChatDemo />
        </div>
      </section>

      {/* ════════════════════════════════════════════
          SCENE 4: USE CASES — INTERACTIVE HOVER CARDS
          ════════════════════════════════════════════ */}
      <section className="relative z-10 py-20 sm:py-28" style={{ background: '#080D1A' }}>
        <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16">
          <AnimatedSection className="text-center mb-16">
            <div className="scroll-item text-xs font-medium uppercase tracking-[0.2em] mb-4" style={{ color: '#9B95FF' }}>
              Built for Every Role
            </div>
            <h2 className="scroll-item font-sans font-bold text-white mb-5 tracking-tight" style={{ fontSize: 'clamp(28px, 3.5vw + 8px, 48px)' }}>
              Whether you're raising, investing,<br />or building
            </h2>
          </AnimatedSection>

          <AnimatedSection className="grid md:grid-cols-3 gap-6">
            {[
              {
                title: 'Founders',
                tagline: 'Raise faster. Hire smarter.',
                desc: "Get in front of investors who've already backed companies like yours.",
                cta: "I'm a Founder",
                personaValue: 'FOUNDER',
                gradient: 'linear-gradient(135deg, rgba(108,99,255,0.08), rgba(108,99,255,0.02))',
                borderColor: 'rgba(108,99,255,0.12)',
                accentColor: '#6C63FF',
              },
              {
                title: 'Investors',
                tagline: "Source deals before they're announced.",
                desc: "See pre-pitch founders in your thesis verticals before they hit the market.",
                cta: "I'm an Investor",
                personaValue: 'INVESTOR',
                gradient: 'linear-gradient(135deg, rgba(78,205,196,0.08), rgba(78,205,196,0.02))',
                borderColor: 'rgba(78,205,196,0.12)',
                accentColor: '#4ECDC4',
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
              <UseCaseCard key={i} persona={persona} setShowAuth={setShowAuth} setMode={setMode} setSelectedPersona={setSelectedPersona} />
            ))}
          </AnimatedSection>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          SCENE 5: SOCIAL PROOF — 3D TESTIMONIAL CAROUSEL
          ════════════════════════════════════════════ */}
      <section className="relative z-10 py-24" style={{ background: '#080D1A' }}>
        <AnimatedSection className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 mb-16">
          <div className="text-center mb-12">
            <div className="text-xs font-medium uppercase tracking-[0.2em] mb-4" style={{ color: '#9B95FF' }}>
              Real Results
            </div>
            <h2 className="font-sans font-bold text-white mb-4 tracking-tight" style={{ fontSize: 'clamp(28px, 3vw + 8px, 44px)' }}>
              What our members say
            </h2>
          </div>

          <div className="carousel-3d relative">
            <div className="grid md:grid-cols-3 gap-6">
              {testimonials.slice(0, 3).map((item, i) => {
                const colors = ['#6C63FF', '#4ECDC4', '#06B6D4'];
                return (
                  <TiltCard key={i} className="carousel-card" glowColor={`${colors[i]}15`} floatIntensity={0.5}>
                    <div className="rounded-2xl p-6 h-full relative overflow-hidden"
                      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(10px)' }}>
                      <div className="absolute top-4 right-4 font-sans text-[60px] font-bold leading-none pointer-events-none select-none"
                        style={{ color: `${colors[i]}08` }}>"</div>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold"
                          style={{ background: `${colors[i]}12`, color: colors[i], border: `1px solid ${colors[i]}20` }}>
                          {item.initials}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{item.name}</p>
                          <p className="text-[11px] text-white/30">{item.title}</p>
                        </div>
                      </div>
                      <p className="text-sm text-white/60 leading-relaxed">"{item.quote}"</p>
                    </div>
                  </TiltCard>
                );
              })}
            </div>
          </div>
        </AnimatedSection>

        <AnimatedSection className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16">
          <TiltCard className="testimonial-3d" glowColor="rgba(78,205,196,0.1)" floatIntensity={0.3}>
            <div className="rounded-2xl p-8 sm:p-14 relative overflow-hidden testimonial-featured"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)' }}>
              <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full pointer-events-none"
                style={{ background: 'radial-gradient(circle, rgba(78,205,196,0.06) 0%, transparent 70%)' }} />
              <div className="absolute -left-4 top-6 font-sans text-[120px] font-bold leading-none pointer-events-none select-none"
                style={{ color: 'rgba(108,99,255,0.04)' }}>"</div>
              <blockquote className="font-sans leading-snug text-white/80 mb-8 relative" style={{ fontSize: 'clamp(18px, 2vw + 8px, 26px)' }}>
                "Great app, finding some great connections on it."
              </blockquote>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{ background: 'rgba(78,205,196,0.1)', color: '#9B95FF', border: '1px solid rgba(78,205,196,0.15)' }}>DL</div>
                <div>
                  <p className="text-white font-semibold text-sm">Dhruv Lakra</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Analyst · ISV Capital</p>
                </div>
              </div>
            </div>
          </TiltCard>
        </AnimatedSection>

        <div className="overflow-hidden py-8 mt-12">
          <div className="flex animate-marquee whitespace-nowrap">
            {[...testimonials, ...testimonials].map((item, i) => (
              <div key={i} className="inline-flex items-center gap-4 mx-8 flex-shrink-0 group">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: 'rgba(108,99,255,0.08)', color: '#9B95FF', border: '1px solid rgba(108,99,255,0.12)' }}>
                  {item.initials}
                </div>
                <div>
                  <p className="text-sm text-white/50 whitespace-normal max-w-[280px]">"{item.quote}"</p>
                  <p className="text-xs font-medium text-white/25 mt-1">— {item.name}, {item.title}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          SCENE 6: LIVE NETWORK — ANIMATED STATS
          ════════════════════════════════════════════ */}
      <section className="relative z-10 py-20 sm:py-28" style={{ background: '#080D1A' }}>
        <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16">
          <AnimatedSection className="text-center mb-16">
            <div className="scroll-item text-xs font-medium uppercase tracking-[0.2em] mb-4" style={{ color: '#06B6D4' }}>
              Live Network
            </div>
            <h2 className="scroll-item font-sans font-bold text-white mb-4 tracking-tight" style={{ fontSize: 'clamp(28px, 3vw + 8px, 44px)' }}>
              A growing ecosystem of builders
            </h2>
          </AnimatedSection>

          <div className="grid grid-cols-3 gap-6 sm:gap-10 max-w-3xl mx-auto mb-16">
            <AnimatedCounter target={49} suffix="+" color="#6C63FF" label="Cities" />
            <AnimatedCounter target={31} suffix="+" color="#4ECDC4" label="Industries" />
            <AnimatedCounter target={1} suffix=" Lakh+" color="#06B6D4" label="Connections" />
          </div>

          <div className="overflow-hidden py-4" style={{ mask: 'linear-gradient(90deg, transparent, black 10%, black 90%, transparent)', WebkitMask: 'linear-gradient(90deg, transparent, black 10%, black 90%, transparent)' }}>
            <div className="flex activity-ticker whitespace-nowrap">
              {[...ACTIVITY_FEED, ...ACTIVITY_FEED].map((item, i) => (
                <div key={i} className="inline-flex items-center gap-2 mx-6 flex-shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: item.color }} />
                  <span className="text-xs text-white/40">{item.text}</span>
                  <span className="text-[10px] text-white/20">— {item.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          SCENE 7: FINAL CTA — INFINITE NETWORK
          ════════════════════════════════════════════ */}
      <section className="relative z-10 py-20 sm:py-28" style={{ background: '#080D1A' }}>
        <AnimatedSection className="relative max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 text-center">
          <div className="scroll-item mb-8">
            <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-8 pulse-ring"
              style={{ background: 'linear-gradient(135deg, #6C63FF, #4ECDC4)', boxShadow: '0 0 60px rgba(108,99,255,0.3)' }}>
              <span className="text-white font-bold text-xl">C</span>
            </div>
          </div>

          <h2 className="scroll-item font-sans font-bold text-white mb-6 tracking-tight leading-tight" style={{ fontSize: 'clamp(28px, 4vw + 8px, 52px)' }}>
            Your next opportunity is<br />
            <span className="gradient-text">already in the network</span>
          </h2>
          <p className="scroll-item text-base mb-8 max-w-lg mx-auto" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Join the founders, investors, and operators who are building meaningful connections through AI.
          </p>
          <p className="scroll-item urgency-text text-sm font-medium mb-8" style={{ color: '#F59E0B' }}>
            Only 23 spots remaining this month
          </p>
          <div className="scroll-item flex flex-col sm:flex-row items-center justify-center gap-4">
            <GlowButton onClick={() => { setShowAuth(true); setMode('signup'); }}
              className="group cta-shimmer px-12 py-4 rounded-full text-white font-medium text-[15px]"
              style={{ background: 'linear-gradient(135deg, #6C63FF, #4ECDC4)', boxShadow: '0 0 50px rgba(108,99,255,0.3)' }}>
              Enter the Network
              <span className="inline-block ml-2 transition-transform group-hover:translate-x-1">→</span>
            </GlowButton>
            <button onClick={() => { setShowAuth(true); setMode('login'); }}
              className="btn-3d px-8 py-[14px] rounded-full text-sm font-medium border border-white/8 hover:border-white/15 text-white/40 hover:text-white/70 transition-all">
              Log In
            </button>
          </div>
        </AnimatedSection>
      </section>

      {/* FOOTER */}
      <footer role="contentinfo" className="relative z-10 border-t border-white/[0.04] py-12" style={{ background: '#080D1A' }}>
        <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6C63FF, #4ECDC4)' }}>
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
                style={{ background: 'linear-gradient(135deg, #6C63FF, #4ECDC4)', boxShadow: '0 0 30px rgba(108,99,255,0.3)' }}>
                <span className="text-white text-xl font-bold">C</span>
              </div>
              <h2 className="font-sans text-2xl font-bold text-white">Welcome to Cleya.ai</h2>
              <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>AI Superconnector</p>
            </div>

            <div className="rounded-2xl border border-white/[0.06] p-8" style={{ background: 'rgba(15,15,26,0.95)', backdropFilter: 'blur(20px)' }}>
              <div className="flex gap-1 mb-6 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <button onClick={() => { setMode('signup'); setError(''); setFieldErrors({}); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${mode === 'signup' ? 'text-white shadow-sm' : 'text-white/40 hover:text-white/70'}`}
                  style={mode === 'signup' ? { background: 'linear-gradient(135deg, #6C63FF, #4ECDC4)' } : {}}>Sign Up</button>
                <button onClick={() => { setMode('login'); setError(''); setFieldErrors({}); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${mode === 'login' ? 'text-white shadow-sm' : 'text-white/40 hover:text-white/70'}`}
                  style={mode === 'login' ? { background: 'linear-gradient(135deg, #6C63FF, #4ECDC4)' } : {}}>Log In</button>
              </div>

              {showForgotPassword ? (
                forgotSent ? (
                  <div className="text-center py-4">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(16,185,129,0.1)' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2"><path d="M20 6L9 17l-5-5" /></svg>
                    </div>
                    <p className="text-white text-sm font-medium mb-1">Check your email</p>
                    <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>If an account exists with that email, we sent a reset link.</p>
                    <button type="button" onClick={() => { setShowForgotPassword(false); setForgotSent(false); setError(''); setFieldErrors({}); }} className="text-xs font-medium" style={{ color: '#9B95FF' }}>Back to Login</button>
                  </div>
                ) : (
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <p className="text-sm mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Enter your email and we&apos;ll send you a reset link.</p>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.5)' }}>Email</label>
                      <input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} placeholder="you@example.com" required className="input-dark" />
                    </div>
                    <button type="submit" disabled={forgotLoading} className="btn-primary">{forgotLoading ? 'Sending...' : 'Send Reset Link'}</button>
                    <button type="button" onClick={() => { setShowForgotPassword(false); setError(''); setFieldErrors({}); }} className="w-full text-xs text-center font-medium" style={{ color: '#9B95FF' }}>Back to Login</button>
                  </form>
                )
              ) : (
                <>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {mode === 'signup' && (
                      <div>
                        <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.5)' }}>Full Name</label>
                        <input type="text" value={fullName} onChange={(e) => { setFullName(e.target.value); setFieldErrors(prev => { const n = {...prev}; delete n.fullName; return n; }); }}
                          placeholder="Your full name" autoComplete="name" className="input-dark"
                          style={fieldErrors.fullName ? { borderColor: '#ef4444' } : {}} />
                        {fieldErrors.fullName && <p className="text-[10px] mt-1 text-red-400">{fieldErrors.fullName}</p>}
                      </div>
                    )}
                    {mode === 'signup' && (
                      <div>
                        <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.5)' }}>I am a</label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { value: 'FOUNDER', label: 'Founder', icon: '🚀' },
                            { value: 'INVESTOR', label: 'Investor', icon: '💰' },
                            { value: 'TALENT', label: 'Talent', icon: '⚡' },
                          ].map((p) => (
                            <button key={p.value} type="button" onClick={() => { setSelectedPersona(p.value); setFieldErrors(prev => { const n = {...prev}; delete n.persona; return n; }); }}
                              className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl border transition-all duration-200"
                              style={{
                                background: selectedPersona === p.value ? 'rgba(108,99,255,0.12)' : 'rgba(255,255,255,0.03)',
                                borderColor: selectedPersona === p.value ? '#6C63FF' : fieldErrors.persona ? '#ef4444' : 'rgba(255,255,255,0.06)',
                              }}>
                              <span className="text-lg">{p.icon}</span>
                              <span className="text-xs font-medium" style={{ color: selectedPersona === p.value ? '#9B95FF' : 'rgba(255,255,255,0.4)' }}>{p.label}</span>
                            </button>
                          ))}
                        </div>
                        {fieldErrors.persona && <p className="text-[10px] mt-1 text-red-400">{fieldErrors.persona}</p>}
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.5)' }}>Email</label>
                      <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setFieldErrors(prev => { const n = {...prev}; delete n.email; return n; }); }}
                        placeholder="you@example.com" className="input-dark" autoFocus
                        style={fieldErrors.email ? { borderColor: '#ef4444' } : {}}
                        onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} />
                      {fieldErrors.email && <p className="text-[10px] mt-1 text-red-400">{fieldErrors.email}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.5)' }}>Password</label>
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
                        <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.5)' }}>Confirm Password</label>
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
                          className="mt-0.5 w-4 h-4 rounded border-white/20 bg-white/5 text-brand-violet focus:ring-brand-violet" />
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
                      className="w-full text-xs text-center font-medium mt-3" style={{ color: '#9B95FF' }}>Forgot password?</button>
                  )}

                  {(googleEnabled || linkedinEnabled || clerkEnabled) && (
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
                        {clerkEnabled && (
                          <ClerkContinueButton
                            mode={mode}
                            onSuccess={async () => {
                              try {
                                const profile = await api.getProfile().catch(() => null);
                                if (profile?.isComplete) {
                                  window.location.href = '/dashboard';
                                } else {
                                  window.location.href = '/chat';
                                }
                              } catch {
                                window.location.href = '/chat';
                              }
                            }}
                            onError={(msg) => setError(msg)}
                          />
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
