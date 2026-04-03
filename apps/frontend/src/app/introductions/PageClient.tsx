'use client';
import AppShell from '@/components/AppShell';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import MobileNav from '@/components/MobileNav';
import NotificationCenter from '@/components/NotificationCenter';

interface IntroData {
  id: string;
  matchId: string;
  status: string;
  introText?: string;
  talkingPoints: string[];
  outcome?: string;
  outcomeNotes?: string;
  sentAt?: string;
  followUpAt?: string;
  scheduledAt?: string;
  notes?: string;
  createdAt: string;
  match: { score: number; reason?: string };
  userA: { id: string; email: string; name?: string; profile?: any };
  userB: { id: string; email: string; name?: string; profile?: any };
}

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

export default function IntroductionsPage() {
  const [introductions, setIntroductions] = useState<IntroData[]>([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<any>(null);
  const [selectedIntro, setSelectedIntro] = useState<IntroData | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [showOutcomeModal, setShowOutcomeModal] = useState(false);
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

  const handleApprove = async (intro: IntroData) => {
    setActionLoading('approve');
    try {
      await api.approveIntroduction(intro.id);
      await loadData();
      setSelectedIntro(null);
    } catch (e: any) {
      alert(e.message || 'Failed to approve');
    } finally {
      setActionLoading('');
    }
  };

  const handleSaveEdit = async (intro: IntroData) => {
    if (!editText.trim() || editText.trim().length < 10) {
      alert('Introduction text must be at least 10 characters');
      return;
    }
    setActionLoading('edit');
    try {
      await api.editIntroductionText(intro.id, editText.trim());
      setEditMode(false);
      await loadData();
      const updated = introductions.find(i => i.id === intro.id);
      if (updated) setSelectedIntro({ ...updated, introText: editText.trim() });
    } catch (e: any) {
      alert(e.message || 'Failed to save edit');
    } finally {
      setActionLoading('');
    }
  };

  const handleCancel = async (intro: IntroData) => {
    if (!confirm('Are you sure you want to cancel this introduction?')) return;
    setActionLoading('cancel');
    try {
      await api.cancelIntroduction(intro.id);
      await loadData();
      setSelectedIntro(null);
    } catch (e: any) {
      alert(e.message || 'Failed to cancel');
    } finally {
      setActionLoading('');
    }
  };

  const handleOutcome = async (intro: IntroData, outcome: string) => {
    setActionLoading('outcome');
    try {
      await api.recordIntroOutcome(intro.id, outcome);
      setShowOutcomeModal(false);
      await loadData();
      setSelectedIntro(null);
    } catch (e: any) {
      alert(e.message || 'Failed to record outcome');
    } finally {
      setActionLoading('');
    }
  };

  const pendingCount = introductions.filter(i => i.status === 'PENDING_APPROVAL').length;
  const activeCount = introductions.filter(i => ['SENT', 'VIEWED', 'FOLLOWED_UP'].includes(i.status)).length;

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-white/40 text-sm">Loading introductions...</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <header className="glass-header">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/dashboard')} className="text-white/30 hover:text-white/60 transition text-sm hidden sm:block">← Back</button>
            <h1 className="font-semibold text-white text-sm">Introductions</h1>
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: 'rgba(245,158,11,0.2)', color: '#fbbf24' }}>
                {pendingCount} to review
              </span>
            )}
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
            <p className="text-white/40 text-sm mb-2">When both sides accept a match, Cleya drafts a warm introduction.</p>
            <p className="text-white/30 text-xs mb-6">You'll be able to preview and approve it before it's sent.</p>
            <button onClick={() => router.push('/matches')}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-white transition"
              style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}>
              View Matches
            </button>
          </div>
        ) : (
          <>
            {pendingCount > 0 && (
              <div className="rounded-xl border p-4 mb-6" style={{ background: 'rgba(245,158,11,0.05)', borderColor: 'rgba(245,158,11,0.15)' }}>
                <p className="text-sm text-amber-300/80">
                  ⏳ You have <strong>{pendingCount}</strong> introduction{pendingCount !== 1 ? 's' : ''} waiting for your review. 
                  Introductions auto-send after 48 hours if not reviewed.
                </p>
              </div>
            )}

            {activeCount > 0 && (
              <div className="rounded-xl border p-4 mb-6" style={{ background: 'rgba(59,130,246,0.05)', borderColor: 'rgba(59,130,246,0.15)' }}>
                <p className="text-sm text-blue-300/80">
                  📤 You have <strong>{activeCount}</strong> active introduction{activeCount !== 1 ? 's' : ''} out there. 
                  Share how they went when you're ready!
                </p>
              </div>
            )}

            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wider text-white/30 mb-3">
                {introductions.length} introduction{introductions.length !== 1 ? 's' : ''}
              </p>
              {introductions.map((intro) => {
                const other = getOtherUser(intro);
                const profile = other.profile;
                const sc = statusConfig[intro.status] || statusConfig.SENT;
                const otherName = other.name || profile?.currentRole || other.email.split('@')[0];

                return (
                  <button key={intro.id} onClick={() => { setSelectedIntro(intro); setEditMode(false); setShowOutcomeModal(false); }}
                    className="w-full text-left rounded-2xl border border-white/5 p-5 hover:border-blue-500/20 transition group"
                    style={{ background: intro.status === 'PENDING_APPROVAL' ? 'rgba(245,158,11,0.03)' : 'rgba(10,10,26,0.8)' }}>
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, #3B82F615, #8B5CF615)', border: '1px solid rgba(59,130,246,0.12)' }}>
                        {personaIcon[profile?.persona || 'OTHER'] || '💬'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-semibold text-white text-sm truncate">{otherName}</h3>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1"
                            style={{ background: sc.bg, color: sc.text }}>
                            <span>{sc.icon}</span> {sc.label}
                          </span>
                          {intro.outcome && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                              style={{ background: `${outcomeLabels[intro.outcome]?.color}15`, color: outcomeLabels[intro.outcome]?.color }}>
                              {outcomeLabels[intro.outcome]?.icon} {outcomeLabels[intro.outcome]?.label}
                            </span>
                          )}
                        </div>
                        {profile?.companyName && <p className="text-xs text-white/40">{profile.companyName}</p>}
                        {intro.introText && (
                          <p className="text-xs text-white/30 mt-2 line-clamp-2 italic">"{intro.introText.slice(0, 120)}..."</p>
                        )}
                        <p className="text-[10px] text-white/20 mt-2">
                          {intro.sentAt
                            ? `Sent ${new Date(intro.sentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                            : `Created ${new Date(intro.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                          }
                        </p>
                      </div>
                      <span className="text-white/20 text-sm flex-shrink-0 group-hover:text-blue-400/40 transition">→</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {selectedIntro && (
        <IntroDetailModal
          intro={selectedIntro}
          me={me}
          editMode={editMode}
          editText={editText}
          actionLoading={actionLoading}
          showOutcomeModal={showOutcomeModal}
          onClose={() => { setSelectedIntro(null); setEditMode(false); setShowOutcomeModal(false); }}
          onApprove={() => handleApprove(selectedIntro)}
          onStartEdit={() => { setEditText(selectedIntro.introText || ''); setEditMode(true); }}
          onCancelEdit={() => setEditMode(false)}
          onSaveEdit={() => handleSaveEdit(selectedIntro)}
          onEditTextChange={setEditText}
          onCancel={() => handleCancel(selectedIntro)}
          onShowOutcome={() => setShowOutcomeModal(true)}
          onHideOutcome={() => setShowOutcomeModal(false)}
          onRecordOutcome={(outcome) => handleOutcome(selectedIntro, outcome)}
        />
      )}
    </AppShell>
  );
}

function IntroDetailModal({
  intro, me, editMode, editText, actionLoading, showOutcomeModal,
  onClose, onApprove, onStartEdit, onCancelEdit, onSaveEdit, onEditTextChange,
  onCancel, onShowOutcome, onHideOutcome, onRecordOutcome,
}: {
  intro: IntroData; me: any; editMode: boolean; editText: string; actionLoading: string;
  showOutcomeModal: boolean;
  onClose: () => void; onApprove: () => void; onStartEdit: () => void;
  onCancelEdit: () => void; onSaveEdit: () => void; onEditTextChange: (t: string) => void;
  onCancel: () => void; onShowOutcome: () => void; onHideOutcome: () => void;
  onRecordOutcome: (o: string) => void;
}) {
  const other = me ? (intro.userA.id === me.id ? intro.userB : intro.userA) : intro.userB;
  const profile = other.profile;
  const otherName = other.name || profile?.currentRole || other.email.split('@')[0];
  const sc = statusConfig[intro.status] || statusConfig.SENT;
  const isPending = intro.status === 'PENDING_APPROVAL';
  const canFeedback = ['SENT', 'VIEWED', 'FOLLOWED_UP'].includes(intro.status);
  const autoApproveDate = new Date(new Date(intro.createdAt).getTime() + 48 * 60 * 60 * 1000);
  const hoursUntilAuto = Math.max(0, Math.round((autoApproveDate.getTime() - Date.now()) / (60 * 60 * 1000)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-lg rounded-2xl border border-white/10 overflow-hidden max-h-[90vh] overflow-y-auto"
        style={{ background: 'rgba(10,10,26,0.8)' }}>
        <div className="p-5 border-b border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                style={{ background: 'linear-gradient(135deg, #3B82F615, #8B5CF615)', border: '1px solid rgba(59,130,246,0.15)' }}>
                {personaIcon[profile?.persona || 'OTHER']}
              </div>
              <div>
                <h2 className="font-semibold text-white text-sm">{otherName}</h2>
                {profile?.companyName && <p className="text-xs text-white/40">{profile.companyName}</p>}
              </div>
            </div>
            <button onClick={onClose} className="text-white/30 hover:text-white/60 transition text-lg p-1">✕</button>
          </div>
          <div className="flex items-center gap-2 mt-3">
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
        </div>

        <div className="p-5 space-y-5">
          {isPending && hoursUntilAuto > 0 && (
            <div className="rounded-xl border p-3" style={{ background: 'rgba(245,158,11,0.05)', borderColor: 'rgba(245,158,11,0.15)' }}>
              <p className="text-xs text-amber-300/70">
                ⏰ This introduction will auto-send in ~{hoursUntilAuto} hours if not reviewed.
              </p>
            </div>
          )}

          {intro.introText && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/30 mb-2 font-medium">Introduction Preview</p>
              <div className="rounded-xl border p-4" style={{ background: 'rgba(59,130,246,0.03)', borderColor: 'rgba(59,130,246,0.1)' }}>
                {editMode ? (
                  <textarea
                    value={editText}
                    onChange={(e) => onEditTextChange(e.target.value)}
                    className="w-full bg-transparent text-white/80 text-sm leading-relaxed resize-none outline-none min-h-[150px] border rounded-lg p-3"
                    style={{ borderColor: 'rgba(59,130,246,0.3)' }}
                  />
                ) : (
                  <p className="text-white/70 text-sm leading-relaxed whitespace-pre-wrap">{intro.introText}</p>
                )}
              </div>
            </div>
          )}

          {intro.talkingPoints && intro.talkingPoints.length > 0 && !editMode && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/30 mb-2 font-medium">Talking Points</p>
              <div className="space-y-2">
                {intro.talkingPoints.map((tp, i) => (
                  <div key={i} className="flex gap-2 text-sm">
                    <span className="text-blue-400/60 mt-0.5 flex-shrink-0">•</span>
                    <span className="text-white/50">{tp}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {other.email && intro.status !== 'PENDING_APPROVAL' && intro.status !== 'CANCELLED' && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/30 mb-2 font-medium">Contact</p>
              <div className="space-y-1">
                <p className="text-sm text-white/50">📧 {other.email}</p>
                {profile?.linkedinUrl && <p className="text-sm text-white/50">🔗 {profile.linkedinUrl}</p>}
                {profile?.phoneNumber && <p className="text-sm text-white/50">📱 {profile.phoneNumber}</p>}
              </div>
            </div>
          )}

          <div className="text-[10px] text-white/20 space-y-1">
            <p>Created: {new Date(intro.createdAt).toLocaleString()}</p>
            {intro.sentAt && <p>Sent: {new Date(intro.sentAt).toLocaleString()}</p>}
          </div>
        </div>

        <div className="p-5 border-t border-white/5 space-y-3">
          {isPending && !editMode && (
            <div className="flex gap-2">
              <button onClick={onApprove} disabled={actionLoading === 'approve'}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}>
                {actionLoading === 'approve' ? 'Sending...' : '✓ Approve & Send'}
              </button>
              <button onClick={onStartEdit}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:text-white/80 transition border border-white/10 hover:border-white/20">
                ✏️ Edit
              </button>
            </div>
          )}

          {isPending && editMode && (
            <div className="flex gap-2">
              <button onClick={onSaveEdit} disabled={actionLoading === 'edit'}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}>
                {actionLoading === 'edit' ? 'Saving...' : 'Save Changes'}
              </button>
              <button onClick={onCancelEdit}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-white/40 hover:text-white/60 transition">
                Cancel
              </button>
            </div>
          )}

          {canFeedback && !showOutcomeModal && (
            <button onClick={onShowOutcome}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition"
              style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}>
              How did it go? Share feedback
            </button>
          )}

          {showOutcomeModal && (
            <div className="space-y-2">
              <p className="text-xs text-white/40 text-center mb-3">How did your conversation go?</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(outcomeLabels).map(([key, val]) => (
                  <button key={key} onClick={() => onRecordOutcome(key)}
                    disabled={actionLoading === 'outcome'}
                    className="py-3 rounded-xl text-sm font-medium text-white/70 hover:text-white transition border border-white/10 hover:border-white/20 disabled:opacity-50"
                    style={{ background: 'rgba(10,10,26,0.85)' }}>
                    <span className="block text-lg mb-1">{val.icon}</span>
                    {val.label}
                  </button>
                ))}
              </div>
              <button onClick={onHideOutcome} className="w-full text-center text-xs text-white/30 hover:text-white/50 mt-2 py-1">
                Not now
              </button>
            </div>
          )}

          {isPending && !editMode && (
            <button onClick={onCancel} disabled={actionLoading === 'cancel'}
              className="w-full py-2 rounded-xl text-xs text-red-400/50 hover:text-red-400/80 transition disabled:opacity-50">
              {actionLoading === 'cancel' ? 'Cancelling...' : 'Cancel Introduction'}
            </button>
          )}

          {intro.status === 'COMPLETED' && intro.outcome && (
            <div className="text-center py-2">
              <p className="text-xs text-white/30">Thanks for your feedback! This helps Cleya make better matches.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
