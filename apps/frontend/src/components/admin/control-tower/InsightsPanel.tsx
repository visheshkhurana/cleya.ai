'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Channel, useAgentData } from './types';
import { api } from '@/lib/api';

interface InsightsPanelProps {
  channel: Channel;
  collapsed: boolean;
  onToggle: () => void;
  stats: any;
  commData: any;
  dealData: any;
  eventData: any;
  analyticsData: any;
  whatsappData: any;
  onLoadComms: () => void;
  onLoadDeals: () => void;
  onLoadEvents: () => void;
  onLoadAnalytics: () => void;
  onLoadWhatsApp: () => void;
}

type InsightTab = 'overview' | 'stats' | 'history' | 'actions' | 'comms' | 'deals' | 'events' | 'analytics' | 'whatsapp';

export function InsightsPanel({
  channel,
  collapsed,
  onToggle,
  stats,
  commData,
  dealData,
  eventData,
  analyticsData,
  whatsappData,
  onLoadComms,
  onLoadDeals,
  onLoadEvents,
  onLoadAnalytics,
  onLoadWhatsApp,
}: InsightsPanelProps) {
  const { agentMap } = useAgentData();
  const [activeTab, setActiveTab] = useState<InsightTab>('overview');
  const [agentStatus, setAgentStatus] = useState<any>(null);
  const [runHistory, setRunHistory] = useState<any[]>([]);
  const [accountability, setAccountability] = useState<any>(null);
  const [runLoading, setRunLoading] = useState(false);

  const isAgentChannel = channel.type === 'agent' && channel.agentId;
  const agent = isAgentChannel ? agentMap[channel.agentId!] : null;

  useEffect(() => {
    setActiveTab('overview');
    if (isAgentChannel && channel.agentId) {
      loadAgentData(channel.agentId);
    }
  }, [channel.id]);

  const loadAgentData = async (agentId: string) => {
    try {
      const [statuses, history, acc] = await Promise.all([
        api.getAgentStatuses().catch(() => []),
        api.getAgentRunHistory(agentId, 10).catch(() => []),
        api.getAgentAccountability(agentId).catch(() => null),
      ]);
      const statusArr = Array.isArray(statuses) ? statuses : [];
      setAgentStatus(statusArr.find((s: any) => s.agentId === agentId) || null);
      setRunHistory(Array.isArray(history) ? history : []);
      setAccountability(acc);
    } catch {
      // non-fatal
    }
  };

  const handleRunAgent = useCallback(async () => {
    if (!channel.agentId || runLoading) return;
    setRunLoading(true);
    try {
      await api.runAgent(channel.agentId);
      setTimeout(() => loadAgentData(channel.agentId!), 2000);
    } catch (err: any) {
      console.error('Failed to run agent:', err);
    }
    setRunLoading(false);
  }, [channel.agentId, runLoading]);

  if (collapsed) {
    return (
      <button
        onClick={onToggle}
        className="w-10 h-full border-l border-white/[0.06] flex items-center justify-center hover:bg-white/[0.04] transition"
        style={{ background: 'rgba(8,13,26,0.95)' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/30">
          <path d="m15 18-6-6 6-6"/>
        </svg>
      </button>
    );
  }

  const tabs: { id: InsightTab; label: string }[] = isAgentChannel
    ? [
        { id: 'overview', label: 'Info' },
        { id: 'history', label: 'History' },
        { id: 'actions', label: 'Actions' },
      ]
    : channel.id === 'founder-room'
    ? [
        { id: 'overview', label: 'Overview' },
        { id: 'comms', label: 'Comms' },
        { id: 'deals', label: 'Deals' },
        { id: 'events', label: 'Events' },
        { id: 'analytics', label: 'Analytics' },
        { id: 'whatsapp', label: 'WhatsApp' },
      ]
    : [{ id: 'overview', label: 'Overview' }];

  return (
    <div className="w-[320px] min-w-[320px] h-full flex flex-col border-l border-white/[0.06]" style={{ background: 'rgba(8,13,26,0.95)' }}>
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Insights</h3>
        <button onClick={onToggle} className="text-white/30 hover:text-white transition p-1">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 18 6-6-6-6"/>
          </svg>
        </button>
      </div>

      {tabs.length > 1 && (
        <div className="flex gap-0.5 px-3 pt-2 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === 'comms' && !commData) onLoadComms();
                if (tab.id === 'deals' && !dealData) onLoadDeals();
                if (tab.id === 'events' && !eventData) onLoadEvents();
                if (tab.id === 'analytics' && !analyticsData) onLoadAnalytics();
                if (tab.id === 'whatsapp' && !whatsappData) onLoadWhatsApp();
              }}
              className={`px-2.5 py-1.5 rounded-md text-[11px] font-medium transition whitespace-nowrap ${
                activeTab === tab.id ? 'bg-indigo-500/20 text-indigo-300' : 'text-white/30 hover:text-white/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {isAgentChannel && agent && activeTab === 'overview' && (
          <AgentOverview agent={agent} agentStatus={agentStatus} accountability={accountability} />
        )}

        {isAgentChannel && activeTab === 'history' && (
          <RunHistoryView history={runHistory} />
        )}

        {isAgentChannel && activeTab === 'actions' && (
          <AgentActions
            agentId={channel.agentId!}
            agentStatus={agentStatus}
            onRun={handleRunAgent}
            runLoading={runLoading}
          />
        )}

        {!isAgentChannel && activeTab === 'overview' && (
          <OverviewStats stats={stats} />
        )}

        {activeTab === 'comms' && <CommsView data={commData} />}
        {activeTab === 'deals' && <DealsView data={dealData} />}
        {activeTab === 'events' && <EventsView data={eventData} />}
        {activeTab === 'analytics' && <AnalyticsView data={analyticsData} />}
        {activeTab === 'whatsapp' && <WhatsAppView data={whatsappData} />}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon?: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="flex items-center gap-1.5 mb-1">
        {icon && <span className="text-xs">{icon}</span>}
        <span className="text-[10px] text-white/30 uppercase font-medium">{label}</span>
      </div>
      <span className="text-lg font-bold text-white">{value}</span>
    </div>
  );
}

function AgentOverview({ agent, agentStatus, accountability }: { agent: any; agentStatus: any; accountability: any }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
        <span className="text-2xl">{agent.emoji}</span>
        <div>
          <h4 className="text-sm font-semibold text-white">{agent.name}</h4>
          <p className="text-xs text-white/30">{agent.role}</p>
        </div>
        {agentStatus && (
          <div className={`ml-auto px-2 py-1 rounded-full text-[10px] font-medium ${
            agentStatus.status === 'running' ? 'bg-yellow-500/20 text-yellow-300' :
            agentStatus.enabled ? 'bg-green-500/20 text-green-300' :
            'bg-slate-500/20 text-slate-300'
          }`}>
            {agentStatus.status === 'running' ? 'Running' : agentStatus.enabled ? 'Active' : 'Disabled'}
          </div>
        )}
      </div>

      <p className="text-xs text-white/40">{agent.description}</p>

      {agentStatus && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-white/30">Last Run</span>
            <span className="text-white/50">{agentStatus.lastRunAt ? new Date(agentStatus.lastRunAt).toLocaleString() : 'Never'}</span>
          </div>
          {agentStatus.nextRunAt && (
            <div className="flex justify-between text-xs">
              <span className="text-white/30">Next Run</span>
              <span className="text-white/50">{new Date(agentStatus.nextRunAt).toLocaleString()}</span>
            </div>
          )}
          {agentStatus.cronExpression && (
            <div className="flex justify-between text-xs">
              <span className="text-white/30">Schedule</span>
              <span className="text-white/50 font-mono text-[10px]">{agentStatus.cronExpression}</span>
            </div>
          )}
        </div>
      )}

      {accountability && (
        <div className="grid grid-cols-2 gap-2">
          <StatCard label="Total Runs" value={accountability.totalRuns || 0} />
          <StatCard label="Success Rate" value={`${accountability.successRate || 0}%`} />
          <StatCard label="Avg Duration" value={`${Math.round((accountability.avgDuration || 0) / 1000)}s`} />
          <StatCard label="Content Items" value={accountability.contentItemsGenerated || 0} />
        </div>
      )}
    </div>
  );
}

function RunHistoryView({ history }: { history: any[] }) {
  if (!history || history.length === 0) {
    return <p className="text-xs text-white/20 text-center py-8">No run history yet</p>;
  }
  return (
    <div className="space-y-2">
      {history.map((run: any, i: number) => (
        <div key={i} className={`rounded-lg border p-3 text-xs ${
          run.status === 'completed' ? 'border-green-500/20 bg-green-500/5' :
          run.status === 'failed' ? 'border-red-500/20 bg-red-500/5' :
          'border-white/[0.06] bg-white/[0.02]'
        }`}>
          <div className="flex items-center justify-between mb-1">
            <span className={`font-medium ${run.status === 'completed' ? 'text-green-300' : run.status === 'failed' ? 'text-red-300' : 'text-white/60'}`}>
              {run.status || 'unknown'}
            </span>
            <span className="text-white/20">{run.created_at ? new Date(run.created_at).toLocaleString() : ''}</span>
          </div>
          {run.duration && <span className="text-white/30">{Math.round(run.duration / 1000)}s</span>}
          {run.error && <p className="text-red-300/60 mt-1 truncate">{run.error}</p>}
        </div>
      ))}
    </div>
  );
}

function AgentActions({ agentId, agentStatus, onRun, runLoading }: { agentId: string; agentStatus: any; onRun: () => void; runLoading: boolean }) {
  const [cronEdit, setCronEdit] = useState(false);
  const [cronExpr, setCronExpr] = useState(agentStatus?.cronExpression || '');
  const [cronDesc, setCronDesc] = useState(agentStatus?.cronDescription || '');
  const [configLoading, setConfigLoading] = useState(false);
  const [enabled, setEnabled] = useState(agentStatus?.enabled ?? true);

  useEffect(() => {
    setCronExpr(agentStatus?.cronExpression || '');
    setCronDesc(agentStatus?.cronDescription || '');
    setEnabled(agentStatus?.enabled ?? true);
  }, [agentStatus]);

  const handleToggleEnabled = async () => {
    setConfigLoading(true);
    try {
      await api.updateAgentConfig(agentId, { enabled: !enabled });
      setEnabled(!enabled);
    } catch (err: any) {
      console.error('Failed to toggle agent:', err);
    }
    setConfigLoading(false);
  };

  const handleSaveCron = async () => {
    if (!cronExpr.trim()) return;
    setConfigLoading(true);
    try {
      await api.updateAgentConfig(agentId, { cronExpression: cronExpr.trim(), cronDescription: cronDesc.trim() || undefined });
      setCronEdit(false);
    } catch (err: any) {
      console.error('Failed to update schedule:', err);
    }
    setConfigLoading(false);
  };

  return (
    <div className="space-y-3">
      <button
        onClick={onRun}
        disabled={runLoading}
        className="w-full py-2.5 rounded-xl text-sm font-medium bg-indigo-500 text-white hover:bg-indigo-400 disabled:opacity-50 transition"
      >
        {runLoading ? 'Running...' : 'Run Agent Now'}
      </button>
      <div className="text-xs text-white/20 text-center">
        Manually trigger this agent to execute its tasks
      </div>

      <div className="border-t border-white/[0.06] pt-3 space-y-3">
        <h5 className="text-[10px] text-white/30 uppercase font-medium">Schedule Configuration</h5>
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/50">Agent Enabled</span>
          <button
            onClick={handleToggleEnabled}
            disabled={configLoading}
            className={`w-10 h-5 rounded-full transition relative ${enabled ? 'bg-indigo-500' : 'bg-white/10'}`}
          >
            <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${enabled ? 'left-5' : 'left-0.5'}`} />
          </button>
        </div>

        {cronEdit ? (
          <div className="space-y-2">
            <input value={cronExpr} onChange={e => setCronExpr(e.target.value)} placeholder="Cron expression (e.g. 0 7 * * *)" className="w-full px-2 py-1.5 rounded-lg text-xs text-white font-mono bg-white/[0.06] border border-white/10 outline-none" />
            <input value={cronDesc} onChange={e => setCronDesc(e.target.value)} placeholder="Description (optional)" className="w-full px-2 py-1.5 rounded-lg text-xs text-white bg-white/[0.06] border border-white/10 outline-none" />
            <div className="flex gap-2">
              <button onClick={handleSaveCron} disabled={configLoading || !cronExpr.trim()} className="flex-1 py-1.5 rounded-lg text-xs font-medium bg-indigo-500 text-white hover:bg-indigo-400 disabled:opacity-50 transition">
                {configLoading ? 'Saving...' : 'Save Schedule'}
              </button>
              <button onClick={() => setCronEdit(false)} className="px-3 py-1.5 rounded-lg text-xs text-white/30 hover:text-white/50 bg-white/[0.04] transition">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-white/50 font-mono">{agentStatus?.cronExpression || 'Not set'}</span>
              {agentStatus?.cronDescription && <p className="text-[10px] text-white/20 mt-0.5">{agentStatus.cronDescription}</p>}
            </div>
            <button onClick={() => setCronEdit(true)} className="px-2 py-1 rounded-lg text-[10px] bg-white/[0.06] text-white/30 hover:text-white/50 transition">Edit</button>
          </div>
        )}
      </div>
    </div>
  );
}

function OverviewStats({ stats }: { stats: any }) {
  if (!stats) return <p className="text-xs text-white/20 text-center py-8">Loading...</p>;
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold text-white/40 uppercase">Platform Stats</h4>
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Total Users" value={stats.totalUsers || 0} icon="\u{1F465}" />
        <StatCard label="Profiles" value={stats.completedProfiles || 0} icon="\u{2705}" />
        <StatCard label="Matches" value={stats.totalMatches || 0} icon="\u{1F91D}" />
        <StatCard label="Accept Rate" value={`${stats.matchAcceptRate || 0}%`} icon="\u{1F4C8}" />
        <StatCard label="Active Chats" value={stats.activeConversations || 0} icon="\u{1F4AC}" />
        <StatCard label="Calls" value={stats.totalCalls || 0} icon="\u{1F4DE}" />
      </div>
    </div>
  );
}

function CommsView({ data }: { data: any }) {
  const [callModal, setCallModal] = useState<{ userId: string; email: string } | null>(null);
  const [msgModal, setMsgModal] = useState<{ userId: string; email: string } | null>(null);
  const [phone, setPhone] = useState('');
  const [msgText, setMsgText] = useState('');
  const [msgChannel, setMsgChannel] = useState<'SMS' | 'WHATSAPP'>('WHATSAPP');
  const [actionLoading, setActionLoading] = useState(false);

  const handleCall = async () => {
    if (!callModal || !phone.trim()) return;
    setActionLoading(true);
    try {
      await api.adminTriggerCall(callModal.userId, phone.trim());
      setCallModal(null);
      setPhone('');
    } catch (err: any) {
      console.error('Call failed:', err);
    }
    setActionLoading(false);
  };

  const handleMessage = async () => {
    if (!msgModal || !phone.trim() || !msgText.trim()) return;
    setActionLoading(true);
    try {
      await api.adminTriggerMessage(msgModal.userId, phone.trim(), msgChannel, msgText.trim());
      setMsgModal(null);
      setPhone('');
      setMsgText('');
    } catch (err: any) {
      console.error('Message failed:', err);
    }
    setActionLoading(false);
  };

  if (!data) return <p className="text-xs text-white/20 text-center py-8">Loading communications...</p>;
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold text-white/40 uppercase">Communications</h4>
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Total Calls" value={data.callStats?.total || 0} icon="\u{1F4DE}" />
        <StatCard label="Completed" value={data.callStats?.completed || 0} icon="\u{2705}" />
        <StatCard label="SMS Sent" value={data.messageStats?.totalSMS || 0} icon="\u{1F4AC}" />
        <StatCard label="WhatsApp" value={data.messageStats?.totalWhatsApp || 0} icon="\u{1F4F1}" />
      </div>
      {data.calls?.length > 0 && (
        <div>
          <h5 className="text-[10px] text-white/30 uppercase font-medium mb-2">Recent Calls</h5>
          <div className="space-y-1.5">
            {data.calls.slice(0, 5).map((call: any) => (
              <div key={call.id} className="text-xs flex items-center gap-2 p-2 rounded-lg bg-white/[0.02]">
                <span className={`w-1.5 h-1.5 rounded-full ${call.status === 'COMPLETED' ? 'bg-green-400' : 'bg-red-400'}`} />
                <span className="text-white/50 truncate flex-1">{call.user?.email || call.phoneNumber}</span>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => setCallModal({ userId: call.userId, email: call.user?.email || '' })} className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 transition text-[10px]">Call</button>
                  <button onClick={() => setMsgModal({ userId: call.userId, email: call.user?.email || '' })} className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition text-[10px]">Msg</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {callModal && (
        <div className="p-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-indigo-300">Call {callModal.email}</span>
            <button onClick={() => setCallModal(null)} className="text-white/30 hover:text-white text-xs">x</button>
          </div>
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone number" className="w-full px-2 py-1.5 rounded-lg text-xs text-white bg-white/[0.06] border border-white/10 outline-none" />
          <button onClick={handleCall} disabled={actionLoading || !phone.trim()} className="w-full py-1.5 rounded-lg text-xs font-medium bg-indigo-500 text-white hover:bg-indigo-400 disabled:opacity-50 transition">
            {actionLoading ? 'Calling...' : 'Trigger Call'}
          </button>
        </div>
      )}

      {msgModal && (
        <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-300">Message {msgModal.email}</span>
            <button onClick={() => setMsgModal(null)} className="text-white/30 hover:text-white text-xs">x</button>
          </div>
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone number" className="w-full px-2 py-1.5 rounded-lg text-xs text-white bg-white/[0.06] border border-white/10 outline-none" />
          <div className="flex gap-1">
            {(['SMS', 'WHATSAPP'] as const).map(ch => (
              <button key={ch} onClick={() => setMsgChannel(ch)} className={`flex-1 py-1 rounded-lg text-[10px] font-medium transition ${msgChannel === ch ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/[0.04] text-white/30'}`}>{ch}</button>
            ))}
          </div>
          <textarea value={msgText} onChange={e => setMsgText(e.target.value)} placeholder="Message..." rows={2} className="w-full px-2 py-1.5 rounded-lg text-xs text-white bg-white/[0.06] border border-white/10 outline-none resize-none" />
          <button onClick={handleMessage} disabled={actionLoading || !phone.trim() || !msgText.trim()} className="w-full py-1.5 rounded-lg text-xs font-medium bg-emerald-500 text-white hover:bg-emerald-400 disabled:opacity-50 transition">
            {actionLoading ? 'Sending...' : 'Send Message'}
          </button>
        </div>
      )}
    </div>
  );
}

function DealsView({ data }: { data: any }) {
  const [updatingDeal, setUpdatingDeal] = useState<string | null>(null);
  const [dealValue, setDealValue] = useState('');
  const [valueEditId, setValueEditId] = useState<string | null>(null);

  const handleStatusChange = async (dealId: string, newStatus: string) => {
    setUpdatingDeal(dealId);
    try {
      await api.updateDeal(dealId, { status: newStatus });
      if (data?.deals) {
        const deal = data.deals.find((d: any) => d.id === dealId);
        if (deal) deal.status = newStatus;
      }
    } catch (err: any) {
      console.error('Failed to update deal:', err);
    }
    setUpdatingDeal(null);
  };

  const handleSetValue = async (dealId: string) => {
    if (!dealValue.trim()) return;
    setUpdatingDeal(dealId);
    try {
      await api.updateDeal(dealId, { dealValue: parseFloat(dealValue) });
      if (data?.deals) {
        const deal = data.deals.find((d: any) => d.id === dealId);
        if (deal) deal.dealValue = parseFloat(dealValue);
      }
      setValueEditId(null);
      setDealValue('');
    } catch (err: any) {
      console.error('Failed to update deal value:', err);
    }
    setUpdatingDeal(null);
  };

  if (!data) return <p className="text-xs text-white/20 text-center py-8">Loading deals...</p>;
  const statuses = ['OPEN', 'INTRO_MADE', 'CLOSED_WON', 'CLOSED_LOST'];
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold text-white/40 uppercase">Deal Pipeline</h4>
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Total Deals" value={data.stats?.total || 0} icon="\u{1F91D}" />
        <StatCard label="Intros Sent" value={data.stats?.introsSent || 0} icon="\u{1F4E8}" />
        <StatCard label="Open" value={data.stats?.byStatus?.OPEN || 0} icon="\u{1F50D}" />
        <StatCard label="Won" value={data.stats?.byStatus?.CLOSED_WON || 0} icon="\u{1F3C6}" />
      </div>
      {data.deals?.length > 0 && (
        <div>
          <h5 className="text-[10px] text-white/30 uppercase font-medium mb-2">Recent Deals</h5>
          <div className="space-y-1.5">
            {data.deals.slice(0, 5).map((deal: any) => (
              <div key={deal.id} className="text-xs p-2 rounded-lg bg-white/[0.02] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-white/50 truncate">{deal.dealPartner?.email || '-'}</span>
                  <select
                    value={deal.status}
                    onChange={e => handleStatusChange(deal.id, e.target.value)}
                    disabled={updatingDeal === deal.id}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/10 text-white/60 outline-none cursor-pointer"
                  >
                    {statuses.map(s => (
                      <option key={s} value={s} className="bg-[#0f1423] text-white">{s.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  {valueEditId === deal.id ? (
                    <div className="flex gap-1 flex-1">
                      <input value={dealValue} onChange={e => setDealValue(e.target.value)} placeholder="Value ($)" type="number" className="flex-1 px-1.5 py-0.5 rounded text-[10px] bg-white/[0.06] border border-white/10 text-white outline-none" />
                      <button onClick={() => handleSetValue(deal.id)} disabled={updatingDeal === deal.id} className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px]">Set</button>
                      <button onClick={() => { setValueEditId(null); setDealValue(''); }} className="px-1 py-0.5 rounded text-white/30 text-[10px]">x</button>
                    </div>
                  ) : (
                    <>
                      <span className="text-white/30">{deal.dealValue ? `$${Number(deal.dealValue).toLocaleString()}` : 'No value'}</span>
                      <button onClick={() => { setValueEditId(deal.id); setDealValue(deal.dealValue?.toString() || ''); }} className="px-1.5 py-0.5 rounded bg-white/[0.06] text-white/30 hover:text-white/50 text-[10px] transition">Set Value</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EventsView({ data }: { data: any }) {
  const [showCreate, setShowCreate] = useState(false);
  const [eventForm, setEventForm] = useState({ name: '', description: '', date: '', location: '', isVirtual: false, maxCapacity: '' });
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!eventForm.name.trim() || !eventForm.date) return;
    setCreating(true);
    try {
      await api.createEvent({
        name: eventForm.name.trim(),
        description: eventForm.description.trim() || undefined,
        date: new Date(eventForm.date).toISOString(),
        location: eventForm.location.trim() || undefined,
        isVirtual: eventForm.isVirtual,
        maxCapacity: eventForm.maxCapacity ? parseInt(eventForm.maxCapacity) : undefined,
      });
      setShowCreate(false);
      setEventForm({ name: '', description: '', date: '', location: '', isVirtual: false, maxCapacity: '' });
    } catch (err: any) {
      console.error('Failed to create event:', err);
    }
    setCreating(false);
  };

  if (!data) return <p className="text-xs text-white/20 text-center py-8">Loading events...</p>;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-white/40 uppercase">Events</h4>
        <button onClick={() => setShowCreate(!showCreate)} className="text-[10px] px-2 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 transition font-medium">
          {showCreate ? 'Cancel' : '+ New Event'}
        </button>
      </div>

      {showCreate && (
        <div className="p-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5 space-y-2">
          <input value={eventForm.name} onChange={e => setEventForm(f => ({ ...f, name: e.target.value }))} placeholder="Event name *" className="w-full px-2 py-1.5 rounded-lg text-xs text-white bg-white/[0.06] border border-white/10 outline-none" />
          <textarea value={eventForm.description} onChange={e => setEventForm(f => ({ ...f, description: e.target.value }))} placeholder="Description" rows={2} className="w-full px-2 py-1.5 rounded-lg text-xs text-white bg-white/[0.06] border border-white/10 outline-none resize-none" />
          <input type="datetime-local" value={eventForm.date} onChange={e => setEventForm(f => ({ ...f, date: e.target.value }))} className="w-full px-2 py-1.5 rounded-lg text-xs text-white bg-white/[0.06] border border-white/10 outline-none" />
          <input value={eventForm.location} onChange={e => setEventForm(f => ({ ...f, location: e.target.value }))} placeholder="Location" className="w-full px-2 py-1.5 rounded-lg text-xs text-white bg-white/[0.06] border border-white/10 outline-none" />
          <div className="flex gap-2">
            <label className="flex items-center gap-1.5 text-[10px] text-white/40">
              <input type="checkbox" checked={eventForm.isVirtual} onChange={e => setEventForm(f => ({ ...f, isVirtual: e.target.checked }))} className="rounded" />
              Virtual
            </label>
            <input value={eventForm.maxCapacity} onChange={e => setEventForm(f => ({ ...f, maxCapacity: e.target.value }))} placeholder="Max capacity" type="number" className="flex-1 px-2 py-1 rounded-lg text-[10px] text-white bg-white/[0.06] border border-white/10 outline-none" />
          </div>
          <button onClick={handleCreate} disabled={creating || !eventForm.name.trim() || !eventForm.date} className="w-full py-1.5 rounded-lg text-xs font-medium bg-indigo-500 text-white hover:bg-indigo-400 disabled:opacity-50 transition">
            {creating ? 'Creating...' : 'Create Event'}
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Total" value={data.stats?.total || 0} icon="\u{1F4C5}" />
        <StatCard label="Upcoming" value={data.stats?.upcoming || 0} icon="\u{1F51C}" />
        <StatCard label="Active" value={data.stats?.active || 0} icon="\u{1F7E2}" />
        <StatCard label="Participants" value={data.stats?.totalParticipants || 0} icon="\u{1F465}" />
      </div>
      {data.events?.length > 0 && (
        <div>
          <h5 className="text-[10px] text-white/30 uppercase font-medium mb-2">Upcoming Events</h5>
          <div className="space-y-1.5">
            {data.events.slice(0, 5).map((event: any) => (
              <div key={event.id} className="text-xs p-2 rounded-lg bg-white/[0.02]">
                <div className="text-white/60 font-medium">{event.name}</div>
                <div className="text-white/20 mt-0.5">{new Date(event.date).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AnalyticsView({ data }: { data: any }) {
  const [ga4, setGa4] = useState<any>(null);
  const [instagram, setInstagram] = useState<any>(null);
  const [posthog, setPosthog] = useState<any>(null);
  const [sentry, setSentry] = useState<any>(null);
  const [digestLoading, setDigestLoading] = useState(false);
  const [digestSent, setDigestSent] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const loadSection = async (section: string) => {
    if (expandedSection === section) {
      setExpandedSection(null);
      return;
    }
    setExpandedSection(section);
    try {
      if (section === 'ga4' && !ga4) setGa4(await api.getAdminAnalyticsGA4());
      if (section === 'instagram' && !instagram) setInstagram(await api.getAdminAnalyticsInstagram());
      if (section === 'posthog' && !posthog) setPosthog(await api.getAdminAnalyticsPostHog());
      if (section === 'sentry' && !sentry) setSentry(await api.getAdminAnalyticsSentry());
    } catch {
    }
  };

  const handleSendDigest = async () => {
    setDigestLoading(true);
    try {
      await api.sendWeeklyDigest();
      setDigestSent(true);
      setTimeout(() => setDigestSent(false), 3000);
    } catch (err: any) {
      console.error('Failed to send digest:', err);
    }
    setDigestLoading(false);
  };

  if (!data) return <p className="text-xs text-white/20 text-center py-8">Loading analytics...</p>;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-white/40 uppercase">Analytics</h4>
        <button onClick={handleSendDigest} disabled={digestLoading} className="text-[10px] px-2 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 transition font-medium disabled:opacity-50">
          {digestSent ? 'Sent!' : digestLoading ? 'Sending...' : 'Send Digest'}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Total Users" value={data.totalUsers || 0} />
        <StatCard label="New Users" value={data.newUsers || 0} />
        <StatCard label="Matches" value={data.totalMatches || 0} />
        <StatCard label="Calls" value={data.totalCalls || 0} />
      </div>
      {data.personaBreakdown?.length > 0 && (
        <div>
          <h5 className="text-[10px] text-white/30 uppercase font-medium mb-2">Persona Breakdown</h5>
          <div className="space-y-1.5">
            {data.personaBreakdown.map((p: any, i: number) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-white/40">{p.persona}</span>
                <span className="text-white/20">{p.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {[
        { key: 'ga4', label: 'Google Analytics', data: ga4 },
        { key: 'instagram', label: 'Instagram', data: instagram },
        { key: 'posthog', label: 'PostHog', data: posthog },
        { key: 'sentry', label: 'Sentry Errors', data: sentry },
      ].map(section => (
        <div key={section.key} className="border border-white/[0.06] rounded-lg overflow-hidden">
          <button onClick={() => loadSection(section.key)} className="w-full flex items-center justify-between px-3 py-2 text-xs text-white/50 hover:bg-white/[0.02] transition">
            <span className="font-medium">{section.label}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform ${expandedSection === section.key ? 'rotate-180' : ''}`}>
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </button>
          {expandedSection === section.key && (
            <div className="px-3 py-2 border-t border-white/[0.06] text-xs">
              {section.data ? (
                <pre className="text-white/30 whitespace-pre-wrap break-words max-h-40 overflow-y-auto text-[10px]">{JSON.stringify(section.data, null, 2)}</pre>
              ) : (
                <p className="text-white/20 text-center py-2">Loading...</p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function WhatsAppView({ data }: { data: any }) {
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [pollingStopped, setPollingStopped] = useState(false);

  const loadDiagnostics = async () => {
    setDiagLoading(true);
    try {
      const res = await fetch('/api/admin/whatsapp/diagnostics', { credentials: 'include' });
      const json = await res.json();
      if (json.success) setDiagnostics(json.data);
    } catch {}
    setDiagLoading(false);
  };

  useEffect(() => { loadDiagnostics(); }, []);

  const pollStatusRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (pollStatusRef.current) clearInterval(pollStatusRef.current); };
  }, []);

  const refreshTestStatus = async (messageId: string) => {
    try {
      const res = await fetch(`/api/admin/whatsapp/test/status?messageId=${encodeURIComponent(messageId)}`, { credentials: 'include' });
      const json = await res.json();
      if (json.success && json.data?.status) {
        setTestResult((prev: any) => prev ? {
          ...prev,
          status: json.data.status,
          ...(json.data.errorMessage ? { errorMessage: json.data.errorMessage } : {}),
        } : prev);
      }
    } catch {}
  };

  const startStatusPolling = (messageId: string) => {
    if (pollStatusRef.current) clearInterval(pollStatusRef.current);
    setPollingStopped(false);
    let attempts = 0;
    pollStatusRef.current = setInterval(async () => {
      attempts++;
      if (attempts > 10) {
        if (pollStatusRef.current) clearInterval(pollStatusRef.current);
        setPollingStopped(true);
        return;
      }
      try {
        const res = await fetch(`/api/admin/whatsapp/test/status?messageId=${encodeURIComponent(messageId)}`, { credentials: 'include' });
        const json = await res.json();
        if (json.success && json.data?.status) {
          setTestResult((prev: any) => prev ? {
            ...prev,
            status: json.data.status,
            ...(json.data.errorMessage ? { errorMessage: json.data.errorMessage } : {}),
          } : prev);
          if (['DELIVERED', 'READ', 'FAILED'].includes(json.data.status)) {
            if (pollStatusRef.current) clearInterval(pollStatusRef.current);
          }
        }
      } catch {}
    }, 3000);
  };

  const sendTestMessage = async () => {
    if (!testPhone.trim() || testLoading) return;
    setTestLoading(true);
    setTestResult(null);
    setPollingStopped(false);
    if (pollStatusRef.current) clearInterval(pollStatusRef.current);
    try {
      const res = await fetch('/api/admin/whatsapp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phoneNumber: testPhone.trim() }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setTestResult(json.data);
        if (json.data.messageId && json.data.status !== 'FAILED') {
          startStatusPolling(json.data.messageId);
        }
      } else {
        const errMsg = json.data?.errorMessage || json.error?.message || 'Send failed';
        setTestResult({ status: json.data?.status || 'FAILED', errorMessage: errMsg });
      }
    } catch (err: any) {
      setTestResult({ status: 'FAILED', errorMessage: err.message || 'Network error' });
    }
    setTestLoading(false);
  };

  const healthColor = diagnostics?.health === 'healthy' ? 'bg-green-400' : diagnostics?.health === 'degraded' ? 'bg-yellow-400' : 'bg-red-400';
  const healthLabel = diagnostics?.health === 'healthy' ? 'Connected' : diagnostics?.health === 'degraded' ? 'Degraded' : 'Not Configured';

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-white/40 uppercase">Diagnostics</h4>
          <button
            onClick={loadDiagnostics}
            disabled={diagLoading}
            className="text-[10px] text-indigo-400 hover:text-indigo-300 transition disabled:opacity-50"
          >
            {diagLoading ? 'Checking...' : 'Refresh'}
          </button>
        </div>

        {diagnostics && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 p-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02]">
              <span className={`w-2.5 h-2.5 rounded-full ${healthColor} animate-pulse`} />
              <span className="text-xs font-medium text-white/70">{healthLabel}</span>
              {diagnostics.appName && (
                <span className="text-[10px] text-white/30 ml-auto">{diagnostics.appName}</span>
              )}
            </div>

            <div className="space-y-1">
              {Object.entries(diagnostics.config as Record<string, boolean>).map(([key, set]) => (
                <div key={key} className="flex items-center gap-2 text-[11px]">
                  <span className={`w-1.5 h-1.5 rounded-full ${set ? 'bg-green-400' : 'bg-red-400/60'}`} />
                  <span className="text-white/40">{key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</span>
                  <span className={`ml-auto text-[10px] ${set ? 'text-green-400/60' : 'text-red-400/60'}`}>{set ? 'Set' : 'Missing'}</span>
                </div>
              ))}
            </div>

            {diagnostics.apiReachable && (
              <div className="flex items-center gap-2 text-[11px] p-2 rounded-lg bg-green-500/[0.06]">
                <span className="text-green-400">API Reachable</span>
                {diagnostics.templateCount !== null && (
                  <span className="text-white/30 ml-auto">{diagnostics.templateCount} templates</span>
                )}
              </div>
            )}

            {diagnostics.apiError && (
              <div className="text-[11px] p-2 rounded-lg bg-red-500/[0.06] text-red-400/80">
                {diagnostics.apiError}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-white/40 uppercase">Send Test Message</h4>
        <div className="flex gap-1.5">
          <input
            type="text"
            value={testPhone}
            onChange={(e) => setTestPhone(e.target.value)}
            placeholder="+91 98765 43210"
            className="flex-1 px-3 py-2 rounded-lg text-xs text-white placeholder-white/20 outline-none focus:ring-1 focus:ring-indigo-500/50"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            onKeyDown={(e) => { if (e.key === 'Enter') sendTestMessage(); }}
          />
          <button
            onClick={sendTestMessage}
            disabled={testLoading || !testPhone.trim()}
            className="px-3 py-2 rounded-lg text-xs font-medium text-white transition disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #6366F1, #4ECDC4)' }}
          >
            {testLoading ? 'Sending...' : 'Send'}
          </button>
        </div>

        {testResult && (
          <div className={`text-[11px] p-2.5 rounded-lg space-y-1 ${testResult.status === 'FAILED' ? 'bg-red-500/[0.06]' : 'bg-green-500/[0.06]'}`}>
            <div className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${
                testResult.status === 'FAILED' ? 'bg-red-400' :
                testResult.status === 'DELIVERED' ? 'bg-green-400' :
                testResult.status === 'READ' ? 'bg-blue-400' :
                'bg-yellow-400'
              }`} />
              <span className={testResult.status === 'FAILED' ? 'text-red-400' : 'text-green-400'}>
                {testResult.status === 'DELIVERED' ? 'Delivered' :
                 testResult.status === 'READ' ? 'Read' :
                 testResult.status === 'SENT' ? 'Sent' :
                 testResult.status === 'QUEUED' ? 'Queued' :
                 testResult.status === 'FAILED' ? 'Failed' : testResult.status}
              </span>
            </div>
            {testResult.messageId && (
              <p className="text-white/30 truncate">ID: {testResult.messageId}</p>
            )}
            {testResult.errorMessage && (
              <p className="text-red-400/70">{testResult.errorMessage}</p>
            )}
            {testResult.sentAt && (
              <p className="text-white/20">{new Date(testResult.sentAt).toLocaleTimeString()}</p>
            )}
            {pollingStopped && testResult.messageId && !['DELIVERED', 'READ', 'FAILED'].includes(testResult.status) && (
              <button
                onClick={() => refreshTestStatus(testResult.messageId)}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 transition mt-1"
              >
                Refresh status
              </button>
            )}
          </div>
        )}
      </div>

      {data && (
        <div className="space-y-3 pt-2 border-t border-white/[0.06]">
          <h4 className="text-xs font-semibold text-white/40 uppercase">Activity</h4>
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Opted-In" value={data.stats?.optedInUsers || 0} icon={"\u2705"} />
            <StatCard label="Messages" value={data.stats?.totalMessages || 0} icon={"\uD83D\uDCAC"} />
            <StatCard label="Inbound" value={data.stats?.inboundCount || 0} icon={"\uD83D\uDCE5"} />
            <StatCard label="Active 24h" value={data.stats?.activeConversations || 0} icon={"\uD83D\uDFE2"} />
          </div>
          {data.messages?.length > 0 && (
            <div>
              <h5 className="text-[10px] text-white/30 uppercase font-medium mb-2">Recent Messages</h5>
              <div className="space-y-1.5">
                {data.messages.slice(0, 5).map((msg: any) => (
                  <div key={msg.id} className="text-xs p-2 rounded-lg bg-white/[0.02]">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${msg.content?.startsWith('[INBOUND]') ? 'bg-indigo-400' : 'bg-green-400'}`} />
                      <span className="text-white/50 truncate">{msg.user?.name || msg.recipientPhone}</span>
                    </div>
                    <p className="text-white/30 truncate mt-0.5">{msg.content?.replace('[INBOUND] ', '').substring(0, 80)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {!data && (
        <p className="text-xs text-white/20 text-center py-4">Loading activity...</p>
      )}
    </div>
  );
}
