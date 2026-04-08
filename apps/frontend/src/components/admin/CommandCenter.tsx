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

interface Agent {
  id: string; name: string; role: string; description: string;
  status: 'active' | 'idle' | 'error' | 'running';
  color: string; icon: string; tools: string[];
  schedule?: string; last_run_at?: string;
}
interface AgentLog { id: number; agent_id: string; action: string; details: Record<string, any>; status: string; created_at: string; }
interface AgentTask { id: number; agent_id: string; title: string; description: string; status: string; priority: string; created_at: string; }
interface Channel { id: string; name: string; icon: React.ReactNode; description: string; unread: number; type: 'channel' | 'agent' | 'system'; agentId?: string; }
interface ChatMessage { id: string; sender: string; senderType: 'agent' | 'system' | 'user'; avatar: string; content: string; timestamp: string; channel: string; details?: Record<string, any>; alerts?: string[]; tasks?: string[]; }

const SUPABASE_URL = 'https://kocvqzcxycwzoftcsxch.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvY3ZxemN4eWN3em9mdGNzeGNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2MjU1MTksImV4cCI6MjA5MTIwMTUxOX0.a5RQvI1rCQQI7mO8jyxWzn7yhZ49ZCbeTGlLcVWTfQ0';

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    success: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    completed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    error: 'bg-red-500/20 text-red-400 border-red-500/30',
    failed: 'bg-red-500/20 text-red-400 border-red-500/30',
    warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    pending: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    in_progress: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    critical: 'bg-red-500/20 text-red-400 border-red-500/30',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    running: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
    active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    idle: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  };
  const cls = colors[status?.toLowerCase()] || 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${cls}`}>
      {status}
    </span>
  );
}

function AlertBanner({ alerts }: { alerts: string[] }) {
  if (!alerts || alerts.length === 0) return null;
  return (
    <div className="mt-2 space-y-1">
      {alerts.map((alert, i) => (
        <div key={i} className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-red-400 text-xs">
          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
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
        <div key={i} className="flex items-center gap-2 text-xs text-slate-400">
          <div className="w-3.5 h-3.5 rounded border border-slate-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-2.5 h-2.5 text-slate-500" />
          </div>
          <span>{task}</span>
        </div>
      ))}
    </div>
  );
}

function MetricCard({ label, value, change }: { label: string; value: string | number; change?: string }) {
  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">{label}</div>
      <div className="text-lg font-semibold text-white">{value}</div>
      {change && <div className="text-[10px] text-emerald-400 mt-0.5">{change}</div>}
    </div>
  );
}

function InsightsPanel({ agents, tasks, logs }: { agents: Agent[]; tasks: AgentTask[]; logs: AgentLog[] }) {
  const activeAgents = agents.filter(a => a.status === 'active' || a.status === 'running').length;
  const pendingTasks = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length;
  const criticalCount = tasks.filter(t => t.priority === 'critical').length;
  const today = new Date().toISOString().split('T')[0];
  const runsToday = logs.filter(l => l.created_at && l.created_at.startsWith(today)).length;
  const criticalTasks = tasks.filter(t => t.priority === 'critical' && t.status !== 'completed');
  const highTasks = tasks.filter(t => t.priority === 'high' && t.status !== 'completed');
  const recentErrors = logs.filter(l => l.status === 'error' || l.status === 'failed').slice(0, 5);

  return (
    <div className="w-80 border-l border-slate-700/50 bg-[#0c1121] flex flex-col overflow-y-auto">
      <div className="p-4 border-b border-slate-700/50">
        <div className="flex items-center gap-2 text-sm font-medium text-white mb-3">
          <Activity className="w-4 h-4 text-violet-400" />
          System Health
        </div>
        <div className="grid grid-cols-2 gap-2">
          <MetricCard label="Agents Active" value={`${activeAgents}/${agents.length}`} />
          <MetricCard label="Pending Tasks" value={pendingTasks} />
          <MetricCard label="Critical" value={criticalCount} change={criticalCount === 0 ? 'All clear' : undefined} />
          <MetricCard label="Runs Today" value={runsToday} />
        </div>
      </div>

      {criticalTasks.length > 0 && (
        <div className="p-4 border-b border-slate-700/50">
          <div className="flex items-center gap-2 text-xs font-medium text-red-400 mb-2">
            <AlertTriangle className="w-3 h-3" />
            Critical Tasks
          </div>
          <div className="space-y-2">
            {criticalTasks.slice(0, 5).map(t => (
              <div key={t.id} className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                <div className="text-xs text-red-300 font-medium">{t.title}</div>
                <div className="text-[10px] text-red-400/60 mt-0.5">{t.agent_id} · {timeAgo(t.created_at)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {highTasks.length > 0 && (
        <div className="p-4 border-b border-slate-700/50">
          <div className="flex items-center gap-2 text-xs font-medium text-orange-400 mb-2">
            <Star className="w-3 h-3" />
            High Priority Tasks
          </div>
          <div className="space-y-2">
            {highTasks.slice(0, 5).map(t => (
              <div key={t.id} className="bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-2">
                <div className="text-xs text-orange-300 font-medium">{t.title}</div>
                <div className="text-[10px] text-orange-400/60 mt-0.5">{t.agent_id} · {timeAgo(t.created_at)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {recentErrors.length > 0 && (
        <div className="p-4 border-b border-slate-700/50">
          <div className="flex items-center gap-2 text-xs font-medium text-red-400 mb-2">
            <AlertTriangle className="w-3 h-3" />
            Recent Errors
          </div>
          <div className="space-y-2">
            {recentErrors.map(e => (
              <div key={e.id} className="bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2">
                <div className="text-xs text-slate-300">{e.action}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">{e.agent_id} · {timeAgo(e.created_at)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="p-4">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-2">
          <Bot className="w-3 h-3" />
          Agent Status
        </div>
        <div className="space-y-1.5">
          {agents.map(a => (
            <div key={a.id} className="flex items-center justify-between px-2 py-1.5 rounded bg-slate-800/40">
              <div className="flex items-center gap-2">
                <span className="text-sm">{a.icon}</span>
                <span className="text-xs text-slate-300">{a.name}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Circle className={`w-2 h-2 fill-current ${
                  a.status === 'active' || a.status === 'running' ? 'text-emerald-400' :
                  a.status === 'error' ? 'text-red-400' : 'text-slate-500'
                }`} />
                <span className="text-[10px] text-slate-500">{a.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

async function fetchSupabase<T>(table: string, select = '*', filters?: Record<string, string>, orderBy?: string, limit?: number): Promise<T[]> {
  let url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}`;
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      url += `&${key}=eq.${encodeURIComponent(value)}`;
    }
  }
  if (orderBy) url += `&order=${orderBy}`;
  if (limit) url += `&limit=${limit}`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) return [];
  return res.json();
}

export function CommandCenter() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeChannel, setActiveChannel] = useState('founder-room');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandSearch, setCommandSearch] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const commandInputRef = useRef<HTMLInputElement>(null);

  const systemChannels: Channel[] = [
    { id: 'founder-room', name: 'founder-room', icon: <Hash className="w-4 h-4" />, description: 'Strategic overview & decisions', unread: 0, type: 'system' },
    { id: 'alerts', name: 'alerts', icon: <Bell className="w-4 h-4" />, description: 'System alerts & notifications', unread: 0, type: 'system' },
    { id: 'tasks', name: 'tasks', icon: <ListTodo className="w-4 h-4" />, description: 'All agent tasks & assignments', unread: 0, type: 'system' },
  ];

  const agentChannels: Channel[] = agents.map(a => ({
    id: a.id,
    name: a.name.toLowerCase().replace(/\s+/g, '-'),
    icon: <span className="text-sm">{a.icon}</span>,
    description: a.description,
    unread: logs.filter(l => l.agent_id === a.id && l.status === 'error').length,
    type: 'agent' as const,
    agentId: a.id,
  }));

  const allChannels = [...systemChannels, ...agentChannels];

  const buildMessages = useCallback((agentsData: Agent[], logsData: AgentLog[], tasksData: AgentTask[]) => {
    const msgs: ChatMessage[] = [];
    const agentMap = new Map(agentsData.map(a => [a.id, a]));

    for (const log of logsData) {
      const agent = agentMap.get(log.agent_id);
      const agentName = agent?.name || log.agent_id;
      const agentIcon = agent?.icon || '🤖';

      msgs.push({
        id: `log-${log.id}`,
        sender: agentName,
        senderType: 'agent',
        avatar: agentIcon,
        content: `**${log.action}** ${log.details?.summary || log.details?.message || ''}`.trim(),
        timestamp: log.created_at,
        channel: log.agent_id,
        details: log.details,
        alerts: log.status === 'error' ? [log.details?.error || log.details?.message || 'An error occurred'] : undefined,
      });

      if (log.status === 'error' || log.status === 'failed') {
        msgs.push({
          id: `alert-${log.id}`,
          sender: 'System',
          senderType: 'system',
          avatar: '🚨',
          content: `Alert from **${agentName}**: ${log.action} failed — ${log.details?.error || log.details?.message || 'Unknown error'}`,
          timestamp: log.created_at,
          channel: 'alerts',
          alerts: [log.details?.error || log.details?.message || 'Task failed'],
        });
      }

      msgs.push({
        id: `fr-${log.id}`,
        sender: agentName,
        senderType: 'agent',
        avatar: agentIcon,
        content: `${log.action}: ${log.details?.summary || log.details?.message || log.status}`,
        timestamp: log.created_at,
        channel: 'founder-room',
      });
    }

    for (const task of tasksData) {
      const agent = agentMap.get(task.agent_id);
      msgs.push({
        id: `task-${task.id}`,
        sender: agent?.name || task.agent_id,
        senderType: 'agent',
        avatar: agent?.icon || '📋',
        content: `**Task:** ${task.title}\n${task.description || ''}`,
        timestamp: task.created_at,
        channel: 'tasks',
        tasks: [task.title],
      });
    }

    msgs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return msgs;
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [agentsData, logsData, tasksData] = await Promise.all([
        fetchSupabase<Agent>('dm_agents'),
        fetchSupabase<AgentLog>('dm_agent_logs', '*', undefined, 'created_at.desc', 100),
        fetchSupabase<AgentTask>('dm_agent_tasks'),
      ]);
      setAgents(agentsData);
      setLogs(logsData);
      setTasks(tasksData);
      setMessages(buildMessages(agentsData, logsData, tasksData));
    } catch (err) {
      console.error('CommandCenter fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [buildMessages]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeChannel]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
        setCommandSearch('');
      }
      if (e.key === 'Escape') setShowCommandPalette(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (showCommandPalette) commandInputRef.current?.focus();
  }, [showCommandPalette]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setInput('');

    if (trimmed.startsWith('/run-all')) {
      setMessages(prev => [...prev, {
        id: `user-${Date.now()}`,
        sender: 'You',
        senderType: 'user',
        avatar: '👤',
        content: 'Running all agents...',
        timestamp: new Date().toISOString(),
        channel: activeChannel,
      }]);
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/agent-scheduler?run_all=true`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        });
        setMessages(prev => [...prev, {
          id: `sys-${Date.now()}`,
          sender: 'System',
          senderType: 'system',
          avatar: '✅',
          content: 'All agents triggered successfully.',
          timestamp: new Date().toISOString(),
          channel: activeChannel,
        }]);
      } catch {
        setMessages(prev => [...prev, {
          id: `err-${Date.now()}`,
          sender: 'System',
          senderType: 'system',
          avatar: '❌',
          content: 'Failed to trigger agents.',
          timestamp: new Date().toISOString(),
          channel: activeChannel,
        }]);
      }
      return;
    }

    if (trimmed.startsWith('/run ')) {
      const agentId = trimmed.replace('/run ', '').trim();
      setMessages(prev => [...prev, {
        id: `user-${Date.now()}`,
        sender: 'You',
        senderType: 'user',
        avatar: '👤',
        content: `Running agent: ${agentId}`,
        timestamp: new Date().toISOString(),
        channel: activeChannel,
      }]);
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/agent-scheduler?agent_id=${encodeURIComponent(agentId)}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        });
        setMessages(prev => [...prev, {
          id: `sys-${Date.now()}`,
          sender: 'System',
          senderType: 'system',
          avatar: '✅',
          content: `Agent **${agentId}** triggered successfully.`,
          timestamp: new Date().toISOString(),
          channel: activeChannel,
        }]);
      } catch {
        setMessages(prev => [...prev, {
          id: `err-${Date.now()}`,
          sender: 'System',
          senderType: 'system',
          avatar: '❌',
          content: `Failed to trigger agent ${agentId}.`,
          timestamp: new Date().toISOString(),
          channel: activeChannel,
        }]);
      }
      return;
    }

    setMessages(prev => [...prev, {
      id: `user-${Date.now()}`,
      sender: 'You',
      senderType: 'user',
      avatar: '👤',
      content: trimmed,
      timestamp: new Date().toISOString(),
      channel: activeChannel,
    }]);
  };

  const handleRunAll = async () => {
    setMessages(prev => [...prev, {
      id: `user-${Date.now()}`,
      sender: 'You',
      senderType: 'user',
      avatar: '👤',
      content: 'Running all agents...',
      timestamp: new Date().toISOString(),
      channel: activeChannel,
    }]);
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/agent-scheduler?run_all=true`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      });
      setMessages(prev => [...prev, {
        id: `sys-${Date.now()}`,
        sender: 'System',
        senderType: 'system',
        avatar: '✅',
        content: 'All agents triggered successfully.',
        timestamp: new Date().toISOString(),
        channel: activeChannel,
      }]);
    } catch {
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        sender: 'System',
        senderType: 'system',
        avatar: '❌',
        content: 'Failed to trigger agents.',
        timestamp: new Date().toISOString(),
        channel: activeChannel,
      }]);
    }
  };

  const channelMessages = messages.filter(m => m.channel === activeChannel);
  const currentChannel = allChannels.find(c => c.id === activeChannel);
  const filteredChannels = commandSearch
    ? allChannels.filter(c => c.name.toLowerCase().includes(commandSearch.toLowerCase()))
    : allChannels;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#0a0f1e] text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        Loading Command Center...
      </div>
    );
  }

  return (
    <div className="flex h-full bg-[#0a0f1e] text-white overflow-hidden relative">
      {/* Sidebar */}
      <div className="w-64 border-r border-slate-700/50 bg-[#080d1a] flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center text-xs font-bold">C</div>
              <span className="text-sm font-semibold text-white">Cleya Command</span>
            </div>
            <button
              onClick={() => setShowCommandPalette(true)}
              className="p-1 rounded hover:bg-slate-700/50 text-slate-500 hover:text-slate-300 transition-colors"
              title="Cmd+K"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          <div className="px-3 mb-1">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium px-2 py-1">System</div>
          </div>
          {systemChannels.map(ch => (
            <button
              key={ch.id}
              onClick={() => setActiveChannel(ch.id)}
              className={`w-full flex items-center gap-2 px-4 py-1.5 text-sm transition-colors ${
                activeChannel === ch.id
                  ? 'bg-violet-500/20 text-white border-l-2 border-violet-400'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-300 border-l-2 border-transparent'
              }`}
            >
              <span className="text-slate-500">{ch.icon}</span>
              <span className="truncate">{ch.name}</span>
              {ch.unread > 0 && (
                <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{ch.unread}</span>
              )}
            </button>
          ))}

          <div className="px-3 mt-4 mb-1">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium px-2 py-1">Agents</div>
          </div>
          {agentChannels.map(ch => (
            <button
              key={ch.id}
              onClick={() => setActiveChannel(ch.id)}
              className={`w-full flex items-center gap-2 px-4 py-1.5 text-sm transition-colors ${
                activeChannel === ch.id
                  ? 'bg-violet-500/20 text-white border-l-2 border-violet-400'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-300 border-l-2 border-transparent'
              }`}
            >
              {ch.icon}
              <span className="truncate">{ch.name}</span>
              {ch.unread > 0 && (
                <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{ch.unread}</span>
              )}
            </button>
          ))}
        </div>

        <div className="p-3 border-t border-slate-700/50">
          <button
            onClick={fetchData}
            className="w-full flex items-center justify-center gap-2 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 text-slate-400 hover:text-white text-xs transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh Data
          </button>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-12 border-b border-slate-700/50 flex items-center justify-between px-4 shrink-0 bg-[#0a0f1e]">
          <div className="flex items-center gap-2 min-w-0">
            {currentChannel?.icon}
            <span className="font-medium text-sm text-white truncate">{currentChannel?.name || activeChannel}</span>
            <span className="text-xs text-slate-500 hidden sm:inline truncate">{currentChannel?.description}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleRunAll}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 hover:text-violet-300 text-xs font-medium transition-colors border border-violet-500/20"
            >
              <Zap className="w-3 h-3" />
              Run All Agents
            </button>
            <button
              onClick={() => setShowCommandPalette(true)}
              className="p-1.5 rounded hover:bg-slate-700/50 text-slate-500 hover:text-slate-300 transition-colors"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {channelMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <MessageSquare className="w-8 h-8 mb-2 text-slate-600" />
              <div className="text-sm">No messages in #{currentChannel?.name || activeChannel}</div>
              <div className="text-xs text-slate-600 mt-1">Agent activity will appear here</div>
            </div>
          )}
          {channelMessages.map(msg => (
            <div key={msg.id} className={`flex gap-3 group ${msg.senderType === 'user' ? 'justify-end' : ''}`}>
              {msg.senderType !== 'user' && (
                <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-sm shrink-0 border border-slate-700/50">
                  {msg.avatar}
                </div>
              )}
              <div className={`flex-1 min-w-0 ${msg.senderType === 'user' ? 'max-w-[70%]' : ''}`}>
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className={`text-xs font-medium ${
                    msg.senderType === 'system' ? 'text-yellow-400' :
                    msg.senderType === 'user' ? 'text-violet-400' : 'text-slate-300'
                  }`}>{msg.sender}</span>
                  <span className="text-[10px] text-slate-600">{formatTime(msg.timestamp)}</span>
                  {msg.details?.status && <StatusBadge status={msg.details.status} />}
                </div>
                <div className={`text-sm leading-relaxed ${
                  msg.senderType === 'user'
                    ? 'bg-violet-600/20 border border-violet-500/20 rounded-lg px-3 py-2 text-violet-100'
                    : 'text-slate-400'
                }`}>
                  {msg.content.split('**').map((part, i) =>
                    i % 2 === 1 ? <strong key={i} className="text-slate-200 font-medium">{part}</strong> : <span key={i}>{part}</span>
                  )}
                </div>
                <AlertBanner alerts={msg.alerts || []} />
                <TaskList tasks={msg.tasks || []} />
              </div>
              {msg.senderType === 'user' && (
                <div className="w-8 h-8 rounded-lg bg-violet-600/30 flex items-center justify-center text-sm shrink-0 border border-violet-500/30">
                  {msg.avatar}
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-slate-700/50 p-3 bg-[#0a0f1e]">
          <div className="flex items-center gap-2 bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder={`Message #${currentChannel?.name || activeChannel}  ·  /run <agent-id>  ·  /run-all`}
              className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="p-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:text-slate-500 text-white transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-3 mt-1.5 px-1">
            <span className="text-[10px] text-slate-600 flex items-center gap-1">
              <Command className="w-2.5 h-2.5" />K to search
            </span>
            <span className="text-[10px] text-slate-600">/run &lt;agent&gt; to trigger</span>
            <span className="text-[10px] text-slate-600">/run-all to trigger all</span>
          </div>
        </div>
      </div>

      {/* Insights Panel */}
      <InsightsPanel agents={agents} tasks={tasks} logs={logs} />

      {/* Command Palette */}
      {showCommandPalette && (
        <div className="absolute inset-0 z-50 flex items-start justify-center pt-[15%] bg-black/60 backdrop-blur-sm" onClick={() => setShowCommandPalette(false)}>
          <div className="w-[500px] bg-[#0f1629] border border-slate-700/50 rounded-xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700/50">
              <Search className="w-4 h-4 text-slate-500" />
              <input
                ref={commandInputRef}
                type="text"
                value={commandSearch}
                onChange={e => setCommandSearch(e.target.value)}
                placeholder="Jump to channel..."
                className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none"
                onKeyDown={e => {
                  if (e.key === 'Escape') setShowCommandPalette(false);
                  if (e.key === 'Enter' && filteredChannels.length > 0) {
                    setActiveChannel(filteredChannels[0].id);
                    setShowCommandPalette(false);
                  }
                }}
              />
              <kbd className="text-[10px] text-slate-500 bg-slate-800 rounded px-1.5 py-0.5 border border-slate-700">esc</kbd>
            </div>
            <div className="max-h-64 overflow-y-auto py-1">
              {filteredChannels.map(ch => (
                <button
                  key={ch.id}
                  onClick={() => { setActiveChannel(ch.id); setShowCommandPalette(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-800/60 text-left transition-colors"
                >
                  <span className="text-slate-500">{ch.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-300">{ch.name}</div>
                    <div className="text-[10px] text-slate-600 truncate">{ch.description}</div>
                  </div>
                  {ch.unread > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{ch.unread}</span>
                  )}
                </button>
              ))}
              {filteredChannels.length === 0 && (
                <div className="text-center text-sm text-slate-500 py-6">No channels found</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
