'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Brain, Target, BarChart3, Clock, AlertCircle, CheckCircle,
  X, Loader, Shield, Zap, MessageSquare, ThumbsUp, ThumbsDown,
  Pause, Play, ChevronDown, ChevronUp, Plus, RefreshCw, Inbox,
  FileText, AlertTriangle, History, Sparkles, Octagon, Send,
  ShieldAlert
} from 'lucide-react';
import { api } from '@/lib/api';

interface Decision {
  id: number;
  title: string;
  context: string;
  options: string[];
  requesting_agent: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'approved' | 'rejected' | 'deferred';
  chosen_option: string | null;
  outcome: string | null;
  founder_notes: string | null;
  created_at: string;
  decided_at: string | null;
}

interface DebateEntry {
  id: number;
  decision_id: number;
  agent_id: string;
  agent_name: string;
  position: 'for' | 'against' | 'neutral';
  argument: string;
  data_points: Record<string, any>;
  created_at: string;
}

interface DailyBriefing {
  date: string;
  metrics: {
    totalUsers: number;
    completedProfiles: number;
    totalMatches: number;
    acceptedMatches: number;
    matchAcceptRate: number;
    recentSignups: number;
  };
  agentActivity: any[];
  pendingDecisions: Decision[];
  pendingContent: any[];
  priorityItems: any[];
  actionList: string[];
}

interface PriorityInbox {
  pendingDecisions: Decision[];
  pendingContent: any[];
  agentErrors: any[];
  criticalAlerts: any[];
  totalCount: number;
}

interface CrisisModeState {
  active: boolean;
  activatedAt: string | null;
  activatedBy: string | null;
  reason: string | null;
}

type FounderTab = 'briefing' | 'decisions' | 'inbox' | 'history' | 'safety';

const AGENT_CONFIG: Record<string, { name: string; emoji: string; color: string }> = {
  nexus: { name: 'Nexus', emoji: '🧠', color: 'purple' },
  maven: { name: 'Maven', emoji: '🎯', color: 'indigo' },
  ledger: { name: 'Ledger', emoji: '📊', color: 'amber' },
  sentinel: { name: 'Sentinel', emoji: '🛡️', color: 'cyan' },
  ally: { name: 'Ally', emoji: '💬', color: 'green' },
  catalyst: { name: 'Catalyst', emoji: '🚀', color: 'emerald' },
  closer: { name: 'Closer', emoji: '🤝', color: 'rose' },
  scout: { name: 'Scout', emoji: '🔍', color: 'teal' },
};

const URGENCY_STYLES: Record<string, string> = {
  low: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  medium: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  high: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  critical: 'bg-red-500/20 text-red-300 border-red-500/30',
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  approved: 'bg-green-500/20 text-green-300 border-green-500/30',
  rejected: 'bg-red-500/20 text-red-300 border-red-500/30',
  deferred: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
};

const POSITION_STYLES: Record<string, { bg: string; label: string; icon: React.ReactNode }> = {
  for: { bg: 'border-green-500/30 bg-green-500/5', label: 'In Favor', icon: <ThumbsUp size={14} className="text-green-400" /> },
  against: { bg: 'border-red-500/30 bg-red-500/5', label: 'Against', icon: <ThumbsDown size={14} className="text-red-400" /> },
  neutral: { bg: 'border-blue-500/30 bg-blue-500/5', label: 'Neutral', icon: <BarChart3 size={14} className="text-blue-400" /> },
};

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-8">
      <Loader className="animate-spin text-brand-violet" size={32} />
    </div>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-slate-800/50 border border-brand-violet/10 rounded-xl p-4">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

function DecisionCard({
  decision,
  onAction,
  onSimulate,
  showActions,
}: {
  decision: Decision;
  onAction: (id: number, status: 'approved' | 'rejected' | 'deferred', chosenOption?: string, notes?: string) => void;
  onSimulate: (id: number) => void;
  showActions: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState('');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const agent = AGENT_CONFIG[decision.requesting_agent] || { name: decision.requesting_agent, emoji: '🤖', color: 'slate' };

  return (
    <div className="border border-brand-violet/15 rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-xl">{agent.emoji}</span>
            <div>
              <h4 className="font-semibold text-white text-sm">{decision.title}</h4>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-slate-400">{agent.name}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${URGENCY_STYLES[decision.urgency]}`}>
                  {decision.urgency}
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${STATUS_STYLES[decision.status]}`}>
                  {decision.status}
                </span>
              </div>
            </div>
          </div>
          <button onClick={() => setExpanded(!expanded)} className="text-slate-400 hover:text-white transition">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {decision.context && (
          <p className="text-sm text-slate-300 mb-3 line-clamp-2">{decision.context}</p>
        )}

        {expanded && (
          <div className="space-y-3 mt-4">
            {decision.options && decision.options.length > 0 && (
              <div>
                <div className="text-xs text-slate-400 mb-2 font-medium">Options</div>
                <div className="space-y-1.5">
                  {decision.options.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => showActions && setSelectedOption(opt)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition ${
                        selectedOption === opt
                          ? 'border-brand-violet bg-brand-violet/10 text-white'
                          : 'border-slate-700 bg-slate-800/30 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {showActions && (
              <div>
                <div className="text-xs text-slate-400 mb-2 font-medium">Notes (optional)</div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add your reasoning..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-brand-violet/20 bg-slate-800/50 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-violet resize-none"
                />
              </div>
            )}

            {decision.chosen_option && (
              <div className="text-sm">
                <span className="text-slate-400">Chosen: </span>
                <span className="text-white">{decision.chosen_option}</span>
              </div>
            )}

            {decision.founder_notes && (
              <div className="text-sm">
                <span className="text-slate-400">Notes: </span>
                <span className="text-slate-300">{decision.founder_notes}</span>
              </div>
            )}

            {decision.outcome && (
              <div className="text-sm bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                <span className="text-green-400 font-medium">Outcome: </span>
                <span className="text-green-200">{decision.outcome}</span>
              </div>
            )}
          </div>
        )}

        <div className="text-xs text-slate-500 mt-3">
          {new Date(decision.created_at).toLocaleString()}
          {decision.decided_at && ` · Decided ${new Date(decision.decided_at).toLocaleString()}`}
        </div>
      </div>

      {showActions && decision.status === 'pending' && (
        <div className="flex border-t border-brand-violet/10">
          <button
            onClick={() => onAction(decision.id, 'approved', selectedOption || undefined, notes || undefined)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium text-green-400 hover:bg-green-500/10 transition"
          >
            <CheckCircle size={14} /> Approve
          </button>
          <button
            onClick={() => onAction(decision.id, 'rejected', undefined, notes || undefined)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/10 transition border-x border-brand-violet/10"
          >
            <X size={14} /> Reject
          </button>
          <button
            onClick={() => onAction(decision.id, 'deferred', undefined, notes || undefined)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-slate-500/10 transition border-r border-brand-violet/10"
          >
            <Pause size={14} /> Defer
          </button>
          <button
            onClick={() => onSimulate(decision.id)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium text-purple-400 hover:bg-purple-500/10 transition"
          >
            <Sparkles size={14} /> Simulate
          </button>
        </div>
      )}
    </div>
  );
}

function DebateView({
  entries,
  loading,
  onClose,
}: {
  entries: DebateEntry[];
  loading: boolean;
  onClose: () => void;
}) {
  if (loading) {
    return (
      <div className="border border-purple-500/20 rounded-xl bg-purple-500/5 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Sparkles className="text-purple-400 animate-pulse" size={20} />
          <h4 className="font-semibold text-white">AI Debate in Progress...</h4>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader className="animate-spin text-purple-400" size={28} />
          <span className="ml-3 text-purple-300 text-sm">Agents are analyzing and forming perspectives...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-purple-500/20 rounded-xl bg-purple-500/5 overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-purple-500/10">
        <div className="flex items-center gap-2">
          <Sparkles className="text-purple-400" size={18} />
          <h4 className="font-semibold text-white text-sm">AI Debate — {entries.length} Agent Perspectives</h4>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition">
          <X size={16} />
        </button>
      </div>
      <div className="p-4 space-y-4">
        {entries.map((entry) => {
          const agent = AGENT_CONFIG[entry.agent_id] || { name: entry.agent_name, emoji: '🤖', color: 'slate' };
          const posStyle = POSITION_STYLES[entry.position] || POSITION_STYLES.neutral;

          return (
            <div key={entry.id} className={`border rounded-xl p-4 ${posStyle.bg}`}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{agent.emoji}</span>
                <span className="font-medium text-white text-sm">{agent.name}</span>
                <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border border-current/30">
                  {posStyle.icon}
                  <span className="ml-0.5">{posStyle.label}</span>
                </span>
              </div>
              <p className="text-sm text-slate-300 whitespace-pre-wrap">{entry.argument}</p>
              {entry.data_points && Object.keys(entry.data_points).length > 0 && (
                <div className="mt-3 bg-black/20 rounded-lg p-3">
                  <div className="text-[10px] text-slate-400 font-medium mb-2 uppercase">Data Points</div>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(entry.data_points).map(([key, value]) => (
                      <div key={key} className="text-xs">
                        <span className="text-slate-400">{key.replace(/_/g, ' ')}: </span>
                        <span className="text-white">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BriefingView({ briefing, loading, onGenerate }: {
  briefing: DailyBriefing | null;
  loading: boolean;
  onGenerate: () => void;
}) {
  if (loading) return <LoadingSpinner />;

  if (!briefing) {
    return (
      <div className="text-center py-12">
        <Brain className="mx-auto text-brand-violet mb-4" size={48} />
        <h3 className="text-white font-semibold text-lg mb-2">No Briefing Yet</h3>
        <p className="text-slate-400 text-sm mb-6">Generate your daily briefing to see key metrics, agent activity, and action items.</p>
        <button
          onClick={onGenerate}
          className="px-6 py-2.5 rounded-xl bg-brand-violet text-white font-medium text-sm hover:bg-brand-violet/80 transition flex items-center gap-2 mx-auto"
        >
          <Sparkles size={16} /> Generate Briefing
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-semibold text-lg flex items-center gap-2">
            <Brain className="text-brand-violet" size={20} />
            Daily Briefing
          </h3>
          <p className="text-slate-400 text-sm mt-1">{new Date(briefing.date).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <button
          onClick={onGenerate}
          className="px-4 py-2 rounded-xl border border-brand-violet/20 text-sm font-medium text-slate-300 hover:text-white hover:border-brand-violet/40 transition flex items-center gap-2"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard label="Total Users" value={briefing.metrics.totalUsers} />
        <MetricCard label="Profiles Done" value={briefing.metrics.completedProfiles} />
        <MetricCard label="Total Matches" value={briefing.metrics.totalMatches} />
        <MetricCard label="Accepted" value={briefing.metrics.acceptedMatches} />
        <MetricCard label="Accept Rate" value={`${briefing.metrics.matchAcceptRate}%`} />
        <MetricCard label="New Signups (24h)" value={briefing.metrics.recentSignups} />
      </div>

      {briefing.actionList.length > 0 && (
        <div className="bg-gradient-to-br from-brand-violet/10 to-purple-500/5 border border-brand-violet/20 rounded-xl p-5">
          <h4 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
            <Target size={16} className="text-brand-violet" /> Today&apos;s Action List
          </h4>
          <ul className="space-y-2">
            {briefing.actionList.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                <span className="text-brand-violet mt-0.5">•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {briefing.priorityItems.length > 0 && (
        <div>
          <h4 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-400" /> Priority Items
          </h4>
          <div className="space-y-2">
            {briefing.priorityItems.map((item: any, i: number) => (
              <div key={i} className="flex items-center gap-3 bg-slate-800/50 border border-brand-violet/10 rounded-lg p-3">
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${URGENCY_STYLES[item.urgency]}`}>
                  {item.urgency}
                </span>
                <span className="text-xs text-slate-400 uppercase">{item.type.replace(/_/g, ' ')}</span>
                <span className="text-sm text-white flex-1">{item.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {briefing.agentActivity.length > 0 && (
        <div>
          <h4 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
            <Zap size={16} className="text-emerald-400" /> Agent Activity (24h)
          </h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {briefing.agentActivity.slice(0, 10).map((log: any, i: number) => {
              const agent = AGENT_CONFIG[log.agent_id] || { emoji: '🤖', name: log.agent_id };
              return (
                <div key={i} className="flex items-center gap-3 text-sm bg-slate-800/30 rounded-lg p-2.5">
                  <span>{agent.emoji}</span>
                  <span className="text-slate-300 flex-1">{log.action}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] ${
                    log.status === 'success' ? 'bg-green-500/20 text-green-300' :
                    log.status === 'error' ? 'bg-red-500/20 text-red-300' :
                    'bg-slate-500/20 text-slate-300'
                  }`}>{log.status}</span>
                  <span className="text-xs text-slate-500">{new Date(log.created_at).toLocaleTimeString()}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function InboxView({ inbox, loading, onAction, onSimulate, onRefresh }: {
  inbox: PriorityInbox | null;
  loading: boolean;
  onAction: (id: number, status: 'approved' | 'rejected' | 'deferred', chosenOption?: string, notes?: string) => void;
  onSimulate: (id: number) => void;
  onRefresh: () => void;
}) {
  if (loading) return <LoadingSpinner />;
  if (!inbox) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-semibold text-lg flex items-center gap-2">
            <Inbox className="text-brand-violet" size={20} />
            Priority Inbox
            {inbox.totalCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{inbox.totalCount}</span>
            )}
          </h3>
          <p className="text-slate-400 text-sm mt-1">Items requiring your attention, sorted by urgency</p>
        </div>
        <button onClick={onRefresh} className="px-4 py-2 rounded-xl border border-brand-violet/20 text-sm font-medium text-slate-300 hover:text-white transition flex items-center gap-2">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {inbox.criticalAlerts.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <h4 className="text-red-300 font-semibold text-sm mb-2 flex items-center gap-2">
            <AlertCircle size={16} /> Critical Alerts
          </h4>
          {inbox.criticalAlerts.map((alert: any, i: number) => (
            <div key={i} className="text-sm text-red-200 py-1">{alert.title}</div>
          ))}
        </div>
      )}

      {inbox.pendingDecisions.length > 0 && (
        <div>
          <h4 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
            <Shield size={16} className="text-amber-400" /> Pending Decisions ({inbox.pendingDecisions.length})
          </h4>
          <div className="space-y-3">
            {inbox.pendingDecisions.map((d) => (
              <DecisionCard key={d.id} decision={d} onAction={onAction} onSimulate={onSimulate} showActions={true} />
            ))}
          </div>
        </div>
      )}

      {inbox.pendingContent.length > 0 && (
        <div>
          <h4 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
            <FileText size={16} className="text-blue-400" /> Pending Content ({inbox.pendingContent.length})
          </h4>
          <div className="space-y-2">
            {inbox.pendingContent.map((item: any) => {
              const agent = AGENT_CONFIG[item.agent_id] || { emoji: '🤖', name: item.agent_id };
              return (
                <div key={item.id} className="border border-brand-violet/10 rounded-xl p-4 bg-slate-800/30">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span>{agent.emoji}</span>
                      <div>
                        <div className="text-sm font-medium text-white">{item.title}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{item.channel} · {item.content_type}</div>
                      </div>
                    </div>
                    <span className="text-xs text-slate-500">{new Date(item.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {inbox.agentErrors.length > 0 && (
        <div>
          <h4 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-400" /> Agent Errors ({inbox.agentErrors.length})
          </h4>
          <div className="space-y-2">
            {inbox.agentErrors.map((err: any, i: number) => {
              const agent = AGENT_CONFIG[err.agent_id] || { emoji: '🤖', name: err.agent_id };
              return (
                <div key={i} className="border border-red-500/20 rounded-lg p-3 bg-red-500/5">
                  <div className="flex items-center gap-2">
                    <span>{agent.emoji}</span>
                    <span className="text-sm text-red-300">{err.action}</span>
                    <span className="text-xs text-slate-500 ml-auto">{new Date(err.created_at).toLocaleTimeString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {inbox.totalCount === 0 && (
        <div className="text-center py-12 text-slate-400">
          <CheckCircle className="mx-auto mb-3 text-green-400" size={40} />
          <p className="font-medium text-white">All Clear</p>
          <p className="text-sm mt-1">No items need your attention right now.</p>
        </div>
      )}
    </div>
  );
}

function SafetyPanel({ crisisMode, onRefresh, loading }: {
  crisisMode: CrisisModeState | null;
  onRefresh: () => void;
  loading: boolean;
}) {
  const [activating, setActivating] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [reason, setReason] = useState('');
  const [sendingDigest, setSendingDigest] = useState(false);
  const [sendingReport, setSendingReport] = useState(false);

  const handleActivate = async () => {
    if (!reason.trim()) return;
    setActivating(true);
    try {
      await api.activateCrisisMode(reason);
      setReason('');
      onRefresh();
    } catch (err: any) {
      console.error('Failed to activate crisis mode:', err);
    }
    setActivating(false);
  };

  const handleDeactivate = async () => {
    setDeactivating(true);
    try {
      await api.deactivateCrisisMode();
      onRefresh();
    } catch (err: any) {
      console.error('Failed to deactivate crisis mode:', err);
    }
    setDeactivating(false);
  };

  const handleSendDigest = async () => {
    setSendingDigest(true);
    try {
      await api.sendAuditDigest();
    } catch (err: any) {
      console.error('Failed to send audit digest:', err);
    }
    setSendingDigest(false);
  };

  const handleSendReport = async () => {
    setSendingReport(true);
    try {
      await api.sendWeeklyReport();
    } catch (err: any) {
      console.error('Failed to send weekly report:', err);
    }
    setSendingReport(false);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold text-lg flex items-center gap-2">
          <ShieldAlert className="text-red-400" size={20} />
          Safety & Crisis Mode
        </h3>
        <button onClick={onRefresh} className="text-slate-400 hover:text-white transition">
          <RefreshCw size={16} />
        </button>
      </div>

      <div className={`border rounded-xl p-5 ${
        crisisMode?.active
          ? 'border-red-500/30 bg-red-500/10'
          : 'border-green-500/30 bg-green-500/5'
      }`}>
        <div className="flex items-center gap-3 mb-3">
          {crisisMode?.active ? (
            <Octagon className="text-red-400" size={24} />
          ) : (
            <CheckCircle className="text-green-400" size={24} />
          )}
          <div>
            <h4 className="font-semibold text-white">
              {crisisMode?.active ? 'Crisis Mode ACTIVE' : 'Normal Operations'}
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              {crisisMode?.active
                ? 'All autonomous agent activity is paused'
                : 'Agents are operating normally within guardrails'}
            </p>
          </div>
        </div>

        {crisisMode?.active && (
          <div className="text-sm text-slate-300 space-y-1 mt-3 mb-4 bg-black/20 rounded-lg p-3">
            <div><span className="text-slate-400">Activated by:</span> {crisisMode.activatedBy}</div>
            <div><span className="text-slate-400">Reason:</span> {crisisMode.reason}</div>
            <div><span className="text-slate-400">Since:</span> {crisisMode.activatedAt ? new Date(crisisMode.activatedAt).toLocaleString() : 'Unknown'}</div>
          </div>
        )}

        {crisisMode?.active ? (
          <button
            onClick={handleDeactivate}
            disabled={deactivating}
            className="w-full py-2.5 rounded-xl bg-green-600 text-white font-medium text-sm hover:bg-green-500 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Play size={14} />
            {deactivating ? 'Resuming...' : 'Deactivate Crisis Mode & Resume Operations'}
          </button>
        ) : (
          <div className="space-y-3 mt-4">
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for activating crisis mode..."
              className="w-full px-3 py-2.5 rounded-xl border border-red-500/20 bg-slate-800/50 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <button
              onClick={handleActivate}
              disabled={activating || !reason.trim()}
              className="w-full py-2.5 rounded-xl bg-red-600 text-white font-medium text-sm hover:bg-red-500 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Octagon size={14} />
              {activating ? 'Activating...' : 'Activate Crisis Mode'}
            </button>
          </div>
        )}
      </div>

      <div className="border border-brand-violet/15 rounded-xl p-5 bg-slate-800/30">
        <h4 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
          <Send size={14} className="text-brand-violet" />
          Manual Triggers
        </h4>
        <div className="space-y-3">
          <button
            onClick={handleSendDigest}
            disabled={sendingDigest}
            className="w-full py-2.5 rounded-xl border border-brand-violet/20 text-sm font-medium text-slate-300 hover:text-white hover:border-brand-violet/40 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <BarChart3 size={14} />
            {sendingDigest ? 'Sending...' : 'Send Daily Audit Digest Now'}
          </button>
          <button
            onClick={handleSendReport}
            disabled={sendingReport}
            className="w-full py-2.5 rounded-xl border border-brand-violet/20 text-sm font-medium text-slate-300 hover:text-white hover:border-brand-violet/40 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <FileText size={14} />
            {sendingReport ? 'Sending...' : 'Send Weekly Performance Report Now'}
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-3">
          Daily digest runs automatically at 10 PM IST. Weekly report runs every Monday at 7 AM IST.
        </p>
      </div>

      <div className="border border-brand-violet/15 rounded-xl p-5 bg-slate-800/30">
        <h4 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
          <Clock size={14} className="text-amber-400" />
          Auto-Escalation Rules
        </h4>
        <div className="space-y-2 text-sm text-slate-300">
          <div className="flex items-start gap-2">
            <span className="text-amber-400 mt-0.5">1.</span>
            <span>Pending decisions trigger a Slack notification immediately</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-orange-400 mt-0.5">2.</span>
            <span>After 2 hours with no response, an escalation reminder is sent</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-red-400 mt-0.5">3.</span>
            <span>After 4 hours with no response, the action is auto-cancelled</span>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-3">Escalation checks run every 30 minutes.</p>
      </div>
    </div>
  );
}

export function FounderMode() {
  const [activeTab, setActiveTab] = useState<FounderTab>('briefing');
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [decisionsLoading, setDecisionsLoading] = useState(false);
  const [historyDecisions, setHistoryDecisions] = useState<Decision[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [inbox, setInbox] = useState<PriorityInbox | null>(null);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [debateEntries, setDebateEntries] = useState<Record<number, DebateEntry[]>>({});
  const [debateLoading, setDebateLoading] = useState<number | null>(null);
  const [activeDebate, setActiveDebate] = useState<number | null>(null);
  const [showCreateDecision, setShowCreateDecision] = useState(false);
  const [newDecision, setNewDecision] = useState({ title: '', context: '', options: '', requesting_agent: 'nexus', urgency: 'medium' });
  const [createLoading, setCreateLoading] = useState(false);
  const [inboxCount, setInboxCount] = useState(0);
  const [crisisMode, setCrisisMode] = useState<CrisisModeState | null>(null);
  const [crisisLoading, setCrisisLoading] = useState(false);

  const loadCrisisMode = useCallback(async () => {
    setCrisisLoading(true);
    try {
      const data = await api.getCrisisModeStatus();
      setCrisisMode(data);
    } catch (err) {
      console.error('Failed to load crisis mode status:', err);
    } finally {
      setCrisisLoading(false);
    }
  }, []);

  const loadBriefing = useCallback(async () => {
    setBriefingLoading(true);
    try {
      const data = await api.getFounderBriefing();
      if (data?.content) {
        setBriefing(data.content);
      }
    } catch (err) {
      console.error('Failed to load briefing:', err);
    } finally {
      setBriefingLoading(false);
    }
  }, []);

  const generateBriefing = useCallback(async () => {
    setBriefingLoading(true);
    try {
      const data = await api.generateFounderBriefing();
      if (data) {
        setBriefing(data);
      }
    } catch (err) {
      console.error('Failed to generate briefing:', err);
    } finally {
      setBriefingLoading(false);
    }
  }, []);

  const loadDecisions = useCallback(async () => {
    setDecisionsLoading(true);
    try {
      const data = await api.getFounderDecisions({ status: 'pending' });
      setDecisions(data || []);
    } catch (err) {
      console.error('Failed to load decisions:', err);
    } finally {
      setDecisionsLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const all: Decision[] = await api.getFounderDecisions({ limit: 100 }) || [];
      setHistoryDecisions(all.filter(d => d.status !== 'pending'));
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const loadInbox = useCallback(async () => {
    setInboxLoading(true);
    try {
      const data = await api.getFounderPriorityInbox();
      setInbox(data);
      setInboxCount(data?.totalCount || 0);
    } catch (err) {
      console.error('Failed to load inbox:', err);
    } finally {
      setInboxLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBriefing();
    loadInbox();
    loadCrisisMode();
  }, []);

  useEffect(() => {
    if (activeTab === 'decisions') loadDecisions();
    if (activeTab === 'history') loadHistory();
    if (activeTab === 'inbox') loadInbox();
    if (activeTab === 'safety') loadCrisisMode();
  }, [activeTab]);

  const handleDecisionAction = useCallback(async (
    id: number,
    status: 'approved' | 'rejected' | 'deferred',
    chosenOption?: string,
    notes?: string
  ) => {
    try {
      await api.updateFounderDecision(id, { status, chosen_option: chosenOption, founder_notes: notes });
      setDecisions(prev => prev.filter(d => d.id !== id));
      setInboxCount(prev => Math.max(0, prev - 1));
      if (inbox) {
        setInbox({
          ...inbox,
          pendingDecisions: inbox.pendingDecisions.filter(d => d.id !== id),
          totalCount: Math.max(0, inbox.totalCount - 1),
        });
      }
    } catch (err) {
      console.error('Failed to update decision:', err);
    }
  }, [inbox]);

  const handleSimulate = useCallback(async (id: number) => {
    setDebateLoading(id);
    setActiveDebate(id);
    try {
      const data = await api.triggerFounderDebate(id);
      setDebateEntries(prev => ({ ...prev, [id]: data || [] }));
    } catch (err) {
      console.error('Failed to trigger debate:', err);
      try {
        const existing = await api.getFounderDebateEntries(id);
        if (existing?.length > 0) {
          setDebateEntries(prev => ({ ...prev, [id]: existing }));
        }
      } catch {}
    } finally {
      setDebateLoading(null);
    }
  }, []);

  const handleCreateDecision = useCallback(async () => {
    if (!newDecision.title.trim()) return;
    setCreateLoading(true);
    try {
      const options = newDecision.options.split('\n').map(o => o.trim()).filter(Boolean);
      await api.createFounderDecision({
        title: newDecision.title,
        context: newDecision.context,
        options,
        requesting_agent: newDecision.requesting_agent,
        urgency: newDecision.urgency,
      });
      setNewDecision({ title: '', context: '', options: '', requesting_agent: 'nexus', urgency: 'medium' });
      setShowCreateDecision(false);
      loadDecisions();
      loadInbox();
    } catch (err) {
      console.error('Failed to create decision:', err);
    } finally {
      setCreateLoading(false);
    }
  }, [newDecision, loadDecisions, loadInbox]);

  const tabs: { id: FounderTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'briefing', label: 'Daily Briefing', icon: <Brain size={16} /> },
    { id: 'decisions', label: 'Decisions', icon: <Shield size={16} /> },
    { id: 'inbox', label: 'Priority Inbox', icon: <Inbox size={16} />, badge: inboxCount },
    { id: 'history', label: 'Decision Log', icon: <History size={16} /> },
    { id: 'safety', label: 'Safety', icon: <ShieldAlert size={16} />, badge: crisisMode?.active ? 1 : undefined },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-3">
            <div className="bg-gradient-to-br from-brand-violet to-purple-600 p-2 rounded-xl">
              <Sparkles size={20} className="text-white" />
            </div>
            Founder Mode
          </h2>
          <p className="text-slate-400 text-sm mt-1">Your strategic command center — daily briefings, decisions, and action items</p>
        </div>
        <button
          onClick={() => setShowCreateDecision(true)}
          className="px-4 py-2 rounded-xl bg-brand-violet text-white text-sm font-medium hover:bg-brand-violet/80 transition flex items-center gap-2"
        >
          <Plus size={14} /> New Decision
        </button>
      </div>

      <div className="flex gap-1 p-1 rounded-xl bg-brand-violet-pressed/20 border border-brand-violet/10">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-brand-violet text-white shadow-lg shadow-brand-violet/20'
                : 'text-slate-400 hover:text-white/60'
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'briefing' && (
        <BriefingView briefing={briefing} loading={briefingLoading} onGenerate={generateBriefing} />
      )}

      {activeTab === 'decisions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-semibold text-lg flex items-center gap-2">
              <Shield className="text-amber-400" size={20} />
              Pending Decisions ({decisions.length})
            </h3>
            <button onClick={loadDecisions} className="text-slate-400 hover:text-white transition">
              <RefreshCw size={16} />
            </button>
          </div>

          {decisionsLoading ? <LoadingSpinner /> : (
            <>
              {decisions.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <CheckCircle className="mx-auto mb-3 text-green-400" size={40} />
                  <p className="font-medium text-white">No Pending Decisions</p>
                  <p className="text-sm mt-1">All decisions have been addressed.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {decisions.map((d) => (
                    <div key={d.id} className="space-y-3">
                      <DecisionCard
                        decision={d}
                        onAction={handleDecisionAction}
                        onSimulate={handleSimulate}
                        showActions={true}
                      />
                      {activeDebate === d.id && (
                        <DebateView
                          entries={debateEntries[d.id] || []}
                          loading={debateLoading === d.id}
                          onClose={() => setActiveDebate(null)}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'inbox' && (
        <InboxView
          inbox={inbox}
          loading={inboxLoading}
          onAction={handleDecisionAction}
          onSimulate={handleSimulate}
          onRefresh={loadInbox}
        />
      )}

      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-semibold text-lg flex items-center gap-2">
              <History className="text-slate-400" size={20} />
              Decision Log
            </h3>
            <button onClick={loadHistory} className="text-slate-400 hover:text-white transition">
              <RefreshCw size={16} />
            </button>
          </div>

          {historyLoading ? <LoadingSpinner /> : (
            <>
              {historyDecisions.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <History className="mx-auto mb-3 text-slate-500" size={40} />
                  <p className="font-medium text-white">No Decision History</p>
                  <p className="text-sm mt-1">Decisions you make will appear here.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {historyDecisions.map((d) => (
                    <DecisionCard
                      key={d.id}
                      decision={d}
                      onAction={handleDecisionAction}
                      onSimulate={handleSimulate}
                      showActions={false}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'safety' && (
        <SafetyPanel crisisMode={crisisMode} onRefresh={loadCrisisMode} loading={crisisLoading} />
      )}

      {showCreateDecision && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[rgba(8,13,26,0.95)] border border-brand-violet/20 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-semibold text-lg">Create Decision</h3>
              <button onClick={() => setShowCreateDecision(false)} className="text-slate-400 hover:text-white transition">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 uppercase mb-1.5">Title</label>
                <input
                  value={newDecision.title}
                  onChange={(e) => setNewDecision(p => ({ ...p, title: e.target.value }))}
                  placeholder="e.g., Launch LinkedIn campaign targeting Series A founders"
                  className="w-full px-3 py-2.5 rounded-xl border border-brand-violet/20 bg-slate-800/50 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-violet"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 uppercase mb-1.5">Context</label>
                <textarea
                  value={newDecision.context}
                  onChange={(e) => setNewDecision(p => ({ ...p, context: e.target.value }))}
                  placeholder="Describe the context and background..."
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-brand-violet/20 bg-slate-800/50 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-violet resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 uppercase mb-1.5">Options (one per line)</label>
                <textarea
                  value={newDecision.options}
                  onChange={(e) => setNewDecision(p => ({ ...p, options: e.target.value }))}
                  placeholder="Option A&#10;Option B&#10;Option C"
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-brand-violet/20 bg-slate-800/50 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-violet resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 uppercase mb-1.5">Requesting Agent</label>
                  <select
                    value={newDecision.requesting_agent}
                    onChange={(e) => setNewDecision(p => ({ ...p, requesting_agent: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-brand-violet/20 bg-slate-800/50 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-violet cursor-pointer"
                  >
                    {Object.entries(AGENT_CONFIG).map(([id, cfg]) => (
                      <option key={id} value={id}>{cfg.emoji} {cfg.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 uppercase mb-1.5">Urgency</label>
                  <select
                    value={newDecision.urgency}
                    onChange={(e) => setNewDecision(p => ({ ...p, urgency: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-brand-violet/20 bg-slate-800/50 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-violet cursor-pointer"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateDecision(false)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 border border-brand-violet/20 hover:text-white/60 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateDecision}
                disabled={createLoading || !newDecision.title.trim()}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-brand-violet text-white hover:bg-brand-violet/80 transition disabled:opacity-40"
              >
                {createLoading ? 'Creating...' : 'Create Decision'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
