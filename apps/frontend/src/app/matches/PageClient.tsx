'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import NotificationCenter from '@/components/NotificationCenter';
import MobileNav from '@/components/MobileNav';
import VerificationBadge from '@/components/VerificationBadge';
import { analytics } from '@/lib/posthog';
import { useToast } from '@/components/Toast';
import AppFooter from '@/components/AppFooter';

interface MatchData {
  id: string;
  status: string;
  score: number;
  reason?: string;
  scoreBreakdown?: any;
  userAId: string;
  userBId: string;
  userAResponse: string;
  userBResponse: string;
  createdAt: string;
  userA: { id: string; email: string; profile?: ProfileData };
  userB: { id: string; email: string; profile?: ProfileData };
}

interface ProfileData {
  persona?: string;
  headline?: string;
  avatarUrl?: string;
  companyName?: string;
  currentRole?: string;
  location?: string;
  industries?: string[];
  skills?: string[];
  linkedinUrl?: string;
  bio?: string;
}

type Tab = 'pending' | 'accepted';

interface FeedbackState {
  matchId: string;
  rating: number;
  text: string;
  action: 'ACCEPTED' | 'REJECTED';
}

export default function MatchesPage() {
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('pending');
  const [me, setMe] = useState<any>(null);
  const [feedbackPrompt, setFeedbackPrompt] = useState<FeedbackState | null>(null);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  useEffect(() => {
    api.getMe().then((user) => {
      if (!user) { router.push('/?action=login'); return; }
      api.setToken('authenticated');
      loadData();
    }).catch(() => { router.push('/?action=login'); });
  }, []);

  const loadData = async () => {
    try {
      const [matchesData, userData] = await Promise.all([
        api.getMatches(),
        api.getMe(),
      ]);
      const matchArr = Array.isArray(matchesData) ? matchesData : [];
      setMatches(matchArr);
      setMe(userData);
      const pending = matchArr.filter((m: any) => m.status === 'PENDING');
      pending.forEach((m: any) => analytics.matchProposed(m.id));
    } catch (err: any) {
      console.error('Load failed:', err);
      if (err.message?.includes('Unauthorized')) router.push('/');
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async (matchId: string, response: 'ACCEPTED' | 'REJECTED') => {
    setResponding(matchId);
    try {
      await api.respondToMatch(matchId, response);
      if (response === 'ACCEPTED') {
        analytics.matchAccepted(matchId);
        toast.success('Match accepted! An introduction will be facilitated.');
      } else {
        analytics.matchRejected(matchId);
        toast.info('Match passed.');
      }
      setFeedbackPrompt({ matchId, rating: 0, text: '', action: response });
      await loadData();
    } catch (err) {
      console.error('Respond failed:', err);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setResponding(null);
    }
  };

  const submitFeedback = async () => {
    if (!feedbackPrompt || feedbackPrompt.rating === 0) return;
    setSubmittingFeedback(true);
    try {
      await api.submitMatchFeedback(
        feedbackPrompt.matchId,
        feedbackPrompt.rating,
        feedbackPrompt.text || undefined
      );
      setFeedbackPrompt(null);
    } catch (err) {
      console.error('Feedback failed:', err);
      setFeedbackPrompt(null);
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const getOtherUser = (match: MatchData) => {
    if (!me) return match.userB;
    return match.userAId === me.id ? match.userB : match.userA;
  };

  const getMyResponse = (match: MatchData) => {
    if (!me) return 'PENDING';
    return match.userAId === me.id ? match.userAResponse : match.userBResponse;
  };

  const isPending = (match: MatchData) => {
    const myResp = getMyResponse(match);
    return myResp === 'PENDING' && match.status !== 'REJECTED' && match.status !== 'ACCEPTED';
  };

  const filterBySearch = (list: MatchData[]) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter((m) => {
      const other = getOtherUser(m);
      const p = other.profile;
      const searchableText = [
        p?.currentRole, p?.companyName, p?.persona, p?.headline, p?.location, p?.bio,
        other.email, m.reason,
        ...(p?.industries || []), ...(p?.skills || []),
      ].filter(Boolean).join(' ').toLowerCase();
      return searchableText.includes(q);
    });
  };

  const sortByScore = (list: MatchData[]) => [...list].sort((a, b) => (b.score || 0) - (a.score || 0));
  const pendingMatches = sortByScore(filterBySearch(matches.filter(isPending)));
  const acceptedMatches = sortByScore(filterBySearch(matches.filter((m) => m.status === 'ACCEPTED')));
  const waitingMatches = sortByScore(filterBySearch(matches.filter((m) => {
    const myResp = getMyResponse(m);
    return myResp === 'ACCEPTED' && m.status !== 'ACCEPTED' && m.status !== 'REJECTED';
  })));

  const personaIcon: Record<string, string> = {
    FOUNDER: '🚀', INVESTOR: '💰', TALENT: '🎯', DEAL_PARTNER: '🤝',
    EVENT_PARTICIPANT: '🏆', VENTURE_PARTNER: '🏦', ADVISOR: '🧠',
    OPERATOR: '⚙️', JOB_SEEKER: '💼', RECRUITER: '👔', FREELANCER: '✨', OTHER: '💬',
  };

  const personaLabel: Record<string, string> = {
    FOUNDER: 'Founder', INVESTOR: 'Investor', TALENT: 'Talent', DEAL_PARTNER: 'Deal Partner',
    EVENT_PARTICIPANT: 'The Pitch by Deel', VENTURE_PARTNER: 'Venture Partner', ADVISOR: 'Advisor',
    OPERATOR: 'Operator', JOB_SEEKER: 'Job Seeker', RECRUITER: 'Recruiter', FREELANCER: 'Freelancer', OTHER: 'Other',
  };

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: '#050510' }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 pb-12">
          <div className="h-8 w-40 rounded-lg animate-pulse mb-6" style={{ background: 'rgba(255,255,255,0.05)' }} />
          <div className="flex gap-2 mb-6">
            {[1,2].map(i => <div key={i} className="h-9 w-28 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.05)' }} />)}
          </div>
          <div className="space-y-4">
            {[1,2,3].map(i => (
              <div key={i} className="rounded-2xl border border-white/5 p-5 animate-pulse" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl" style={{ background: 'rgba(255,255,255,0.06)' }} />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 rounded" style={{ background: 'rgba(255,255,255,0.06)' }} />
                    <div className="h-3 w-48 rounded" style={{ background: 'rgba(255,255,255,0.04)' }} />
                    <div className="h-3 w-64 rounded" style={{ background: 'rgba(255,255,255,0.04)' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const CircularProgress = ({ value, size = 48, strokeWidth = 4 }: { value: number; size?: number; strokeWidth?: number }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (value / 100) * circumference;
    const color = value >= 80 ? '#3B82F6' : value >= 60 ? '#3B82F6' : '#64748B';
    return (
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
    );
  };

  const ScoreBreakdown = ({ breakdown, overallScore }: { breakdown: any; overallScore?: number }) => {
    if (!breakdown || typeof breakdown !== 'object') return null;
    const factors = [
      { key: 'industryScore', label: 'Industry Fit', icon: '🏭' },
      { key: 'stageScore', label: 'Stage Match', icon: '📊' },
      { key: 'locationScore', label: 'Location', icon: '📍' },
      { key: 'goalsScore', label: 'Goal Alignment', icon: '🎯' },
      { key: 'skillsScore', label: 'Skills Match', icon: '💡' },
      { key: 'personaScore', label: 'Role Fit', icon: '👤' },
    ];
    const validFactors = factors.filter(f => breakdown[f.key] !== undefined && breakdown[f.key] !== null);
    if (validFactors.length === 0) return null;
    const scorePercent = overallScore !== undefined && overallScore !== null ? Math.round(overallScore * 100) : null;
    return (
      <div className="mt-4 rounded-xl p-4" style={{ background: 'rgba(10,10,26,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-start gap-4">
          {scorePercent !== null && (
            <div className="flex-shrink-0 relative">
              <CircularProgress value={scorePercent} size={56} strokeWidth={4} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold" style={{ color: scorePercent >= 80 ? '#93C5FD' : scorePercent >= 60 ? '#93C5FD' : '#94A3B8' }}>
                  {scorePercent}%
                </span>
              </div>
            </div>
          )}
          <div className="flex-1 space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-white/25 mb-2">Match Breakdown</p>
            {validFactors.map(f => {
              const val = Math.round((breakdown[f.key] || 0) * 100);
              return (
                <div key={f.key} className="flex items-center gap-2">
                  <span className="text-xs w-4">{f.icon}</span>
                  <span className="text-[10px] w-20 text-white/40">{f.label}</span>
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <div className="h-full rounded-full" style={{ width: `${val}%`, background: val >= 70 ? '#3B82F6' : val >= 40 ? '#3B82F6' : '#64748B', transition: 'width 0.4s ease' }} />
                  </div>
                  <span className="text-[10px] w-8 text-right" style={{ color: val >= 70 ? '#93C5FD' : '#94A3B8' }}>{val}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const MatchCard = ({ match, showActions }: { match: MatchData; showActions: boolean }) => {
    const other = getOtherUser(match);
    const profile = other.profile;
    const scorePercent = Math.round((match.score || 0) * 100);
    const isAccepted = match.status === 'ACCEPTED';
    const [showBreakdown, setShowBreakdown] = useState(false);

    return (
      <div className="rounded-2xl border border-white/5 overflow-hidden transition hover:border-blue-500/15"
        style={{ background: 'rgba(10,10,26,0.8)' }}>
        <div className="p-5">
          <div className="flex items-start gap-4">
            {profile?.avatarUrl ? (
              <img src={profile.avatarUrl} alt={profile?.currentRole || 'Match'} referrerPolicy="no-referrer"
                className="w-14 h-14 rounded-2xl object-cover flex-shrink-0 border border-white/10" />
            ) : (
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #3B82F615, #8B5CF615)', border: '1px solid rgba(59,130,246,0.12)' }}>
                {personaIcon[profile?.persona || 'OTHER'] || '💬'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-white text-sm truncate">
                  {profile?.currentRole || other.email.split('@')[0]}
                </h3>
                {(profile as any)?.verificationScore > 0 && (
                  <VerificationBadge score={(profile as any).verificationScore} size="sm" showLabel={true} />
                )}
                <button
                  onClick={() => setShowBreakdown(!showBreakdown)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition hover:opacity-80"
                  title="Click to see score breakdown"
                  style={{ background: scorePercent >= 80 ? 'rgba(59,130,246,0.15)' : scorePercent >= 60 ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.12)',
                    color: scorePercent >= 80 ? '#93C5FD' : scorePercent >= 60 ? '#93C5FD' : '#94A3B8' }}>
                  {scorePercent}% · {scorePercent >= 80 ? 'Strong Match' : scorePercent >= 60 ? 'Good Fit' : 'Possible Fit'}
                  <svg className={`w-3 h-3 transition-transform ${showBreakdown ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              {profile?.companyName && (
                <p className="text-xs text-white/40 mb-0.5">{profile.companyName}</p>
              )}
              {profile?.persona && (
                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border mt-1"
                  style={{ background: 'rgba(59,130,246,0.08)', borderColor: 'rgba(59,130,246,0.15)', color: '#93C5FD' }}>
                  {personaLabel[profile.persona] || profile.persona}
                </span>
              )}
            </div>
          </div>

          {profile?.headline && (
            <p className="text-sm text-white/50 mt-3 line-clamp-2">{profile.headline}</p>
          )}

          {showBreakdown && <ScoreBreakdown breakdown={match.scoreBreakdown} overallScore={match.score} />}

          {match.reason && (
            <div className="mt-3 p-3 rounded-xl" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.08)' }}>
              <p className="text-xs text-white/50 leading-relaxed">
                <span className="text-blue-300/70 font-medium">Why connect: </span>
                {match.reason}
              </p>
            </div>
          )}

          {profile?.industries && profile.industries.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {profile.industries.slice(0, 4).map((ind) => (
                <span key={ind} className="px-2 py-0.5 rounded-full text-[10px] border"
                  style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>
                  {ind.replace(/_/g, ' ').replace(/\b(ai|ml|saas|b2b|b2c|iot|ar|vr|hr|it|ui|ux|api|ev|nft|defi|d2c)\b/gi, (m) => m.toUpperCase()).replace(/\b[a-z]/g, (c) => c.toUpperCase())}
                </span>
              ))}
              {profile.industries.length > 4 && (
                <span className="text-[10px] text-white/20">+{profile.industries.length - 4}</span>
              )}
            </div>
          )}

          {isAccepted && (
            <div className="mt-4 p-3 rounded-xl" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.12)' }}>
              <p className="text-xs font-medium text-emerald-400 mb-2">Contact Revealed</p>
              <div className="space-y-1">
                <p className="text-xs text-white/60">📧 {other.email}</p>
                {profile?.linkedinUrl && (
                  <a href={profile.linkedinUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-300 hover:text-blue-200 transition block">
                    🔗 LinkedIn Profile
                  </a>
                )}
                {profile?.location && (
                  <p className="text-xs text-white/40">📍 {profile.location}</p>
                )}
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => router.push('/messages')}
                  className="flex-1 py-2 rounded-lg text-xs font-medium text-white border border-blue-500/20 hover:bg-blue-500/5 transition"
                  style={{ background: 'rgba(59,130,246,0.1)' }}>
                  💬 Message
                </button>
                <button onClick={() => router.push('/introductions')}
                  className="flex-1 py-2 rounded-lg text-xs font-medium text-blue-300 border border-blue-500/20 hover:bg-blue-500/5 transition">
                  View Intro →
                </button>
              </div>
            </div>
          )}
        </div>

        {showActions && (
          <div className="flex border-t border-white/5">
            <button
              onClick={() => handleRespond(match.id, 'REJECTED')}
              disabled={responding === match.id}
              className="flex-1 py-3 text-sm font-medium text-white/30 hover:text-red-400 hover:bg-red-500/5 transition disabled:opacity-40"
            >
              Pass
            </button>
            <div className="w-px" style={{ background: 'rgba(255,255,255,0.05)' }} />
            <button
              onClick={() => handleRespond(match.id, 'ACCEPTED')}
              disabled={responding === match.id}
              className="flex-1 py-3 text-sm font-medium transition disabled:opacity-40"
              style={{ color: '#93C5FD' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(59,130,246,0.08)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              {responding === match.id ? 'Sending...' : 'Connect ✓'}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen" style={{ background: '#050510' }}>
      <header className="sticky top-0 z-10 border-b border-white/5" style={{ background: 'rgba(5,5,16,0.85)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/dashboard')} className="text-white/30 hover:text-white/60 transition text-sm hidden sm:block">← Back</button>
            <h1 className="font-semibold text-white text-sm">Your Matches</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden sm:block"><NotificationCenter /></div>
          <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: 'rgba(59,130,246,0.08)' }}>
            {[
              { id: 'pending' as Tab, label: `Pending (${pendingMatches.length})` },
              { id: 'accepted' as Tab, label: `Accepted (${acceptedMatches.length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                  activeTab === tab.id
                    ? 'text-white shadow-sm'
                    : 'text-white/40 hover:text-white/60'
                }`}
                style={activeTab === tab.id ? { background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' } : {}}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="sm:hidden"><MobileNav /></div>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="mb-5">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 text-sm">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, persona, industry, company..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm text-white placeholder:text-white/20 border border-white/5 focus:border-blue-500/30 focus:outline-none transition"
              style={{ background: 'rgba(10,10,26,0.8)' }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/40 text-xs">
                ✕
              </button>
            )}
          </div>
        </div>

        {activeTab === 'pending' && (
          <div className="space-y-4">
            {pendingMatches.length === 0 && waitingMatches.length === 0 ? (
              <div className="text-center py-16">
                <span className="text-5xl block mb-4">🔍</span>
                <h3 className="text-white font-semibold mb-2">No pending matches</h3>
                <p className="text-white/40 text-sm mb-6">Cleya is working on finding your best connections</p>
                <button
                  onClick={() => router.push('/dashboard')}
                  className="px-5 py-2.5 rounded-xl text-sm font-medium text-white transition"
                  style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}
                >
                  Back to Dashboard
                </button>
              </div>
            ) : (
              <>
                {pendingMatches.length > 0 && (
                  <>
                    <p className="text-xs font-medium uppercase tracking-wider text-white/30 mb-3">
                      {pendingMatches.length} match{pendingMatches.length !== 1 ? 'es' : ''} to review
                    </p>
                    {pendingMatches.map((match) => (
                      <MatchCard key={match.id} match={match} showActions={true} />
                    ))}
                  </>
                )}

                {waitingMatches.length > 0 && (
                  <>
                    <p className="text-xs font-medium uppercase tracking-wider text-white/30 mb-3 mt-8">
                      Waiting for response ({waitingMatches.length})
                    </p>
                    {waitingMatches.map((match) => (
                      <MatchCard key={match.id} match={match} showActions={false} />
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'accepted' && (
          <div className="space-y-4">
            {acceptedMatches.length === 0 ? (
              <div className="text-center py-16">
                <span className="text-5xl block mb-4">🤝</span>
                <h3 className="text-white font-semibold mb-2">No accepted matches yet</h3>
                <p className="text-white/40 text-sm">When both sides accept, contact info is revealed here</p>
              </div>
            ) : (
              <>
                <p className="text-xs font-medium uppercase tracking-wider text-white/30 mb-3">
                  {acceptedMatches.length} connection{acceptedMatches.length !== 1 ? 's' : ''} made
                </p>
                {acceptedMatches.map((match) => (
                  <MatchCard key={match.id} match={match} showActions={false} />
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {feedbackPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}>
          <div className="w-full max-w-sm mx-4 rounded-2xl border border-white/10 p-6 fade-up" style={{ background: 'rgba(10,10,26,0.8)' }}>
            <h3 className="text-lg font-semibold text-white mb-1">
              {feedbackPrompt.action === 'ACCEPTED' ? 'Great choice!' : 'Got it!'}
            </h3>
            <p className="text-sm text-white/40 mb-5">How relevant was this match?</p>

            <div className="flex justify-center gap-2 mb-5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} onClick={() => setFeedbackPrompt({ ...feedbackPrompt, rating: star })}
                  className="text-3xl transition-transform hover:scale-110"
                  style={{ filter: star <= feedbackPrompt.rating ? 'none' : 'grayscale(1) opacity(0.3)' }}>
                  ⭐
                </button>
              ))}
            </div>

            <textarea
              value={feedbackPrompt.text}
              onChange={(e) => setFeedbackPrompt({ ...feedbackPrompt, text: e.target.value })}
              placeholder="Any additional feedback? (optional)"
              rows={3}
              className="input-dark resize-none mb-4"
            />

            <div className="flex gap-3">
              <button onClick={() => setFeedbackPrompt(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white/40 border border-white/10 hover:border-white/20 transition">
                Skip
              </button>
              <button onClick={submitFeedback}
                disabled={feedbackPrompt.rating === 0 || submittingFeedback}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}>
                {submittingFeedback ? 'Sending...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      <AppFooter />
    </div>
  );
}
