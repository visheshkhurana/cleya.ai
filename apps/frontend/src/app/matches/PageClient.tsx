'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import NotificationCenter from '@/components/NotificationCenter';
import AppNav from '@/components/AppNav';
import VerificationBadge from '@/components/VerificationBadge';
import { analytics } from '@/lib/posthog';
import { useToast } from '@/components/Toast';
import AppFooter from '@/components/AppFooter';
import AppShell from '@/components/AppShell';
import UserAvatar from '@/components/UserAvatar';
import { personaIcon, personaLabel } from '@/lib/persona';
import WhyMatchModal from '@/components/WhyMatchModal';
import QuickFeedbackChips from '@/components/QuickFeedbackChips';
import InvestorMetrics from '@/components/InvestorMetrics';
import PostIntroResponsePrompt from '@/components/PostIntroResponsePrompt';

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
  userAViewedAt?: string;
  userBViewedAt?: string;
  createdAt: string;
  userA: { id: string; email: string; name?: string; profile?: ProfileData };
  userB: { id: string; email: string; name?: string; profile?: ProfileData };
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
  verificationScore?: number;
  companyStage?: string;
  fundName?: string;
  raiseAmount?: string;
  investmentRange?: string;
  keyTractionPoints?: string;
  yearsExperience?: number;
  businessDescription?: string;
  investmentThesis?: string;
}

type Tab = 'pending' | 'accepted' | 'declined';
type SortOption = 'score' | 'recent';

interface FeedbackState {
  matchId: string;
  rating: number;
  text: string;
  action: 'ACCEPTED' | 'REJECTED';
}

interface MatchStats {
  total: number;
  pending: number;
  accepted: number;
  tier?: string;
  matchesUsed?: number;
  matchesRemaining?: number;
  freeMatchLimit?: number;
  bonusMatches?: number;
  paywallActive?: boolean;
}

export default function MatchesPage() {
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('pending');
  const [me, setMe] = useState<any>(null);
  const [feedbackPrompt, setFeedbackPrompt] = useState<FeedbackState | null>(null);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('score');
  const [expandedProfile, setExpandedProfile] = useState<string | null>(null);
  const [matchStats, setMatchStats] = useState<MatchStats>({ total: 0, pending: 0, accepted: 0 });
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [showPaywall, setShowPaywall] = useState(false);
  const [whyMatchOpen, setWhyMatchOpen] = useState<string | null>(null);
  const [creatingSubscription, setCreatingSubscription] = useState(false);
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
      const [matchesData, userData, statsData] = await Promise.all([
        api.getMatches(),
        api.getMe(),
        api.getMatchStats().catch(() => ({ total: 0, pending: 0, accepted: 0 })),
      ]);
      const matchArr = Array.isArray(matchesData) ? matchesData : [];
      setMatches(matchArr);
      setMe(userData);
      setMatchStats(statsData);
      const proposed = matchArr.filter((m: any) => m.status === 'PROPOSED');
      proposed.forEach((m: any) => analytics.matchProposed(m.id));
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
      const result = await api.respondToMatch(matchId, response);
      if (response === 'ACCEPTED') {
        analytics.matchAccepted(matchId);
        const matchData = result?.data || result;
        if (matchData?.status === 'ACCEPTED') {
          const partnerId = matchData.userAId === me?.id ? matchData.userBId : matchData.userAId;
          toast.success('Match accepted! You can now chat with your connection.');
          setTimeout(() => {
            router.push(`/messages?partner=${partnerId}`);
          }, 1500);
        } else {
          toast.success('Match accepted! Waiting for the other person to respond.');
        }
      } else {
        analytics.matchRejected(matchId);
        toast.info('Match passed.');
      }
      setFeedbackPrompt({ matchId, rating: 0, text: '', action: response });
      await loadData();
    } catch (err: any) {
      console.error('Respond failed:', err);
      if (err.message?.includes('PAYWALL_LIMIT_REACHED') || err.message?.includes('Free match limit')) {
        setShowPaywall(true);
      } else {
        toast.error('Something went wrong. Please try again.');
      }
    } finally {
      setResponding(null);
    }
  };

  const handleSubscribe = async () => {
    setCreatingSubscription(true);
    try {
      const data = await api.createSubscription();
      if (data.subscriptionId && data.keyId && typeof window !== 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => {
          const options = {
            key: data.keyId,
            subscription_id: data.subscriptionId,
            name: 'Cleya.ai',
            description: 'Pro Subscription - Unlimited Matches',
            handler: async () => {
              toast.success('Subscription activated! You now have unlimited matches.');
              setShowPaywall(false);
              await loadData();
            },
            modal: {
              ondismiss: () => {
                setCreatingSubscription(false);
              },
            },
            theme: {
              color: '#6C63FF',
            },
          };
          const rzp = new (window as any).Razorpay(options);
          rzp.open();
        };
        document.body.appendChild(script);
      } else if (data.shortUrl) {
        window.open(data.shortUrl, '_blank');
      }
    } catch (err: any) {
      console.error('Subscription creation failed:', err);
      if (err.message?.includes('already have an active subscription')) {
        toast.info('You already have an active subscription. Refreshing...');
        await loadData();
        setShowPaywall(false);
      } else {
        toast.error('Unable to start subscription. Please try again.');
      }
    } finally {
      setCreatingSubscription(false);
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

  const handleMarkViewed = useCallback((matchId: string) => {
    api.markMatchViewed(matchId).catch(() => {});
  }, []);

  const getOtherUser = (match: MatchData) => {
    if (!me) return match.userB;
    return match.userAId === me.id ? match.userB : match.userA;
  };

  const getMyResponse = (match: MatchData) => {
    if (!me) return 'PENDING';
    return match.userAId === me.id ? match.userAResponse : match.userBResponse;
  };

  const getOtherViewedAt = (match: MatchData) => {
    if (!me) return null;
    return match.userAId === me.id ? match.userBViewedAt : match.userAViewedAt;
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

  const sortList = (list: MatchData[]) => {
    if (sortBy === 'recent') return [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return [...list].sort((a, b) => (b.score || 0) - (a.score || 0));
  };

  const pendingMatches = sortList(filterBySearch(matches.filter(isPending)));
  const acceptedMatches = sortList(filterBySearch(matches.filter((m) => m.status === 'ACCEPTED')));
  const waitingMatches = sortList(filterBySearch(matches.filter((m) => {
    const myResp = getMyResponse(m);
    return myResp === 'ACCEPTED' && m.status !== 'ACCEPTED' && m.status !== 'REJECTED';
  })));
  const declinedMatches = sortList(filterBySearch(matches.filter((m) => m.status === 'REJECTED')));


  const formatStage = (stage?: string) => {
    if (!stage) return null;
    return stage.replace(/_/g, ' ').replace(/\b[a-z]/g, c => c.toUpperCase());
  };

  if (loading) {
    return (
      <AppShell>
        <div className="max-w-5xl mx-auto px-6 lg:px-8 pt-6 pb-12">
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
      </AppShell>
    );
  }

  const CircularProgress = ({ value, size = 48, strokeWidth = 4 }: { value: number; size?: number; strokeWidth?: number }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (value / 100) * circumference;
    const color = value >= 80 ? '#4ECDC4' : value >= 60 ? '#6C63FF' : '#64748B';
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
      <div className="mt-4 rounded-xl p-4" style={{ background: 'rgba(15,22,41,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-start gap-4">
          {scorePercent !== null && (
            <div className="flex-shrink-0 relative">
              <CircularProgress value={scorePercent} size={56} strokeWidth={4} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold" style={{ color: scorePercent >= 80 ? '#4ECDC4' : scorePercent >= 60 ? '#9B95FF' : '#94A3B8' }}>
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
                    <div className="h-full rounded-full" style={{ width: `${val}%`, background: val >= 70 ? '#4ECDC4' : val >= 40 ? '#6C63FF' : '#64748B', transition: 'width 0.4s ease' }} />
                  </div>
                  <span className="text-[10px] w-8 text-right font-mono" style={{ color: val >= 70 ? '#4ECDC4' : '#94A3B8' }}>{val}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const ConnectionStatusBadge = ({ match }: { match: MatchData }) => {
    const myResp = getMyResponse(match);
    const otherViewed = getOtherViewedAt(match);

    if (match.status === 'ACCEPTED') {
      return (
        <div className="flex items-center gap-1.5 mt-2">
          {[
            { label: 'Sent', done: true },
            { label: 'Viewed', done: true },
            { label: 'Accepted', done: true },
          ].map((step, i) => (
            <div key={step.label} className="flex items-center gap-1">
              {i > 0 && <div className="w-3 h-px" style={{ background: 'rgba(16,185,129,0.4)' }} />}
              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(16,185,129,0.12)', color: '#34D399' }}>
                {step.label}
              </span>
            </div>
          ))}
        </div>
      );
    }

    if (match.status === 'REJECTED') {
      const declinedSteps = [
        { label: 'Sent', done: true, declined: false },
        { label: 'Viewed', done: !!otherViewed, declined: false },
        { label: 'Declined', done: true, declined: true },
      ];
      return (
        <div className="flex items-center gap-1.5 mt-2">
          {declinedSteps.map((step, i) => (
            <div key={step.label} className="flex items-center gap-1">
              {i > 0 && <div className="w-3 h-px" style={{ background: step.declined ? 'rgba(239,68,68,0.3)' : 'rgba(108,99,255,0.4)' }} />}
              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full"
                style={{
                  background: step.declined ? 'rgba(239,68,68,0.12)' : step.done ? 'rgba(108,99,255,0.12)' : 'rgba(255,255,255,0.04)',
                  color: step.declined ? '#F87171' : step.done ? '#9B95FF' : 'rgba(255,255,255,0.25)',
                }}>
                {step.label}
              </span>
            </div>
          ))}
        </div>
      );
    }

    if (myResp === 'ACCEPTED') {
      const steps = [
        { label: 'Sent', done: true },
        { label: 'Viewed', done: !!otherViewed },
        { label: 'Accepted', done: false },
      ];
      return (
        <div className="flex items-center gap-1.5 mt-2">
          {steps.map((step, i) => (
            <div key={step.label} className="flex items-center gap-1">
              {i > 0 && <div className="w-3 h-px" style={{ background: step.done ? 'rgba(108,99,255,0.4)' : 'rgba(255,255,255,0.08)' }} />}
              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full"
                style={{
                  background: step.done ? 'rgba(108,99,255,0.12)' : 'rgba(255,255,255,0.04)',
                  color: step.done ? '#9B95FF' : 'rgba(255,255,255,0.25)',
                }}>
                {step.label}
              </span>
            </div>
          ))}
        </div>
      );
    }

    const pendingSteps = [
      { label: 'Sent', done: true },
      { label: 'Viewed', done: false },
      { label: 'Pending', done: false },
    ];
    return (
      <div className="flex items-center gap-1.5 mt-2">
        {pendingSteps.map((step, i) => (
          <div key={step.label} className="flex items-center gap-1">
            {i > 0 && <div className="w-3 h-px" style={{ background: step.done ? 'rgba(108,99,255,0.4)' : 'rgba(255,255,255,0.08)' }} />}
            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full"
              style={{
                background: step.done ? 'rgba(108,99,255,0.12)' : 'rgba(255,255,255,0.04)',
                color: step.done ? '#9B95FF' : 'rgba(255,255,255,0.25)',
              }}>
              {step.label}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const FullProfileModal = ({ match, onClose }: { match: MatchData; onClose: () => void }) => {
    const other = getOtherUser(match);
    const profile = other.profile;
    const scorePercent = Math.round((match.score || 0) * 100);

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
        onClick={onClose}>
        <div className="w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto rounded-2xl border border-white/10 fade-up"
          style={{ background: 'rgba(15,22,41,0.95)' }}
          onClick={(e) => e.stopPropagation()}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-white">Full Profile</h2>
              <button onClick={onClose} className="text-white/30 hover:text-white/60 transition text-xl">✕</button>
            </div>

            <div className="flex items-start gap-4 mb-5">
              <UserAvatar
                name={other.name || profile?.currentRole}
                avatarUrl={profile?.avatarUrl}
                size="3xl"
                shape="rounded"
                fallbackIcon={personaIcon[profile?.persona || 'OTHER'] || '💬'}
                className={profile?.avatarUrl ? 'border border-white/10' : ''}
                style={!profile?.avatarUrl ? { background: 'linear-gradient(135deg, #6C63FF15, #4ECDC415)', border: '1px solid rgba(108,99,255,0.12)' } : undefined}
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white text-base">
                  {other.name || profile?.currentRole || other.email?.split('@')[0] || 'Unknown'}
                </h3>
                {profile?.headline && <p className="text-sm text-white/50 mt-0.5">{profile.headline}</p>}
                {profile?.companyName && (
                  <p className="text-xs text-white/40 mt-0.5">
                    {profile.companyName}
                    {profile.companyStage && ` · ${formatStage(profile.companyStage)}`}
                  </p>
                )}
                {profile?.location && <p className="text-xs text-white/30 mt-0.5">📍 {profile.location}</p>}
              </div>
              <div className="flex-shrink-0">
                <div className="relative">
                  <CircularProgress value={scorePercent} size={52} strokeWidth={4} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-bold" style={{ color: '#9B95FF' }}>{scorePercent}%</span>
                  </div>
                </div>
              </div>
            </div>

            {profile?.persona && (
              <div className="mb-4">
                <span className="inline-block px-2.5 py-1 rounded-full text-xs font-medium border"
                  style={{ background: 'rgba(108,99,255,0.08)', borderColor: 'rgba(108,99,255,0.15)', color: '#9B95FF' }}>
                  {personaLabel[profile.persona] || profile.persona}
                </span>
                {profile.verificationScore !== undefined && profile.verificationScore > 0 && (
                  <span className="ml-2"><VerificationBadge score={profile.verificationScore} size="sm" showLabel={true} /></span>
                )}
              </div>
            )}

            {profile?.bio && (
              <div className="mb-4">
                <p className="text-[10px] font-medium uppercase tracking-wider text-white/25 mb-1.5">About</p>
                <p className="text-sm text-white/60 leading-relaxed">{profile.bio}</p>
              </div>
            )}

            {profile?.businessDescription && (
              <div className="mb-4">
                <p className="text-[10px] font-medium uppercase tracking-wider text-white/25 mb-1.5">Business</p>
                <p className="text-sm text-white/60 leading-relaxed">{profile.businessDescription}</p>
              </div>
            )}

            {profile?.investmentThesis && (
              <div className="mb-4">
                <p className="text-[10px] font-medium uppercase tracking-wider text-white/25 mb-1.5">Investment Thesis</p>
                <p className="text-sm text-white/60 leading-relaxed">{profile.investmentThesis}</p>
              </div>
            )}

            {profile?.keyTractionPoints && (
              <div className="mb-4">
                <p className="text-[10px] font-medium uppercase tracking-wider text-white/25 mb-1.5">Traction</p>
                <p className="text-sm text-white/60 leading-relaxed">{profile.keyTractionPoints}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mb-4">
              {profile?.fundName && (
                <div className="p-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <p className="text-[10px] text-white/25 mb-0.5">Fund</p>
                  <p className="text-xs text-white/60">{profile.fundName}</p>
                </div>
              )}
              {profile?.raiseAmount && (
                <div className="p-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <p className="text-[10px] text-white/25 mb-0.5">Raising</p>
                  <p className="text-xs text-white/60">{profile.raiseAmount}</p>
                </div>
              )}
              {profile?.investmentRange && (
                <div className="p-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <p className="text-[10px] text-white/25 mb-0.5">Check Size</p>
                  <p className="text-xs text-white/60">{profile.investmentRange}</p>
                </div>
              )}
              {profile?.yearsExperience && (
                <div className="p-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <p className="text-[10px] text-white/25 mb-0.5">Experience</p>
                  <p className="text-xs text-white/60">{profile.yearsExperience}+ years</p>
                </div>
              )}
            </div>

            {profile?.skills && profile.skills.length > 0 && (
              <div className="mb-4">
                <p className="text-[10px] font-medium uppercase tracking-wider text-white/25 mb-1.5">Skills & Expertise</p>
                <div className="flex flex-wrap gap-1.5">
                  {profile.skills.map((skill) => (
                    <span key={skill} className="px-2 py-0.5 rounded-full text-[10px] border"
                      style={{ background: 'rgba(78,205,196,0.06)', borderColor: 'rgba(78,205,196,0.12)', color: 'rgba(155,149,255,0.7)' }}>
                      {skill.replace(/_/g, ' ').replace(/\b[a-z]/g, c => c.toUpperCase())}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {profile?.industries && profile.industries.length > 0 && (
              <div className="mb-4">
                <p className="text-[10px] font-medium uppercase tracking-wider text-white/25 mb-1.5">Industries</p>
                <div className="flex flex-wrap gap-1.5">
                  {profile.industries.map((ind) => (
                    <span key={ind} className="px-2 py-0.5 rounded-full text-[10px] border"
                      style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>
                      {ind.replace(/_/g, ' ').replace(/\b(ai|ml|saas|b2b|b2c|iot|ar|vr|hr|it|ui|ux|api|ev|nft|defi|d2c)\b/gi, (m) => m.toUpperCase()).replace(/\b[a-z]/g, (c) => c.toUpperCase())}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {match.reason && (
              <div className="p-3 rounded-xl" style={{ background: 'rgba(108,99,255,0.06)', border: '1px solid rgba(108,99,255,0.08)' }}>
                <p className="text-xs text-white/50 leading-relaxed">
                  <span className="text-brand-violet-hover/70 font-medium">Why connect: </span>
                  {match.reason}
                </p>
              </div>
            )}

            {match.scoreBreakdown && (
              <ScoreBreakdown breakdown={match.scoreBreakdown} overallScore={match.score} />
            )}

            {getOtherUser(match)?.profile?.persona === 'INVESTOR' && (
              <InvestorMetrics userId={getOtherUser(match).id} />
            )}

            <button
              onClick={() => { onClose(); setWhyMatchOpen(match.id); }}
              className="w-full mt-2 py-2 rounded-xl text-xs font-medium text-white/70 border border-white/10 hover:border-white/20 transition"
            >
              Why this match? See factor breakdown →
            </button>
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

    useEffect(() => {
      if (showActions) {
        handleMarkViewed(match.id);
      }
    }, [match.id, showActions]);

    return (
      <div className="rounded-2xl border border-white/5 overflow-hidden transition hover:border-brand-violet/15"
        style={{ background: '#1A2035' }}>
        <div className="p-5">
          <div className="flex items-start gap-4">
            <UserAvatar
              name={other.name || profile?.currentRole}
              avatarUrl={profile?.avatarUrl}
              size="2xl"
              shape="rounded"
              fallbackIcon={personaIcon[profile?.persona || 'OTHER'] || '💬'}
              className={profile?.avatarUrl ? 'border border-white/10' : ''}
              style={!profile?.avatarUrl ? { background: 'linear-gradient(135deg, #6C63FF15, #4ECDC415)', border: '1px solid rgba(108,99,255,0.12)' } : undefined}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-white text-sm truncate">
                  {other.name || profile?.currentRole || other.email?.split('@')[0] || 'Unknown'}
                </h3>
                {profile?.verificationScore !== undefined && profile.verificationScore > 0 && (
                  <VerificationBadge score={profile.verificationScore} size="sm" showLabel={true} />
                )}
                <button
                  onClick={() => setShowBreakdown(!showBreakdown)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono transition hover:opacity-80"
                  title="Click to see score breakdown"
                  style={{ background: scorePercent >= 80 ? 'rgba(78,205,196,0.12)' : 'rgba(108,99,255,0.1)',
                    color: scorePercent >= 80 ? '#4ECDC4' : scorePercent >= 60 ? '#9B95FF' : '#94A3B8' }}>
                  {scorePercent}% · {scorePercent >= 80 ? 'Strong Match' : scorePercent >= 60 ? 'Good Fit' : 'Possible Fit'}
                  <svg className={`w-3 h-3 transition-transform ${showBreakdown ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              {profile?.headline && (
                <p className="text-xs text-white/50 mb-0.5 truncate">{profile.headline}</p>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                {profile?.companyName && (
                  <p className="text-xs text-white/40">
                    {profile.companyName}
                    {profile.companyStage && ` · ${formatStage(profile.companyStage)}`}
                  </p>
                )}
                {profile?.location && (
                  <p className="text-[10px] text-white/25">📍 {profile.location}</p>
                )}
              </div>
              {profile?.persona && (
                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border mt-1"
                  style={{ background: 'rgba(108,99,255,0.08)', borderColor: 'rgba(108,99,255,0.15)', color: '#9B95FF' }}>
                  {personaLabel[profile.persona] || profile.persona}
                </span>
              )}
              <ConnectionStatusBadge match={match} />
            </div>
          </div>

          {profile?.skills && profile.skills.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {profile.skills.slice(0, 5).map((skill) => (
                <span key={skill} className="px-1.5 py-0.5 rounded-full text-[9px] border"
                  style={{ background: 'rgba(78,205,196,0.06)', borderColor: 'rgba(78,205,196,0.12)', color: 'rgba(155,149,255,0.6)' }}>
                  {skill.replace(/_/g, ' ').replace(/\b[a-z]/g, c => c.toUpperCase())}
                </span>
              ))}
              {profile.skills.length > 5 && (
                <span className="text-[9px] text-white/20">+{profile.skills.length - 5}</span>
              )}
            </div>
          )}

          {showBreakdown && <ScoreBreakdown breakdown={match.scoreBreakdown} overallScore={match.score} />}

          {match.reason && (
            <div className="mt-3 p-3.5 rounded-xl" style={{ background: 'linear-gradient(135deg, rgba(108,99,255,0.06), rgba(78,205,196,0.04))', border: '1px solid rgba(108,99,255,0.1)' }}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-xs">💡</span>
                <span className="text-[10px] font-semibold text-brand-violet-hover/80 uppercase tracking-wide">Thought of someone for you</span>
              </div>
              <p className="text-xs text-white/60 leading-relaxed italic">
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

          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={() => setExpandedProfile(match.id)}
              className="text-[11px] font-medium transition hover:opacity-80"
              style={{ color: '#9B95FF' }}>
              View Full Profile →
            </button>
            <button
              onClick={() => setWhyMatchOpen(match.id)}
              className="text-[11px] font-medium text-white/40 hover:text-white/70 transition"
            >
              Why this match? ⓘ
            </button>
          </div>

          {showActions && <QuickFeedbackChips matchId={match.id} />}

          {isAccepted && (
            <div className="mt-4 p-3 rounded-xl" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.12)' }}>
              <p className="text-xs font-medium text-emerald-400 mb-2">Contact Revealed</p>
              <div className="space-y-1">
                <p className="text-xs text-white/60">📧 {other.email}</p>
                {profile?.linkedinUrl && (
                  <a href={profile.linkedinUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-brand-violet-hover hover:text-white/60 transition block">
                    🔗 LinkedIn Profile
                  </a>
                )}
                {profile?.location && (
                  <p className="text-xs text-white/40">📍 {profile.location}</p>
                )}
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => router.push('/messages')}
                  className="flex-1 py-2 rounded-lg text-xs font-medium text-white border border-brand-violet/20 hover:bg-brand-violet/5 transition"
                  style={{ background: 'rgba(108,99,255,0.1)' }}>
                  💬 Message
                </button>
                <button onClick={() => router.push('/introductions')}
                  className="flex-1 py-2 rounded-lg text-xs font-medium text-brand-violet-hover border border-brand-violet/20 hover:bg-brand-violet/5 transition">
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
              style={{ color: '#9B95FF' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(108,99,255,0.08)'; }}
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
    <AppShell>
      <AppNav rightContent={<NotificationCenter />} />
      <div className="max-w-5xl mx-auto px-6 lg:px-8 py-3 flex items-center justify-between">
          <h1 className="font-semibold text-white text-sm">Your Matches</h1>
          <div className="flex items-center gap-2 sm:gap-3">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-white/60 border border-white/10 focus:border-brand-violet/30 focus:outline-none transition appearance-none cursor-pointer"
            style={{ background: 'rgba(15,22,41,0.8)' }}>
            <option value="score">Best Match</option>
            <option value="recent">Most Recent</option>
          </select>
          <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: 'rgba(108,99,255,0.08)' }}>
            {[
              { id: 'pending' as Tab, label: `Pending (${matchStats.pending})` },
              { id: 'accepted' as Tab, label: `Accepted (${matchStats.accepted})` },
              { id: 'declined' as Tab, label: `Declined (${declinedMatches.length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                  activeTab === tab.id
                    ? 'text-white shadow-sm'
                    : 'text-white/40 hover:text-white/60'
                }`}
                style={activeTab === tab.id ? { background: 'linear-gradient(135deg, #6C63FF, #4ECDC4)' } : {}}
              >
                {tab.label}
              </button>
            ))}
          </div>
          </div>
        </div>

      <div className="max-w-5xl mx-auto px-6 lg:px-8 py-6">
        {matchStats.tier === 'FREE' && matchStats.matchesRemaining !== undefined && (
          <div className="mb-5 rounded-xl p-4 border"
            style={{
              background: matchStats.paywallActive ? 'rgba(239,68,68,0.06)' : 'rgba(108,99,255,0.06)',
              borderColor: matchStats.paywallActive ? 'rgba(239,68,68,0.15)' : 'rgba(108,99,255,0.12)',
            }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-lg">{matchStats.paywallActive ? '🔒' : '✨'}</span>
                <div>
                  <p className="text-sm font-medium text-white">
                    {matchStats.paywallActive
                      ? 'Free match limit reached'
                      : `${matchStats.matchesRemaining} free match${matchStats.matchesRemaining !== 1 ? 'es' : ''} remaining`}
                  </p>
                  <p className="text-xs text-white/40 mt-0.5">
                    {matchStats.paywallActive
                      ? 'Subscribe to Pro for unlimited matches and introductions'
                      : `${matchStats.matchesUsed} of ${matchStats.freeMatchLimit} free matches used${matchStats.bonusMatches ? ` (includes ${matchStats.bonusMatches} bonus from referrals)` : ''}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {matchStats.paywallActive && (
                  <button
                    onClick={() => setShowPaywall(true)}
                    className="px-4 py-2 rounded-lg text-xs font-medium text-white transition hover:scale-[1.02]"
                    style={{ background: '#6C63FF' }}>
                    Upgrade to Pro
                  </button>
                )}
              </div>
            </div>
            {!!matchStats.bonusMatches && matchStats.bonusMatches > 0 && (
              <p className="text-xs mt-2 font-medium" style={{ color: '#4ECDC4' }}>
                You earned {matchStats.bonusMatches} bonus intros from referrals!
              </p>
            )}
          </div>
        )}

        <div className="mb-5">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 text-sm">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, persona, industry, company..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm text-white placeholder:text-white/20 border border-white/5 focus:border-brand-violet/30 focus:outline-none transition"
              style={{ background: 'rgba(15,22,41,0.8)' }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/40 text-xs">
                ✕
              </button>
            )}
          </div>
        </div>

        <PostIntroResponsePrompt />

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
                  style={{ background: 'linear-gradient(135deg, #6C63FF, #4ECDC4)' }}
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

        {activeTab === 'declined' && (
          <div className="space-y-4">
            {declinedMatches.length === 0 ? (
              <div className="text-center py-16">
                <span className="text-5xl block mb-4">📋</span>
                <h3 className="text-white font-semibold mb-2">No declined matches</h3>
                <p className="text-white/40 text-sm">Matches that were passed on will appear here</p>
              </div>
            ) : (
              <>
                <p className="text-xs font-medium uppercase tracking-wider text-white/30 mb-3">
                  {declinedMatches.length} declined match{declinedMatches.length !== 1 ? 'es' : ''}
                </p>
                {declinedMatches.map((match) => (
                  <MatchCard key={match.id} match={match} showActions={false} />
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {expandedProfile && matches.find(m => m.id === expandedProfile) && (
        <FullProfileModal
          match={matches.find(m => m.id === expandedProfile)!}
          onClose={() => setExpandedProfile(null)}
        />
      )}

      {whyMatchOpen && (
        <WhyMatchModal matchId={whyMatchOpen} onClose={() => setWhyMatchOpen(null)} />
      )}

      {feedbackPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}>
          <div className="w-full max-w-sm mx-4 rounded-2xl border border-white/10 p-6 fade-up" style={{ background: 'rgba(15,22,41,0.8)' }}>
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
                style={{ background: 'linear-gradient(135deg, #6C63FF, #4ECDC4)' }}>
                {submittingFeedback ? 'Sending...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPaywall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
          onClick={() => setShowPaywall(false)}>
          <div className="w-full max-w-md mx-4 rounded-2xl border border-white/10 p-8 fade-up"
            style={{ background: 'rgba(15,22,41,0.95)' }}
            onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-6">
              <span className="text-5xl block mb-4">🚀</span>
              <h2 className="text-xl font-bold text-white mb-2">Upgrade to Pro</h2>
              <p className="text-sm text-white/50">
                {"You've used all 10 free matches for this month. Subscribe to unlock unlimited matches, introductions, and premium features."}
              </p>
            </div>

            <div className="rounded-xl border border-brand-violet/20 p-5 mb-6"
              style={{ background: 'rgba(108,99,255,0.06)' }}>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-sm text-white/50">&#8377;</span>
                <span className="text-3xl font-bold text-white">2,999</span>
                <span className="text-sm text-white/50">/month</span>
              </div>
              <ul className="space-y-2.5">
                {[
                  'Unlimited AI-powered matches',
                  'Detailed match explanations',
                  'Priority introductions',
                  'In-app messaging',
                  'Meeting scheduling',
                  'Advanced filters & search',
                  'Weekly match digest',
                ].map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm text-white/60">
                    <svg className="w-4 h-4 flex-shrink-0" style={{ color: '#6C63FF' }} viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            <button
              onClick={handleSubscribe}
              disabled={creatingSubscription}
              className="w-full py-3 rounded-xl text-sm font-medium text-white transition hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
              style={{ background: '#6C63FF', boxShadow: '0 0 20px rgba(108,99,255,0.3)' }}>
              {creatingSubscription ? 'Setting up...' : 'Subscribe Now'}
            </button>

            <button
              onClick={() => setShowPaywall(false)}
              className="w-full mt-3 py-2 text-sm text-white/30 hover:text-white/50 transition">
              Maybe later
            </button>
          </div>
        </div>
      )}

      <AppFooter />
    </AppShell>
  );
}
