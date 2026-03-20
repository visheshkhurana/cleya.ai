'use client';
import { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import NotificationCenter from '@/components/NotificationCenter';
import MobileNav from '@/components/MobileNav';
import { analytics, identifyUser } from '@/lib/posthog';
import { setUser as setSentryUser } from '@/lib/sentry';

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
  const [showAIChat, setShowAIChat] = useState(false);
  const [aiMessages, setAiMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);
  const [matchFeedback, setMatchFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const aiScrollRef = useRef<HTMLDivElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const redirectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get('token');
      if (urlToken) {
        api.setToken(urlToken);
        window.history.replaceState({}, '', '/dashboard');
      }
    }
    if (!api.getToken()) {
      router.push('/');
      return;
    }
    loadDashboard();
  }, []);

  useEffect(() => {
    if (matchFeedback && feedbackRef.current) {
      feedbackRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [matchFeedback]);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
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
      if (userData?.id) {
        identifyUser(userData.id, { email: userData.email, persona: profileData?.persona });
        setSentryUser({ id: userData.id, email: userData.email });
      }
      analytics.pageView('dashboard');
    } catch (err: any) {
      console.error('Dashboard load failed:', err);
      if (err.message?.includes('Unauthorized') || err.message?.includes('token')) {
        router.push('/');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setSendingVerification(true);
    try {
      await api.sendVerificationEmail();
      setVerificationSent(true);
    } catch {
    } finally {
      setSendingVerification(false);
    }
  };

  const handleFindMatches = async () => {
    setFindingMatches(true);
    setMatchFeedback(null);
    try {
      const result = await api.findAndPropose(5);
      const [stats, matches] = await Promise.all([
        api.getMatchStats(),
        api.getMatches().catch(() => []),
      ]);
      const prevTotal = matchStats.total;
      setMatchStats(stats);
      const matchArr = Array.isArray(matches) ? matches : [];
      setRecentMatches(matchArr.slice(0, 5));
      const newCount = stats.total - prevTotal;
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      if (newCount > 0) {
        setMatchFeedback({ type: 'success', message: `Found ${newCount} new match${newCount > 1 ? 'es' : ''}! View them in your Matches page.` });
        redirectTimerRef.current = setTimeout(() => router.push('/matches'), 2000);
      } else if (matchArr.length > 0) {
        setMatchFeedback({ type: 'info', message: `You have ${matchArr.length} existing match${matchArr.length > 1 ? 'es' : ''}. No new matches found right now.` });
      } else {
        setMatchFeedback({ type: 'info', message: 'No matches found yet. Try updating your profile to improve results.' });
      }
      feedbackTimerRef.current = setTimeout(() => setMatchFeedback(null), 10000);
    } catch (err: any) {
      console.error('Find matches failed:', err);
      setMatchFeedback({ type: 'error', message: err.message || 'Failed to find matches. Please try again.' });
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = setTimeout(() => setMatchFeedback(null), 8000);
    } finally {
      setFindingMatches(false);
    }
  };

  const sendAIMessage = async () => {
    if (!aiInput.trim() || aiLoading) return;
    const msg = aiInput.trim();
    setAiInput('');
    const newMessages = [...aiMessages, { role: 'user' as const, content: msg }];
    setAiMessages(newMessages);
    setAiLoading(true);
    setTimeout(() => aiScrollRef.current?.scrollTo({ top: aiScrollRef.current.scrollHeight, behavior: 'smooth' }), 50);
    try {
      const result = await api.sendAIChat(msg, aiMessages);
      setAiMessages([...newMessages, { role: 'assistant', content: result.content }]);
      setTimeout(() => aiScrollRef.current?.scrollTo({ top: aiScrollRef.current.scrollHeight, behavior: 'smooth' }), 50);
    } catch {
      setAiMessages([...newMessages, { role: 'assistant', content: "Sorry, I couldn't process that. Try again!" }]);
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: '#0D0B1A' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-12">
          <div className="h-8 w-48 rounded-lg animate-pulse mb-6" style={{ background: 'rgba(255,255,255,0.05)' }} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {[1,2,3].map(i => (
              <div key={i} className="rounded-2xl p-6 border border-white/5 animate-pulse" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <div className="h-4 w-20 rounded mb-3" style={{ background: 'rgba(255,255,255,0.06)' }} />
                <div className="h-8 w-16 rounded" style={{ background: 'rgba(255,255,255,0.08)' }} />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-2xl p-6 border border-white/5 animate-pulse" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <div className="h-5 w-32 rounded mb-4" style={{ background: 'rgba(255,255,255,0.06)' }} />
              <div className="space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-20 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }} />)}
              </div>
            </div>
            <div className="rounded-2xl p-6 border border-white/5 animate-pulse" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <div className="h-5 w-24 rounded mb-4" style={{ background: 'rgba(255,255,255,0.06)' }} />
              <div className="space-y-3">
                {[1,2,3,4].map(i => <div key={i} className="h-10 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }} />)}
              </div>
            </div>
          </div>
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
              style={{ background: 'linear-gradient(135deg, #0D9488, #0F766E)' }}>
              C
            </div>
            <h1 className="font-semibold text-white text-sm">Cleo.ai</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2">
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
            </div>
            <NotificationCenter />
            <div className="hidden md:flex items-center">
              <button onClick={() => { api.clearToken(); router.push('/'); }}
                className="text-xs text-white/30 hover:text-white/60 transition px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20">
                Sign out
              </button>
            </div>
            <div className="flex md:hidden items-center">
              <MobileNav />
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {user && !user.emailVerified && (
          <div className="rounded-xl border p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
            style={{ background: 'rgba(245,158,11,0.06)', borderColor: 'rgba(245,158,11,0.2)' }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(245,158,11,0.15)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: '#fbbf24' }}>Verify your email</p>
                <p className="text-xs" style={{ color: 'rgba(251,191,36,0.6)' }}>
                  {verificationSent
                    ? 'Verification email sent! Check your inbox.'
                    : `We sent a verification link to ${user.email}. Please check your inbox.`}
                </p>
              </div>
            </div>
            {!verificationSent && (
              <button
                onClick={handleResendVerification}
                disabled={sendingVerification}
                className="text-xs font-medium px-4 py-2 rounded-lg transition flex-shrink-0"
                style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.2)' }}>
                {sendingVerification ? 'Sending...' : 'Resend email'}
              </button>
            )}
          </div>
        )}

        {!profile?.persona && matchStats.total === 0 && (
          <div className="rounded-2xl border p-6" style={{ background: 'linear-gradient(135deg, rgba(13,148,136,0.08), rgba(15,118,110,0.04))', borderColor: 'rgba(13,148,136,0.2)' }}>
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #0D9488, #0F766E)', boxShadow: '0 4px 20px rgba(13,148,136,0.3)' }}>
                C
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-white mb-1">Welcome to Cleo.ai!</h2>
                <p className="text-sm text-white/50 mb-4">Start by telling Cleo about yourself. It takes about 2 minutes and helps us find your best connections in India's startup ecosystem.</p>
                <div className="flex items-center gap-3 flex-wrap">
                  <button onClick={() => router.push('/chat')}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition"
                    style={{ background: 'linear-gradient(135deg, #0D9488, #0F766E)' }}>
                    Set Up Your Profile
                  </button>
                  <span className="text-xs text-white/30">Takes ~2 minutes</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-white/5 p-6" style={{ background: 'rgba(26,18,48,0.6)' }}>
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #0D948820, #0F766E20)', border: '1px solid rgba(108,71,255,0.15)' }}>
              {personaIcon[profile?.persona || 'OTHER'] || '💬'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-bold text-white truncate">
                  {profile?.currentRole || user?.email?.split('@')[0] || 'Welcome'}
                </h2>
                {profile?.persona && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium border"
                    style={{ background: 'rgba(108,71,255,0.1)', borderColor: 'rgba(108,71,255,0.2)', color: '#5EEAD4' }}>
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
                      style={{ width: `${(profile.completenessScore || 0) * 100}%`, background: 'linear-gradient(90deg, #0D9488, #5EEAD4)' }} />
                  </div>
                  <span className="text-xs text-white/30">{Math.round((profile.completenessScore || 0) * 100)}% complete</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'Total Matches', value: matchStats.total, icon: '🤝', color: '#0D9488' },
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

        {matchFeedback && (
          <div ref={feedbackRef} className={`rounded-xl p-4 text-sm border transition-all animate-pulse-once ${
            matchFeedback.type === 'success' ? 'text-green-400 bg-green-500/10 border-green-500/20' :
            matchFeedback.type === 'error' ? 'text-red-400 bg-red-500/10 border-red-500/20' :
            'text-blue-400 bg-blue-500/10 border-blue-500/20'
          }`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">{matchFeedback.type === 'success' ? '✅' : matchFeedback.type === 'error' ? '❌' : 'ℹ️'}</span>
                <span className="font-medium">{matchFeedback.message}</span>
              </div>
              <button onClick={() => { setMatchFeedback(null); if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current); if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current); }} className="text-white/30 hover:text-white/60 flex-shrink-0">×</button>
            </div>
            {matchFeedback.type === 'success' && (
              <p className="text-xs mt-2 opacity-70">Redirecting to matches page...</p>
            )}
          </div>
        )}

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
                        style={{ background: 'linear-gradient(135deg, #0D948815, #0F766E15)', border: '1px solid rgba(108,71,255,0.12)' }}>
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
                              color: scorePercent >= 70 ? '#6ee7b7' : scorePercent >= 50 ? '#fbbf24' : '#5EEAD4'
                            }}>
                            {scorePercent}%
                          </div>
                        </div>
                        {otherProfile?.persona && (
                          <span className="text-[10px] font-medium" style={{ color: '#5EEAD4' }}>
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
                          style={{ background: 'linear-gradient(135deg, #0D9488, #0F766E)' }}>
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
                <p className="text-[11px] mt-1" style={{ color: '#5EEAD4' }}>{matchStats.pending} pending</p>
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
                  style={{ background: 'rgba(108,71,255,0.08)', borderColor: 'rgba(108,71,255,0.15)', color: '#5EEAD4' }}>
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

      {!showAIChat && (
        <button
          onClick={() => setShowAIChat(true)}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center text-white text-xl shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-all z-40 glow-pulse"
          style={{ background: 'linear-gradient(135deg, #0D9488, #0F766E)' }}
        >
          💬
        </button>
      )}

      {showAIChat && (
        <div className="fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-6 sm:w-96 sm:h-[500px] z-50 flex flex-col rounded-none sm:rounded-2xl border-0 sm:border border-white/10 shadow-2xl"
          style={{ background: '#0D0B1A' }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5" style={{ background: 'rgba(26,18,48,0.9)' }}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                style={{ background: 'linear-gradient(135deg, #0D9488, #0F766E)' }}>C</div>
              <div>
                <h3 className="text-sm font-semibold text-white">Chat with Cleo</h3>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  <span className="text-[10px] text-white/30">AI Assistant</span>
                </div>
              </div>
            </div>
            <button onClick={() => setShowAIChat(false)} className="text-white/30 hover:text-white/60 transition p-1">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div ref={aiScrollRef} className="flex-1 overflow-y-auto chat-scroll px-4 py-4 space-y-3">
            {aiMessages.length === 0 && (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
                  style={{ background: 'linear-gradient(135deg, #0D948820, #0F766E20)', border: '1px solid rgba(108,71,255,0.15)' }}>
                  <span className="text-2xl">✨</span>
                </div>
                <p className="text-sm text-white/60 mb-1">Ask Cleo anything!</p>
                <p className="text-xs text-white/30">Get networking tips, match insights, or career advice</p>
                <div className="mt-4 space-y-2">
                  {['Tell me about my matches', 'Give me networking tips', 'How can I improve my profile?'].map((q) => (
                    <button key={q} onClick={() => { setAiInput(q); }}
                      className="block w-full text-left px-3 py-2 rounded-xl text-xs text-white/40 border border-white/5 hover:border-purple-500/20 hover:text-white/60 transition"
                      style={{ background: 'rgba(26,18,48,0.4)' }}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {aiMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'rounded-tr-sm text-white'
                    : 'rounded-tl-sm bg-white/5 text-white/80 border border-white/5'
                }`}
                  style={msg.role === 'user' ? { background: 'linear-gradient(135deg, #0D9488, #0F766E)' } : {}}>
                  {msg.content}
                </div>
              </div>
            ))}
            {aiLoading && (
              <div className="flex justify-start">
                <div className="bg-white/5 border border-white/5 rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1">
                  <div className="w-2 h-2 bg-white/30 rounded-full typing-dot" />
                  <div className="w-2 h-2 bg-white/30 rounded-full typing-dot" />
                  <div className="w-2 h-2 bg-white/30 rounded-full typing-dot" />
                </div>
              </div>
            )}
          </div>

          <form onSubmit={(e) => { e.preventDefault(); sendAIMessage(); }} className="px-3 py-3 border-t border-white/5">
            <div className="flex gap-2">
              <input
                type="text"
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder="Ask Cleo anything..."
                className="input-dark flex-1 !py-2.5 !text-sm"
              />
              <button
                type="submit"
                disabled={!aiInput.trim() || aiLoading}
                className="px-4 py-2.5 rounded-2xl font-semibold text-sm text-white transition-all disabled:opacity-30"
                style={{ background: 'linear-gradient(135deg, #0D9488, #0F766E)' }}
              >
                ↑
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
