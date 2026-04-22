'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import AppNav from '@/components/AppNav';
import NotificationCenter from '@/components/NotificationCenter';
import AppFooter from '@/components/AppFooter';
import AppShell from '@/components/AppShell';
import { useToast } from '@/components/Toast';

interface ReferralInfo {
  referralCode: string;
  referralLink: string;
  totalReferrals: number;
  bonusMatches: number;
}

interface ReferralHistoryItem {
  id: string;
  refereeName: string;
  refereeJoinedAt: string;
  rewardGranted: boolean;
}

function getTimeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function ReferralPage() {
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [history, setHistory] = useState<ReferralHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const router = useRouter();
  const toast = useToast();

  const loadData = useCallback(async () => {
    try {
      const [infoData, historyData] = await Promise.all([
        api.getReferralInfo(),
        api.getReferralHistory(),
      ]);
      setInfo(infoData);
      setHistory(historyData);
    } catch (err: any) {
      if (err.message?.includes('401') || err.message?.includes('Unauthorized')) {
        router.push('/?action=login');
        return;
      }
      toast.error('Failed to load referral data');
    } finally {
      setLoading(false);
    }
  }, [router, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const copyLink = async () => {
    if (!info?.referralLink) return;
    try {
      await navigator.clipboard.writeText(info.referralLink);
      setCopied(true);
      toast.success('Referral link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const shareWhatsApp = () => {
    if (!info?.referralLink) return;
    const text = `Join Cleya.ai — your AI Networker for India's startup ecosystem. Cleya meets people on your behalf and introduces you to the few worth your time. ${info.referralLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const shareLinkedIn = () => {
    if (!info?.referralLink) return;
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(info.referralLink)}`, '_blank');
  };

  const shareTwitter = () => {
    if (!info?.referralLink) return;
    const text = `I use Cleya.ai to find warm intros for my startup. Sign up with my link and we both benefit!`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(info.referralLink)}`, '_blank');
  };

  if (loading) {
    return (
      <AppShell>
        <AppNav rightContent={<NotificationCenter />} />
        <div className="max-w-3xl mx-auto px-6 py-20">
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-white/20 border-t-[#6C63FF] rounded-full animate-spin" />
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <AppNav rightContent={<NotificationCenter />} />

      <div className="max-w-3xl mx-auto px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Refer & Earn</h1>
          <p className="text-white/50 text-sm">
            Invite people to Cleya.ai and earn 5 bonus free intros for each signup.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="rounded-xl p-5 border" style={{ background: 'rgba(108,99,255,0.06)', borderColor: 'rgba(108,99,255,0.12)' }}>
            <p className="text-xs text-white/40 uppercase tracking-wider mb-1">People Referred</p>
            <p className="text-2xl font-bold text-white">{info?.totalReferrals || 0}</p>
          </div>
          <div className="rounded-xl p-5 border" style={{ background: 'rgba(78,205,196,0.06)', borderColor: 'rgba(78,205,196,0.12)' }}>
            <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Bonus Intros Earned</p>
            <p className="text-2xl font-bold text-white">{info?.bonusMatches || 0}</p>
          </div>
          <div className="rounded-xl p-5 border" style={{ background: 'rgba(245,158,11,0.06)', borderColor: 'rgba(245,158,11,0.12)' }}>
            <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Per Referral</p>
            <p className="text-2xl font-bold text-white">+5 intros</p>
          </div>
        </div>

        {/* Referral Link */}
        <div className="rounded-xl p-6 border mb-8" style={{ background: 'rgba(26,32,53,0.8)', borderColor: 'rgba(108,99,255,0.15)' }}>
          <p className="text-sm font-medium text-white mb-3">Your Referral Link</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 rounded-lg px-4 py-3 text-sm text-white/70 font-mono truncate"
              style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)' }}>
              {info?.referralLink || '...'}
            </div>
            <button
              onClick={copyLink}
              className="px-5 py-3 rounded-lg text-sm font-medium text-white transition whitespace-nowrap hover:scale-[1.02]"
              style={{ background: copied ? '#10b981' : '#6C63FF' }}
            >
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
          </div>
        </div>

        {/* Share Buttons */}
        <div className="rounded-xl p-6 border mb-8" style={{ background: 'rgba(26,32,53,0.8)', borderColor: 'rgba(108,99,255,0.15)' }}>
          <p className="text-sm font-medium text-white mb-4">Share via</p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={shareWhatsApp}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition hover:scale-[1.02]"
              style={{ background: '#25D366' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              WhatsApp
            </button>
            <button
              onClick={shareLinkedIn}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition hover:scale-[1.02]"
              style={{ background: '#0A66C2' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              LinkedIn
            </button>
            <button
              onClick={shareTwitter}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition hover:scale-[1.02]"
              style={{ background: '#1DA1F2' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              X (Twitter)
            </button>
          </div>
        </div>

        {/* How it works */}
        <div className="rounded-xl p-6 border mb-8" style={{ background: 'rgba(26,32,53,0.8)', borderColor: 'rgba(108,99,255,0.15)' }}>
          <p className="text-sm font-medium text-white mb-4">How it works</p>
          <div className="space-y-3">
            {[
              { step: '1', text: 'Share your unique referral link with friends and colleagues' },
              { step: '2', text: 'They sign up on Cleya.ai using your link' },
              { step: '3', text: 'You get 5 bonus free intros for each person who signs up' },
            ].map(item => (
              <div key={item.step} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ background: '#6C63FF' }}>
                  {item.step}
                </div>
                <p className="text-sm text-white/60">{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Referral History */}
        <div className="rounded-xl p-6 border" style={{ background: 'rgba(26,32,53,0.8)', borderColor: 'rgba(108,99,255,0.15)' }}>
          <p className="text-sm font-medium text-white mb-4">
            Referral History {history.length > 0 && <span className="text-white/40">({history.length})</span>}
          </p>
          {history.length === 0 ? (
            <p className="text-sm text-white/30 py-4 text-center">
              No referrals yet. Share your link to get started!
            </p>
          ) : (
            <div className="space-y-3">
              {history.map(item => (
                <div key={item.id} className="flex items-center justify-between py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ background: 'rgba(108,99,255,0.2)' }}>
                      {item.refereeName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{item.refereeName}</p>
                      <p className="text-xs text-white/40">{getTimeAgo(item.refereeJoinedAt)}</p>
                    </div>
                  </div>
                  {item.rewardGranted && (
                    <span className="text-xs font-medium px-2 py-1 rounded-md" style={{ background: 'rgba(78,205,196,0.1)', color: '#4ECDC4' }}>
                      +5 intros
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <AppFooter />
    </AppShell>
  );
}
