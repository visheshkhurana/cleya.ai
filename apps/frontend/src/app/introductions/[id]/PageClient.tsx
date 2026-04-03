'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useRouter, useParams } from 'next/navigation';
import MobileNav from '@/components/MobileNav';
import NotificationCenter from '@/components/NotificationCenter';
import AppShell from '@/components/AppShell';

const personaIcon: Record<string, string> = {
  FOUNDER: '🚀', INVESTOR: '💰', TALENT: '🎯', DEAL_PARTNER: '🤝',
  EVENT_PARTICIPANT: '🏆', VENTURE_PARTNER: '🏦', ADVISOR: '🧠',
  OPERATOR: '⚙️', JOB_SEEKER: '💼', RECRUITER: '👔', FREELANCER: '✨', OTHER: '💬',
};

const statusConfig: Record<string, { bg: string; text: string; label: string; icon: string }> = {
  PENDING_APPROVAL: { bg: 'rgba(245,158,11,0.15)', text: '#fbbf24', label: 'Review Required', icon: '⏳' },
  APPROVED: { bg: 'rgba(59,130,246,0.15)', text: '#93c5fd', label: 'Approved', icon: '✅' },
  SENT: { bg: 'rgba(59,130,246,0.15)', text: '#93C5FD', label: 'Sent', icon: '📤' },
  VIEWED: { bg: 'rgba(59,130,246,0.15)', text: '#93c5fd', label: 'Viewed', icon: '👀' },
  RESPONDED: { bg: 'rgba(16,185,129,0.15)', text: '#6ee7b7', label: 'Responded', icon: '💬' },
  FOLLOWED_UP: { bg: 'rgba(245,158,11,0.15)', text: '#fbbf24', label: 'Follow-up Sent', icon: '🔔' },
  COMPLETED: { bg: 'rgba(16,185,129,0.2)', text: '#10B981', label: 'Completed', icon: '🎉' },
  CANCELLED: { bg: 'rgba(239,68,68,0.15)', text: '#f87171', label: 'Cancelled', icon: '✖' },
};

const outcomeLabels: Record<string, { label: string; icon: string; color: string }> = {
  GREAT_MEETING: { label: 'Great meeting', icon: '🎉', color: '#10B981' },
  GOOD_CHAT: { label: 'Good chat', icon: '👍', color: '#3B82F6' },
  DIDNT_MEET: { label: "Didn't meet", icon: '😕', color: '#f59e0b' },
  NOT_A_FIT: { label: 'Not a fit', icon: '🤷', color: '#ef4444' },
};

export default function IntroductionDetailPage() {
  const [intro, setIntro] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [showOutcome, setShowOutcome] = useState(false);
  const router = useRouter();
  const params = useParams();

  useEffect(() => {
    api.getMe().then((user) => {
      if (!user) { router.push('/?action=login'); return; }
      api.setToken('authenticated');
      loadData();
    }).catch(() => { router.push('/?action=login'); });
  }, []);

  const loadData = async () => {
    try {
      const [introData, userData] = await Promise.all([
        api.getIntroduction(params.id as string),
        api.getMe(),
      ]);
      setIntro(introData);
      setMe(userData);
    } catch {
      router.push('/introductions');
    } finally {
      setLoading(false);
    }
  };

  if (loading || !intro) {
    return (
      <AppShell>
        <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </AppShell>
    );
  }

  const other = me ? (intro.userA.id === me.id ? intro.userB : intro.userA) : intro.userB;
  const profile = other.profile;
  const otherName = other.name || profile?.currentRole || other.email.split('@')[0];
  const sc = statusConfig[intro.status] || statusConfig.SENT;
  const isPending = intro.status === 'PENDING_APPROVAL';
  const canFeedback = ['SENT', 'VIEWED', 'FOLLOWED_UP'].includes(intro.status);

  const handleApprove = async () => {
    setActionLoading('approve');
    try {
      await api.approveIntroduction(intro.id);
      await loadData();
    } catch (e: any) {
      alert(e.message || 'Failed to approve');
    } finally {
      setActionLoading('');
    }
  };

  const handleSaveEdit = async () => {
    if (!editText.trim() || editText.trim().length < 10) {
      alert('Introduction text must be at least 10 characters');
      return;
    }
    setActionLoading('edit');
    try {
      await api.editIntroductionText(intro.id, editText.trim());
      setEditMode(false);
      await loadData();
    } catch (e: any) {
      alert(e.message || 'Failed to save');
    } finally {
      setActionLoading('');
    }
  };

  const handleCancel = async () => {
    if (!confirm('Cancel this introduction?')) return;
    setActionLoading('cancel');
    try {
      await api.cancelIntroduction(intro.id);
      router.push('/introductions');
    } catch (e: any) {
      alert(e.message || 'Failed to cancel');
    } finally {
      setActionLoading('');
    }
  };

  const handleOutcome = async (outcome: string) => {
    setActionLoading('outcome');
    try {
      await api.recordIntroOutcome(intro.id, outcome);
      setShowOutcome(false);
      await loadData();
    } catch (e: any) {
      alert(e.message || 'Failed to record');
    } finally {
      setActionLoading('');
    }
  };

  const autoApproveDate = new Date(new Date(intro.createdAt).getTime() + 48 * 60 * 60 * 1000);
  const hoursUntilAuto = Math.max(0, Math.round((autoApproveDate.getTime() - Date.now()) / (60 * 60 * 1000)));

  return (
    <AppShell>
      <header className="sticky top-0 z-10 border-b border-white/5" style={{ background: 'rgba(5,5,16,0.85)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/introductions')} className="text-white/30 hover:text-white/60 transition text-sm">← Back</button>
            <h1 className="font-semibold text-white text-sm">Introduction</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:block"><NotificationCenter /></div>
            <div className="sm:hidden"><MobileNav /></div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="rounded-2xl border border-white/5 p-6" style={{ background: 'rgba(10,10,26,0.8)' }}>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
              style={{ background: 'linear-gradient(135deg, #3B82F615, #8B5CF615)', border: '1px solid rgba(59,130,246,0.15)' }}>
              {personaIcon[profile?.persona || 'OTHER']}
            </div>
            <div>
              <h2 className="font-semibold text-white">{otherName}</h2>
              {profile?.companyName && <p className="text-sm text-white/40">{profile.companyName}</p>}
              {profile?.location && <p className="text-xs text-white/30">📍 {profile.location}</p>}
            </div>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1"
              style={{ background: sc.bg, color: sc.text }}>
              {sc.icon} {sc.label}
            </span>
            {intro.outcome && (
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold"
                style={{ background: `${outcomeLabels[intro.outcome]?.color}15`, color: outcomeLabels[intro.outcome]?.color }}>
                {outcomeLabels[intro.outcome]?.icon} {outcomeLabels[intro.outcome]?.label}
              </span>
            )}
          </div>

          {isPending && hoursUntilAuto > 0 && (
            <div className="rounded-xl border p-3" style={{ background: 'rgba(245,158,11,0.05)', borderColor: 'rgba(245,158,11,0.15)' }}>
              <p className="text-xs text-amber-300/70">
                ⏰ Auto-sends in ~{hoursUntilAuto}h. Review or edit before then.
              </p>
            </div>
          )}
        </div>

        {intro.introText && (
          <div className="rounded-2xl border border-white/5 p-6" style={{ background: 'rgba(10,10,26,0.8)' }}>
            <p className="text-[10px] uppercase tracking-wider text-white/30 mb-3 font-medium">
              {isPending ? 'Introduction Preview — Review before sending' : 'Introduction Text'}
            </p>
            {editMode ? (
              <div className="space-y-3">
                <textarea value={editText} onChange={(e) => setEditText(e.target.value)}
                  className="w-full bg-transparent text-white/80 text-sm leading-relaxed resize-none outline-none min-h-[200px] border rounded-xl p-4"
                  style={{ borderColor: 'rgba(59,130,246,0.3)' }}
                />
                <div className="flex gap-2">
                  <button onClick={handleSaveEdit} disabled={actionLoading === 'edit'}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}>
                    {actionLoading === 'edit' ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button onClick={() => setEditMode(false)}
                    className="px-4 py-2.5 rounded-xl text-sm text-white/40 hover:text-white/60 transition">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border p-5" style={{ background: 'rgba(59,130,246,0.03)', borderColor: 'rgba(59,130,246,0.1)' }}>
                <p className="text-white/70 text-sm leading-relaxed whitespace-pre-wrap">{intro.introText}</p>
              </div>
            )}
          </div>
        )}

        {intro.talkingPoints?.length > 0 && !editMode && (
          <div className="rounded-2xl border border-white/5 p-6" style={{ background: 'rgba(10,10,26,0.8)' }}>
            <p className="text-[10px] uppercase tracking-wider text-white/30 mb-3 font-medium">Conversation Starters</p>
            <div className="space-y-3">
              {intro.talkingPoints.map((tp: string, i: number) => (
                <div key={i} className="flex gap-3 items-start">
                  <span className="text-blue-400/60 mt-0.5 flex-shrink-0 text-sm">💡</span>
                  <span className="text-white/50 text-sm">{tp}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {intro.status !== 'PENDING_APPROVAL' && intro.status !== 'CANCELLED' && (
          <div className="rounded-2xl border border-white/5 p-6" style={{ background: 'rgba(10,10,26,0.8)' }}>
            <p className="text-[10px] uppercase tracking-wider text-white/30 mb-3 font-medium">Contact Information</p>
            <div className="space-y-2">
              <p className="text-sm text-white/60">📧 {other.email}</p>
              {profile?.linkedinUrl && (
                <a href={profile.linkedinUrl} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-blue-400/80 hover:text-blue-300 transition block">
                  🔗 {profile.linkedinUrl}
                </a>
              )}
              {profile?.phoneNumber && <p className="text-sm text-white/60">📱 {profile.phoneNumber}</p>}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-white/5 p-6 space-y-3" style={{ background: 'rgba(10,10,26,0.8)' }}>
          {isPending && !editMode && (
            <>
              <div className="flex gap-2">
                <button onClick={handleApprove} disabled={actionLoading === 'approve'}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}>
                  {actionLoading === 'approve' ? 'Sending...' : '✓ Approve & Send'}
                </button>
                <button onClick={() => { setEditText(intro.introText || ''); setEditMode(true); }}
                  className="px-5 py-3 rounded-xl text-sm font-medium text-white/60 hover:text-white/80 transition border border-white/10 hover:border-white/20">
                  ✏️ Edit
                </button>
              </div>
              <button onClick={handleCancel} disabled={actionLoading === 'cancel'}
                className="w-full py-2 rounded-xl text-xs text-red-400/50 hover:text-red-400/80 transition disabled:opacity-50">
                Cancel Introduction
              </button>
            </>
          )}

          {canFeedback && !showOutcome && (
            <button onClick={() => setShowOutcome(true)}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white transition"
              style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}>
              How did it go? Share feedback
            </button>
          )}

          {showOutcome && (
            <div className="space-y-3">
              <p className="text-sm text-white/40 text-center">How did your conversation go?</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(outcomeLabels).map(([key, val]) => (
                  <button key={key} onClick={() => handleOutcome(key)}
                    disabled={actionLoading === 'outcome'}
                    className="py-4 rounded-xl text-sm font-medium text-white/70 hover:text-white transition border border-white/10 hover:border-white/20 disabled:opacity-50"
                    style={{ background: 'rgba(10,10,26,0.85)' }}>
                    <span className="block text-xl mb-1">{val.icon}</span>
                    {val.label}
                  </button>
                ))}
              </div>
              <button onClick={() => setShowOutcome(false)} className="w-full text-center text-xs text-white/30 hover:text-white/50 py-1">
                Not now
              </button>
            </div>
          )}

          {intro.status === 'COMPLETED' && (
            <div className="text-center py-2">
              <p className="text-xs text-white/30">Thanks for sharing! Your feedback helps Cleya make better matches.</p>
            </div>
          )}
        </div>

        <div className="text-[10px] text-white/15 space-y-1 px-1">
          <p>Created: {new Date(intro.createdAt).toLocaleString()}</p>
          {intro.sentAt && <p>Sent: {new Date(intro.sentAt).toLocaleString()}</p>}
          {intro.followUpAt && <p>Follow-up scheduled: {new Date(intro.followUpAt).toLocaleString()}</p>}
        </div>
      </div>
    </AppShell>
  );
}
