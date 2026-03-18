'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import NotificationCenter from '@/components/NotificationCenter';
import MobileNav from '@/components/MobileNav';

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
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  useEffect(() => {
    if (!api.getToken()) {
      router.push('/');
      return;
    }
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [matchesData, userData] = await Promise.all([
        api.getMatches(),
        api.getMe(),
      ]);
      setMatches(Array.isArray(matchesData) ? matchesData : []);
      setMe(userData);
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
      setFeedbackPrompt({ matchId, rating: 0, text: '', action: response });
      await loadData();
    } catch (err) {
      console.error('Respond failed:', err);
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

  const pendingMatches = filterBySearch(matches.filter(isPending));
  const acceptedMatches = filterBySearch(matches.filter((m) => m.status === 'ACCEPTED'));
  const waitingMatches = filterBySearch(matches.filter((m) => {
    const myResp = getMyResponse(m);
    return myResp === 'ACCEPTED' && m.status !== 'ACCEPTED' && m.status !== 'REJECTED';
  }));

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
      <div className="min-h-screen" style={{ background: '#0D0B1A' }}>
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

  const MatchCard = ({ match, showActions }: { match: MatchData; showActions: boolean }) => {
    const other = getOtherUser(match);
    const profile = other.profile;
    const scorePercent = Math.round((match.score || 0) * 100);
    const isAccepted = match.status === 'ACCEPTED';

    return (
      <div className="rounded-2xl border border-white/5 overflow-hidden transition hover:border-purple-500/15"
        style={{ background: 'rgba(26,18,48,0.6)' }}>
        <div className="p-5">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #0D948815, #0F766E15)', border: '1px solid rgba(108,71,255,0.12)' }}>
              {personaIcon[profile?.persona || 'OTHER'] || '💬'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-white text-sm truncate">
                  {profile?.currentRole || other.email.split('@')[0]}
                </h3>
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ background: scorePercent >= 70 ? 'rgba(16,185,129,0.12)' : scorePercent >= 50 ? 'rgba(245,158,11,0.12)' : 'rgba(108,71,255,0.12)',
                    color: scorePercent >= 70 ? '#6ee7b7' : scorePercent >= 50 ? '#fbbf24' : '#5EEAD4' }}>
                  {scorePercent}%
                </div>
              </div>
              {profile?.companyName && (
                <p className="text-xs text-white/40 mb-0.5">{profile.companyName}</p>
              )}
              {profile?.persona && (
                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border mt-1"
                  style={{ background: 'rgba(108,71,255,0.08)', borderColor: 'rgba(108,71,255,0.15)', color: '#5EEAD4' }}>
                  {personaLabel[profile.persona] || profile.persona}
                </span>
              )}
            </div>
          </div>

          {profile?.headline && (
            <p className="text-sm text-white/50 mt-3 line-clamp-2">{profile.headline}</p>
          )}

          {match.reason && (
            <div className="mt-3 p-3 rounded-xl" style={{ background: 'rgba(108,71,255,0.06)', border: '1px solid rgba(108,71,255,0.08)' }}>
              <p className="text-xs text-white/50 leading-relaxed">
                <span className="text-purple-300/70 font-medium">Why connect: </span>
                {match.reason}
              </p>
            </div>
          )}

          {profile?.industries && profile.industries.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {profile.industries.slice(0, 4).map((ind) => (
                <span key={ind} className="px-2 py-0.5 rounded-full text-[10px] border"
                  style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>
                  {ind.replace(/_/g, ' ')}
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
                    className="text-xs text-purple-300 hover:text-purple-200 transition block">
                    🔗 LinkedIn Profile
                  </a>
                )}
                {profile?.location && (
                  <p className="text-xs text-white/40">📍 {profile.location}</p>
                )}
              </div>
              <button onClick={() => router.push('/introductions')}
                className="mt-3 w-full py-2 rounded-lg text-xs font-medium text-purple-300 border border-purple-500/20 hover:bg-purple-500/5 transition">
                View Introduction →
              </button>
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
              style={{ color: '#5EEAD4' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(108,71,255,0.08)'; }}
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
    <div className="min-h-screen" style={{ background: '#0D0B1A' }}>
      <header className="sticky top-0 z-10 border-b border-white/5" style={{ background: 'rgba(13,11,26,0.9)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/dashboard')} className="text-white/30 hover:text-white/60 transition text-sm hidden sm:block">← Back</button>
            <h1 className="font-semibold text-white text-sm">Your Matches</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden sm:block"><NotificationCenter /></div>
          <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: 'rgba(108,71,255,0.08)' }}>
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
                style={activeTab === tab.id ? { background: 'linear-gradient(135deg, #0D9488, #0F766E)' } : {}}
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
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm text-white placeholder:text-white/20 border border-white/5 focus:border-purple-500/30 focus:outline-none transition"
              style={{ background: 'rgba(26,18,48,0.6)' }}
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
                <p className="text-white/40 text-sm mb-6">Cleo is working on finding your best connections</p>
                <button
                  onClick={() => router.push('/dashboard')}
                  className="px-5 py-2.5 rounded-xl text-sm font-medium text-white transition"
                  style={{ background: 'linear-gradient(135deg, #0D9488, #0F766E)' }}
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
          <div className="w-full max-w-sm mx-4 rounded-2xl border border-white/10 p-6 fade-up" style={{ background: '#1a1230' }}>
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
                style={{ background: 'linear-gradient(135deg, #0D9488, #0F766E)' }}>
                {submittingFeedback ? 'Sending...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
