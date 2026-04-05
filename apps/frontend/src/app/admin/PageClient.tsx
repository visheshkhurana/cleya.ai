'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import PhoneInput from '@/components/PhoneInput';
import AppShell from '@/components/AppShell';

interface Stats {
  totalUsers: number;
  activeConversations: number;
  completedProfiles: number;
  totalMatches: number;
  acceptedMatches: number;
  matchAcceptRate: number;
  totalCalls: number;
  totalMessages: number;
}

interface FunnelStep {
  stage: string;
  count: number;
}

interface CommData {
  calls: any[];
  messages: any[];
  callStats: { total: number; completed: number; failed: number; inProgress: number };
  messageStats: { totalSMS: number; totalWhatsApp: number; delivered: number; failed: number; total: number };
}

type Tab = 'overview' | 'communications' | 'deals' | 'events' | 'analytics';

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [funnel, setFunnel] = useState<FunnelStep[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [commData, setCommData] = useState<CommData | null>(null);
  const [dealData, setDealData] = useState<{ deals: any[]; stats: any } | null>(null);
  const [eventData, setEventData] = useState<{ events: any[]; stats: any } | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triggerModal, setTriggerModal] = useState<{ type: 'call' | 'message'; user: any } | null>(null);
  const [triggerPhone, setTriggerPhone] = useState('');
  const [triggerMessage, setTriggerMessage] = useState('');
  const [triggerChannel, setTriggerChannel] = useState<'SMS' | 'WHATSAPP'>('WHATSAPP');
  const [triggerLoading, setTriggerLoading] = useState(false);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({ name: '', description: '', date: '', location: '', isVirtual: false, maxCapacity: '' });
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [digestLoading, setDigestLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    api.getMe().then((user) => {
      if (!user) { router.push('/'); return; }
      api.setToken('authenticated');
      loadDashboard();
    }).catch(() => { router.push('/'); });
  }, []);

  const loadDashboard = async () => {
    try {
      const [statsData, funnelData, usersData] = await Promise.all([
        api.getAdminStats(),
        api.getAdminFunnel(),
        api.getAdminUsers(),
      ]);
      setStats(statsData);
      setFunnel(funnelData.funnel || []);
      setUsers(Array.isArray(usersData) ? usersData : usersData?.users || []);
    } catch (err: any) {
      console.error('Admin load failed:', err);
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const loadComms = async () => {
    try {
      const data = await api.getAdminCommunications();
      setCommData(data);
    } catch (err: any) {
      console.error('Failed to load communications:', err);
    }
  };

  const loadDeals = async () => {
    try {
      const data = await api.getAdminDeals();
      setDealData(data);
    } catch (err: any) {
      console.error('Failed to load deals:', err);
    }
  };

  const loadEvents = async () => {
    try {
      const data = await api.getAdminEvents();
      setEventData(data);
    } catch (err: any) {
      console.error('Failed to load events:', err);
    }
  };

  const loadAnalytics = async () => {
    try {
      const data = await api.getAdminAnalytics();
      setAnalyticsData(data);
    } catch (err: any) {
      console.error('Failed to load analytics:', err);
    }
  };

  const handleSendDigest = async () => {
    setDigestLoading(true);
    try {
      await api.sendWeeklyDigest();
    } catch (err) {
      console.error('Digest send failed:', err);
    }
    setDigestLoading(false);
  };

  const handleCreateEvent = async () => {
    try {
      await api.createEvent({
        ...newEvent,
        maxCapacity: newEvent.maxCapacity ? parseInt(newEvent.maxCapacity) : undefined,
      });
      setShowCreateEvent(false);
      setNewEvent({ name: '', description: '', date: '', location: '', isVirtual: false, maxCapacity: '' });
      loadEvents();
    } catch (err: any) {
      alert(err.message || 'Failed to create event');
    }
  };

  useEffect(() => {
    if (activeTab === 'communications' && !commData) loadComms();
    if (activeTab === 'deals' && !dealData) loadDeals();
    if (activeTab === 'events' && !eventData) loadEvents();
    if (activeTab === 'analytics' && !analyticsData) loadAnalytics();
  }, [activeTab]);

  const handleTrigger = async () => {
    if (!triggerModal || !triggerPhone) return;
    setTriggerLoading(true);
    try {
      if (triggerModal.type === 'call') {
        await api.adminTriggerCall(triggerModal.user.id, triggerPhone);
      } else {
        await api.adminTriggerMessage(triggerModal.user.id, triggerPhone, triggerChannel, triggerMessage);
      }
      setTriggerModal(null);
      setTriggerPhone('');
      setTriggerMessage('');
      loadComms();
    } catch (err: any) {
      alert(err.message || 'Failed to trigger');
    } finally {
      setTriggerLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-blue-300">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-red-400">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  const maxFunnel = funnel.length > 0 ? Math.max(...funnel.map((f) => f.count), 1) : 1;

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const statusColor = (status: string) => {
    const map: Record<string, string> = {
      COMPLETED: 'text-green-400 bg-green-500/10 border-green-500/20',
      SENT: 'text-green-400 bg-green-500/10 border-green-500/20',
      DELIVERED: 'text-green-400 bg-green-500/10 border-green-500/20',
      IN_PROGRESS: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
      QUEUED: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
      SCHEDULED: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
      FAILED: 'text-red-400 bg-red-500/10 border-red-500/20',
      NO_ANSWER: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    };
    return map[status] || 'text-blue-300 bg-blue-500/10 border-blue-500/20';
  };

  return (
    <AppShell>
      <header className="glass-header px-6 lg:px-8 py-3 sm:py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white text-sm font-bold flex items-center justify-center shadow-lg shadow-blue-500/20">
              C
            </div>
            <h1 className="text-base sm:text-lg font-bold text-white">Cleya.ai Admin</h1>
          </div>
          <button
            onClick={() => { api.logout().then(() => router.push('/')); }}
            className="text-xs sm:text-sm text-slate-400 hover:text-blue-200 transition"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-4 sm:py-6">
        <div className="flex gap-1 mb-6 p-1 rounded-xl bg-blue-900/20 border border-blue-500/10 overflow-x-auto">
          {[
            { id: 'overview' as Tab, label: 'Overview', icon: '📊' },
            { id: 'communications' as Tab, label: 'Comms', icon: '📞' },
            { id: 'deals' as Tab, label: 'Deals', icon: '🤝' },
            { id: 'events' as Tab, label: 'Events', icon: '📅' },
            { id: 'analytics' as Tab, label: 'Analytics', icon: '📈' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                  : 'text-slate-400 hover:text-blue-200'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-8">
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total Users', value: stats.totalUsers, icon: '👥' },
                  { label: 'Complete Profiles', value: stats.completedProfiles, icon: '✅' },
                  { label: 'Total Matches', value: stats.totalMatches, icon: '🤝' },
                  { label: 'Accept Rate', value: `${stats.matchAcceptRate}%`, icon: '📈' },
                  { label: 'Active Chats', value: stats.activeConversations, icon: '💬' },
                  { label: 'Accepted Matches', value: stats.acceptedMatches, icon: '🎉' },
                  { label: 'Total Calls', value: stats.totalCalls, icon: '📞' },
                  { label: 'Total Messages', value: stats.totalMessages, icon: '💬' },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="bg-[rgba(10,10,26,0.8)]/60 backdrop-blur-sm rounded-xl border border-blue-500/10 p-5 hover:border-blue-500/20 transition"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{stat.icon}</span>
                      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{stat.label}</p>
                    </div>
                    <p className="text-3xl font-bold text-white">{stat.value}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-[rgba(10,10,26,0.8)]/60 backdrop-blur-sm rounded-xl border border-blue-500/10 p-6">
              <h2 className="text-sm font-semibold text-white mb-6">Conversion Funnel</h2>
              <div className="space-y-3">
                {funnel.map((step, i) => (
                  <div key={step.stage} className="flex items-center gap-4">
                    <div className="w-44 text-xs font-medium text-blue-300/70 text-right">{step.stage}</div>
                    <div className="flex-1 bg-blue-900/20 rounded-full h-8 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-600 to-blue-500 rounded-full flex items-center justify-end pr-3 transition-all duration-700"
                        style={{ width: `${Math.max((step.count / maxFunnel) * 100, 8)}%` }}
                      >
                        <span className="text-xs font-bold text-white">{step.count}</span>
                      </div>
                    </div>
                    {i > 0 && funnel[i - 1].count > 0 && (
                      <div className="w-16 text-xs text-blue-400/50">
                        {Math.round((step.count / funnel[i - 1].count) * 100)}%
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[rgba(10,10,26,0.8)]/60 backdrop-blur-sm rounded-xl border border-blue-500/10 overflow-hidden">
              <div className="px-6 py-4 border-b border-blue-500/10 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Users ({users.length})</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-blue-900/10">
                      <th className="text-left px-3 sm:px-6 py-3 text-xs font-medium text-slate-400 uppercase">Email</th>
                      <th className="text-left px-3 sm:px-6 py-3 text-xs font-medium text-slate-400 uppercase">Persona</th>
                      <th className="text-left px-3 sm:px-6 py-3 text-xs font-medium text-slate-400 uppercase">Company</th>
                      <th className="text-left px-3 sm:px-6 py-3 text-xs font-medium text-slate-400 uppercase">Completeness</th>
                      <th className="text-left px-3 sm:px-6 py-3 text-xs font-medium text-slate-400 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-500/5">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-blue-900/10 transition">
                        <td className="px-6 py-3 font-medium text-white">{user.email}</td>
                        <td className="px-6 py-3">
                          {user.profile?.persona ? (
                            <span className="px-2.5 py-1 rounded-full text-xs bg-blue-500/15 text-blue-300 border border-blue-500/20">
                              {user.profile.persona}
                            </span>
                          ) : (
                            <span className="text-blue-400/30">-</span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-blue-200/70">{user.profile?.companyName || '-'}</td>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-blue-900/20 rounded-full h-1.5">
                              <div
                                className="bg-gradient-to-r from-blue-500 to-blue-400 rounded-full h-1.5 transition-all"
                                style={{ width: `${(user.profile?.completenessScore || 0) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs text-blue-300/50">
                              {Math.round((user.profile?.completenessScore || 0) * 100)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => { setTriggerModal({ type: 'call', user }); setTriggerPhone(user.phone || ''); }}
                              className="px-2 py-1 text-xs rounded-md bg-blue-600/20 text-blue-300 hover:bg-blue-600/40 transition border border-blue-500/20"
                            >
                              Call
                            </button>
                            <button
                              onClick={() => { setTriggerModal({ type: 'message', user }); setTriggerPhone(user.phone || ''); setTriggerMessage(''); }}
                              className="px-2 py-1 text-xs rounded-md bg-blue-600/20 text-blue-300 hover:bg-blue-600/40 transition border border-blue-500/20"
                            >
                              Message
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'communications' && (
          <div className="space-y-6">
            {commData && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                  { label: 'Total Calls', value: commData.callStats.total, icon: '📞' },
                  { label: 'Completed Calls', value: commData.callStats.completed, icon: '✅' },
                  { label: 'Failed Calls', value: commData.callStats.failed, icon: '❌' },
                  { label: 'SMS Sent', value: commData.messageStats.totalSMS, icon: '💬' },
                  { label: 'WhatsApp Sent', value: commData.messageStats.totalWhatsApp, icon: '📱' },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="bg-[rgba(10,10,26,0.8)]/60 backdrop-blur-sm rounded-xl border border-blue-500/10 p-5"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{stat.icon}</span>
                      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{stat.label}</p>
                    </div>
                    <p className="text-2xl font-bold text-white">{stat.value}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-[rgba(10,10,26,0.8)]/60 backdrop-blur-sm rounded-xl border border-blue-500/10 overflow-hidden">
              <div className="px-6 py-4 border-b border-blue-500/10">
                <h2 className="text-sm font-semibold text-white">Recent Calls</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-blue-900/10">
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase">User</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase">Phone</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase">Direction</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase">Status</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase">Duration</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-500/5">
                    {(commData?.calls || []).map((call: any) => (
                      <tr key={call.id} className="hover:bg-blue-900/10 transition">
                        <td className="px-6 py-3 text-white">{call.user?.email || '-'}</td>
                        <td className="px-6 py-3 text-blue-200/70">{call.phoneNumber}</td>
                        <td className="px-6 py-3">
                          <span className={`text-xs ${call.direction === 'INBOUND' ? 'text-blue-400' : 'text-blue-300'}`}>
                            {call.direction === 'INBOUND' ? '← In' : '→ Out'}
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs border ${statusColor(call.status)}`}>
                            {call.status}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-blue-200/70">
                          {call.duration ? `${Math.floor(call.duration / 60)}m ${call.duration % 60}s` : '-'}
                        </td>
                        <td className="px-6 py-3 text-blue-300/40 text-xs">{formatDate(call.createdAt)}</td>
                      </tr>
                    ))}
                    {(!commData?.calls || commData.calls.length === 0) && (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-blue-400/40">No call records yet</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-[rgba(10,10,26,0.8)]/60 backdrop-blur-sm rounded-xl border border-blue-500/10 overflow-hidden">
              <div className="px-6 py-4 border-b border-blue-500/10">
                <h2 className="text-sm font-semibold text-white">Recent Messages (WhatsApp + SMS)</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-blue-900/10">
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase">User</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase">Phone</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase">Channel</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase">Content</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase">Status</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-500/5">
                    {(commData?.messages || []).map((msg: any) => (
                      <tr key={msg.id} className="hover:bg-blue-900/10 transition">
                        <td className="px-6 py-3 text-white">{msg.user?.email || '-'}</td>
                        <td className="px-6 py-3 text-blue-200/70">{msg.recipientPhone}</td>
                        <td className="px-6 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs border ${
                            msg.channel === 'WHATSAPP'
                              ? 'text-green-400 bg-green-500/10 border-green-500/20'
                              : 'text-blue-400 bg-blue-500/10 border-blue-500/20'
                          }`}>
                            {msg.channel}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-blue-200/70 max-w-xs truncate">{msg.content}</td>
                        <td className="px-6 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs border ${statusColor(msg.status)}`}>
                            {msg.status}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-blue-300/40 text-xs">{formatDate(msg.createdAt)}</td>
                      </tr>
                    ))}
                    {(!commData?.messages || commData.messages.length === 0) && (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-blue-400/40">No message records yet</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'deals' && (
          <div className="space-y-6">
            {dealData && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total Deals', value: dealData.stats.total, icon: '🤝' },
                  { label: 'Intros Sent', value: dealData.stats.introsSent, icon: '📨' },
                  { label: 'Open', value: dealData.stats.byStatus?.OPEN || 0, icon: '🔍' },
                  { label: 'Closed Won', value: dealData.stats.byStatus?.CLOSED_WON || 0, icon: '🏆' },
                ].map((stat) => (
                  <div key={stat.label} className="bg-[rgba(10,10,26,0.8)]/60 backdrop-blur-sm rounded-xl border border-blue-500/10 p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{stat.icon}</span>
                      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{stat.label}</p>
                    </div>
                    <p className="text-2xl font-bold text-white">{stat.value}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-[rgba(10,10,26,0.8)]/60 backdrop-blur-sm rounded-xl border border-blue-500/10 overflow-hidden">
              <div className="px-6 py-4 border-b border-blue-500/10">
                <h2 className="text-sm font-semibold text-white">Deal Pipeline ({dealData?.deals?.length || 0})</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-blue-900/10">
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase">Deal Partner</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase">Founder</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase">Industry</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase">Stage</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase">Status</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase">Deal Value</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase">Carry %</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase">Intro</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-500/5">
                    {(dealData?.deals || []).map((deal: any) => (
                      <tr key={deal.id} className="hover:bg-blue-900/10 transition">
                        <td className="px-6 py-3 text-white">{deal.dealPartner?.email || '-'}</td>
                        <td className="px-6 py-3">
                          <div>
                            <div className="text-white">{deal.founder?.email || '-'}</div>
                            <div className="text-xs text-blue-300/50">{deal.founder?.profile?.companyName || ''}</div>
                          </div>
                        </td>
                        <td className="px-6 py-3 text-blue-200/70">{deal.industry || '-'}</td>
                        <td className="px-6 py-3 text-blue-200/70">{deal.stage?.replace(/_/g, ' ') || '-'}</td>
                        <td className="px-6 py-3">
                          <select
                            value={deal.status}
                            onChange={async (e) => {
                              try {
                                await api.updateDeal(deal.id, { status: e.target.value });
                                loadDeals();
                              } catch (err) { console.error(err); }
                            }}
                            className="bg-[#050510] border border-blue-500/20 rounded px-2 py-1 text-xs text-blue-200"
                          >
                            <option value="OPEN">Open</option>
                            <option value="INTRO_MADE">Intro Made</option>
                            <option value="CLOSED_WON">Closed Won</option>
                            <option value="CLOSED_LOST">Closed Lost</option>
                          </select>
                        </td>
                        <td className="px-6 py-3 text-blue-200/70">
                          {deal.dealValue ? `$${Number(deal.dealValue).toLocaleString()}` : '-'}
                        </td>
                        <td className="px-6 py-3 text-blue-200/70">
                          {deal.carryPercentage ? `${deal.carryPercentage}%` : '-'}
                        </td>
                        <td className="px-6 py-3">
                          {deal.introSent ? (
                            <div>
                              <span className="text-green-400 text-xs">Sent</span>
                              {deal.introDate && <div className="text-blue-300/40 text-xs">{formatDate(deal.introDate)}</div>}
                            </div>
                          ) : (
                            <span className="text-blue-400/40 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-6 py-3">
                          <button
                            onClick={async () => {
                              const value = prompt('Enter deal value ($):');
                              const carry = prompt('Enter carry percentage (%):');
                              if (value || carry) {
                                try {
                                  await api.updateDeal(deal.id, {
                                    ...(value && { dealValue: value }),
                                    ...(carry && { carryPercentage: carry }),
                                  });
                                  loadDeals();
                                } catch (err) { console.error(err); }
                              }
                            }}
                            className="px-2 py-1 text-xs bg-blue-600/20 text-blue-300 rounded hover:bg-blue-600/40 transition"
                          >
                            Set Value
                          </button>
                        </td>
                      </tr>
                    ))}
                    {(!dealData?.deals || dealData.deals.length === 0) && (
                      <tr>
                        <td colSpan={9} className="px-6 py-8 text-center text-blue-400/40">No deals tracked yet</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'events' && (
          <div className="space-y-6">
            {eventData && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total Events', value: eventData.stats.total, icon: '📅' },
                  { label: 'Upcoming', value: eventData.stats.upcoming, icon: '🔜' },
                  { label: 'Active', value: eventData.stats.active, icon: '🟢' },
                  { label: 'Total Participants', value: eventData.stats.totalParticipants, icon: '👥' },
                ].map((stat) => (
                  <div key={stat.label} className="bg-[rgba(10,10,26,0.8)]/60 backdrop-blur-sm rounded-xl border border-blue-500/10 p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{stat.icon}</span>
                      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{stat.label}</p>
                    </div>
                    <p className="text-2xl font-bold text-white">{stat.value}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-[rgba(10,10,26,0.8)]/60 backdrop-blur-sm rounded-xl border border-blue-500/10 overflow-hidden">
              <div className="px-6 py-4 border-b border-blue-500/10 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Events ({eventData?.events?.length || 0})</h2>
                <button
                  onClick={() => setShowCreateEvent(true)}
                  className="px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition shadow-lg shadow-blue-600/20"
                >
                  + New Event
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-blue-900/10">
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase">Name</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase">Date</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase">Location</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase">Status</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase">Participants</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase">Capacity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-500/5">
                    {(eventData?.events || []).map((event: any) => (
                      <tr key={event.id} className="hover:bg-blue-900/10 transition">
                        <td className="px-6 py-3">
                          <div>
                            <div className="text-white font-medium">{event.name}</div>
                            {event.description && <div className="text-xs text-blue-300/50 mt-0.5 max-w-xs truncate">{event.description}</div>}
                          </div>
                        </td>
                        <td className="px-6 py-3 text-blue-200/70 text-xs">{formatDate(event.date)}</td>
                        <td className="px-6 py-3 text-blue-200/70">
                          {event.isVirtual ? (
                            <span className="text-blue-400 text-xs">Virtual</span>
                          ) : (
                            <span className="text-xs">{event.location || '-'}</span>
                          )}
                        </td>
                        <td className="px-6 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs border ${
                            event.status === 'UPCOMING' ? 'text-blue-400 bg-blue-500/10 border-blue-500/20' :
                            event.status === 'ACTIVE' ? 'text-green-400 bg-green-500/10 border-green-500/20' :
                            event.status === 'COMPLETED' ? 'text-blue-300 bg-blue-500/10 border-blue-500/20' :
                            'text-red-400 bg-red-500/10 border-red-500/20'
                          }`}>
                            {event.status}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-white">{event._count?.participants || event.participants?.length || 0}</td>
                        <td className="px-6 py-3 text-blue-200/70">{event.maxCapacity || 'Unlimited'}</td>
                      </tr>
                    ))}
                    {(!eventData?.events || eventData.events.length === 0) && (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-blue-400/40">No events yet</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {showCreateEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[rgba(10,10,26,0.8)] border border-blue-500/20 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-white font-semibold mb-4">Create Event</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 uppercase mb-1.5">Name</label>
                <input
                  value={newEvent.name}
                  onChange={(e) => setNewEvent({ ...newEvent, name: e.target.value })}
                  placeholder="Event name"
                  className="w-full px-3 py-2.5 rounded-xl border border-blue-500/20 bg-blue-900/20 text-white placeholder-slate-400/30 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 uppercase mb-1.5">Description</label>
                <textarea
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  placeholder="Event description"
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-xl border border-blue-500/20 bg-blue-900/20 text-white placeholder-slate-400/30 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 uppercase mb-1.5">Date & Time</label>
                <input
                  type="datetime-local"
                  value={newEvent.date}
                  onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-blue-500/20 bg-blue-900/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 uppercase mb-1.5">Location</label>
                <input
                  value={newEvent.location}
                  onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                  placeholder="Event location"
                  className="w-full px-3 py-2.5 rounded-xl border border-blue-500/20 bg-blue-900/20 text-white placeholder-slate-400/30 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newEvent.isVirtual}
                    onChange={(e) => setNewEvent({ ...newEvent, isVirtual: e.target.checked })}
                    className="rounded border-blue-500/20 bg-blue-900/20 text-blue-600"
                  />
                  <span className="text-sm text-blue-300">Virtual event</span>
                </label>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 uppercase mb-1.5">Max Capacity (optional)</label>
                <input
                  type="number"
                  value={newEvent.maxCapacity}
                  onChange={(e) => setNewEvent({ ...newEvent, maxCapacity: e.target.value })}
                  placeholder="No limit"
                  className="w-full px-3 py-2.5 rounded-xl border border-blue-500/20 bg-blue-900/20 text-white placeholder-slate-400/30 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreateEvent(false)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-blue-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateEvent}
                disabled={!newEvent.name || !newEvent.date}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20"
              >
                Create Event
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {!analyticsData ? (
            <div className="text-center py-12 text-blue-300/40">Loading analytics...</div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-white text-lg font-semibold">Platform Analytics</h2>
                <button onClick={handleSendDigest} disabled={digestLoading}
                  className="px-4 py-2 rounded-xl text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 transition disabled:opacity-40">
                  {digestLoading ? 'Sending...' : '📧 Send Weekly Digest'}
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total Users', value: analyticsData.totalUsers, icon: '👥', color: '#93C5FD' },
                  { label: 'Complete Profiles', value: analyticsData.completedProfiles, icon: '✅', color: '#6ee7b7' },
                  { label: 'Onboarding Rate', value: `${analyticsData.onboardingRate}%`, icon: '📈', color: '#fbbf24' },
                  { label: 'Signups (7d)', value: analyticsData.recentSignups, icon: '🆕', color: '#60a5fa' },
                  { label: 'Total Matches', value: analyticsData.totalMatches, icon: '🎯', color: '#93C5FD' },
                  { label: 'Accepted', value: analyticsData.acceptedMatches, icon: '✅', color: '#6ee7b7' },
                  { label: 'Accept Rate', value: `${analyticsData.matchAcceptRate}%`, icon: '📊', color: '#fbbf24' },
                  { label: 'Avg Score', value: `${analyticsData.avgMatchScore}%`, icon: '⭐', color: '#f472b6' },
                ].map((s, i) => (
                  <div key={i} className="rounded-xl border border-blue-500/10 p-4" style={{ background: 'rgba(10,10,26,0.8)' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{s.icon}</span>
                      <span className="text-xs text-blue-300/40 uppercase font-medium">{s.label}</span>
                    </div>
                    <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="rounded-xl border border-blue-500/10 p-5" style={{ background: 'rgba(10,10,26,0.8)' }}>
                  <h3 className="text-white text-sm font-semibold mb-4">📊 Daily Signups (7 days)</h3>
                  <div className="flex items-end gap-2 h-32">
                    {analyticsData.dailySignups?.map((d: any, i: number) => {
                      const max = Math.max(...analyticsData.dailySignups.map((x: any) => x.count), 1);
                      const height = (d.count / max) * 100;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-xs text-blue-300/40">{d.count}</span>
                          <div className="w-full rounded-t-md" style={{
                            height: `${Math.max(height, 4)}%`,
                            background: 'linear-gradient(180deg, #3B82F6, #8B5CF6)',
                            minHeight: '4px',
                          }} />
                          <span className="text-[10px] text-blue-300/30">{d.date.slice(5)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-xl border border-blue-500/10 p-5" style={{ background: 'rgba(10,10,26,0.8)' }}>
                  <h3 className="text-white text-sm font-semibold mb-4">🎭 Personas</h3>
                  <div className="space-y-2">
                    {analyticsData.personaBreakdown?.map((p: any, i: number) => {
                      const total = analyticsData.personaBreakdown.reduce((s: number, x: any) => s + x.count, 0);
                      const pct = total > 0 ? Math.round((p.count / total) * 100) : 0;
                      return (
                        <div key={i}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-blue-200/60">{p.persona}</span>
                            <span className="text-blue-300/40">{p.count} ({pct}%)</span>
                          </div>
                          <div className="h-2 rounded-full bg-blue-900/30">
                            <div className="h-full rounded-full" style={{
                              width: `${pct}%`,
                              background: 'linear-gradient(90deg, #3B82F6, #93C5FD)',
                            }} />
                          </div>
                        </div>
                      );
                    })}
                    {(!analyticsData.personaBreakdown || analyticsData.personaBreakdown.length === 0) && (
                      <p className="text-blue-300/30 text-xs">No persona data yet</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-blue-500/10 p-5" style={{ background: 'rgba(10,10,26,0.8)' }}>
                <h3 className="text-white text-sm font-semibold mb-4">📣 Channel Attribution</h3>
                <div className="space-y-2">
                  {analyticsData.attributionBreakdown?.map((a: any, i: number) => {
                    const total = analyticsData.attributionBreakdown.reduce((s: number, x: any) => s + x.count, 0);
                    const pct = total > 0 ? Math.round((a.count / total) * 100) : 0;
                    const sourceLabels: Record<string, string> = {
                      linkedin: 'LinkedIn', twitter: 'Twitter / X', whatsapp_group: 'WhatsApp Group',
                      friend_referral: 'Friend Referral', event_the_pitch: 'Event (The Pitch)',
                      angel_network: 'Angel Network', vc_newsletter: 'VC Newsletter',
                      google_search: 'Google Search', referral: 'Referral', email: 'Email',
                      event: 'Event', other: 'Other',
                    };
                    return (
                      <div key={i}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-blue-200/60">{sourceLabels[a.source] || a.source}</span>
                          <span className="text-blue-300/40">{a.count} ({pct}%)</span>
                        </div>
                        <div className="h-2 rounded-full bg-blue-900/30">
                          <div className="h-full rounded-full" style={{
                            width: `${pct}%`,
                            background: 'linear-gradient(90deg, #14B8A6, #93C5FD)',
                          }} />
                        </div>
                      </div>
                    );
                  })}
                  {(!analyticsData.attributionBreakdown || analyticsData.attributionBreakdown.length === 0) && (
                    <p className="text-blue-300/30 text-xs">No attribution data yet</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="rounded-xl border border-blue-500/10 p-5" style={{ background: 'rgba(10,10,26,0.8)' }}>
                  <h3 className="text-white text-sm font-semibold mb-4">⭐ Feedback</h3>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-yellow-400">{analyticsData.feedbackStats?.avgRating || 0}</p>
                      <p className="text-xs text-blue-300/40">Avg Rating</p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-blue-400">{analyticsData.feedbackStats?.total || 0}</p>
                      <p className="text-xs text-blue-300/40">Total Reviews</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {[5, 4, 3, 2, 1].map(r => {
                      const count = analyticsData.feedbackStats?.distribution?.find((d: any) => d.rating === r)?.count || 0;
                      const total = analyticsData.feedbackStats?.total || 1;
                      return (
                        <div key={r} className="flex items-center gap-2">
                          <span className="text-xs text-yellow-400 w-6">{r}★</span>
                          <div className="flex-1 h-2 rounded-full bg-blue-900/30">
                            <div className="h-full rounded-full bg-yellow-400/60" style={{ width: `${(count / total) * 100}%` }} />
                          </div>
                          <span className="text-xs text-blue-300/40 w-6 text-right">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-xl border border-blue-500/10 p-5" style={{ background: 'rgba(10,10,26,0.8)' }}>
                  <h3 className="text-white text-sm font-semibold mb-4">📞 Communications</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-blue-500/10 p-3 text-center" style={{ background: 'rgba(59,130,246,0.05)' }}>
                      <p className="text-xl font-bold text-blue-400">{analyticsData.totalCalls}</p>
                      <p className="text-xs text-blue-300/40">Calls</p>
                    </div>
                    <div className="rounded-lg border border-blue-500/10 p-3 text-center" style={{ background: 'rgba(59,130,246,0.05)' }}>
                      <p className="text-xl font-bold text-blue-400">{analyticsData.totalMessages}</p>
                      <p className="text-xs text-blue-300/40">Messages</p>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1.5">
                    {analyticsData.channelBreakdown?.map((c: any, i: number) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="text-blue-200/60">{c.channel}</span>
                        <span className="text-blue-300/40">{c.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-blue-500/10 p-5" style={{ background: 'rgba(10,10,26,0.8)' }}>
                <h3 className="text-white text-sm font-semibold mb-4">🔔 Recent Activity</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {analyticsData.recentActivity?.map((a: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: 'rgba(59,130,246,0.03)' }}>
                      <span className="text-sm">
                        {a.type === 'MATCH_FOUND' ? '🎯' : a.type === 'INTRO_ACCEPTED' ? '✅' : a.type === 'INTRO_REQUEST' ? '🤝' : '🔔'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs text-white/70 truncate block">{a.title}</span>
                        {a.email && <span className="text-[10px] text-blue-300/30">{a.email}</span>}
                      </div>
                      <span className="text-[10px] text-blue-300/20 flex-shrink-0">
                        {new Date(a.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                  {(!analyticsData.recentActivity || analyticsData.recentActivity.length === 0) && (
                    <p className="text-blue-300/30 text-xs text-center py-4">No recent activity</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {triggerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[rgba(10,10,26,0.8)] border border-blue-500/20 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-white font-semibold mb-4">
              {triggerModal.type === 'call' ? 'Trigger Call' : 'Send Message'} — {triggerModal.user.email}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 uppercase mb-1.5">Phone Number</label>
                <PhoneInput
                  value={triggerPhone}
                  onChange={setTriggerPhone}
                  placeholder="98765 43210"
                />
              </div>

              {triggerModal.type === 'message' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 uppercase mb-1.5">Channel</label>
                    <div className="flex gap-2">
                      {(['WHATSAPP', 'SMS'] as const).map((ch) => (
                        <button
                          key={ch}
                          onClick={() => setTriggerChannel(ch)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
                            triggerChannel === ch
                              ? 'bg-blue-600 text-white border-blue-500'
                              : 'border-blue-500/20 text-slate-400 hover:text-blue-200'
                          }`}
                        >
                          {ch === 'WHATSAPP' ? '📱 WhatsApp' : '💬 SMS'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 uppercase mb-1.5">Message</label>
                    <textarea
                      value={triggerMessage}
                      onChange={(e) => setTriggerMessage(e.target.value)}
                      placeholder="Type your message..."
                      rows={3}
                      className="w-full px-3 py-2.5 rounded-xl border border-blue-500/20 bg-blue-900/20 text-white placeholder-slate-400/30 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setTriggerModal(null)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 border border-blue-500/20 hover:text-blue-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleTrigger}
                disabled={triggerLoading || !triggerPhone || (triggerModal.type === 'message' && !triggerMessage)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 transition disabled:opacity-40"
              >
                {triggerLoading ? 'Sending...' : triggerModal.type === 'call' ? 'Call Now' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
