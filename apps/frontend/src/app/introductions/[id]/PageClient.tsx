'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useRouter, useParams } from 'next/navigation';
import AppNav from '@/components/AppNav';
import AppFooter from '@/components/AppFooter';
import Breadcrumb from '@/components/Breadcrumb';
import NotificationCenter from '@/components/NotificationCenter';
import AppShell from '@/components/AppShell';
import { useTranslation } from '@/lib/i18n';
import { personaIcon } from '@/lib/persona';

const statusStyles: Record<string, { bg: string; text: string; labelKey: string; icon: string }> = {
  PENDING_APPROVAL: { bg: 'rgba(245,158,11,0.15)', text: '#fbbf24', labelKey: 'intro.statusReview', icon: '⏳' },
  APPROVED: { bg: 'rgba(108,99,255,0.15)', text: '#93c5fd', labelKey: 'intro.statusApproved', icon: '✅' },
  SENT: { bg: 'rgba(108,99,255,0.15)', text: '#9B95FF', labelKey: 'intro.statusSent', icon: '📤' },
  VIEWED: { bg: 'rgba(108,99,255,0.15)', text: '#93c5fd', labelKey: 'intro.statusViewed', icon: '👀' },
  RESPONDED: { bg: 'rgba(16,185,129,0.15)', text: '#6ee7b7', labelKey: 'intro.statusResponded', icon: '💬' },
  FOLLOWED_UP: { bg: 'rgba(245,158,11,0.15)', text: '#fbbf24', labelKey: 'intro.statusFollowedUp', icon: '🔔' },
  COMPLETED: { bg: 'rgba(16,185,129,0.2)', text: '#10B981', labelKey: 'intro.statusCompleted', icon: '🎉' },
  CANCELLED: { bg: 'rgba(239,68,68,0.15)', text: '#f87171', labelKey: 'intro.statusCancelled', icon: '✖' },
};

const outcomeKeys: Record<string, { labelKey: string; icon: string; color: string }> = {
  GREAT_MEETING: { labelKey: 'intro.greatMeeting', icon: '🎉', color: '#10B981' },
  GOOD_CHAT: { labelKey: 'intro.goodChat', icon: '👍', color: '#6C63FF' },
  DIDNT_MEET: { labelKey: 'intro.didntMeet', icon: '😕', color: '#f59e0b' },
  NOT_A_FIT: { labelKey: 'intro.notAFit', icon: '🤷', color: '#ef4444' },
};

export default function IntroductionDetailPage() {
  const [intro, setIntro] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [showOutcome, setShowOutcome] = useState(false);
  const { t } = useTranslation();
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
        <div className="w-5 h-5 border-2 border-brand-violet border-t-transparent rounded-full animate-spin" />
      </AppShell>
    );
  }

  const other = me ? (intro.userA.id === me.id ? intro.userB : intro.userA) : intro.userB;
  const profile = other.profile;
  const otherName = other.name || profile?.currentRole || other.email.split('@')[0];
  const sc = statusStyles[intro.status] || statusStyles.SENT;
  const isPending = intro.status === 'PENDING_APPROVAL';
  const canFeedback = ['SENT', 'VIEWED', 'FOLLOWED_UP'].includes(intro.status);

  const handleApprove = async () => {
    setActionLoading('approve');
    try {
      await api.approveIntroduction(intro.id);
      await loadData();
    } catch (e: any) {
      alert(e.message || t('common.error'));
    } finally {
      setActionLoading('');
    }
  };

  const handleSaveEdit = async () => {
    if (!editText.trim() || editText.trim().length < 10) {
      alert(t('intro.editMinLength'));
      return;
    }
    setActionLoading('edit');
    try {
      await api.editIntroductionText(intro.id, editText.trim());
      setEditMode(false);
      await loadData();
    } catch (e: any) {
      alert(e.message || t('common.error'));
    } finally {
      setActionLoading('');
    }
  };

  const handleCancel = async () => {
    if (!confirm(t('intro.confirmCancel'))) return;
    setActionLoading('cancel');
    try {
      await api.cancelIntroduction(intro.id);
      router.push('/introductions');
    } catch (e: any) {
      alert(e.message || t('common.error'));
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
      alert(e.message || t('common.error'));
    } finally {
      setActionLoading('');
    }
  };

  const autoApproveDate = new Date(new Date(intro.createdAt).getTime() + 48 * 60 * 60 * 1000);
  const hoursUntilAuto = Math.max(0, Math.round((autoApproveDate.getTime() - Date.now()) / (60 * 60 * 1000)));

  return (
    <AppShell>
      <AppNav rightContent={<NotificationCenter />} />

      <div className="max-w-2xl mx-auto px-6 lg:px-8 pt-4 pb-2">
        <Breadcrumb items={[
          { label: t('nav.dashboard'), href: '/dashboard' },
          { label: t('intro.title'), href: '/introductions' },
          { label: otherName },
        ]} />
      </div>

      <div className="max-w-2xl mx-auto px-6 lg:px-8 py-6 space-y-6">
        <div className="rounded-2xl border border-white/5 p-6" style={{ background: 'rgba(15,22,41,0.8)' }}>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
              style={{ background: 'linear-gradient(135deg, #6C63FF15, #4ECDC415)', border: '1px solid rgba(108,99,255,0.15)' }}>
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
              {sc.icon} {t(sc.labelKey)}
            </span>
            {intro.outcome && (
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold"
                style={{ background: `${outcomeKeys[intro.outcome]?.color}15`, color: outcomeKeys[intro.outcome]?.color }}>
                {outcomeKeys[intro.outcome]?.icon} {t(outcomeKeys[intro.outcome]?.labelKey)}
              </span>
            )}
          </div>

          {isPending && hoursUntilAuto > 0 && (
            <div className="rounded-xl border p-3" style={{ background: 'rgba(245,158,11,0.05)', borderColor: 'rgba(245,158,11,0.15)' }}>
              <p className="text-xs text-amber-300/70">
                ⏰ {t('intro.autoSendHours').replace('{hours}', String(hoursUntilAuto))}
              </p>
            </div>
          )}
        </div>

        {intro.introText && (
          <div className="rounded-2xl border border-white/5 p-6" style={{ background: 'rgba(15,22,41,0.8)' }}>
            <p className="text-[10px] uppercase tracking-wider text-white/30 mb-3 font-medium">
              {t('intro.preview')}
            </p>
            {editMode ? (
              <div className="space-y-3">
                <textarea value={editText} onChange={(e) => setEditText(e.target.value)}
                  className="w-full bg-transparent text-white/80 text-sm leading-relaxed resize-none outline-none min-h-[200px] border rounded-xl p-4"
                  style={{ borderColor: 'rgba(108,99,255,0.3)' }}
                />
                <div className="flex gap-2">
                  <button onClick={handleSaveEdit} disabled={actionLoading === 'edit'}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #6C63FF, #4ECDC4)' }}>
                    {actionLoading === 'edit' ? t('intro.saving') : t('intro.saveChanges')}
                  </button>
                  <button onClick={() => setEditMode(false)}
                    className="px-4 py-2.5 rounded-xl text-sm text-white/40 hover:text-white/60 transition">
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border p-5" style={{ background: 'rgba(108,99,255,0.03)', borderColor: 'rgba(108,99,255,0.1)' }}>
                <p className="text-white/70 text-sm leading-relaxed whitespace-pre-wrap">{intro.introText}</p>
              </div>
            )}
          </div>
        )}

        {intro.talkingPoints?.length > 0 && !editMode && (
          <div className="rounded-2xl border border-white/5 p-6" style={{ background: 'rgba(15,22,41,0.8)' }}>
            <p className="text-[10px] uppercase tracking-wider text-white/30 mb-3 font-medium">{t('intro.talkingPoints')}</p>
            <div className="space-y-3">
              {intro.talkingPoints.map((tp: string, i: number) => (
                <div key={i} className="flex gap-3 items-start">
                  <span className="text-brand-violet/60 mt-0.5 flex-shrink-0 text-sm">💡</span>
                  <span className="text-white/50 text-sm">{tp}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {intro.status !== 'PENDING_APPROVAL' && intro.status !== 'CANCELLED' && (
          <div className="rounded-2xl border border-white/5 p-6" style={{ background: 'rgba(15,22,41,0.8)' }}>
            <p className="text-[10px] uppercase tracking-wider text-white/30 mb-3 font-medium">{t('intro.contact')}</p>
            <div className="space-y-2">
              <p className="text-sm text-white/60">📧 {other.email}</p>
              {profile?.linkedinUrl && (
                <a href={profile.linkedinUrl} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-brand-violet/80 hover:text-brand-violet-hover transition block">
                  🔗 {profile.linkedinUrl}
                </a>
              )}
              {profile?.phoneNumber && <p className="text-sm text-white/60">📱 {profile.phoneNumber}</p>}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-white/5 p-6 space-y-3" style={{ background: 'rgba(15,22,41,0.8)' }}>
          {isPending && !editMode && (
            <>
              <div className="flex gap-2">
                <button onClick={handleApprove} disabled={actionLoading === 'approve'}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #6C63FF, #4ECDC4)' }}>
                  {actionLoading === 'approve' ? t('intro.sending') : `✓ ${t('intro.approve')}`}
                </button>
                <button onClick={() => { setEditText(intro.introText || ''); setEditMode(true); }}
                  className="px-5 py-3 rounded-xl text-sm font-medium text-white/60 hover:text-white/80 transition border border-white/10 hover:border-white/20">
                  ✏️ {t('intro.edit')}
                </button>
              </div>
              <button onClick={handleCancel} disabled={actionLoading === 'cancel'}
                className="w-full py-2 rounded-xl text-xs text-red-400/50 hover:text-red-400/80 transition disabled:opacity-50">
                {actionLoading === 'cancel' ? t('intro.cancelling') : t('intro.cancel')}
              </button>
            </>
          )}

          {canFeedback && !showOutcome && (
            <button onClick={() => setShowOutcome(true)}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white transition"
              style={{ background: 'linear-gradient(135deg, #6C63FF, #4ECDC4)' }}>
              {t('intro.howDidItGo')}
            </button>
          )}

          {showOutcome && (
            <div className="space-y-3">
              <p className="text-sm text-white/40 text-center">{t('intro.howWasConversation')}</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(outcomeKeys).map(([key, val]) => (
                  <button key={key} onClick={() => handleOutcome(key)}
                    disabled={actionLoading === 'outcome'}
                    className="py-4 rounded-xl text-sm font-medium text-white/70 hover:text-white transition border border-white/10 hover:border-white/20 disabled:opacity-50"
                    style={{ background: 'rgba(15,22,41,0.85)' }}>
                    <span className="block text-xl mb-1">{val.icon}</span>
                    {t(val.labelKey)}
                  </button>
                ))}
              </div>
              <button onClick={() => setShowOutcome(false)} className="w-full text-center text-xs text-white/30 hover:text-white/50 py-1">
                {t('intro.notNow')}
              </button>
            </div>
          )}

          {intro.status === 'COMPLETED' && (
            <div className="text-center py-2">
              <p className="text-xs text-white/30">{t('intro.thanksFeedback')}</p>
            </div>
          )}
        </div>

        <div className="text-[10px] text-white/15 space-y-1 px-1">
          <p>{t('intro.created')}: {new Date(intro.createdAt).toLocaleString()}</p>
          {intro.sentAt && <p>{t('intro.sent')}: {new Date(intro.sentAt).toLocaleString()}</p>}
          {intro.followUpAt && <p>{t('intro.statusFollowedUp')}: {new Date(intro.followUpAt).toLocaleString()}</p>}
        </div>
      </div>
      <AppFooter />
    </AppShell>
  );
}
