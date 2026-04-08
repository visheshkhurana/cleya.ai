'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Hash, MessageSquare, Bell, Search, Send, Plus, Settings,
  ChevronDown, Circle, AlertTriangle, CheckCircle2, Clock,
  Bot, User, Zap, BarChart3, Target, Mail, Globe, Brain,
  Lightbulb, Share2, TrendingUp, DollarSign, Users, ArrowRight,
  Command, Filter, Pin, Bookmark, MoreHorizontal, Smile,
  AtSign, Paperclip, Mic, ChevronRight, Activity, Star,
  Layout, ListTodo, RefreshCw
} from 'lucide-react';

// === TYPES ===
interface Agent {
  id: string;
  name: string;
  role: string;
  description: string;
  status: 'active' | 'idle' | 'error' | 'running';
  color: string;
  icon: string;
  tools: string[];
  schedule?: string;
  last_run_at?: string;
}

interface AgentLog {
  id: number;
  agent_id: string;
  action: string;
  details: Record<string, any>;
  status: string;
  created_at: string;
}

interface AgentTask {
  id: number;
  agent_id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
}

interface Channel {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  unread: number;
  type: 'channel' | 'agent' | 'system';
  agentId?: string;
}

interface ChatMessage {
  id: string;
  sender: string;
  senderType: 'agent' | 'system' | 'user';
  avatar: string;
  content: string;
  timestamp: string;
  channel: string;
  details?: Record<string, any>;
  alerts?: string[];
  tasks?: string[];
}

// === CONFIG ===
const SUPABASE_URL = 'https://kocvqzcxycwzoftcsxch.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvY3ZxemN4eWN3em9mdGNzeGNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2MjU1MTksImV4cCI6MjA5MTIwMTUxOX0.a5RQvI1rCQQI7mO8jyxWzn7yhZ49ZCbeTGlLcVWTfQ0';

const supabaseHeaders = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

const AGENT_EMOJIS: Record<string, string> = {
  'orchestrator': '🧠',
  'content-strategist': '💡',
  'social-media': '📱',
  'email-marketing': '✉️',
  'cold-outreach': '🎯',
  'seo-geo': '🌐',
  'paid-ads': '⚡',
  'analytics': '📊',
  'cleya-marketing': '🎨',
  'cleya-growth': '🚀',
  'cleya-finance': '💰',
  'cleya-sales': '🤝',
};

const AGENT_DISPLAY_NAMES: Record<string, string> = {
  'orchestrator': 'Nexus',
  'content-strategist': 'Content Strategist',
  'social-media': 'Social Media',
  'email-marketing': 'Email Marketing',
  'cold-outreach': 'Cold Outreach',
  'seo-geo': 'SEO/GEO',
  'paid-ads': 'Paid Ads',
  'analytics': 'Analytics',
  'cleya-marketing': 'Mira',
  'cleya-growth': 'Vega',
  'cleya-finance': 'Arjun',
  'cleya-sales': 'Kavi',
};

const STATUS_DOT: Record<string, string> = {
  'idle': 'bg-green-400',
  'running': 'bg-yellow-400 animate-pulse',
  'error': 'bg-red-400',
  'active': 'bg-green-400',
};

// === HELPER ===
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

// === SUB-COMPONENTS ===

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    'success': 'bg-green-500/20 text-green-300 border-green-500/30',
    'error': 'bg-red-500/20 text-red-300 border-red-500/30',
    'warning': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    'pending': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    'critical': 'bg-red-500/20 text-red-300 border-red-500/30',
    'high': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    'medium': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    'low': 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${colors[status] || colors['pending']}`}>
      {status}
    </span>
  );
}

function AlertBanner({ alerts }: { alerts: string[] }) {
  if (!alerts || alerts.length === 0) return null;
  return (
    <div className="mt-2 space-y-1">
      {alerts.map((alert, i) => (
        <div key={i} className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-xs text-red-300">
          <AlertTriangle size={12} className="mt-0.5 shrink-0 text-red-400" />
          <span>{alert}</span>
        </div>
      ))}
    </div>
  );
}

function TaskList({ tasks }: { tasks: string[] }) {
  if (!tasks || tasks.length === 0) return null;
  return (
    <div className="mt-2 space-y-1">
      {tasks.map((task, i) => (
        <div key={i} className="flex items-center gap-2 text-xs text-slate-300">
          <div className="w-3.5 h-3.5 rounded border border-slate-500 flex items-center justify-center shrink-0">
            <CheckCircle2 size={8} className="text-slate-500" />
          </div>
          <span>{task}</span>
        </div>
      ))}
    </div>
  );
}

function MetricCard({ label, value, change }: { label: string; value: string | number; change?: string }) {
  return (
    <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
      <div className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</div>
      <div className="text-lg font-semibold text-white mt-0.5">{value}</div>
      {change && <div className="text-[10px] text-emerald-400 mt-0.5">{change}</div>}
    </div>
  );
}

// === INSIGHTS PANEL ===
function InsightsPanel({ agents, tasks, logs }: { agents: Agent[]; tasks: AgentTask[]; logs: AgentLog[] }) {
  const criticalTasks = tasks.filter(t => t.priority === 'critical' && t.status === 'pending');
  const highTasks = tasks.filter(t => t.priority === 'high' && t.status === 'pending');
  const recentErrors = logs.filter(l => l.status === 'error').slice(0, 3);
  const activeAgents = agents.filter(a => a.status === 'running' || a.status === 'active');

  return (
    <div className="w-80 border-l border-slate-700/50 bg-[#0a0f1e] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700/50">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Activity size={14} className="text-brand-violet" />
          Insights
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Quick Metrics */}
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-medium">System Health</div>
          <div className="grid grid-cols-2 gap-2">
            <MetricCard label="Agents" value={`${activeAgents.length}/${agents.length}`} />
            <MetricCard label="Tasks" value={tasks.filter(t => t.status === 'pending').length} />
            <MetricCard label="Critical" value={criticalTasks.length} change={criticalTasks.length > 0 ? 'needs attention' : undefined} />
            <MetricCard label="Runs Today" value={logs.filter(l => {
              const today = new Date().toDateString();
              return new Date(l.created_at).toDateString() === today;
            }).length} />
          </div>
        </div>

        {/* Critical Tasks */}
        {criticalTasks.length > 0 && (
          <div>
            <div className="text-[10px] text-red-400 uppercase tracking-wider mb-2 font-medium flex items-center gap-1">
              <AlertTriangle size={10} /> Critical Tasks
            </div>
            <div className="space-y-2">
              {criticalTasks.map(task => (
                <div key={task.id} className="bg-red-500/10 border border-red-500/20 rounded-lg p-2.5">
                  <div className="text-xs font-medium text-red-300">{task.title}</div>
                  <div className="text-[10px] text-red-400/70 mt-1">{AGENT_DISPLAY_NAMES[task.agent_id] || task.agent_id}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* High Priority Tasks */}
        {highTasks.length > 0 && (
          <div>
            <div className="text-[10px] text-orange-400 uppercase tracking-wider mb-2 font-medium flex items-center gap-1">
              <Clock size={10} /> High Priority
            </div>
            <div className="space-y-2">
              {highTasks.slice(0, 5).map(task => (
                <div key={task.id} className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-2.5">
                  <div className="text-xs font-medium text-orange-300">{task.title}</div>
                  <div className="text-[10px] text-orange-400/70 mt-1">{AGENT_DISPLAY_NAMES[task.agent_id] || task.agent_id}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Agent Status */}
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-medium">Agent Status</div>
          <div className="space-y-1.5">
            {agents.map(agent => (
              <div key={agent.id} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-slate-800/50">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{AGENT_EMOJIS[agent.id] || '🤖'}</span>
                  <span className="text-xs text-slate-300">{AGENT_DISPLAY_NAMES[agent.id] || agent.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500">{agent.last_run_at ? timeAgo(agent.last_run_at) : 'never'}</span>
                  <div className={`w-2 h-2 rounded-full ${STATUS_DOT[agent.status] || 'bg-slate-500'}`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// === MAIN COMPONENT ===
export function CommandCenter() {
  // State
  const [agents, setAgents] = useState<Agent[]>([]);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [activeChannel, setActiveChannel] = useState<string>('founder-room');
  const [commandInput, setCommandInput] = useState('');
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showInsights, setShowInsights] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      const [agentsRes, logsRes, tasksRes] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/dm_agents?select=*&order=name`, { headers: supabaseHeaders }),
        fetch(`${SUPABASE_URL}/rest/v1/dm_agent_logs?select=*&order=created_at.desc&limit=100`, { headers: supabaseHeaders }),
        fetch(`${SUPABASE_URL}/rest/v1/dm_agent_tasks?select=*&order=created_at.desc`, { headers: supabaseHeaders }),
      ]);
      const [agentsData, logsData, tasksData] = await Promise.all([
        agentsRes.json(), logsRes.json(), tasksRes.json()
      ]);
      setAgents(agentsData);
      setLogs(logsData);
      setTasks(tasksData);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch:', err);
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    // Trigger all agents to run
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/agent-scheduler?run_all=true`);
      await new Promise(r => setTimeout(r, 2000));
      await fetchData();
    } catch (err) { console.error(err); }
    setRefreshing(false);
  };

  // Build channels from agents
  const channels: Channel[] = [
    { id: 'founder-room', name: 'founder-room', icon: <Star size={14} />, description: 'CEO Daily Dashboard', unread: 0, type: 'system' },
    { id: 'alerts', name: 'alerts', icon: <AlertTriangle size={14} />, description: 'Critical Alerts', unread: logs.filter(l => l.status === 'error' || (l.details?.alerts && l.details.alerts.length > 0)).length, type: 'system' },
    { id: 'tasks', name: 'tasks', icon: <ListTodo size={14} />, description: 'All Agent Tasks', unread: tasks.filter(t => t.status === 'pending').length, type: 'system' },
    ...agents.map(a => ({
      id: a.id,
      name: AGENT_DISPLAY_NAMES[a.id]?.toLowerCase().replace(/\s+/g, '-') || a.id,
      icon: <span className="text-xs">{AGENT_EMOJIS[a.id] || '🤖'}</span>,
      description: a.role,
      unread: 0,
      type: 'agent' as const,
      agentId: a.id,
    })),
  ];

  // Build messages for current channel
  const buildMessages = (): ChatMessage[] => {
    if (activeChannel === 'founder-room') {
      // Show orchestrator brief + all agent summaries
      return logs
        .filter(l => l.action.includes('orchestration') || l.action.includes('weekly'))
        .slice(0, 10)
        .map(l => ({
          id: `log-${l.id}`,
          sender: AGENT_DISPLAY_NAMES[l.agent_id] || l.agent_id,
          senderType: 'agent' as const,
          avatar: AGENT_EMOJIS[l.agent_id] || '🤖',
          content: formatLogMessage(l),
          timestamp: l.created_at,
          channel: 'founder-room',
          details: l.details,
          alerts: l.details?.alerts || l.details?.weekly_brief,
          tasks: l.details?.recommended_actions || l.details?.priority_actions,
        }));
    }

    if (activeChannel === 'alerts') {
      return logs
        .filter(l => l.status === 'error' || (l.details?.alerts && l.details.alerts.length > 0))
        .slice(0, 20)
        .map(l => ({
          id: `alert-${l.id}`,
          sender: AGENT_DISPLAY_NAMES[l.agent_id] || l.agent_id,
          senderType: 'agent' as const,
          avatar: AGENT_EMOJIS[l.agent_id] || '🤖',
          content: l.details?.alerts?.[0] || l.details?.error || `Error in ${l.action}`,
          timestamp: l.created_at,
          channel: 'alerts',
          alerts: l.details?.alerts,
        }));
    }

    if (activeChannel === 'tasks') {
      return tasks.map(t => ({
        id: `task-${t.id}`,
        sender: AGENT_DISPLAY_NAMES[t.agent_id] || t.agent_id,
        senderType: 'agent' as const,
        avatar: AGENT_EMOJIS[t.agent_id] || '🤖',
        content: `**${t.title}** — ${t.description}`,
        timestamp: t.created_at,
        channel: 'tasks',
        details: { priority: t.priority, status: t.status },
      }));
    }

    // Agent-specific channel
    const agentLogs = logs.filter(l => l.agent_id === activeChannel).slice(0, 20);
    const agentTasks = tasks.filter(t => t.agent_id === activeChannel);

    const messages: ChatMessage[] = [];

    agentLogs.forEach(l => {
      messages.push({
        id: `log-${l.id}`,
        sender: AGENT_DISPLAY_NAMES[l.agent_id] || l.agent_id,
        senderType: 'agent',
        avatar: AGENT_EMOJIS[l.agent_id] || '🤖',
        content: formatLogMessage(l),
        timestamp: l.created_at,
        channel: activeChannel,
        details: l.details,
        alerts: l.details?.alerts,
        tasks: l.details?.recommended_actions || l.details?.actions_needed || l.details?.priority_actions,
      });
    });

    if (agentTasks.length > 0) {
      messages.unshift({
        id: `tasks-header-${activeChannel}`,
        sender: 'System',
        senderType: 'system',
        avatar: '📋',
        content: `**${agentTasks.length} tasks** assigned to this agent (${agentTasks.filter(t => t.status === 'pending').length} pending)`,
        timestamp: new Date().toISOString(),
        channel: activeChannel,
        tasks: agentTasks.filter(t => t.status === 'pending').map(t => `[${t.priority.toUpperCase()}] ${t.title}`),
      });
    }

    return messages;
  };

  function formatLogMessage(log: AgentLog): string {
    const d = log.details;
    switch (log.action) {
      case 'weekly_orchestration':
        return `**Weekly Orchestration Report**\n${d.total_agents} agents monitored • ${d.overdue_agents?.length || 0} overdue • ${d.pending_tasks} pending tasks\nOutreach: ${d.outreach_health?.lemlist_sent || 0} sent, ${d.outreach_health?.lemlist_replied || 0} replies • MailerLite: ${d.outreach_health?.mailerlite_subscribers || 0} subscribers`;
      case 'outreach_daily_review':
        return `**Outreach Daily Review**\nLemlist: ${d.performance?.total_sent || 0} sent • ${d.performance?.avg_open_rate || '0%'} open rate • ${d.performance?.total_replied || 0} replies\nActive campaigns: ${d.lemlist_overview?.running || 0}`;
      case 'email_campaign_review':
        return `**Email Marketing Review**\nMailerLite: ${d.mailerlite?.subscribers || 0} subscribers • ${d.mailerlite?.campaigns_sent || 0} campaigns sent\nStatus: ${d.mailerlite?.status || 'Unknown'}`;
      case 'marketing_daily_review':
        return `**Marketing Daily Review** (${d.agent_name})\nEmail: ${d.channels?.email?.subscribers || 0} subscribers • LinkedIn: target ${d.channels?.linkedin?.target || 0} posts/week`;
      case 'growth_daily_review':
        return `**Growth Review** (${d.agent_name})\nUsers: ${d.key_metrics?.total_users || 0} • Match acceptance: ${d.key_metrics?.match_acceptance_rate || 'N/A'}\nPipeline: ${d.key_metrics?.outreach_pipeline || 0} leads`;
      case 'sales_daily_review':
        return `**Sales Pipeline** (${d.agent_name})\nLeads: ${d.pipeline?.total_leads_in_outreach || 0} • Sent: ${d.pipeline?.emails_sent || 0} • Opens: ${d.pipeline?.opened || 0} • Replies: ${d.pipeline?.replied || 0}`;
      case 'finance_weekly_review':
        return `**Finance Review** (${d.agent_name})\nCurrent cost: ${d.infrastructure_costs?.current?.total || 'N/A'} • Recommended: ${d.infrastructure_costs?.recommended?.total || 'N/A'}\nMRR: ${d.key_financial_metrics?.mrr || 0}`;
      case 'content_planning':
        return `**Content Planning**\nBest outreach: ${d.content_insights?.best_performing_outreach || 'N/A'}\n${d.tasks_created > 0 ? `Created ${d.tasks_created} new tasks` : `${d.pending_tasks} tasks pending`}`;
      case 'social_media_daily':
        return `**Social Media Daily**\nLinkedIn: ${d.platforms?.linkedin?.posts_this_week || 0}/${d.platforms?.linkedin?.target || 0} posts • Instagram: ${d.platforms?.instagram?.posts_this_week || 0}/${d.platforms?.instagram?.target || 0} posts`;
      case 'seo_biweekly_audit':
        return `**SEO/GEO Audit** — ${d.domain}\nChecks: ${d.checks_performed?.join(', ')}`;
      case 'ads_daily_review':
        return `**Paid Ads Review**\nLinkedIn Ads: ${d.platforms?.linkedin_ads?.active || 0} active • Meta Ads: ${d.platforms?.meta_ads?.active || 0} active`;
      case 'weekly_analytics_report':
        return `**Weekly Analytics**\nAgent runs: ${d.agent_health?.total_runs_last_50 || 0} • Errors: ${d.agent_health?.error_count || 0}\nLemlist: ${d.outreach_metrics?.lemlist?.campaigns?.sent || 0} sent, ${d.outreach_metrics?.lemlist?.campaigns?.open_rate || 'N/A'}`;
      default:
        return `**${log.action.replace(/_/g, ' ')}** completed`;
    }
  }

  // Command execution
  const handleCommand = async () => {
    if (!commandInput.trim()) return;
    const cmd = commandInput.trim();
    setCommandInput('');

    if (cmd.startsWith('/run ')) {
      const agentId = cmd.replace('/run ', '').trim();
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/agent-scheduler?agent_id=${agentId}`);
        setTimeout(fetchData, 2000);
      } catch (err) { console.error(err); }
    } else if (cmd === '/run-all') {
      handleRefresh();
    }
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChannel, logs]);

  const messages = buildMessages();
  const currentChannel = channels.find(c => c.id === activeChannel);
  const currentAgent = agents.find(a => a.id === activeChannel);

  // Filter channels by search
  const filteredChannels = channels.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const systemChannels = filteredChannels.filter(c => c.type === 'system');
  const agentChannels = filteredChannels.filter(c => c.type === 'agent');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)] text-slate-400">
        <RefreshCw size={20} className="animate-spin mr-2" /> Loading Command Center...
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-180px)] bg-[#060b18] rounded-xl border border-slate-700/50 overflow-hidden">

      {/* === SIDEBAR === */}
      <div className="w-60 bg-[#080d1a] border-r border-slate-700/50 flex flex-col">
        {/* Workspace Header */}
        <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-brand-violet flex items-center justify-center text-white text-xs font-bold">C</div>
            <span className="text-sm font-semibold text-white">Cleya HQ</span>
          </div>
          <button
            onClick={() => setShowCommandPalette(true)}
            className="text-slate-400 hover:text-white transition-colors"
            title="Command Palette (⌘K)"
          >
            <Command size={14} />
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2">
          <div className="flex items-center gap-2 bg-slate-800/50 rounded-md px-2.5 py-1.5 border border-slate-700/30">
            <Search size={13} className="text-slate-500" />
            <input
              type="text"
              placeholder="Search channels..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-transparent text-xs text-white placeholder-slate-500 outline-none flex-1"
            />
          </div>
        </div>

        {/* Channel List */}
        <div className="flex-1 overflow-y-auto px-2 py-1">
          {/* System Channels */}
          <div className="mb-3">
            <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Channels</div>
            {systemChannels.map(channel => (
              <button
                key={channel.id}
                onClick={() => setActiveChannel(channel.id)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-all ${
                  activeChannel === channel.id
                    ? 'bg-brand-violet/20 text-white'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                <span className="text-slate-500">{channel.icon}</span>
                <span className="flex-1 text-left">{channel.name}</span>
                {channel.unread > 0 && (
                  <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-medium min-w-[18px] text-center">
                    {channel.unread}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Agent Channels */}
          <div>
            <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Agents</div>
            {agentChannels.map(channel => {
              const agent = agents.find(a => a.id === channel.agentId);
              return (
                <button
                  key={channel.id}
                  onClick={() => setActiveChannel(channel.id)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-all ${
                    activeChannel === channel.id
                      ? 'bg-brand-violet/20 text-white'
                      : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                  }`}
                >
                  <span>{channel.icon}</span>
                  <span className="flex-1 text-left truncate">{channel.name}</span>
                  {agent && <div className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[agent.status] || 'bg-slate-500'}`} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="px-3 py-2 border-t border-slate-700/50">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-brand-violet/20 text-brand-violet hover:bg-brand-violet/30 transition-colors text-xs font-medium disabled:opacity-50"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Running...' : 'Run All Agents'}
          </button>
        </div>
      </div>

      {/* === MAIN CHAT AREA === */}
      <div className="flex-1 flex flex-col">
        {/* Channel Header */}
        <div className="px-4 py-2.5 border-b border-slate-700/50 flex items-center justify-between bg-[#080d1a]/80">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {currentChannel?.type === 'agent' && <span className="text-base">{AGENT_EMOJIS[activeChannel] || '🤖'}</span>}
              {currentChannel?.type === 'system' && <Hash size={16} className="text-slate-400" />}
              <h2 className="text-sm font-semibold text-white">{currentChannel?.name || activeChannel}</h2>
            </div>
            {currentAgent && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <div className={`w-2 h-2 rounded-full ${STATUS_DOT[currentAgent.status]}`} />
                <span>{currentAgent.role}</span>
                <span className="text-slate-600">•</span>
                <span>{currentAgent.last_run_at ? timeAgo(currentAgent.last_run_at) : 'never run'}</span>
              </div>
            )}
            {currentChannel?.type === 'system' && (
              <span className="text-xs text-slate-500">{currentChannel.description}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowInsights(!showInsights)}
              className={`p-1.5 rounded-md transition-colors ${showInsights ? 'bg-brand-violet/20 text-brand-violet' : 'text-slate-400 hover:text-white'}`}
              title="Toggle Insights"
            >
              <Layout size={14} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <MessageSquare size={32} className="mb-2 opacity-50" />
              <p className="text-sm">No messages in this channel yet</p>
              <p className="text-xs mt-1">Agent data will appear here after runs</p>
            </div>
          ) : (
            messages.map(msg => (
              <div key={msg.id} className="flex gap-3 group hover:bg-slate-800/20 -mx-2 px-2 py-1 rounded-lg transition-colors">
                {/* Avatar */}
                <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700/50 flex items-center justify-center text-base shrink-0">
                  {msg.avatar}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold text-white">{msg.sender}</span>
                    {msg.details?.priority && <StatusBadge status={msg.details.priority} />}
                    <span className="text-[10px] text-slate-500">{formatTime(msg.timestamp)}</span>
                  </div>
                  <div className="text-sm text-slate-300 mt-0.5 whitespace-pre-line leading-relaxed">
                    {msg.content.split('**').map((part, i) =>
                      i % 2 === 1
                        ? <strong key={i} className="text-white font-semibold">{part}</strong>
                        : <span key={i}>{part}</span>
                    )}
                  </div>

                  {/* Alerts */}
                  <AlertBanner alerts={msg.alerts || []} />

                  {/* Tasks */}
                  <TaskList tasks={msg.tasks || []} />

                  {/* Metric details for specific agents */}
                  {msg.details?.performance && activeChannel !== 'founder-room' && (
                    <div className="mt-2 grid grid-cols-4 gap-2">
                      <MetricCard label="Sent" value={msg.details.performance.total_sent || 0} />
                      <MetricCard label="Opened" value={msg.details.performance.total_opened || 0} />
                      <MetricCard label="Clicked" value={msg.details.performance.total_clicked || 0} />
                      <MetricCard label="Replied" value={msg.details.performance.total_replied || 0} />
                    </div>
                  )}

                  {msg.details?.campaign_breakdown && activeChannel !== 'founder-room' && (
                    <div className="mt-2 bg-slate-800/30 rounded-lg border border-slate-700/30 overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-700/30">
                            <th className="text-left px-3 py-1.5 text-slate-500 font-medium">Campaign</th>
                            <th className="text-right px-3 py-1.5 text-slate-500 font-medium">Sent</th>
                            <th className="text-right px-3 py-1.5 text-slate-500 font-medium">Open %</th>
                            <th className="text-right px-3 py-1.5 text-slate-500 font-medium">Replied</th>
                          </tr>
                        </thead>
                        <tbody>
                          {msg.details.campaign_breakdown.map((c: any, i: number) => (
                            <tr key={i} className="border-b border-slate-700/20">
                              <td className="px-3 py-1.5 text-slate-300">{c.name}</td>
                              <td className="text-right px-3 py-1.5 text-slate-400">{c.sent}</td>
                              <td className="text-right px-3 py-1.5 text-slate-400">{c.open_rate}</td>
                              <td className="text-right px-3 py-1.5 text-slate-400">{c.replied}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Command Input */}
        <div className="px-4 py-3 border-t border-slate-700/50">
          <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg px-3 py-2.5 border border-slate-700/30 focus-within:border-brand-violet/50 transition-colors">
            <span className="text-slate-500 text-xs">/</span>
            <input
              type="text"
              value={commandInput}
              onChange={e => setCommandInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCommand()}
              placeholder={`Message #${currentChannel?.name || activeChannel}   •   /run <agent-id>   •   /run-all`}
              className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none"
            />
            <button
              onClick={handleCommand}
              disabled={!commandInput.trim()}
              className="text-slate-400 hover:text-brand-violet disabled:opacity-30 transition-colors"
            >
              <Send size={16} />
            </button>
          </div>
          <div className="flex items-center gap-3 mt-1.5 px-1">
            <span className="text-[10px] text-slate-600">
              <kbd className="px-1 py-0.5 bg-slate-800 rounded text-slate-500 font-mono">⌘K</kbd> commands
            </span>
            <span className="text-[10px] text-slate-600">
              <kbd className="px-1 py-0.5 bg-slate-800 rounded text-slate-500 font-mono">/run</kbd> agent-id
            </span>
            <span className="text-[10px] text-slate-600">
              <kbd className="px-1 py-0.5 bg-slate-800 rounded text-slate-500 font-mono">/run-all</kbd> trigger all
            </span>
          </div>
        </div>
      </div>

      {/* === INSIGHTS PANEL === */}
      {showInsights && <InsightsPanel agents={agents} tasks={tasks} logs={logs} />}

      {/* === COMMAND PALETTE === */}
      {showCommandPalette && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/60 backdrop-blur-sm" onClick={() => setShowCommandPalette(false)}>
          <div className="w-full max-w-lg bg-[#0a0f1e] border border-slate-700/50 rounded-xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700/50">
              <Search size={16} className="text-slate-400" />
              <input
                autoFocus
                type="text"
                placeholder="Type a command or search..."
                className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none"
                onKeyDown={e => {
                  if (e.key === 'Escape') setShowCommandPalette(false);
                }}
              />
            </div>
            <div className="p-2 max-h-80 overflow-y-auto">
              <div className="px-2 py-1 text-[10px] text-slate-500 uppercase tracking-wider">Quick Actions</div>
              {[
                { label: 'Run All Agents', icon: <Zap size={14} />, action: () => { handleRefresh(); setShowCommandPalette(false); } },
                { label: 'View Founder Room', icon: <Star size={14} />, action: () => { setActiveChannel('founder-room'); setShowCommandPalette(false); } },
                { label: 'View Alerts', icon: <AlertTriangle size={14} />, action: () => { setActiveChannel('alerts'); setShowCommandPalette(false); } },
                { label: 'View Tasks', icon: <ListTodo size={14} />, action: () => { setActiveChannel('tasks'); setShowCommandPalette(false); } },
                { label: 'Toggle Insights', icon: <Layout size={14} />, action: () => { setShowInsights(!showInsights); setShowCommandPalette(false); } },
              ].map((cmd, i) => (
                <button
                  key={i}
                  onClick={cmd.action}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-slate-300 hover:bg-brand-violet/20 hover:text-white transition-colors"
                >
                  <span className="text-slate-500">{cmd.icon}</span>
                  {cmd.label}
                </button>
              ))}
              <div className="px-2 py-1 mt-2 text-[10px] text-slate-500 uppercase tracking-wider">Agents</div>
              {agents.map(agent => (
                <button
                  key={agent.id}
                  onClick={() => { setActiveChannel(agent.id); setShowCommandPalette(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-slate-300 hover:bg-brand-violet/20 hover:text-white transition-colors"
                >
                  <span>{AGENT_EMOJIS[agent.id] || '🤖'}</span>
                  <span className="flex-1 text-left">{AGENT_DISPLAY_NAMES[agent.id] || agent.name}</span>
                  <span className="text-[10px] text-slate-500">{agent.role}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
