'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, SafeAnimatePresence as AnimatePresence } from '@/components/SafeMotion';

type ChatStep =
  | { type: 'bot'; text: string }
  | { type: 'user'; text: string }
  | { type: 'typing' }
  | { type: 'cards'; cards: MatchCard[] }
  | { type: 'intro-card'; intro: IntroCard }
  | { type: 'schedule-card'; schedule: ScheduleCard };

interface MatchCard {
  initials: string;
  name: string;
  role: string;
  sector: string;
  match: number;
}

interface IntroCard {
  from: string;
  fromInitials: string;
  to: string;
  toInitials: string;
  context: string;
  status: string;
}

interface ScheduleCard {
  title: string;
  time: string;
  with: string;
  withInitials: string;
  platform: string;
}

const scenarios: { steps: ChatStep[]; stepDelays: number[] }[] = [
  {
    steps: [
      { type: 'bot', text: "Hey! I'm Cleya. What brings you here today?" },
      { type: 'user', text: "I'm raising a seed round for my fintech startup in Bangalore" },
      { type: 'typing' },
      { type: 'bot', text: "I found 3 investors that match your profile perfectly." },
      {
        type: 'cards',
        cards: [
          { initials: 'MI', name: 'Meera Iyer', role: 'VC Partner', sector: 'Fintech · Seed', match: 94 },
          { initials: 'SA', name: 'Siddharth A.', role: 'Angel Investor', sector: 'SaaS · Pre-Seed', match: 91 },
          { initials: 'AB', name: 'Ananya Bhat', role: 'Associate', sector: 'AI/ML · Seed-A', match: 88 },
        ],
      },
      { type: 'typing' },
    ],
    stepDelays: [400, 1200, 800, 600, 300, 1500],
  },
  {
    steps: [
      { type: 'bot', text: "Great news! Meera Iyer accepted your intro request." },
      { type: 'typing' },
      {
        type: 'intro-card',
        intro: {
          from: 'You',
          fromInitials: 'AM',
          to: 'Meera Iyer',
          toInitials: 'MI',
          context: 'Seed round · Fintech · Bangalore',
          status: 'Intro Accepted ✓',
        },
      },
      { type: 'bot', text: "I've shared your deck and a warm intro note. She's excited about your traction!" },
      { type: 'user', text: "Amazing! Can you set up a meeting?" },
      { type: 'typing' },
      { type: 'bot', text: "Done! I've scheduled a 30-min call for Thursday." },
      {
        type: 'schedule-card',
        schedule: {
          title: 'Intro Call',
          time: 'Thu, 2:30 PM IST',
          with: 'Meera Iyer',
          withInitials: 'MI',
          platform: 'Google Meet',
        },
      },
    ],
    stepDelays: [400, 800, 600, 600, 1200, 800, 600, 300],
  },
  {
    steps: [
      { type: 'user', text: "Cleya, clear my afternoon — I need focus time" },
      { type: 'typing' },
      { type: 'bot', text: "On it! I've rescheduled 2 meetings and blocked 3 hours for deep work." },
      {
        type: 'schedule-card',
        schedule: {
          title: 'Deep Work Block',
          time: 'Today, 2–5 PM IST',
          with: 'Focus Time',
          withInitials: '🎯',
          platform: 'Calendar blocked',
        },
      },
      { type: 'user', text: "Also, prep me for the Blume Ventures call tomorrow" },
      { type: 'typing' },
      { type: 'bot', text: "Here's your prep: Blume has invested in 3 fintech cos in your space. Key partner is Karthik — he values unit economics. I'll send a detailed brief to your inbox." },
      { type: 'typing' },
    ],
    stepDelays: [400, 800, 600, 300, 1200, 800, 600, 1500],
  },
];

const HOLD_DURATION = 2500;

function TypingIndicator() {
  return (
    <div className="flex gap-2.5 items-end">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] text-white font-bold flex-shrink-0"
        style={{ background: 'linear-gradient(135deg, #6C63FF, #4ECDC4)' }}
      >
        C
      </div>
      <div className="rounded-xl rounded-tl-sm px-3.5 py-3 flex gap-1.5" style={{ background: 'rgba(15,22,41,0.8)' }}>
        <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#94A3B8', animationDelay: '0ms' }} />
        <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#94A3B8', animationDelay: '150ms' }} />
        <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#94A3B8', animationDelay: '300ms' }} />
      </div>
    </div>
  );
}

function BotBubble({ text }: { text: string }) {
  return (
    <div className="flex gap-2.5 items-end">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] text-white font-bold flex-shrink-0"
        style={{ background: 'linear-gradient(135deg, #6C63FF, #4ECDC4)' }}
      >
        C
      </div>
      <div className="rounded-xl rounded-tl-sm px-3.5 py-3 max-w-[82%]" style={{ background: 'rgba(15,22,41,0.8)' }}>
        <p className="text-[13px] leading-relaxed text-white/80">{text}</p>
      </div>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="rounded-xl rounded-tr-sm px-3.5 py-3 max-w-[82%] bg-gradient-to-r from-[#6C63FF] to-[#4ECDC4]">
        <p className="text-[13px] leading-relaxed text-white">{text}</p>
      </div>
    </div>
  );
}

function MatchCards({ cards }: { cards: MatchCard[] }) {
  return (
    <div className="space-y-2.5 ml-9">
      {cards.map((m, i) => (
        <motion.div
          key={m.name}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.15, duration: 0.4, type: 'spring', stiffness: 100 }}
          className="rounded-xl border border-white/[0.06] p-3"
          style={{ background: 'rgba(108,99,255,0.04)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold"
              style={{ background: 'rgba(108,99,255,0.2)', color: '#9B95FF' }}
            >
              {m.initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] text-white font-medium">
                {m.name} — {m.role}
              </p>
              <p className="text-[11px] text-white/40">
                {m.sector} · {m.match}% match
              </p>
            </div>
          </div>
          <div className="mt-2.5 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(108,99,255,0.15)' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${m.match}%` }}
              transition={{ delay: 0.3 + i * 0.15, duration: 0.8, ease: 'easeOut' }}
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, #6C63FF, #9B95FF)' }}
            />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function IntroCardView({ intro }: { intro: IntroCard }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, type: 'spring', stiffness: 120 }}
      className="ml-9 rounded-xl border border-emerald-500/20 p-3.5"
      style={{ background: 'linear-gradient(135deg, rgba(108,99,255,0.08), rgba(108,99,255,0.02))' }}
    >
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ background: 'rgba(108,99,255,0.25)', color: '#9B95FF' }}>
            {intro.fromInitials}
          </div>
          <svg width="18" height="10" viewBox="0 0 18 10" fill="none">
            <path d="M1 5h14M13 1l4 4-4 4" stroke="#9B95FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ background: 'rgba(108,99,255,0.25)', color: '#9B95FF' }}>
            {intro.toInitials}
          </div>
        </div>
        <span className="text-[10px] font-semibold text-emerald-400">{intro.status}</span>
      </div>
      <p className="text-[11px] text-white/60 mb-1">{intro.from} → {intro.to}</p>
      <p className="text-[10px] text-white/35">{intro.context}</p>
    </motion.div>
  );
}

function ScheduleCardView({ schedule }: { schedule: ScheduleCard }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, type: 'spring', stiffness: 120 }}
      className="ml-9 rounded-xl border border-white/[0.08] p-3.5"
      style={{ background: 'rgba(15,22,41,0.8)' }}
    >
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: 'rgba(108,99,255,0.2)', color: '#9B95FF' }}>
          {schedule.withInitials}
        </div>
        <div className="flex-1">
          <p className="text-[12px] text-white font-medium">{schedule.title}</p>
          <p className="text-[11px] text-white/40">{schedule.time}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-white/35">
        <span>with {schedule.with}</span>
        <span>·</span>
        <span>{schedule.platform}</span>
      </div>
    </motion.div>
  );
}

const scenarioLabels = ['Matchmaking', 'Warm Intros', 'AI Secretary'];

export default function AnimatedChatPreview() {
  const [scenarioIdx, setScenarioIdx] = useState(0);
  const [visibleSteps, setVisibleSteps] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scenario = scenarios[scenarioIdx];
  const totalSteps = scenario.steps.length;

  const advanceStep = useCallback(() => {
    setVisibleSteps((prev) => {
      if (prev < totalSteps) return prev + 1;
      return prev;
    });
  }, [totalSteps]);

  useEffect(() => {
    setVisibleSteps(0);
    setTransitioning(false);
  }, [scenarioIdx]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [visibleSteps]);

  useEffect(() => {
    if (visibleSteps >= totalSteps) {
      const holdTimer = setTimeout(() => {
        setTransitioning(true);
        setTimeout(() => {
          setScenarioIdx((prev) => (prev + 1) % scenarios.length);
        }, 500);
      }, HOLD_DURATION);
      return () => clearTimeout(holdTimer);
    }

    const delay = scenario.stepDelays[visibleSteps] || 600;
    const timer = setTimeout(advanceStep, delay);
    return () => clearTimeout(timer);
  }, [visibleSteps, totalSteps, scenarioIdx, advanceStep, scenario.stepDelays]);

  const displayed = scenario.steps.slice(0, visibleSteps);

  return (
    <div
      className="relative w-[400px] rounded-2xl border border-white/[0.08] overflow-hidden shadow-2xl"
      style={{ background: '#080D1A', boxShadow: '0 30px 80px -12px rgba(0,0,0,0.6), 0 0 60px rgba(108,99,255,0.12), inset 0 1px 0 rgba(255,255,255,0.05)' }}
    >
      <div className="px-5 py-4 flex items-center gap-3 border-b border-white/[0.06]" style={{ background: 'rgba(15,22,41,0.8)' }}>
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: 'linear-gradient(135deg, #6C63FF, #4ECDC4)' }}>
          C
        </div>
        <div className="flex-1">
          <p className="text-white text-[15px] font-semibold">Cleya.ai</p>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <p className="text-xs text-white/40">Active now</p>
          </div>
        </div>
      </div>

      <div className="flex gap-1.5 px-5 pt-3">
        {scenarioLabels.map((label, i) => (
          <button
            key={label}
            onClick={() => {
              setTransitioning(true);
              setTimeout(() => setScenarioIdx(i), 300);
            }}
            className="flex-1 text-center py-2 rounded-lg transition-all duration-300"
            style={{
              background: i === scenarioIdx ? 'rgba(108,99,255,0.15)' : 'transparent',
              border: i === scenarioIdx ? '1px solid rgba(108,99,255,0.3)' : '1px solid transparent',
            }}
          >
            <span className={`text-[11px] font-medium transition-colors ${i === scenarioIdx ? 'text-emerald-400' : 'text-white/30'}`}>
              {label}
            </span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={scenarioIdx}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: transitioning ? 0 : 1, y: transitioning ? -8 : 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35 }}
          className="p-5 space-y-3.5 h-[340px] overflow-y-auto"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {displayed.map((step, i) => (
            <motion.div
              key={`${scenarioIdx}-${i}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
            >
              {step.type === 'bot' && <BotBubble text={step.text} />}
              {step.type === 'user' && <UserBubble text={step.text} />}
              {step.type === 'typing' && i === displayed.length - 1 && <TypingIndicator />}
              {step.type === 'cards' && <MatchCards cards={step.cards} />}
              {step.type === 'intro-card' && <IntroCardView intro={step.intro} />}
              {step.type === 'schedule-card' && <ScheduleCardView schedule={step.schedule} />}
            </motion.div>
          ))}
          <div ref={chatEndRef} />
        </motion.div>
      </AnimatePresence>

      <div className="px-5 pb-4 flex justify-center gap-2">
        {scenarios.map((_, i) => (
          <div
            key={i}
            className="h-1 rounded-full transition-all duration-500"
            style={{
              width: i === scenarioIdx ? '24px' : '8px',
              background: i === scenarioIdx ? 'linear-gradient(90deg, #6C63FF, #9B95FF)' : 'rgba(255,255,255,0.1)',
            }}
          />
        ))}
      </div>
    </div>
  );
}
