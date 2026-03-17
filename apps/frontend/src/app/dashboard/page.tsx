'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import NotificationCenter from '@/components/NotificationCenter';

interface UserProfile {
  persona?: string;
  headline?: string;
  companyName?: string;
  currentRole?: string;
  location?: string;
  industries?: string[];
  skills?: string[];
  completenessScore?: number;
  isComplete?: boolean;
}

interface MatchStats {
  total: number;
  pending: number;
  accepted: number;
}

interface MatchData {
  id: string;
  status: string;
  score: number;
  reason?: string;
  userAId: string;
  userBId: string;
  userAResponse: string;
  userBResponse: string;
  createdAt: string;
  userA: { id: string; email: string; profile?: any };
  userB: { id: string; email: string; profile?: any };
}

export default function DashboardPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [user, setUser] = useState<any>(null);
  const [matchStats, setMatchStats] = useState<MatchStats>({ total: 0, pending: 0, accepted: 0 });
  const [recentMatches, setRecentMatches] = useState<MatchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [findingMatches, setFindingMatches] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!api.getToken()) {
      router.push('/');
      return;
    }
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const [userData, profileData, stats, matches] = await Promise.all([
        api.getMe(),
        api.getProfile().catch(() => null),
        api.getMatchStats().catch(() => ({ total: 0, pending: 0, accepted: 0 })),
        api.getMatches().catch(() => []),
      ]);
      setUser(userData);
      setProfile(profileData);
      setMatchStats(stats);
      const matchArr = Array.isArray(matches) ? matches : [];
      setRecentMatches(matchArr.slice(0, 5));
    } catch (err: any) {
      console.error('Dashboard load failed:', err);
      if (err.message?.includes('Unauthorized') || err.message?.includes('token')) {
        router.push('/');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFindMatches = async () => {
    setFindingMatches(true);
    try {
      await api.findAndPropose(5);
      const [stats, matches] = await Promise.all([
        api.getMatchStats(),
        api.getMatches().catch(() => []),
      ]);
      setMatchStats(stats);
      const matchArr = Array.isArray(matches) ? matches : [];
      setRecentMatches(matchArr.slice(0, 5));
    } catch (err) {
      console.error('Find matches failed:', err);
    } finally {
      setFindingMatches(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0D0B1A' }}>
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-purple-300/60 text-sm">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const personaLabel: Record<string, string> = {
    FOUNDER: 'Founder', INVESTOR: 'Investor', TALENT: 'Talent', DEAL_PARTNER: 'Deal Partner',
    EVENT_PARTICIPANT: 'The Pitch by Deel', VENTURE_PARTNER: 'Venture Partner', ADVISOR: 'Advisor',
    OPERATOR: 'Operator', JOB_SEEKER: 'Job Seeker', RECRUITER: 'Recruiter', FREELANCER: 'Freelancer', OTHER: 'Other',
  };

  const personaIcon: Record<string, string> = {
    FOUNDER: '🚀', INVESTOR: '💰', TALENT: '🎯', DEAL_PARTNER: '🤝',
    EVENT_PARTICIPANT: '🏆', VENTURE_PARTNER: '🏦', ADVISOR: '🧠',
    OPERATOR: '⚙️', JOB_SEEKER: '💼', RECRUITER: '👔', FREELANCER: '✨', OTHER: '💬',
  };

  const getOtherUser = (match: MatchData) => {
    if (!user) return match.userB;
    return match.userAId === user.id ? match.userB : match.userA;
  };

  const getMyResponse = (match: MatchData) => {
    if (!user) return 'PENDING';
    return match.userAId === user.id ? match.userAResponse : match.userBResponse;
  };

  return (
    <div className="min-h-screen" style={{ background: '#0D0B1A' }}>
      <header className="sticky top-0 z-10 border-b border-white/5" style={{ background: 'rgba(13,11,26,0.9)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-purple-500/20"
              style={{ background: 'linear-gradient(135deg, #6C47FF, #4E2FD8)' }}>
              C
            </div>
            <h1 className="font-semibold text-white text-sm">Cleo.ai</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => router.push('/matches')}
              className="px-3 py-1.5 text-xs rounded-lg border border-white/10 text-white/50 hover:text-white/80 hover:border-white/20 transition">
              Matches {matchStats.pending > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-purple-500 text-white">{matchStats.pending}</span>}
            </button>
            <button onClick={() => router.push('/chat')}
              className="px-3 py-1.5 text-xs rounded-lg border border-white/10 text-white/50 hover:text-white/80 hover:border-white/20 transition">
              Chat
            </button>
            <button onClick={() => router.push('/profile')}
              className="px-3 py-1.5 text-xs rounded-lg border border-white/10 text-white/50 hover:text-white/80 hover:border-white/20 transition">
              Profile
            </button>
            <button onClick={() => router.push('/settings')}
              className="px-3 py-1.5 text-xs rounded-lg border border-white/10 text-white/50 hover:text-white/80 hover:border-white/20 transition">
              Settings
            </button>
            <NotificationCenter />
            <button onClick={() => { api.clearToken(); router.push('/'); }}
              className="text-xs text-white/30 hover:text-white/60 transition px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="rounded-2xl border border-white/5 p-6" style={{ background: 'rgba(26,18,48,0.6)' }}>
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #6C47FF20, #4E2FD820)', border: '1px solid rgba(108,71,255,0.15)' }}>
              {personaIcon[profile?.persona || 'OTHER'] || '💬'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-bold text-white truncate">
                  {profile?.currentRole || user?.email?.split('@')[0] || 'Welcome'}
                </h2>
                {profile?.persona && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium border"
                    style={{ background: 'rgba(108,71,255,0.1)', borderColor: 'rgba(108,71,255,0.2)', color: '#a78bfa' }}>
                    {personaLabel[profile.persona] || profile.persona}
                  </span>
                )}
              </div>
              <p className="text-sm text-white/40 mb-1">{profile?.headline || 'Complete your profile to get matched'}</p>
              {profile?.companyName && <p className="text-xs text-white/30">{profile.companyName} {profile.location ? `· ${profile.location}` : ''}</p>}

              {profile?.completenessScore !== undefined && (
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex-1 h-1.5 rounded-full max-w-xs" style={{ background: 'rgba(108,71,255,0.15)' }}>
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${(profile.completenessScore || 0) * 100}%`, background: 'linear-gradient(90deg, #6C47FF, #a78bfa)' }} />
                  </div>
                  <span className="text-xs text-white/30">{Math.round((profile.completenessScore || 0) * 100)}% complete</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'Total Matches', value: matchStats.total, icon: '🤝', color: '#6C47FF' },
            { label: 'Pending Review', value: matchStats.pending, icon: '⏳', color: '#f59e0b' },
            { label: 'Accepted Intros', value: matchStats.accepted, icon: '✅', color: '#10b981' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-white/5 p-5" style={{ background: 'rgba(26,18,48,0.6)' }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{stat.icon}</span>
                <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>{stat.label}</p>
              </div>
              <p className="text-3xl font-bold text-white">{stat.value}</p>
            </div>
          ))}
        </div>

        {recentMatches.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Your Matches</h3>
              <button onClick={() => router.push('/matches')} className="text-xs text-purple-400 hover:text-purple-300 transition">
                View All →
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentMatches.slice(0, 6).map((match) => {
                const other = getOtherUser(match);
                const otherProfile = other.profile;
                const scorePercent = Math.round((match.score || 0) * 100);
                const myResponse = getMyResponse(match);
                const isPending = myResponse === 'PENDING' && match.status !== 'REJECTED' && match.status !== 'ACCEPTED';

                return (
                  <div key={match.id} className="rounded-2xl border border-white/5 p-4 hover:border-purple-500/15 transition"
                    style={{ background: 'rgba(26,18,48,0.6)' }}>
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, #6C47FF15, #4E2FD815)', border: '1px solid rgba(108,71,255,0.12)' }}>
                        {personaIcon[otherProfile?.persona || 'OTHER'] || '💬'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold text-white truncate">
                            {otherProfile?.currentRole || other.email.split('@')[0]}
                          </h4>
                          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                            style={{
                              background: scorePercent >= 70 ? 'rgba(16,185,129,0.12)' : scorePercent >= 50 ? 'rgba(245,158,11,0.12)' : 'rgba(108,71,255,0.12)',
                              color: scorePercent >= 70 ? '#6ee7b7' : scorePercent >= 50 ? '#fbbf24' : '#a78bfa'
                            }}>
                            {scorePercent}%
                          </div>
                        </div>
                        {otherProfile?.persona && (
                          <span className="text-[10px] font-medium" style={{ color: '#a78bfa' }}>
                            {personaLabel[otherProfile.persona] || otherProfile.persona}
                          </span>
                        )}
                      </div>
                    </div>
                    {match.reason && (
                      <p className="text-xs text-white/40 line-clamp-2 mb-3">{match.reason}</p>
                    )}
                    <div className="flex gap-2">
                      {isPending ? (
                        <button onClick={() => router.push('/matches')}
                          className="flex-1 py-2 rounded-xl text-xs font-medium text-white transition"
                          style={{ background: 'linear-gradient(135deg, #6C47FF, #4E2FD8)' }}>
                          Review
                        </button>
                      ) : (
                        <button onClick={() => router.push('/matches')}
                          className="flex-1 py-2 rounded-xl text-xs font-medium text-white/50 border border-white/10 hover:border-white/20 transition">
                          View
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={() => router.push('/matches')}
              className="rounded-2xl border border-white/5 p-5 text-left hover:border-purple-500/20 transition group"
              style={{ background: 'rgba(26,18,48,0.6)' }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">🎯</span>
                <span className="text-xs text-white/20 group-hover:text-white/40 transition">→</span>
              </div>
              <h3 className="font-semibold text-white text-sm mb-1">View Matches</h3>
              <p className="text-xs text-white/40">Review proposals</p>
              {matchStats.pending > 0 && (
                <p className="text-[11px] mt-1" style={{ color: '#a78bfa' }}>{matchStats.pending} pending</p>
              )}
            </button>

            <button
              onClick={handleFindMatches}
              disabled={findingMatches}
              className="rounded-2xl border border-white/5 p-5 text-left hover:border-purple-500/20 transition group disabled:opacity-60"
              style={{ background: 'rgba(26,18,48,0.6)' }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">🔍</span>
                {findingMatches && <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />}
              </div>
              <h3 className="font-semibold text-white text-sm mb-1">
                {findingMatches ? 'Finding...' : 'Find Matches'}
              </h3>
              <p className="text-xs text-white/40">Search for connections</p>
            </button>

            <button
              onClick={() => router.push('/profile')}
              className="rounded-2xl border border-white/5 p-5 text-left hover:border-purple-500/20 transition group"
              style={{ background: 'rgba(26,18,48,0.6)' }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">✏️</span>
                <span className="text-xs text-white/20 group-hover:text-white/40 transition">→</span>
              </div>
              <h3 className="font-semibold text-white text-sm mb-1">Edit Profile</h3>
              <p className="text-xs text-white/40">Update your info</p>
            </button>

            <button
              onClick={() => router.push('/chat')}
              className="rounded-2xl border border-white/5 p-5 text-left hover:border-purple-500/20 transition group"
              style={{ background: 'rgba(26,18,48,0.6)' }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">💬</span>
                <span className="text-xs text-white/20 group-hover:text-white/40 transition">→</span>
              </div>
              <h3 className="font-semibold text-white text-sm mb-1">Chat with Cleo</h3>
              <p className="text-xs text-white/40">Start a conversation</p>
            </button>
          </div>
        </div>

        {profile?.industries && profile.industries.length > 0 && (
          <div className="rounded-2xl border border-white/5 p-6" style={{ background: 'rgba(26,18,48,0.6)' }}>
            <h3 className="font-semibold text-white mb-3 text-sm">Your Industries</h3>
            <div className="flex flex-wrap gap-2">
              {profile.industries.map((ind) => (
                <span key={ind} className="px-2.5 py-1 rounded-full text-xs border"
                  style={{ background: 'rgba(108,71,255,0.08)', borderColor: 'rgba(108,71,255,0.15)', color: '#a78bfa' }}>
                  {ind.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
            {profile.skills && profile.skills.length > 0 && (
              <>
                <h4 className="font-medium text-white/60 text-xs mt-4 mb-2 uppercase tracking-wider">Skills</h4>
                <div className="flex flex-wrap gap-2">
                  {profile.skills.map((skill) => (
                    <span key={skill} className="px-2.5 py-1 rounded-full text-xs border"
                      style={{ background: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.15)', color: '#6ee7b7' }}>
                      {skill.replace(/-/g, ' ')}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
