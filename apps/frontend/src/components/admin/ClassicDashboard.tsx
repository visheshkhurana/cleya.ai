'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import PhoneInput from '@/components/PhoneInput';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid } from 'recharts';
import { AgentsManagement } from '@/components/admin/AgentsManagement';
import { AgentArchitecture } from '@/components/admin/AgentArchitecture';

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

type Tab = 'overview' | 'communications' | 'deals' | 'events' | 'analytics' | 'agents' | 'architecture' | 'whatsapp';

interface AgentInfo {
  id: string;
  name: string;
  emoji: string;
  role: string;
  description: string;
  color: string;
}

interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function ClassicDashboard() {
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
  const [analyticsHealth, setAnalyticsHealth] = useState<any>(null);
  const [digestLoading, setDigestLoading] = useState(false);
  const [analyticsRange, setAnalyticsRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [ga4Data, setGa4Data] = useState<any>(null);
  const [instagramData, setInstagramData] = useState<any>(null);
  const [posthogData, setPosthogData] = useState<any>(null);
  const [sentryData, setSentryData] = useState<any>(null);
  const [ga4Loading, setGa4Loading] = useState(false);
  const [instagramLoading, setInstagramLoading] = useState(false);
  const [posthogLoading, setPosthogLoading] = useState(false);
  const [sentryLoading, setSentryLoading] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [funnelData, setFunnelData] = useState<{ stage: string; count: number }[] | null>(null);
  const [whatsappData, setWhatsappData] = useState<any>(null);
  const [whatsappUsers, setWhatsappUsers] = useState<any[] | null>(null);
  const [waSubTab, setWaSubTab] = useState<'activity' | 'users'>('activity');
  const [agentList, setAgentList] = useState<AgentInfo[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [agentMessages, setAgentMessages] = useState<Record<string, AgentMessage[]>>({});
  const [agentInput, setAgentInput] = useState('');
  const [agentLoading, setAgentLoading] = useState(false);

  useEffect(() => {
    loadDashboard();
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

  const loadAnalytics = async (range?: '7d' | '30d' | '90d') => {
    const r = range || analyticsRange;
    try {
      const [data, health] = await Promise.all([
        api.getAdminAnalytics(r),
        api.getAnalyticsHealth(),
      ]);
      setAnalyticsData(data);
      setAnalyticsHealth(health);
    } catch (err: unknown) {
      console.error('Failed to load analytics:', err);
    }
    loadGA4(r);
    loadInstagram(r);
    loadPostHog(r);
    loadSentry(r);
    loadFunnel();
  };

  const loadFunnel = async () => {
    try {
      const data = await api.getAdminFunnel();
      if (data?.funnel) setFunnelData(data.funnel);
    } catch {
    }
  };

  const loadGA4 = async (range: string = analyticsRange) => {
    setGa4Loading(true);
    try {
      const data = await api.getAdminAnalyticsGA4(range);
      setGa4Data(data);
    } catch (err: any) {
      setGa4Data({ configured: true, data: null, error: err?.message || 'Failed to load' });
    }
    setGa4Loading(false);
  };

  const loadInstagram = async (range: string = analyticsRange) => {
    setInstagramLoading(true);
    try {
      const data = await api.getAdminAnalyticsInstagram(range);
      setInstagramData(data);
    } catch (err: any) {
      setInstagramData({ configured: true, data: null, error: err?.message || 'Failed to load' });
    }
    setInstagramLoading(false);
  };

  const loadPostHog = async (range: string = analyticsRange) => {
    setPosthogLoading(true);
    try {
      const data = await api.getAdminAnalyticsPostHog(range);
      setPosthogData(data);
    } catch (err: any) {
      setPosthogData({ configured: true, data: null, error: err?.message || 'Failed to load' });
    }
    setPosthogLoading(false);
  };

  const loadSentry = async (range: string = analyticsRange) => {
    setSentryLoading(true);
    try {
      const data = await api.getAdminAnalyticsSentry(range);
      setSentryData(data);
    } catch (err: any) {
      setSentryData({ configured: true, data: null, error: err?.message || 'Failed to load' });
    }
    setSentryLoading(false);
  };

  const toggleSection = (key: string) => {
    setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleRangeChange = (range: '7d' | '30d' | '90d') => {
    setAnalyticsRange(range);
    loadAnalytics(range);
  };

  const loadWhatsApp = async () => {
    try {
      const [actRes, usersRes] = await Promise.all([
        fetch('/api/admin/whatsapp/activity', { credentials: 'include' }),
        fetch('/api/admin/whatsapp/users', { credentials: 'include' }),
      ]);
      const actJson = await actRes.json();
      const usersJson = await usersRes.json();
      if (actJson.success) setWhatsappData(actJson.data);
      if (usersJson.success) setWhatsappUsers(usersJson.data);
    } catch (err: any) {
      console.error('Failed to load WhatsApp data:', err);
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

  const sendAgentMsg = async () => {
    if (!selectedAgent || !agentInput.trim() || agentLoading) return;
    const msg = agentInput.trim();
    setAgentInput('');
    const history = agentMessages[selectedAgent] || [];
    setAgentMessages((prev) => ({ ...prev, [selectedAgent]: [...(prev[selectedAgent] || []), { role: 'user', content: msg }] }));
    setAgentLoading(true);
    try {
      const result = await api.sendAgentMessage(selectedAgent, msg, history);
      setAgentMessages((prev) => ({
        ...prev,
        [selectedAgent]: [...(prev[selectedAgent] || []), { role: 'assistant', content: result.content }],
      }));
    } catch (err: any) {
      setAgentMessages((prev) => ({
        ...prev,
        [selectedAgent]: [...(prev[selectedAgent] || []), { role: 'assistant', content: `Error: ${err.message}` }],
      }));
    }
    setAgentLoading(false);
  };

  const loadAgents = async () => {
    try {
      const data = await api.getAgentStatuses();
      if (Array.isArray(data)) {
        setAgentList(data.map((a: any) => ({
          id: a.agentId,
          name: a.name,
          emoji: a.emoji || '🤖',
          role: a.codename,
          description: `${a.codename} agent`,
          color: a.color || 'slate',
        })));
      }
    } catch (err) {
      console.error('Failed to load agents:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'communications' && !commData) loadComms();
    if (activeTab === 'deals' && !dealData) loadDeals();
    if (activeTab === 'events' && !eventData) loadEvents();
    if (activeTab === 'analytics' && !analyticsData) loadAnalytics();
    if (activeTab === 'whatsapp' && !whatsappData) loadWhatsApp();
    if (activeTab === 'agents' && agentList.length === 0) loadAgents();
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
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-brand-violet border-t-transparent rounded-full animate-spin" />
          <p className="text-brand-violet-hover">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-red-400">{error}</p>
          <button
            onClick={() => { setError(null); setLoading(true); loadDashboard(); }}
            className="px-4 py-2 bg-brand-violet text-white rounded-lg hover:bg-brand-violet transition"
          >
            Retry
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
      SCHEDULED: 'text-brand-violet bg-brand-violet/10 border-brand-violet/20',
      FAILED: 'text-red-400 bg-red-500/10 border-red-500/20',
      NO_ANSWER: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    };
    return map[status] || 'text-brand-violet-hover bg-brand-violet/10 border-brand-violet/20';
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-4 sm:py-6">
        <div className="flex gap-1 mb-6 p-1 rounded-xl bg-brand-violet-pressed/20 border border-brand-violet/10 overflow-x-auto">
          {[
            { id: 'overview' as Tab, label: 'Overview', icon: '📊' },
            { id: 'communications' as Tab, label: 'Comms', icon: '📞' },
            { id: 'deals' as Tab, label: 'Deals', icon: '🤝' },
            { id: 'events' as Tab, label: 'Events', icon: '📅' },
            { id: 'analytics' as Tab, label: 'Analytics', icon: '📈' },
            { id: 'whatsapp' as Tab, label: 'WhatsApp', icon: '💬' },
            { id: 'agents' as Tab, label: 'Agents', icon: '🤖' },
            { id: 'architecture' as Tab, label: 'Architecture', icon: '🏗️' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-brand-violet text-white shadow-lg shadow-brand-violet/20'
                  : 'text-slate-400 hover:text-white/60'
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
                    className="bg-[rgba(8,13,26,0.8)]/60 backdrop-blur-sm rounded-xl border border-brand-violet/10 p-5 hover:border-brand-violet/20 transition"
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

            <div className="bg-[rgba(8,13,26,0.8)]/60 backdrop-blur-sm rounded-xl border border-brand-violet/10 p-6">
              <h2 className="text-sm font-semibold text-white mb-6">Conversion Funnel</h2>
              <div className="space-y-3">
                {funnel.map((step, i) => (
                  <div key={step.stage} className="flex items-center gap-4">
                    <div className="w-44 text-xs font-medium text-brand-violet-hover/70 text-right">{step.stage}</div>
                    <div className="flex-1 bg-brand-violet-pressed/20 rounded-full h-8 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-brand-violet to-brand-violet rounded-full flex items-center justify-end pr-3 transition-all duration-700"
                        style={{ width: `${Math.max((step.count / maxFunnel) * 100, 8)}%` }}
                      >
                        <span className="text-xs font-bold text-white">{step.count}</span>
                      </div>
                    </div>
                    {i > 0 && funnel[i - 1].count > 0 && (
                      <div className="w-16 text-xs text-brand-violet/50">
                        {Math.round((step.count / funnel[i - 1].count) * 100)}%
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[rgba(8,13,26,0.8)]/60 backdrop-blur-sm rounded-xl border border-brand-violet/10 overflow-hidden">
              <div className="px-6 py-4 border-b border-brand-violet/10 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Users ({users.length})</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-brand-violet-pressed/10">
                      <th className="text-left px-3 sm:px-6 py-3 text-xs font-medium text-slate-400 uppercase">Email</th>
                      <th className="text-left px-3 sm:px-6 py-3 text-xs font-medium text-slate-400 uppercase">Persona</th>
                      <th className="text-left px-3 sm:px-6 py-3 text-xs font-medium text-slate-400 uppercase">Company</th>
                      <th className="text-left px-3 sm:px-6 py-3 text-xs font-medium text-slate-400 uppercase">Completeness</th>
                      <th className="text-left px-3 sm:px-6 py-3 text-xs font-medium text-slate-400 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-violet/5">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-brand-violet-pressed/10 transition">
                        <td className="px-6 py-3 font-medium text-white">{user.email}</td>
                        <td className="px-6 py-3">
                          {user.profile?.persona ? (
                            <span className="px-2.5 py-1 rounded-full text-xs bg-brand-violet/15 text-brand-violet-hover border border-brand-violet/20">
                              {user.profile.persona}
                            </span>
                          ) : (
                            <span className="text-brand-violet/30">-</span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-white/50">{user.profile?.companyName || '-'}</td>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-brand-violet-pressed/20 rounded-full h-1.5">
                              <div
                                className="bg-gradient-to-r from-brand-violet to-brand-violet rounded-full h-1.5 transition-all"
                                style={{ width: `${(user.profile?.completenessScore || 0) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs text-brand-violet-hover/50">
                              {Math.round((user.profile?.completenessScore || 0) * 100)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => { setTriggerModal({ type: 'call', user }); setTriggerPhone(user.phone || ''); }}
                              className="px-2 py-1 text-xs rounded-md bg-brand-violet/20 text-brand-violet-hover hover:bg-brand-violet/40 transition border border-brand-violet/20"
                            >
                              Call
                            </button>
                            <button
                              onClick={() => { setTriggerModal({ type: 'message', user }); setTriggerPhone(user.phone || ''); setTriggerMessage(''); }}
                              className="px-2 py-1 text-xs rounded-md bg-brand-violet/20 text-brand-violet-hover hover:bg-brand-violet/40 transition border border-brand-violet/20"
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
                    className="bg-[rgba(8,13,26,0.8)]/60 backdrop-blur-sm rounded-xl border border-brand-violet/10 p-5"
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

            <div className="bg-[rgba(8,13,26,0.8)]/60 backdrop-blur-sm rounded-xl border border-brand-violet/10 overflow-hidden">
              <div className="px-6 py-4 border-b border-brand-violet/10">
                <h2 className="text-sm font-semibold text-white">Recent Calls</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-brand-violet-pressed/10">
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase">User</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase">Phone</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase">Direction</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase">Status</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase">Duration</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-violet/5">
                    {(commData?.calls || []).map((call: any) => (
                      <tr key={call.id} className="hover:bg-brand-violet-pressed/10 transition">
                        <td className="px-6 py-3 text-white">{call.user?.email || '-'}</td>
                        <td className="px-6 py-3 text-white/50">{call.phoneNumber}</td>
                        <td className="px-6 py-3">
                          <span className={`text-xs ${call.direction === 'INBOUND' ? 'text-brand-violet' : 'text-brand-violet-hover'}`}>
                            {call.direction === 'INBOUND' ? '← In' : '→ Out'}
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs border ${statusColor(call.status)}`}>
                            {call.status}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-white/50">
                          {call.duration ? `${Math.floor(call.duration / 60)}m ${call.duration % 60}s` : '-'}
                        </td>
                        <td className="px-6 py-3 text-brand-violet-hover/40 text-xs">{formatDate(call.createdAt)}</td>
                      </tr>
                    ))}
                    {(!commData?.calls || commData.calls.length === 0) && (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-brand-violet/40">No call records yet</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-[rgba(8,13,26,0.8)]/60 backdrop-blur-sm rounded-xl border border-brand-violet/10 overflow-hidden">
              <div className="px-6 py-4 border-b border-brand-violet/10">
                <h2 className="text-sm font-semibold text-white">Recent Messages (WhatsApp + SMS)</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-brand-violet-pressed/10">
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase">User</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase">Phone</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase">Channel</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase">Content</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase">Status</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-violet/5">
                    {(commData?.messages || []).map((msg: any) => (
                      <tr key={msg.id} className="hover:bg-brand-violet-pressed/10 transition">
                        <td className="px-6 py-3 text-white">{msg.user?.email || '-'}</td>
                        <td className="px-6 py-3 text-white/50">{msg.recipientPhone}</td>
                        <td className="px-6 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs border ${
                            msg.channel === 'WHATSAPP'
                              ? 'text-green-400 bg-green-500/10 border-green-500/20'
                              : 'text-brand-violet bg-brand-violet/10 border-brand-violet/20'
                          }`}>
                            {msg.channel}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-white/50 max-w-xs truncate">{msg.content}</td>
                        <td className="px-6 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs border ${statusColor(msg.status)}`}>
                            {msg.status}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-brand-violet-hover/40 text-xs">{formatDate(msg.createdAt)}</td>
                      </tr>
                    ))}
                    {(!commData?.messages || commData.messages.length === 0) && (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-brand-violet/40">No message records yet</td>
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
                  <div key={stat.label} className="bg-[rgba(8,13,26,0.8)]/60 backdrop-blur-sm rounded-xl border border-brand-violet/10 p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{stat.icon}</span>
                      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{stat.label}</p>
                    </div>
                    <p className="text-2xl font-bold text-white">{stat.value}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-[rgba(8,13,26,0.8)]/60 backdrop-blur-sm rounded-xl border border-brand-violet/10 overflow-hidden">
              <div className="px-6 py-4 border-b border-brand-violet/10">
                <h2 className="text-sm font-semibold text-white">Deal Pipeline ({dealData?.deals?.length || 0})</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-brand-violet-pressed/10">
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
                  <tbody className="divide-y divide-brand-violet/5">
                    {(dealData?.deals || []).map((deal: any) => (
                      <tr key={deal.id} className="hover:bg-brand-violet-pressed/10 transition">
                        <td className="px-6 py-3 text-white">{deal.dealPartner?.email || '-'}</td>
                        <td className="px-6 py-3">
                          <div>
                            <div className="text-white">{deal.founder?.email || '-'}</div>
                            <div className="text-xs text-brand-violet-hover/50">{deal.founder?.profile?.companyName || ''}</div>
                          </div>
                        </td>
                        <td className="px-6 py-3 text-white/50">{deal.industry || '-'}</td>
                        <td className="px-6 py-3 text-white/50">{deal.stage?.replace(/_/g, ' ') || '-'}</td>
                        <td className="px-6 py-3">
                          <select
                            value={deal.status}
                            onChange={async (e) => {
                              try {
                                await api.updateDeal(deal.id, { status: e.target.value });
                                loadDeals();
                              } catch (err) { console.error(err); }
                            }}
                            className="bg-[#080D1A] border border-brand-violet/20 rounded px-2 py-1 text-xs text-white/60"
                          >
                            <option value="OPEN">Open</option>
                            <option value="INTRO_MADE">Intro Made</option>
                            <option value="CLOSED_WON">Closed Won</option>
                            <option value="CLOSED_LOST">Closed Lost</option>
                          </select>
                        </td>
                        <td className="px-6 py-3 text-white/50">
                          {deal.dealValue ? `$${Number(deal.dealValue).toLocaleString()}` : '-'}
                        </td>
                        <td className="px-6 py-3 text-white/50">
                          {deal.carryPercentage ? `${deal.carryPercentage}%` : '-'}
                        </td>
                        <td className="px-6 py-3">
                          {deal.introSent ? (
                            <div>
                              <span className="text-green-400 text-xs">Sent</span>
                              {deal.introDate && <div className="text-brand-violet-hover/40 text-xs">{formatDate(deal.introDate)}</div>}
                            </div>
                          ) : (
                            <span className="text-brand-violet/40 text-xs">-</span>
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
                            className="px-2 py-1 text-xs bg-brand-violet/20 text-brand-violet-hover rounded hover:bg-brand-violet/40 transition"
                          >
                            Set Value
                          </button>
                        </td>
                      </tr>
                    ))}
                    {(!dealData?.deals || dealData.deals.length === 0) && (
                      <tr>
                        <td colSpan={9} className="px-6 py-8 text-center text-brand-violet/40">No deals tracked yet</td>
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
                  <div key={stat.label} className="bg-[rgba(8,13,26,0.8)]/60 backdrop-blur-sm rounded-xl border border-brand-violet/10 p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{stat.icon}</span>
                      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{stat.label}</p>
                    </div>
                    <p className="text-2xl font-bold text-white">{stat.value}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-[rgba(8,13,26,0.8)]/60 backdrop-blur-sm rounded-xl border border-brand-violet/10 overflow-hidden">
              <div className="px-6 py-4 border-b border-brand-violet/10 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Events ({eventData?.events?.length || 0})</h2>
                <button
                  onClick={() => setShowCreateEvent(true)}
                  className="px-3 py-1.5 text-xs rounded-lg bg-brand-violet text-white hover:bg-brand-violet transition shadow-lg shadow-brand-violet/20"
                >
                  + New Event
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-brand-violet-pressed/10">
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase">Name</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase">Date</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase">Location</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase">Status</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase">Participants</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase">Capacity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-violet/5">
                    {(eventData?.events || []).map((event: any) => (
                      <tr key={event.id} className="hover:bg-brand-violet-pressed/10 transition">
                        <td className="px-6 py-3">
                          <div>
                            <div className="text-white font-medium">{event.name}</div>
                            {event.description && <div className="text-xs text-brand-violet-hover/50 mt-0.5 max-w-xs truncate">{event.description}</div>}
                          </div>
                        </td>
                        <td className="px-6 py-3 text-white/50 text-xs">{formatDate(event.date)}</td>
                        <td className="px-6 py-3 text-white/50">
                          {event.isVirtual ? (
                            <span className="text-brand-violet text-xs">Virtual</span>
                          ) : (
                            <span className="text-xs">{event.location || '-'}</span>
                          )}
                        </td>
                        <td className="px-6 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs border ${
                            event.status === 'UPCOMING' ? 'text-brand-violet bg-brand-violet/10 border-brand-violet/20' :
                            event.status === 'ACTIVE' ? 'text-green-400 bg-green-500/10 border-green-500/20' :
                            event.status === 'COMPLETED' ? 'text-brand-violet-hover bg-brand-violet/10 border-brand-violet/20' :
                            'text-red-400 bg-red-500/10 border-red-500/20'
                          }`}>
                            {event.status}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-white">{event._count?.participants || event.participants?.length || 0}</td>
                        <td className="px-6 py-3 text-white/50">{event.maxCapacity || 'Unlimited'}</td>
                      </tr>
                    ))}
                    {(!eventData?.events || eventData.events.length === 0) && (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-brand-violet/40">No events yet</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-white text-lg font-semibold">Analytics Dashboard</h2>
              <div className="flex items-center gap-3">
                <div className="flex rounded-lg border border-brand-violet/20 overflow-hidden">
                  {(['7d', '30d', '90d'] as const).map(r => (
                    <button key={r} onClick={() => handleRangeChange(r)}
                      className={`px-3 py-1.5 text-xs font-medium transition ${analyticsRange === r ? 'bg-brand-violet text-white' : 'text-brand-violet-hover/50 hover:text-white/60'}`}>
                      {r === '7d' ? '7 Days' : r === '30d' ? '30 Days' : '90 Days'}
                    </button>
                  ))}
                </div>
                <button onClick={handleSendDigest} disabled={digestLoading}
                  className="px-4 py-1.5 rounded-lg text-xs font-medium bg-brand-violet text-white hover:bg-brand-violet transition disabled:opacity-40">
                  {digestLoading ? 'Sending...' : 'Send Digest'}
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-brand-violet/10 overflow-hidden" style={{ background: 'rgba(8,13,26,0.8)' }}>
              <button onClick={() => toggleSection('ga4')} className="w-full flex items-center justify-between p-5 hover:bg-brand-violet/5 transition">
                <div className="flex items-center gap-3">
                  <span className="text-lg">🌐</span>
                  <h3 className="text-white text-sm font-semibold">Website Traffic</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-violet/10 text-brand-violet-hover/50">GA4</span>
                </div>
                <span className="text-brand-violet-hover/30 text-sm">{collapsedSections['ga4'] ? '▶' : '▼'}</span>
              </button>
              {!collapsedSections['ga4'] && (
                <div className="px-5 pb-5 space-y-4">
                  {ga4Loading ? (
                    <div className="text-center py-8 text-brand-violet-hover/40 text-sm">Loading GA4 data...</div>
                  ) : !ga4Data?.configured ? (
                    <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4">
                      <p className="text-yellow-300/80 text-sm font-medium mb-1">Not Configured</p>
                      <p className="text-yellow-300/50 text-xs">
                        {analyticsHealth?.ga4?.requiredVars
                          ? <>Set {analyticsHealth.ga4.requiredVars.map((v: string, i: number) => <><code key={v} className="bg-yellow-500/10 px-1 rounded">{v}</code>{i < analyticsHealth.ga4.requiredVars.length - 1 ? ' and ' : ''}</>)} environment variables to enable Google Analytics data.</>
                          : <>Set <code className="bg-yellow-500/10 px-1 rounded">GA4_PROPERTY_ID</code> and <code className="bg-yellow-500/10 px-1 rounded">GA4_SERVICE_ACCOUNT_KEY</code> environment variables to enable Google Analytics data.</>}
                      </p>
                    </div>
                  ) : ga4Data?.data ? (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { label: 'Pageviews', value: ga4Data.data.pageviews?.toLocaleString(), color: '#93C5FD' },
                          { label: 'Sessions', value: ga4Data.data.sessions?.toLocaleString(), color: '#6ee7b7' },
                          { label: 'Active Users', value: ga4Data.data.activeUsers?.toLocaleString(), color: '#fbbf24' },
                          { label: 'Bounce Rate', value: `${ga4Data.data.bounceRate}%`, color: '#f472b6' },
                        ].map((s, i) => (
                          <div key={i} className="rounded-lg border border-brand-violet/10 p-3" style={{ background: 'rgba(59,130,246,0.03)' }}>
                            <p className="text-[10px] text-brand-violet-hover/40 uppercase font-medium mb-1">{s.label}</p>
                            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                          </div>
                        ))}
                      </div>
                      {ga4Data.data.dailyTrend?.length > 0 && (
                        <div>
                          <p className="text-xs text-brand-violet-hover/40 mb-2">Daily Pageviews</p>
                          <ResponsiveContainer width="100%" height={120}>
                            <AreaChart data={ga4Data.data.dailyTrend}>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,130,246,0.1)" />
                              <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'rgba(147,197,253,0.3)' }} tickFormatter={(v: string) => v.slice(5)} />
                              <YAxis tick={{ fontSize: 9, fill: 'rgba(147,197,253,0.3)' }} width={30} />
                              <Tooltip contentStyle={{ background: 'rgba(8,13,26,0.95)', border: '1px solid rgba(108,99,255,0.2)', borderRadius: 8, fontSize: 11, color: '#fff' }} />
                              <Area type="monotone" dataKey="pageviews" stroke="#6C63FF" fill="rgba(108,99,255,0.2)" strokeWidth={2} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-brand-violet-hover/40 mb-2">Top Pages</p>
                          <div className="space-y-1.5">
                            {ga4Data.data.topPages?.slice(0, 5).map((p: any, i: number) => (
                              <div key={i} className="flex justify-between text-xs">
                                <span className="text-white/40 truncate mr-2">{p.page}</span>
                                <span className="text-brand-violet-hover/40 flex-shrink-0">{p.views?.toLocaleString()}</span>
                              </div>
                            ))}
                            {(!ga4Data.data.topPages || ga4Data.data.topPages.length === 0) && <p className="text-brand-violet-hover/30 text-xs">No data</p>}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-brand-violet-hover/40 mb-2">Traffic Sources</p>
                          <div className="space-y-1.5">
                            {ga4Data.data.trafficSources?.slice(0, 5).map((s: any, i: number) => (
                              <div key={i} className="flex justify-between text-xs">
                                <span className="text-white/40 truncate mr-2">{s.source}</span>
                                <span className="text-brand-violet-hover/40 flex-shrink-0">{s.sessions?.toLocaleString()}</span>
                              </div>
                            ))}
                            {(!ga4Data.data.trafficSources || ga4Data.data.trafficSources.length === 0) && <p className="text-brand-violet-hover/30 text-xs">No data</p>}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-brand-violet-hover/40 mb-2">Top Countries</p>
                          <div className="space-y-1.5">
                            {ga4Data.data.geoBreakdown?.slice(0, 5).map((g: any, i: number) => (
                              <div key={i} className="flex justify-between text-xs">
                                <span className="text-white/40 truncate mr-2">{g.country}</span>
                                <span className="text-brand-violet-hover/40 flex-shrink-0">{g.users?.toLocaleString()}</span>
                              </div>
                            ))}
                            {(!ga4Data.data.geoBreakdown || ga4Data.data.geoBreakdown.length === 0) && <p className="text-brand-violet-hover/30 text-xs">No data</p>}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-6 text-brand-violet-hover/30 text-xs">{ga4Data?.error || 'Failed to load GA4 data. Check your credentials.'}</div>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-purple-500/10 overflow-hidden" style={{ background: 'rgba(8,13,26,0.8)' }}>
              <button onClick={() => toggleSection('instagram')} className="w-full flex items-center justify-between p-5 hover:bg-purple-500/5 transition">
                <div className="flex items-center gap-3">
                  <span className="text-lg">📸</span>
                  <h3 className="text-white text-sm font-semibold">Instagram</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300/50">Graph API</span>
                </div>
                <span className="text-brand-violet-hover/30 text-sm">{collapsedSections['instagram'] ? '▶' : '▼'}</span>
              </button>
              {!collapsedSections['instagram'] && (
                <div className="px-5 pb-5 space-y-4">
                  {instagramLoading ? (
                    <div className="text-center py-8 text-brand-violet-hover/40 text-sm">Loading Instagram data...</div>
                  ) : !instagramData?.configured ? (
                    <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4">
                      <p className="text-yellow-300/80 text-sm font-medium mb-1">Not Configured</p>
                      <p className="text-yellow-300/50 text-xs">
                        {analyticsHealth?.instagram?.requiredVars
                          ? <>Set {analyticsHealth.instagram.requiredVars.map((v: string, i: number) => <><code key={v} className="bg-yellow-500/10 px-1 rounded">{v}</code>{i < analyticsHealth.instagram.requiredVars.length - 1 ? ' and ' : ''}</>)} environment variables.</>
                          : <>Set <code className="bg-yellow-500/10 px-1 rounded">INSTAGRAM_ACCESS_TOKEN</code> and <code className="bg-yellow-500/10 px-1 rounded">INSTAGRAM_BUSINESS_ACCOUNT_ID</code> environment variables.</>}
                      </p>
                    </div>
                  ) : instagramData?.data ? (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {[
                          { label: 'Followers', value: instagramData.data.accountInfo?.followersCount?.toLocaleString(), color: '#c084fc' },
                          { label: 'Follower Growth', value: instagramData.data.followerGrowth > 0 ? `+${instagramData.data.followerGrowth}` : String(instagramData.data.followerGrowth), color: instagramData.data.followerGrowth >= 0 ? '#6ee7b7' : '#f87171' },
                          { label: 'Reach', value: instagramData.data.postReach?.toLocaleString(), color: '#93C5FD' },
                          { label: 'Impressions', value: instagramData.data.impressions?.toLocaleString(), color: '#fbbf24' },
                          { label: 'Engagement', value: `${instagramData.data.engagementRate}%`, color: '#f472b6' },
                        ].map((s, i) => (
                          <div key={i} className="rounded-lg border border-purple-500/10 p-3" style={{ background: 'rgba(139,92,246,0.03)' }}>
                            <p className="text-[10px] text-purple-300/40 uppercase font-medium mb-1">{s.label}</p>
                            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                          </div>
                        ))}
                      </div>
                      {instagramData.data.topPosts?.length > 0 && (
                        <div>
                          <p className="text-xs text-purple-300/40 mb-2">Top Posts</p>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {instagramData.data.topPosts.map((post: any, i: number) => (
                              <div key={i} className="rounded-lg border border-purple-500/10 p-3" style={{ background: 'rgba(139,92,246,0.03)' }}>
                                <p className="text-xs text-white/70 truncate mb-2">{post.caption || 'No caption'}</p>
                                <div className="flex items-center gap-3 text-xs">
                                  <span className="text-pink-400">❤ {post.likeCount}</span>
                                  <span className="text-brand-violet">💬 {post.commentsCount}</span>
                                </div>
                                <p className="text-[10px] text-purple-300/20 mt-1">{post.timestamp ? new Date(post.timestamp).toLocaleDateString() : ''}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-6 text-brand-violet-hover/30 text-xs">{instagramData?.error || 'Failed to load Instagram data.'}</div>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-green-500/10 overflow-hidden" style={{ background: 'rgba(8,13,26,0.8)' }}>
              <button onClick={() => toggleSection('posthog')} className="w-full flex items-center justify-between p-5 hover:bg-green-500/5 transition">
                <div className="flex items-center gap-3">
                  <span className="text-lg">📊</span>
                  <h3 className="text-white text-sm font-semibold">Product Analytics</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-300/50">PostHog</span>
                </div>
                <span className="text-brand-violet-hover/30 text-sm">{collapsedSections['posthog'] ? '▶' : '▼'}</span>
              </button>
              {!collapsedSections['posthog'] && (
                <div className="px-5 pb-5 space-y-4">
                  {posthogLoading ? (
                    <div className="text-center py-8 text-brand-violet-hover/40 text-sm">Loading PostHog data...</div>
                  ) : !posthogData?.configured ? (
                    <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4">
                      <p className="text-yellow-300/80 text-sm font-medium mb-1">Not Configured</p>
                      <p className="text-yellow-300/50 text-xs">
                        {analyticsHealth?.posthog?.requiredVars
                          ? <>Set {analyticsHealth.posthog.requiredVars.map((v: string, i: number) => <><code key={v} className="bg-yellow-500/10 px-1 rounded">{v}</code>{i < analyticsHealth.posthog.requiredVars.length - 1 ? ' and ' : ''}</>)} environment variables.</>
                          : <>Set <code className="bg-yellow-500/10 px-1 rounded">POSTHOG_API_KEY</code> environment variables.</>}
                      </p>
                    </div>
                  ) : posthogData?.data ? (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { label: 'Unique Users', value: posthogData.data.uniqueUsers?.toLocaleString(), color: '#6ee7b7' },
                          { label: 'Total Events', value: posthogData.data.totalEvents?.toLocaleString(), color: '#93C5FD' },
                          { label: 'Events/User', value: posthogData.data.avgEventsPerUser, color: '#fbbf24' },
                          { label: 'Avg Session', value: posthogData.data.avgSessionDurationSeconds > 0 ? `${Math.round(posthogData.data.avgSessionDurationSeconds / 60)}m ${posthogData.data.avgSessionDurationSeconds % 60}s` : '—', color: '#c084fc' },
                        ].map((s, i) => (
                          <div key={i} className="rounded-lg border border-green-500/10 p-3" style={{ background: 'rgba(34,197,94,0.03)' }}>
                            <p className="text-[10px] text-green-300/40 uppercase font-medium mb-1">{s.label}</p>
                            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                          </div>
                        ))}
                      </div>
                      {posthogData.data.dailyEventVolume?.length > 0 && (
                        <div>
                          <p className="text-xs text-green-300/40 mb-2">Daily Event Volume</p>
                          <ResponsiveContainer width="100%" height={120}>
                            <AreaChart data={posthogData.data.dailyEventVolume}>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(34,197,94,0.1)" />
                              <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'rgba(134,239,172,0.3)' }} tickFormatter={(v: string) => v.slice(5)} />
                              <YAxis tick={{ fontSize: 9, fill: 'rgba(134,239,172,0.3)' }} width={30} />
                              <Tooltip contentStyle={{ background: 'rgba(8,13,26,0.95)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, fontSize: 11, color: '#fff' }} />
                              <Area type="monotone" dataKey="count" stroke="#22C55E" fill="rgba(34,197,94,0.2)" strokeWidth={2} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {posthogData.data.topEvents?.length > 0 && (
                          <div>
                            <p className="text-xs text-green-300/40 mb-2">Top Events</p>
                            <div className="space-y-1.5">
                              {posthogData.data.topEvents.slice(0, 8).map((e: any, i: number) => {
                                const max = posthogData.data.topEvents[0]?.count || 1;
                                const pct = Math.round((e.count / max) * 100);
                                return (
                                  <div key={i}>
                                    <div className="flex justify-between text-xs mb-0.5">
                                      <span className="text-green-200/60 truncate mr-2">{e.event}</span>
                                      <span className="text-green-300/40 flex-shrink-0">{e.count?.toLocaleString()}</span>
                                    </div>
                                    <div className="h-1.5 rounded-full bg-green-900/20">
                                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #22C55E, #86EFAC)' }} />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {posthogData.data.featureUsage?.length > 0 && (
                          <div>
                            <p className="text-xs text-green-300/40 mb-2">Feature Usage</p>
                            <div className="space-y-1.5">
                              {posthogData.data.featureUsage.slice(0, 6).map((f: any, i: number) => {
                                const max = posthogData.data.featureUsage[0]?.count || 1;
                                const pct = Math.round((f.count / max) * 100);
                                return (
                                  <div key={i}>
                                    <div className="flex justify-between text-xs mb-0.5">
                                      <span className="text-green-200/60 truncate mr-2">{f.feature}</span>
                                      <span className="text-green-300/40 flex-shrink-0">{f.count?.toLocaleString()}</span>
                                    </div>
                                    <div className="h-1.5 rounded-full bg-green-900/20">
                                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #14B8A6, #6EE7B7)' }} />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                      {posthogData.data.retention?.length > 0 && (
                        <div>
                          <p className="text-xs text-green-300/40 mb-2">Retention (first-time users)</p>
                          <ResponsiveContainer width="100%" height={100}>
                            <BarChart data={posthogData.data.retention}>
                              <XAxis dataKey="day" tick={{ fontSize: 9, fill: 'rgba(134,239,172,0.3)' }} tickFormatter={(v: number) => `D${v}`} />
                              <YAxis tick={{ fontSize: 9, fill: 'rgba(134,239,172,0.3)' }} width={30} unit="%" />
                              <Tooltip contentStyle={{ background: 'rgba(8,13,26,0.95)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, fontSize: 11, color: '#fff' }} formatter={(v) => [`${v}%`, 'Retention']} />
                              <Bar dataKey="percentage" fill="#22C55E" radius={[2, 2, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-6 text-brand-violet-hover/30 text-xs">{posthogData?.error || 'Failed to load PostHog data.'}</div>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-red-500/10 overflow-hidden" style={{ background: 'rgba(8,13,26,0.8)' }}>
              <button onClick={() => toggleSection('sentry')} className="w-full flex items-center justify-between p-5 hover:bg-red-500/5 transition">
                <div className="flex items-center gap-3">
                  <span className="text-lg">🐛</span>
                  <h3 className="text-white text-sm font-semibold">Error Tracking</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-300/50">Sentry</span>
                </div>
                <span className="text-brand-violet-hover/30 text-sm">{collapsedSections['sentry'] ? '▶' : '▼'}</span>
              </button>
              {!collapsedSections['sentry'] && (
                <div className="px-5 pb-5 space-y-4">
                  {sentryLoading ? (
                    <div className="text-center py-8 text-brand-violet-hover/40 text-sm">Loading Sentry data...</div>
                  ) : !sentryData?.configured ? (
                    <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4">
                      <p className="text-yellow-300/80 text-sm font-medium mb-1">Not Configured</p>
                      <p className="text-yellow-300/50 text-xs">
                        {analyticsHealth?.sentry?.requiredVars
                          ? <>Set {analyticsHealth.sentry.requiredVars.map((v: string, i: number) => <><code key={v} className="bg-yellow-500/10 px-1 rounded">{v}</code>{i < analyticsHealth.sentry.requiredVars.length - 1 ? ', ' : ''}</>)} environment variables.</>
                          : <>Set <code className="bg-yellow-500/10 px-1 rounded">SENTRY_AUTH_TOKEN</code>, <code className="bg-yellow-500/10 px-1 rounded">SENTRY_ORG</code>, and <code className="bg-yellow-500/10 px-1 rounded">SENTRY_PROJECT</code> environment variables.</>}
                      </p>
                    </div>
                  ) : sentryData?.data ? (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { label: 'Total Errors', value: sentryData.data.totalErrors?.toLocaleString(), color: '#f87171' },
                          { label: 'Unresolved Issues', value: sentryData.data.unresolvedIssues?.toLocaleString(), color: '#fbbf24' },
                          { label: 'Transactions', value: sentryData.data.transactionStats?.totalTransactions?.toLocaleString() || '—', color: '#93C5FD' },
                          { label: 'Avg Duration', value: sentryData.data.transactionStats?.avgDuration ? `${sentryData.data.transactionStats.avgDuration}ms` : '—', color: '#6ee7b7' },
                        ].map((s, i) => (
                          <div key={i} className="rounded-lg border border-red-500/10 p-3" style={{ background: 'rgba(239,68,68,0.03)' }}>
                            <p className="text-[10px] text-red-300/40 uppercase font-medium mb-1">{s.label}</p>
                            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                          </div>
                        ))}
                      </div>
                      {sentryData.data.errorTrend?.length > 0 && (
                        <div>
                          <p className="text-xs text-red-300/40 mb-2">Error Trend</p>
                          <ResponsiveContainer width="100%" height={120}>
                            <AreaChart data={sentryData.data.errorTrend}>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(239,68,68,0.1)" />
                              <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'rgba(252,165,165,0.3)' }} tickFormatter={(v: string) => v.slice(5)} />
                              <YAxis tick={{ fontSize: 9, fill: 'rgba(252,165,165,0.3)' }} width={30} />
                              <Tooltip contentStyle={{ background: 'rgba(8,13,26,0.95)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, fontSize: 11, color: '#fff' }} />
                              <Area type="monotone" dataKey="count" stroke="#EF4444" fill="rgba(239,68,68,0.2)" strokeWidth={2} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                      {sentryData.data.topIssues?.length > 0 && (
                        <div>
                          <p className="text-xs text-red-300/40 mb-2">Top Issues</p>
                          <div className="space-y-2">
                            {sentryData.data.topIssues.slice(0, 8).map((issue: any, i: number) => {
                              const max = sentryData.data.topIssues[0]?.count || 1;
                              const pct = Math.round((issue.count / max) * 100);
                              return (
                                <div key={i}>
                                  <div className="flex justify-between text-xs mb-0.5">
                                    <span className="text-red-200/60 truncate mr-2" title={issue.title}>{issue.shortId}: {issue.title}</span>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                      <span className={`text-[9px] px-1.5 py-0.5 rounded ${issue.level === 'error' ? 'bg-red-500/10 text-red-300/60' : issue.level === 'warning' ? 'bg-yellow-500/10 text-yellow-300/60' : 'bg-blue-500/10 text-blue-300/60'}`}>{issue.level}</span>
                                      <span className="text-red-300/40">{issue.count?.toLocaleString()}</span>
                                    </div>
                                  </div>
                                  <div className="h-1.5 rounded-full bg-red-900/20">
                                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #EF4444, #FCA5A5)' }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {sentryData.data.transactionStats && (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-lg border border-red-500/10 p-3" style={{ background: 'rgba(239,68,68,0.03)' }}>
                            <p className="text-[10px] text-red-300/40 uppercase font-medium mb-1">P95 Duration</p>
                            <p className="text-lg font-bold text-orange-400">{sentryData.data.transactionStats.p95Duration}ms</p>
                          </div>
                          <div className="rounded-lg border border-red-500/10 p-3" style={{ background: 'rgba(239,68,68,0.03)' }}>
                            <p className="text-[10px] text-red-300/40 uppercase font-medium mb-1">Avg Duration</p>
                            <p className="text-lg font-bold text-green-400">{sentryData.data.transactionStats.avgDuration}ms</p>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-6 text-brand-violet-hover/30 text-xs">{sentryData?.error || 'Failed to load Sentry data.'}</div>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-brand-violet/10 overflow-hidden" style={{ background: 'rgba(8,13,26,0.8)' }}>
              <button onClick={() => toggleSection('platform')} className="w-full flex items-center justify-between p-5 hover:bg-brand-violet/5 transition">
                <div className="flex items-center gap-3">
                  <span className="text-lg">🏗️</span>
                  <h3 className="text-white text-sm font-semibold">Platform Metrics</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-violet/10 text-brand-violet-hover/50">Internal</span>
                </div>
                <span className="text-brand-violet-hover/30 text-sm">{collapsedSections['platform'] ? '▶' : '▼'}</span>
              </button>
              {!collapsedSections['platform'] && (
                <div className="px-5 pb-5 space-y-4">
                  {!analyticsData ? (
                    <div className="text-center py-8 text-brand-violet-hover/40 text-sm">Loading platform data...</div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { label: 'Total Users', value: analyticsData.totalUsers, color: '#93C5FD' },
                          { label: 'Complete Profiles', value: analyticsData.completedProfiles, color: '#6ee7b7' },
                          { label: 'Onboarding Rate', value: `${analyticsData.onboardingRate}%`, color: '#fbbf24' },
                          { label: `Signups (${analyticsRange})`, value: analyticsData.recentSignups, color: '#60a5fa' },
                          { label: 'Total Matches', value: analyticsData.totalMatches, color: '#93C5FD' },
                          { label: 'Accepted', value: analyticsData.acceptedMatches, color: '#6ee7b7' },
                          { label: 'Accept Rate', value: `${analyticsData.matchAcceptRate}%`, color: '#fbbf24' },
                          { label: 'Avg Score', value: `${analyticsData.avgMatchScore}%`, color: '#f472b6' },
                        ].map((s, i) => (
                          <div key={i} className="rounded-lg border border-brand-violet/10 p-3" style={{ background: 'rgba(59,130,246,0.03)' }}>
                            <p className="text-[10px] text-brand-violet-hover/40 uppercase font-medium mb-1">{s.label}</p>
                            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                          </div>
                        ))}
                      </div>

                      {funnelData && funnelData.length > 0 && (
                        <div>
                          <p className="text-xs text-brand-violet-hover/40 mb-2">User Funnel</p>
                          <ResponsiveContainer width="100%" height={140}>
                            <BarChart data={funnelData} layout="vertical">
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,130,246,0.1)" />
                              <XAxis type="number" tick={{ fontSize: 9, fill: 'rgba(147,197,253,0.3)' }} />
                              <YAxis dataKey="stage" type="category" tick={{ fontSize: 9, fill: 'rgba(147,197,253,0.4)' }} width={120} />
                              <Tooltip contentStyle={{ background: 'rgba(8,13,26,0.95)', border: '1px solid rgba(108,99,255,0.2)', borderRadius: 8, fontSize: 11, color: '#fff' }} />
                              <Bar dataKey="count" fill="#6C63FF" radius={[0, 3, 3, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-brand-violet-hover/40 mb-2">Daily Signups</p>
                          {analyticsData.dailySignups?.length > 0 && (
                            <ResponsiveContainer width="100%" height={120}>
                              <BarChart data={analyticsData.dailySignups}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,130,246,0.1)" />
                                <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'rgba(147,197,253,0.3)' }} tickFormatter={(v: string) => v.slice(5)} />
                                <YAxis tick={{ fontSize: 9, fill: 'rgba(147,197,253,0.3)' }} width={25} allowDecimals={false} />
                                <Tooltip contentStyle={{ background: 'rgba(8,13,26,0.95)', border: '1px solid rgba(108,99,255,0.2)', borderRadius: 8, fontSize: 11, color: '#fff' }} />
                                <Bar dataKey="count" fill="#6C63FF" radius={[3, 3, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          )}
                        </div>

                        <div>
                          <p className="text-xs text-brand-violet-hover/40 mb-2">Personas</p>
                          <div className="space-y-1.5">
                            {analyticsData.personaBreakdown?.map((p: any, i: number) => {
                              const total = analyticsData.personaBreakdown.reduce((s: number, x: any) => s + x.count, 0);
                              const pct = total > 0 ? Math.round((p.count / total) * 100) : 0;
                              return (
                                <div key={i}>
                                  <div className="flex justify-between text-xs mb-0.5">
                                    <span className="text-white/40">{p.persona}</span>
                                    <span className="text-brand-violet-hover/40">{p.count} ({pct}%)</span>
                                  </div>
                                  <div className="h-1.5 rounded-full bg-brand-violet-pressed/30">
                                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #6C63FF, #4ECDC4)' }} />
                                  </div>
                                </div>
                              );
                            })}
                            {(!analyticsData.personaBreakdown || analyticsData.personaBreakdown.length === 0) && (
                              <p className="text-brand-violet-hover/30 text-xs">No persona data yet</p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-brand-violet-hover/40 mb-2">Channel Attribution</p>
                          <div className="space-y-1.5">
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
                                  <div className="flex justify-between text-xs mb-0.5">
                                    <span className="text-white/40">{sourceLabels[a.source] || a.source}</span>
                                    <span className="text-brand-violet-hover/40">{a.count} ({pct}%)</span>
                                  </div>
                                  <div className="h-1.5 rounded-full bg-brand-violet-pressed/30">
                                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #14B8A6, #93C5FD)' }} />
                                  </div>
                                </div>
                              );
                            })}
                            {(!analyticsData.attributionBreakdown || analyticsData.attributionBreakdown.length === 0) && (
                              <p className="text-brand-violet-hover/30 text-xs">No attribution data yet</p>
                            )}
                          </div>
                        </div>

                        <div>
                          <p className="text-xs text-brand-violet-hover/40 mb-2">Feedback</p>
                          <div className="flex items-center gap-4 mb-3">
                            <div className="text-center">
                              <p className="text-2xl font-bold text-yellow-400">{analyticsData.feedbackStats?.avgRating || 0}</p>
                              <p className="text-[10px] text-brand-violet-hover/40">Avg Rating</p>
                            </div>
                            <div className="text-center">
                              <p className="text-2xl font-bold text-brand-violet">{analyticsData.feedbackStats?.total || 0}</p>
                              <p className="text-[10px] text-brand-violet-hover/40">Total Reviews</p>
                            </div>
                          </div>
                          <div className="space-y-1">
                            {[5, 4, 3, 2, 1].map(r => {
                              const count = analyticsData.feedbackStats?.distribution?.find((d: any) => d.rating === r)?.count || 0;
                              const total = analyticsData.feedbackStats?.total || 1;
                              return (
                                <div key={r} className="flex items-center gap-2">
                                  <span className="text-[10px] text-yellow-400 w-5">{r}★</span>
                                  <div className="flex-1 h-1.5 rounded-full bg-brand-violet-pressed/30">
                                    <div className="h-full rounded-full bg-yellow-400/60" style={{ width: `${(count / total) * 100}%` }} />
                                  </div>
                                  <span className="text-[10px] text-brand-violet-hover/40 w-5 text-right">{count}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-brand-violet-hover/40 mb-2">Communications</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-lg border border-brand-violet/10 p-3 text-center" style={{ background: 'rgba(59,130,246,0.03)' }}>
                              <p className="text-lg font-bold text-brand-violet">{analyticsData.totalCalls}</p>
                              <p className="text-[10px] text-brand-violet-hover/40">Calls</p>
                            </div>
                            <div className="rounded-lg border border-brand-violet/10 p-3 text-center" style={{ background: 'rgba(59,130,246,0.03)' }}>
                              <p className="text-lg font-bold text-brand-violet">{analyticsData.totalMessages}</p>
                              <p className="text-[10px] text-brand-violet-hover/40">Messages</p>
                            </div>
                          </div>
                          <div className="mt-2 space-y-1">
                            {analyticsData.channelBreakdown?.map((c: any, i: number) => (
                              <div key={i} className="flex justify-between text-xs">
                                <span className="text-white/40">{c.channel}</span>
                                <span className="text-brand-violet-hover/40">{c.count}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="text-xs text-brand-violet-hover/40 mb-2">Recent Activity</p>
                          <div className="space-y-1.5 max-h-48 overflow-y-auto">
                            {analyticsData.recentActivity?.map((a: any, i: number) => (
                              <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: 'rgba(59,130,246,0.03)' }}>
                                <span className="text-xs">
                                  {a.type === 'MATCH_FOUND' ? '🎯' : a.type === 'INTRO_ACCEPTED' ? '✅' : a.type === 'INTRO_REQUEST' ? '🤝' : '🔔'}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <span className="text-[10px] text-white/70 truncate block">{a.title}</span>
                                  {a.email && <span className="text-[9px] text-brand-violet-hover/30">{a.email}</span>}
                                </div>
                                <span className="text-[9px] text-brand-violet-hover/20 flex-shrink-0">
                                  {new Date(a.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                            ))}
                            {(!analyticsData.recentActivity || analyticsData.recentActivity.length === 0) && (
                              <p className="text-brand-violet-hover/30 text-xs text-center py-4">No recent activity</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'whatsapp' && (
          <div className="space-y-6">
            {whatsappData ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Opted-In Users', value: whatsappData.stats?.optedInUsers || 0, icon: '✅' },
                    { label: 'Total Messages', value: whatsappData.stats?.totalMessages || 0, icon: '💬' },
                    { label: 'Inbound', value: whatsappData.stats?.inboundCount || 0, icon: '📥' },
                    { label: 'Outbound', value: whatsappData.stats?.outboundCount || 0, icon: '📤' },
                    { label: 'Delivered', value: whatsappData.stats?.deliveredCount || 0, icon: '📬' },
                    { label: 'Failed', value: whatsappData.stats?.failedCount || 0, icon: '❌' },
                    { label: 'Active (24h)', value: whatsappData.stats?.activeConversations || 0, icon: '🟢' },
                  ].map((stat) => (
                    <div key={stat.label} className="bg-[rgba(8,13,26,0.8)]/60 backdrop-blur-sm rounded-xl border border-green-500/10 p-5 hover:border-green-500/20 transition">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{stat.icon}</span>
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{stat.label}</p>
                      </div>
                      <p className="text-3xl font-bold text-white">{stat.value}</p>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button onClick={loadWhatsApp} className="px-4 py-2 rounded-xl text-sm font-medium bg-green-600/20 text-green-300 border border-green-500/20 hover:bg-green-600/30 transition">
                    Refresh
                  </button>
                  <button onClick={() => setWaSubTab('activity')} className={`px-4 py-2 rounded-xl text-sm font-medium transition ${waSubTab === 'activity' ? 'bg-green-600 text-white' : 'text-slate-400 border border-brand-violet/20 hover:text-green-200'}`}>
                    Activity
                  </button>
                  <button onClick={() => setWaSubTab('users')} className={`px-4 py-2 rounded-xl text-sm font-medium transition ${waSubTab === 'users' ? 'bg-green-600 text-white' : 'text-slate-400 border border-brand-violet/20 hover:text-green-200'}`}>
                    Users
                  </button>
                </div>

                {waSubTab === 'activity' && (
                  <div className="bg-[rgba(8,13,26,0.8)]/60 backdrop-blur-sm rounded-xl border border-brand-violet/10 overflow-hidden">
                    <div className="px-5 py-4 border-b border-brand-violet/10">
                      <h3 className="text-sm font-semibold text-white">Recent WhatsApp Messages</h3>
                    </div>
                    <div className="divide-y divide-brand-violet/5 max-h-[600px] overflow-y-auto">
                      {whatsappData.messages?.length > 0 ? whatsappData.messages.map((msg: any) => (
                        <div key={msg.id} className="px-5 py-3 flex items-start gap-3 hover:bg-brand-violet-pressed/10 transition">
                          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                            msg.content?.startsWith('[INBOUND]') ? 'bg-brand-violet' :
                            msg.status === 'DELIVERED' || msg.status === 'READ' ? 'bg-green-400' :
                            msg.status === 'FAILED' ? 'bg-red-400' : 'bg-yellow-400'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-medium text-slate-300">
                                {msg.user?.name || msg.user?.email || msg.recipientPhone}
                              </span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                msg.content?.startsWith('[INBOUND]') ? 'bg-brand-violet/20 text-brand-violet-hover' : 'bg-green-500/20 text-green-300'
                              }`}>
                                {msg.content?.startsWith('[INBOUND]') ? 'IN' : 'OUT'}
                              </span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                msg.status === 'DELIVERED' || msg.status === 'READ' ? 'bg-green-500/20 text-green-300' :
                                msg.status === 'FAILED' ? 'bg-red-500/20 text-red-300' :
                                msg.status === 'SENT' ? 'bg-yellow-500/20 text-yellow-300' :
                                'bg-slate-500/20 text-slate-300'
                              }`}>
                                {msg.status}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 truncate">
                              {msg.content?.replace('[INBOUND] ', '').substring(0, 120)}
                            </p>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              {new Date(msg.createdAt).toLocaleString()} &middot; {msg.recipientPhone}
                            </p>
                          </div>
                        </div>
                      )) : (
                        <div className="px-5 py-10 text-center text-sm text-slate-500">
                          No WhatsApp messages yet
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {waSubTab === 'users' && (
                  <div className="bg-[rgba(8,13,26,0.8)]/60 backdrop-blur-sm rounded-xl border border-brand-violet/10 overflow-hidden">
                    <div className="px-5 py-4 border-b border-brand-violet/10">
                      <h3 className="text-sm font-semibold text-white">WhatsApp Users ({whatsappUsers?.length || 0})</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-brand-violet/10">
                            <th className="px-4 py-3 text-left font-medium text-slate-400 uppercase tracking-wider">User</th>
                            <th className="px-4 py-3 text-left font-medium text-slate-400 uppercase tracking-wider">Phone</th>
                            <th className="px-4 py-3 text-left font-medium text-slate-400 uppercase tracking-wider">Messages</th>
                            <th className="px-4 py-3 text-left font-medium text-slate-400 uppercase tracking-wider">Last Activity</th>
                            <th className="px-4 py-3 text-left font-medium text-slate-400 uppercase tracking-wider">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-brand-violet/5">
                          {whatsappUsers && whatsappUsers.length > 0 ? whatsappUsers.map((u: any) => (
                            <tr key={u.id} className="hover:bg-brand-violet-pressed/10 transition">
                              <td className="px-4 py-3">
                                <div className="text-slate-200 font-medium">{u.name || 'N/A'}</div>
                                <div className="text-slate-500">{u.email}</div>
                              </td>
                              <td className="px-4 py-3 text-slate-300 font-mono">{u.whatsappPhone || u.phone || '-'}</td>
                              <td className="px-4 py-3 text-slate-300">{u.messageCount || 0}</td>
                              <td className="px-4 py-3 text-slate-400">
                                {u.messageRecords?.[0]?.createdAt ? new Date(u.messageRecords[0].createdAt).toLocaleDateString() : 'Never'}
                              </td>
                              <td className="px-4 py-3">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/20 text-green-300">
                                  Opted In
                                </span>
                              </td>
                            </tr>
                          )) : (
                            <tr>
                              <td colSpan={5} className="px-4 py-10 text-center text-slate-500">No WhatsApp users yet</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center py-20">
                <div className="w-5 h-5 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        )}

        {activeTab === 'agents' && <AgentsManagement />}

        {activeTab === 'architecture' && <AgentArchitecture />}
      </div>

      {showCreateEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[rgba(8,13,26,0.8)] border border-brand-violet/20 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-white font-semibold mb-4">Create Event</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 uppercase mb-1.5">Name</label>
                <input
                  value={newEvent.name}
                  onChange={(e) => setNewEvent({ ...newEvent, name: e.target.value })}
                  placeholder="Event name"
                  className="w-full px-3 py-2.5 rounded-xl border border-brand-violet/20 bg-brand-violet-pressed/20 text-white placeholder-slate-400/30 text-sm focus:outline-none focus:ring-2 focus:ring-brand-violet"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 uppercase mb-1.5">Description</label>
                <textarea
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  placeholder="Event description"
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-xl border border-brand-violet/20 bg-brand-violet-pressed/20 text-white placeholder-slate-400/30 text-sm focus:outline-none focus:ring-2 focus:ring-brand-violet resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 uppercase mb-1.5">Date & Time</label>
                <input
                  type="datetime-local"
                  value={newEvent.date}
                  onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-brand-violet/20 bg-brand-violet-pressed/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-violet"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 uppercase mb-1.5">Location</label>
                <input
                  value={newEvent.location}
                  onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                  placeholder="Event location"
                  className="w-full px-3 py-2.5 rounded-xl border border-brand-violet/20 bg-brand-violet-pressed/20 text-white placeholder-slate-400/30 text-sm focus:outline-none focus:ring-2 focus:ring-brand-violet"
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newEvent.isVirtual}
                    onChange={(e) => setNewEvent({ ...newEvent, isVirtual: e.target.checked })}
                    className="rounded border-brand-violet/20 bg-brand-violet-pressed/20 text-brand-violet"
                  />
                  <span className="text-sm text-brand-violet-hover">Virtual event</span>
                </label>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 uppercase mb-1.5">Max Capacity (optional)</label>
                <input
                  type="number"
                  value={newEvent.maxCapacity}
                  onChange={(e) => setNewEvent({ ...newEvent, maxCapacity: e.target.value })}
                  placeholder="No limit"
                  className="w-full px-3 py-2.5 rounded-xl border border-brand-violet/20 bg-brand-violet-pressed/20 text-white placeholder-slate-400/30 text-sm focus:outline-none focus:ring-2 focus:ring-brand-violet"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreateEvent(false)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white/60 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateEvent}
                disabled={!newEvent.name || !newEvent.date}
                className="px-4 py-2 text-sm bg-brand-violet text-white rounded-xl hover:bg-brand-violet transition disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-brand-violet/20"
              >
                Create Event
              </button>
            </div>
          </div>
        </div>
      )}

      {triggerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[rgba(8,13,26,0.8)] border border-brand-violet/20 rounded-2xl p-6 w-full max-w-md shadow-2xl">
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
                              ? 'bg-brand-violet text-white border-brand-violet'
                              : 'border-brand-violet/20 text-slate-400 hover:text-white/60'
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
                      className="w-full px-3 py-2.5 rounded-xl border border-brand-violet/20 bg-brand-violet-pressed/20 text-white placeholder-slate-400/30 text-sm focus:outline-none focus:ring-2 focus:ring-brand-violet resize-none"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setTriggerModal(null)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 border border-brand-violet/20 hover:text-white/60 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleTrigger}
                disabled={triggerLoading || !triggerPhone || (triggerModal.type === 'message' && !triggerMessage)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-brand-violet text-white hover:bg-brand-violet transition disabled:opacity-40"
              >
                {triggerLoading ? 'Sending...' : triggerModal.type === 'call' ? 'Call Now' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
