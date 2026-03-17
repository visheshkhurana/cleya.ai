'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useRouter, useParams } from 'next/navigation';
import MobileNav from '@/components/MobileNav';

interface IntroDetail {
  id: string;
  matchId: string;
  userAId: string;
  userBId: string;
  status: string;
  talkingPoints: string[];
  scheduledAt?: string;
  notes?: string;
  createdAt: string;
  match: { score: number; reason?: string };
  userA: { id: string; email: string; profile?: any };
  userB: { id: string; email: string; profile?: any };
}

const personaLabel: Record<string, string> = {
  FOUNDER: 'Founder', INVESTOR: 'Investor', TALENT: 'Talent', DEAL_PARTNER: 'Deal Partner',
  EVENT_PARTICIPANT: 'Event Participant', VENTURE_PARTNER: 'Venture Partner', ADVISOR: 'Advisor',
  OPERATOR: 'Operator', JOB_SEEKER: 'Job Seeker', RECRUITER: 'Recruiter', FREELANCER: 'Freelancer', OTHER: 'Other',
};

const personaIcon: Record<string, string> = {
  FOUNDER: '🚀', INVESTOR: '💰', TALENT: '🎯', DEAL_PARTNER: '🤝',
  EVENT_PARTICIPANT: '🏆', VENTURE_PARTNER: '🏦', ADVISOR: '🧠',
  OPERATOR: '⚙️', JOB_SEEKER: '💼', RECRUITER: '👔', FREELANCER: '✨', OTHER: '💬',
};

const statusInfo: Record<string, { bg: string; border: string; text: string; label: string }> = {
  SENT: { bg: 'rgba(108,71,255,0.08)', border: 'rgba(108,71,255,0.15)', text: '#a78bfa', label: 'Introduction Sent' },
  VIEWED: { bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.15)', text: '#93c5fd', label: 'Viewed' },
  RESPONDED: { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.15)', text: '#6ee7b7', label: 'Responded' },
  MEETING_SCHEDULED: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.15)', text: '#fbbf24', label: 'Meeting Scheduled' },
};

export default function IntroductionDetailPage() {
  const [intro, setIntro] = useState<IntroDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<any>(null);
  const [updating, setUpdating] = useState(false);
  const router = useRouter();
  const params = useParams();

  useEffect(() => {
    if (!api.getToken()) { router.push('/'); return; }
    loadIntro();
  }, []);

  const loadIntro = async () => {
    try {
      const [introData, userData] = await Promise.all([
        api.getIntroduction(params.id as string),
        api.getMe(),
      ]);
      setIntro(introData);
      setMe(userData);
    } catch (err: any) {
      if (err.message?.includes('not found')) router.push('/introductions');
      else if (err.message?.includes('Unauthorized')) router.push('/');
    } finally {
      setLoading(false);
    }
  };

  const markResponded = async () => {
    if (!intro) return;
    setUpdating(true);
    try {
      const updated = await api.updateIntroductionStatus(intro.id, 'RESPONDED');
      setIntro(updated);
    } catch (e) { console.error(e); }
    finally { setUpdating(false); }
  };

  const markScheduled = async () => {
    if (!intro) return;
    setUpdating(true);
    try {
      const updated = await api.updateIntroductionStatus(intro.id, 'MEETING_SCHEDULED');
      setIntro(updated);
    } catch (e) { console.error(e); }
    finally { setUpdating(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0D0B1A' }}>
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-purple-300/60 text-sm">Loading introduction...</p>
        </div>
      </div>
    );
  }

  if (!intro || !me) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0D0B1A' }}>
        <div className="text-center">
          <p className="text-white/40 mb-4">Introduction not found</p>
          <button onClick={() => router.push('/introductions')}
            className="text-purple-400 text-sm hover:text-purple-300">← Back to introductions</button>
        </div>
      </div>
    );
  }

  const otherUser = intro.userAId === me.id ? intro.userB : intro.userA;
  const myProfile = intro.userAId === me.id ? intro.userA.profile : intro.userB.profile;
  const otherProfile = otherUser.profile;
  const sc = statusInfo[intro.status] || statusInfo.SENT;
  const scorePercent = Math.round((intro.match?.score || 0) * 100);

  const calendarTitle = encodeURIComponent(`Cleo.ai Intro: ${myProfile?.currentRole || 'You'} ↔ ${otherProfile?.currentRole || otherUser.email.split('@')[0]}`);
  const calendarDetails = encodeURIComponent(`Introduction made by Cleo.ai\n\nMatch reason: ${intro.match?.reason || 'Professional networking'}\n\nTalking points:\n${intro.talkingPoints.map((t, i) => `${i + 1}. ${t}`).join('\n')}`);
  const calendarLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${calendarTitle}&details=${calendarDetails}&add=${encodeURIComponent(otherUser.email)}`;

  const emailSubject = encodeURIComponent(`Following up on our Cleo.ai introduction`);
  const emailBody = encodeURIComponent(`Hi ${otherProfile?.currentRole || 'there'},\n\nCleo.ai connected us because: ${intro.match?.reason || 'we have complementary backgrounds'}.\n\nI'd love to chat and explore how we can help each other. Would you be open to a quick call this week?\n\nBest regards`);
  const mailtoLink = `mailto:${otherUser.email}?subject=${emailSubject}&body=${emailBody}`;

  const UserCard = ({ user, label }: { user: any; label: string }) => {
    const p = user.profile;
    return (
      <div className="flex-1 rounded-2xl border border-white/5 p-4" style={{ background: 'rgba(26,18,48,0.5)' }}>
        <p className="text-[10px] uppercase tracking-wider text-white/20 mb-3">{label}</p>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl"
            style={{ background: 'linear-gradient(135deg, #6C47FF15, #4E2FD815)', border: '1px solid rgba(108,71,255,0.12)' }}>
            {personaIcon[p?.persona || 'OTHER']}
          </div>
          <div>
            <h3 className="font-semibold text-white text-sm">{p?.currentRole || user.email.split('@')[0]}</h3>
            {p?.companyName && <p className="text-xs text-white/40">{p.companyName}</p>}
          </div>
        </div>
        {p?.persona && (
          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border mb-2"
            style={{ background: 'rgba(108,71,255,0.08)', borderColor: 'rgba(108,71,255,0.15)', color: '#a78bfa' }}>
            {personaLabel[p.persona]}
          </span>
        )}
        {p?.headline && <p className="text-xs text-white/50 mb-2">{p.headline}</p>}
        {p?.industries?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {p.industries.slice(0, 4).map((ind: string) => (
              <span key={ind} className="px-2 py-0.5 rounded-full text-[10px] border"
                style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>
                {ind.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        )}
        {p?.location && <p className="text-[10px] text-white/25 mt-2">📍 {p.location}</p>}
      </div>
    );
  };

  return (
    <div className="min-h-screen" style={{ background: '#0D0B1A' }}>
      <header className="sticky top-0 z-10 border-b border-white/5" style={{ background: 'rgba(13,11,26,0.9)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/introductions')} className="text-white/30 hover:text-white/60 transition text-sm">← Back</button>
            <h1 className="font-semibold text-white text-sm hidden sm:block">Introduction Details</h1>
          </div>
          <div className="sm:hidden"><MobileNav /></div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Introduction</h2>
            <p className="text-xs text-white/30 mt-1">
              {new Date(intro.createdAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full text-xs font-bold border"
              style={{ background: sc.bg, borderColor: sc.border, color: sc.text }}>
              {sc.label}
            </span>
            <span className="px-2 py-1 rounded-full text-xs font-bold"
              style={{ background: scorePercent >= 70 ? 'rgba(16,185,129,0.12)' : 'rgba(108,71,255,0.12)',
                color: scorePercent >= 70 ? '#6ee7b7' : '#a78bfa' }}>
              {scorePercent}% match
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <UserCard user={intro.userA} label={intro.userAId === me.id ? 'You' : 'Connection'} />
          <div className="flex items-center justify-center">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
              style={{ background: 'linear-gradient(135deg, #6C47FF, #4E2FD8)' }}>
              🤝
            </div>
          </div>
          <UserCard user={intro.userB} label={intro.userBId === me.id ? 'You' : 'Connection'} />
        </div>

        {intro.match?.reason && (
          <div className="rounded-2xl border border-white/5 p-5" style={{ background: 'rgba(26,18,48,0.5)' }}>
            <h3 className="text-sm font-semibold text-white mb-2">Why You Were Matched</h3>
            <p className="text-sm text-white/50 leading-relaxed">{intro.match.reason}</p>
          </div>
        )}

        {intro.talkingPoints.length > 0 && (
          <div className="rounded-2xl border border-white/5 p-5" style={{ background: 'rgba(26,18,48,0.5)' }}>
            <h3 className="text-sm font-semibold text-white mb-3">Suggested Talking Points</h3>
            <div className="space-y-3">
              {intro.talkingPoints.map((point, i) => (
                <div key={i} className="flex gap-3">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                    style={{ background: 'rgba(108,71,255,0.12)', color: '#a78bfa' }}>
                    {i + 1}
                  </span>
                  <p className="text-sm text-white/50 leading-relaxed">{point}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-white/5 p-5" style={{ background: 'rgba(26,18,48,0.5)' }}>
          <h3 className="text-sm font-semibold text-white mb-2">Contact Information</h3>
          <div className="space-y-2">
            <p className="text-sm text-white/50">📧 {otherUser.email}</p>
            {otherProfile?.linkedinUrl && (
              <a href={otherProfile.linkedinUrl} target="_blank" rel="noopener noreferrer"
                className="text-sm text-purple-300 hover:text-purple-200 transition block">
                🔗 LinkedIn Profile
              </a>
            )}
            {otherProfile?.location && <p className="text-sm text-white/40">📍 {otherProfile.location}</p>}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <a href={calendarLink} target="_blank" rel="noopener noreferrer" onClick={markScheduled}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-medium text-white transition"
            style={{ background: 'linear-gradient(135deg, #6C47FF, #4E2FD8)' }}>
            📅 Schedule a Call
          </a>
          <a href={mailtoLink} onClick={markResponded}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-medium text-white/70 border border-white/10 hover:border-white/20 hover:bg-white/5 transition">
            ✉️ Send a Message
          </a>
        </div>

        {intro.status !== 'MEETING_SCHEDULED' && intro.status !== 'RESPONDED' && (
          <div className="flex gap-3">
            <button onClick={markResponded} disabled={updating}
              className="flex-1 py-2.5 rounded-xl text-xs font-medium text-white/40 border border-white/5 hover:border-white/10 transition disabled:opacity-40">
              Mark as Responded
            </button>
            <button onClick={markScheduled} disabled={updating}
              className="flex-1 py-2.5 rounded-xl text-xs font-medium text-white/40 border border-white/5 hover:border-white/10 transition disabled:opacity-40">
              Mark Meeting Scheduled
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
