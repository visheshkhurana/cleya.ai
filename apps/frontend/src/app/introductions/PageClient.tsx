'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import MobileNav from '@/components/MobileNav';
import NotificationCenter from '@/components/NotificationCenter';

interface IntroData {
  id: string;
  matchId: string;
  status: string;
  talkingPoints: string[];
  scheduledAt?: string;
  notes?: string;
  createdAt: string;
  match: { score: number; reason?: string };
  userA: { id: string; email: string; profile?: any };
  userB: { id: string; email: string; profile?: any };
}

const personaIcon: Record<string, string> = {
  FOUNDER: '🚀', INVESTOR: '💰', TALENT: '🎯', DEAL_PARTNER: '🤝',
  EVENT_PARTICIPANT: '🏆', VENTURE_PARTNER: '🏦', ADVISOR: '🧠',
  OPERATOR: '⚙️', JOB_SEEKER: '💼', RECRUITER: '👔', FREELANCER: '✨', OTHER: '💬',
};

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
  PENDING_APPROVAL: { bg: 'rgba(245,158,11,0.1)', text: '#fbbf24', label: 'Pending Approval' },
  APPROVED: { bg: 'rgba(59,130,246,0.1)', text: '#93c5fd', label: 'Approved' },
  SENT: { bg: 'rgba(108,71,255,0.1)', text: '#5EEAD4', label: 'Sent' },
  VIEWED: { bg: 'rgba(59,130,246,0.1)', text: '#93c5fd', label: 'Viewed' },
  RESPONDED: { bg: 'rgba(16,185,129,0.1)', text: '#6ee7b7', label: 'Responded' },
  MEETING_SCHEDULED: { bg: 'rgba(245,158,11,0.1)', text: '#fbbf24', label: 'Meeting Scheduled' },
  FOLLOWED_UP: { bg: 'rgba(16,185,129,0.1)', text: '#6ee7b7', label: 'Followed Up' },
  COMPLETED: { bg: 'rgba(16,185,129,0.15)', text: '#10B981', label: 'Completed' },
  CANCELLED: { bg: 'rgba(239,68,68,0.1)', text: '#f87171', label: 'Cancelled' },
};

export default function IntroductionsPage() {
  const [introductions, setIntroductions] = useState<IntroData[]>([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    if (!api.getToken()) { router.push('/?action=login'); return; }
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [intros, userData] = await Promise.all([
        api.getIntroductions(),
        api.getMe(),
      ]);
      setIntroductions(Array.isArray(intros) ? intros : []);
      setMe(userData);
    } catch (err: any) {
      if (err.message?.includes('Unauthorized')) router.push('/');
    } finally {
      setLoading(false);
    }
  };

  const getOtherUser = (intro: IntroData) => {
    if (!me) return intro.userB;
    return intro.userA.id === me.id ? intro.userB : intro.userA;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0D0B1A' }}>
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-purple-300/60 text-sm">Loading introductions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#0D0B1A' }}>
      <header className="sticky top-0 z-10 border-b border-white/5" style={{ background: 'rgba(13,11,26,0.9)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/dashboard')} className="text-white/30 hover:text-white/60 transition text-sm hidden sm:block">← Back</button>
            <h1 className="font-semibold text-white text-sm">Introductions</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:block"><NotificationCenter /></div>
            <div className="sm:hidden"><MobileNav /></div>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {introductions.length === 0 ? (
          <div className="text-center py-16">
            <span className="text-5xl block mb-4">🤝</span>
            <h3 className="text-white font-semibold mb-2">No introductions yet</h3>
            <p className="text-white/40 text-sm mb-6">When both sides accept a match, introductions appear here</p>
            <button onClick={() => router.push('/matches')}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-white transition"
              style={{ background: 'linear-gradient(135deg, #0D9488, #0F766E)' }}>
              View Matches
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs font-medium uppercase tracking-wider text-white/30 mb-3">
              {introductions.length} introduction{introductions.length !== 1 ? 's' : ''}
            </p>
            {introductions.map((intro) => {
              const other = getOtherUser(intro);
              const profile = other.profile;
              const sc = statusColors[intro.status] || statusColors.SENT;
              return (
                <button key={intro.id} onClick={() => router.push(`/introductions/${intro.id}`)}
                  className="w-full text-left rounded-2xl border border-white/5 p-5 hover:border-purple-500/15 transition"
                  style={{ background: 'rgba(26,18,48,0.6)' }}>
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, #0D948815, #0F766E15)', border: '1px solid rgba(108,71,255,0.12)' }}>
                      {personaIcon[profile?.persona || 'OTHER'] || '💬'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold text-white text-sm truncate">
                          {profile?.currentRole || other.email.split('@')[0]}
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                          style={{ background: sc.bg, color: sc.text }}>
                          {sc.label}
                        </span>
                      </div>
                      {profile?.companyName && <p className="text-xs text-white/40">{profile.companyName}</p>}
                      {intro.match?.reason && (
                        <p className="text-xs text-white/30 mt-2 line-clamp-2">{intro.match.reason}</p>
                      )}
                      <p className="text-[10px] text-white/20 mt-2">
                        {new Date(intro.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    <span className="text-white/20 text-sm flex-shrink-0">→</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
