'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Brain, Lightbulb, Share2, Mail, Target, Globe, Zap, BarChart3,
  Clock, AlertCircle, CheckCircle, ChevronRight, X, Send, Plus,
  Filter, Download, Eye, Check, XCircle, Loader, Database, Trash2, Shield, Octagon,
  Upload, ScrollText
} from 'lucide-react';
import { api } from '@/lib/api';

// Types
interface Agent {
  id: string;
  name: string;
  role: string;
  description: string;
  status: 'active' | 'idle' | 'error';
  color: string;
  icon: string;
  tools: string[];
  schedule?: string;
  last_run_at?: string;
  next_run_at?: string;
}

interface AgentLog {
  id: number;
  agent_id: string;
  action: string;
  details: Record<string, any>;
  status: 'success' | 'error' | 'warning' | 'info';
  created_at: string;
}

interface AgentTask {
  id: number;
  agent_id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  due_date: string;
  output: Record<string, any>;
  created_at: string;
  completed_at?: string;
}

interface AgentMessage {
  id: number;
  agent_id: string;
  direction: 'inbound' | 'outbound';
  message: string;
  message_type: string;
  metadata: Record<string, any>;
  read: boolean;
  created_at: string;
}

interface ContentQueueItem {
  id: number;
  agent_id: string;
  channel: string;
  content_type: string;
  title: string;
  body: string;
  media_urls: string[];
  scheduled_for: string;
  status: 'pending' | 'approved' | 'rejected' | 'published';
  metadata: Record<string, any>;
  created_at: string;
  published_at?: string;
}

interface CodeChange {
  id: number;
  agent_id: string;
  repo: string;
  branch: string;
  commit_message: string;
  pr_url: string;
  pr_status: string;
  files_changed: string[];
  created_at: string;
}

interface CampaignMetric {
  id: number;
  source: string;
  campaign_name: string;
  metric_date: string;
  metrics: Record<string, any>;
  created_at: string;
}

interface AgentStatusInfo {
  agentId: string;
  name: string;
  codename: string;
  status: 'idle' | 'running' | 'completed' | 'failed' | 'scheduled';
  lastRunAt: string | null;
  lastRunDuration: number | null;
  lastRunStatus: string | null;
  nextRunAt: string | null;
  enabled: boolean;
  cronExpression: string | null;
  autonomyLevel: 'manual' | 'semi_autonomous' | 'autonomous';
  guardrails: {
    maxActionsPerDay: number;
    maxSpendPerDay: number;
    maxPostsPerDay: number;
    contentBlocklist: string[];
  };
}

interface ExecutionLogEntry {
  id: number;
  agent_id: string;
  action_type: string;
  action_description: string;
  autonomy_level: string;
  guardrails_checked: string[];
  guardrail_result: string;
  execution_result: string;
  details: Record<string, any>;
  spend_amount: number;
  executed_at: string;
}

interface AccountabilityStats {
  totalRuns: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  avgDuration: number;
  contentItemsGenerated: number;
}

const SUPABASE_URL = 'https://kocvqzcxycwzoftcsxch.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvY3ZxemN4eWN3em9mdGNzeGNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2MjU1MTksImV4cCI6MjA5MTIwMTUxOX0.a5RQvI1rCQQI7mO8jyxWzn7yhZ49ZCbeTGlLcVWTfQ0';

const AGENT_ICONS: Record<string, React.ReactNode> = {
  'brain': <Brain size={20} />,
  'lightbulb': <Lightbulb size={20} />,
  'share2': <Share2 size={20} />,
  'mail': <Mail size={20} />,
  'target': <Target size={20} />,
  'globe': <Globe size={20} />,
  'zap': <Zap size={20} />,
  'barChart3': <BarChart3 size={20} />,
};

const AGENT_COLORS: Record<string, string> = {
  'purple': 'from-purple-500/20 to-purple-600/10 border-purple-500/20',
  'blue': 'from-brand-violet/20 to-brand-violet/10 border-brand-violet/20',
  'pink': 'from-pink-500/20 to-pink-600/10 border-pink-500/20',
  'orange': 'from-orange-500/20 to-orange-600/10 border-orange-500/20',
  'red': 'from-red-500/20 to-red-600/10 border-red-500/20',
  'green': 'from-green-500/20 to-green-600/10 border-green-500/20',
  'yellow': 'from-yellow-500/20 to-yellow-600/10 border-yellow-500/20',
  'cyan': 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/20',
};

const PRIORITY_COLORS: Record<string, string> = {
  'low': 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  'medium': 'bg-brand-violet/20 text-brand-violet-hover border-brand-violet/30',
  'high': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  'critical': 'bg-red-500/20 text-red-300 border-red-500/30',
};

const STATUS_COLORS: Record<string, string> = {
  'success': 'bg-green-500/20 text-green-300',
  'error': 'bg-red-500/20 text-red-300',
  'warning': 'bg-yellow-500/20 text-yellow-300',
  'info': 'bg-brand-violet/20 text-brand-violet-hover',
};

// Supabase API helpers
const supabaseHeaders = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

async function fetchSupabase<T>(
  table: string,
  query: string = '*',
  filters?: Record<string, string>
): Promise<T[]> {
  let url = `${SUPABASE_URL}/rest/v1/${table}?select=${query}`;
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      url += `&${key}=eq.${value}`;
    });
  }
  const response = await fetch(url, { headers: supabaseHeaders });
  if (!response.ok) throw new Error(`Supabase error: ${response.statusText}`);
  return response.json();
}

async function updateSupabase(
  table: string,
  id: string | number,
  data: Record<string, any>
): Promise<any> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`,
    {
      method: 'PATCH',
      headers: { ...supabaseHeaders, 'Prefer': 'return=minimal' },
      body: JSON.stringify(data),
    }
  );
  if (!response.ok) throw new Error(`Update failed: ${response.statusText}`);
  return response.json();
}

// Components
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-8">
      <Loader className="animate-spin text-brand-violet" size={32} />
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-red-300 flex items-center gap-3">
      <AlertCircle size={20} />
      <span>{message}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, string> = {
    active: 'bg-green-500/20 text-green-300 border-green-500/30',
    running: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    completed: 'bg-green-500/20 text-green-300 border-green-500/30',
    scheduled: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    idle: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
    error: 'bg-red-500/20 text-red-300 border-red-500/30',
    failed: 'bg-red-500/20 text-red-300 border-red-500/30',
  };

  const dotColor = ['active', 'running'].includes(status) ? 'bg-green-400 animate-pulse' :
    ['error', 'failed'].includes(status) ? 'bg-red-400' :
    status === 'scheduled' ? 'bg-amber-400' :
    status === 'completed' ? 'bg-green-400' :
    'bg-slate-400';

  const label = status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <div className={`flex items-center gap-2 px-3 py-1 rounded-lg border text-xs font-medium ${statusConfig[status] || statusConfig.idle}`}>
      <div className={`w-2 h-2 rounded-full ${dotColor}`} />
      {label}
    </div>
  );
}

function AgentCard({
  agent,
  stats,
  onClick
}: {
  agent: Agent;
  stats: { tasksToday: number; contentPending: number; messagesUnread: number };
  onClick: () => void;
}) {
  const colorClass = AGENT_COLORS[agent.color] || AGENT_COLORS['blue'];
  const icon = AGENT_ICONS[agent.icon] || AGENT_ICONS['lightbulb'];

  return (
    <button
      onClick={onClick}
      className={`group relative bg-gradient-to-br ${colorClass} border rounded-xl p-6 transition-all hover:shadow-lg hover:shadow-brand-violet/10 cursor-pointer w-full text-left`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="text-brand-violet-hover">{icon}</div>
          <div>
            <h3 className="font-semibold text-white">{agent.name}</h3>
            <p className="text-sm text-slate-400">{agent.role}</p>
          </div>
        </div>
        <StatusBadge status={agent.status} />
      </div>

      <p className="text-sm text-slate-300 mb-4 line-clamp-2">{agent.description}</p>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-slate-800/50 rounded-lg p-2">
          <div className="text-xs text-slate-400">Tasks Today</div>
          <div className="text-lg font-bold text-white">{stats.tasksToday}</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-2">
          <div className="text-xs text-slate-400">Content</div>
          <div className="text-lg font-bold text-white">{stats.contentPending}</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-2">
          <div className="text-xs text-slate-400">Unread</div>
          <div className="text-lg font-bold text-white">{stats.messagesUnread}</div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>
          {agent.last_run_at ? `Last: ${new Date(agent.last_run_at).toLocaleDateString()}` : 'Never run'}
        </span>
        <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
      </div>
    </button>
  );
}

function ActivityLogTab({ agentId }: { agentId: string }) {
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLogs = async () => {
      try {
        const data = await fetchSupabase<AgentLog>(
          'dm_agent_logs',
          '*',
          { agent_id: agentId }
        );
        setLogs(data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      } catch (error) {
        console.error('Failed to load logs:', error);
      } finally {
        setLoading(false);
      }
    };
    loadLogs();
  }, [agentId]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-3">
      {logs.length === 0 ? (
        <p className="text-slate-400 text-center py-6">No activity yet</p>
      ) : (
        logs.map((log) => (
          <div key={log.id} className={`border rounded-lg p-4 text-sm ${STATUS_COLORS[log.status]}`}>
            <div className="flex items-start justify-between mb-2">
              <span className="font-medium">{log.action}</span>
              <time className="text-xs opacity-75">{new Date(log.created_at).toLocaleString()}</time>
            </div>
            {Object.keys(log.details).length > 0 && (
              <details className="cursor-pointer">
                <summary className="text-xs opacity-75 hover:opacity-100">Details</summary>
                <pre className="text-xs mt-2 bg-black/20 p-2 rounded overflow-auto max-h-32">
                  {JSON.stringify(log.details, null, 2)}
                </pre>
              </details>
            )}
          </div>
        ))
      )}
    </div>
  );
}

function TasksTab({ agentId }: { agentId: string }) {
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTasks = async () => {
      try {
        const data = await fetchSupabase<AgentTask>(
          'dm_agent_tasks',
          '*',
          { agent_id: agentId }
        );
        setTasks(data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      } catch (error) {
        console.error('Failed to load tasks:', error);
      } finally {
        setLoading(false);
      }
    };
    loadTasks();
  }, [agentId]);

  const handleStatusChange = useCallback(
    async (taskId: number, newStatus: string) => {
      try {
        await updateSupabase('dm_agent_tasks', taskId, { status: newStatus });
        setTasks(tasks.map(t => t.id === taskId ? { ...t, status: newStatus as any } : t));
      } catch (error) {
        console.error('Failed to update task:', error);
      }
    },
    [tasks]
  );

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-3">
      {tasks.length === 0 ? (
        <p className="text-slate-400 text-center py-6">No tasks assigned</p>
      ) : (
        tasks.map((task) => (
          <div key={task.id} className="border border-brand-violet/10 rounded-lg p-4 bg-brand-violet-pressed/5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="font-medium text-white">{task.title}</h4>
                <p className="text-sm text-slate-400 mt-1">{task.description}</p>
              </div>
              <div className="flex gap-2">
                <div className={`px-2 py-1 rounded text-xs font-medium ${PRIORITY_COLORS[task.priority]}`}>
                  {task.priority}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={task.status}
                onChange={(e) => handleStatusChange(task.id, e.target.value)}
                className="px-2 py-1 rounded text-xs bg-slate-800 border border-slate-700 text-white cursor-pointer"
              >
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
              <span className="text-xs text-slate-400">
                Due: {new Date(task.due_date).toLocaleDateString()}
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function ContentQueueTab({ agentId }: { agentId: string }) {
  const [items, setItems] = useState<ContentQueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadItems = async () => {
      try {
        const data = await fetchSupabase<ContentQueueItem>(
          'dm_content_queue',
          '*',
          { agent_id: agentId }
        );
        setItems(data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      } catch (error) {
        console.error('Failed to load content queue:', error);
      } finally {
        setLoading(false);
      }
    };
    loadItems();
  }, [agentId]);

  const handleApprove = useCallback(
    async (itemId: number) => {
      try {
        await updateSupabase('dm_content_queue', itemId, { status: 'approved' });
        setItems(items.map(i => i.id === itemId ? { ...i, status: 'approved' } : i));
      } catch (error) {
        console.error('Failed to approve:', error);
      }
    },
    [items]
  );

  const handleReject = useCallback(
    async (itemId: number) => {
      try {
        await updateSupabase('dm_content_queue', itemId, { status: 'rejected' });
        setItems(items.map(i => i.id === itemId ? { ...i, status: 'rejected' } : i));
      } catch (error) {
        console.error('Failed to reject:', error);
      }
    },
    [items]
  );

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="text-slate-400 text-center py-6">No content in queue</p>
      ) : (
        items.map((item) => (
          <div key={item.id} className="border border-brand-violet/10 rounded-lg p-4 bg-brand-violet-pressed/5 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="font-medium text-white">{item.title}</h4>
                <p className="text-sm text-slate-400 mt-1 line-clamp-2">{item.body}</p>
              </div>
              <span className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-200 whitespace-nowrap">
                {item.channel}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">
                Scheduled: {new Date(item.scheduled_for).toLocaleString()}
              </span>
              {item.status === 'pending' && (
                <div className="flex gap-2 ml-auto">
                  <button
                    onClick={() => handleApprove(item.id)}
                    className="flex items-center gap-1 px-3 py-1 rounded text-xs bg-green-500/20 text-green-300 hover:bg-green-500/30 border border-green-500/30"
                  >
                    <Check size={14} /> Approve
                  </button>
                  <button
                    onClick={() => handleReject(item.id)}
                    className="flex items-center gap-1 px-3 py-1 rounded text-xs bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30"
                  >
                    <X size={14} /> Reject
                  </button>
                </div>
              )}
              {item.status !== 'pending' && (
                <span className={`ml-auto text-xs px-2 py-1 rounded font-medium ${
                  item.status === 'approved' ? 'bg-green-500/20 text-green-300' :
                  item.status === 'rejected' ? 'bg-red-500/20 text-red-300' :
                  'bg-brand-violet/20 text-brand-violet-hover'
                }`}>
                  {item.status}
                </span>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function ChatTab({ agentId }: { agentId: string }) {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const loadMessages = async () => {
      try {
        const data = await fetchSupabase<AgentMessage>(
          'dm_agent_messages',
          '*',
          { agent_id: agentId }
        );
        setMessages(data.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
      } catch (error) {
        console.error('Failed to load messages:', error);
      } finally {
        setLoading(false);
      }
    };
    loadMessages();
  }, [agentId]);

  const handleSendMessage = useCallback(async () => {
    if (!newMessage.trim()) return;
    const userMsg = newMessage.trim();
    setNewMessage('');
    setSending(true);

    // Add user message to UI immediately
    const tempUserMsg: AgentMessage = {
      id: Date.now(),
      agent_id: agentId,
      direction: 'inbound',
      message: userMsg,
      message_type: 'text',
      metadata: {},
      read: false,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      // Save user message to Supabase
      await fetch(`${SUPABASE_URL}/rest/v1/dm_agent_messages`, {
        method: 'POST',
        headers: { ...supabaseHeaders, 'Prefer': 'return=minimal' },
        body: JSON.stringify({
          agent_id: agentId, direction: 'inbound', message: userMsg,
          message_type: 'text', metadata: {}, read: false,
        }),
      });

      // Build chat history from recent messages for context
      const history = messages.slice(-10).map(m => ({
        role: m.direction === 'inbound' ? 'user' : 'assistant',
        content: m.message,
      }));

      // Call backend agent-chat API via the authenticated api client
      let assistantText = 'Sorry, I could not generate a response. Please check that the OpenAI API key is configured.';
      try {
        const data = await api.sendAgentMessage(agentId, userMsg, history);
        assistantText = data.data?.content || data.content || assistantText;
      } catch (apiErr) {
        console.error('Agent chat API error:', apiErr);
      }

      // Add AI response to UI
      const aiMsg: AgentMessage = {
        id: Date.now() + 1,
        agent_id: agentId,
        direction: 'outbound',
        message: assistantText,
        message_type: 'text',
        metadata: {},
        read: false,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, aiMsg]);

      // Save AI response to Supabase
      await fetch(`${SUPABASE_URL}/rest/v1/dm_agent_messages`, {
        method: 'POST',
        headers: { ...supabaseHeaders, 'Prefer': 'return=minimal' },
        body: JSON.stringify({
          agent_id: agentId, direction: 'outbound', message: assistantText,
          message_type: 'text', metadata: {}, read: false,
        }),
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessages(prev => [...prev, {
        id: Date.now() + 1, agent_id: agentId, direction: 'outbound',
        message: `Error: ${error instanceof Error ? error.message : 'Failed to reach AI service'}`,
        message_type: 'text', metadata: {}, read: false, created_at: new Date().toISOString(),
      }]);
    } finally {
      setSending(false);
    }
  }, [agentId, newMessage, messages]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="flex flex-col h-[600px] bg-brand-violet-pressed/5 rounded-lg border border-brand-violet/10">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <p className="text-slate-400 text-center py-6">No messages yet</p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.direction === 'outbound' ? 'justify-start' : 'justify-end'}`}
            >
              <div
                className={`max-w-xs px-4 py-2 rounded-lg text-sm ${
                  msg.direction === 'outbound'
                    ? 'bg-slate-700 text-slate-100'
                    : 'bg-brand-violet text-white'
                }`}
              >
                <p>{msg.message}</p>
                <span className="text-xs opacity-50 mt-1 block">
                  {new Date(msg.created_at).toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="border-t border-brand-violet/10 p-4 flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="Type a message..."
          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-violet"
        />
        <button
          onClick={handleSendMessage}
          disabled={!newMessage.trim() || sending}
          className="px-4 py-2 rounded-lg bg-brand-violet text-white text-sm font-medium hover:bg-brand-violet/80 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}

function CodeChangesTab({ agentId }: { agentId: string }) {
  const [changes, setChanges] = useState<CodeChange[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadChanges = async () => {
      try {
        const data = await fetchSupabase<CodeChange>(
          'dm_code_changes',
          '*',
          { agent_id: agentId }
        );
        setChanges(data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      } catch (error) {
        console.error('Failed to load code changes:', error);
      } finally {
        setLoading(false);
      }
    };
    loadChanges();
  }, [agentId]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-3">
      {changes.length === 0 ? (
        <p className="text-slate-400 text-center py-6">No code changes yet</p>
      ) : (
        changes.map((change) => (
          <div key={change.id} className="border border-brand-violet/10 rounded-lg p-4 bg-brand-violet-pressed/5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h4 className="font-medium text-white font-mono text-sm">{change.commit_message}</h4>
                <div className="flex gap-2 mt-2 text-xs text-slate-400">
                  <span>Repo: {change.repo}</span>
                  <span className="text-slate-600">•</span>
                  <span>Branch: {change.branch}</span>
                </div>
              </div>
              <a
                href={change.pr_url}
                target="_blank"
                rel="noopener noreferrer"
                className={`px-2 py-1 rounded text-xs font-medium ${
                  change.pr_status === 'merged' ? 'bg-green-500/20 text-green-300' :
                  change.pr_status === 'open' ? 'bg-brand-violet/20 text-brand-violet-hover' :
                  'bg-red-500/20 text-red-300'
                }`}
              >
                {change.pr_status}
              </a>
            </div>
            <div className="flex gap-2 flex-wrap">
              {change.files_changed.map((file, idx) => (
                <span key={idx} className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-300 font-mono">
                  {file}
                </span>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function RunHistoryTab({ agentId }: { agentId: string }) {
  const [history, setHistory] = useState<AgentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const resp = await api.getAgentRunHistory(agentId, 30);
        const data = Array.isArray(resp) ? resp : resp?.data || [];
        setHistory(data);
      } catch (error) {
        console.error('Failed to load run history:', error);
      } finally {
        setLoading(false);
      }
    };
    loadHistory();
  }, [agentId]);

  if (loading) return <LoadingSpinner />;

  const runs = history.filter(h => h.action.startsWith('Autonomous run'));

  return (
    <div className="space-y-3">
      {runs.length === 0 ? (
        <p className="text-slate-400 text-center py-6">No run history yet</p>
      ) : (
        runs.map((run) => {
          const duration = run.details?.duration_ms;
          const isExpanded = expandedId === run.id;
          return (
            <div key={run.id} className="border border-brand-violet/10 rounded-lg bg-brand-violet-pressed/5 overflow-hidden">
              <button
                onClick={() => setExpandedId(isExpanded ? null : run.id)}
                className="w-full p-4 text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${run.status === 'success' ? 'bg-green-400' : run.status === 'warning' ? 'bg-yellow-400' : 'bg-red-400'}`} />
                    <div>
                      <span className="text-sm font-medium text-white">{run.action}</span>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                        <span>{new Date(run.created_at).toLocaleString()}</span>
                        {duration && <span>{(duration / 1000).toFixed(1)}s</span>}
                        {run.details?.retry_count > 0 && (
                          <span className="text-yellow-400">Retries: {run.details.retry_count}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={16} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </div>
              </button>
              {isExpanded && run.details && (
                <div className="px-4 pb-4 border-t border-brand-violet/10">
                  {run.details.output_summary && (
                    <p className="text-sm text-slate-300 mt-3">{run.details.output_summary}</p>
                  )}
                  {run.details.error && (
                    <p className="text-sm text-red-300 mt-3">{run.details.error}</p>
                  )}
                  <div className="flex gap-4 mt-2 text-xs text-slate-500">
                    {run.details.content_type && <span>Type: {run.details.content_type}</span>}
                    {run.details.channel && <span>Channel: {run.details.channel}</span>}
                    {run.details.output_length && <span>Output: {run.details.output_length} chars</span>}
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

function AccountabilityTab({ agentId }: { agentId: string }) {
  const [stats, setStats] = useState<AccountabilityStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const resp = await api.getAgentAccountability(agentId);
        setStats(resp?.data || resp);
      } catch (error) {
        console.error('Failed to load accountability:', error);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, [agentId]);

  if (loading) return <LoadingSpinner />;
  if (!stats) return <ErrorState message="Failed to load accountability data" />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase tracking-wider">Total Runs</div>
          <div className="text-2xl font-bold text-white mt-1">{stats.totalRuns}</div>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase tracking-wider">Success Rate</div>
          <div className={`text-2xl font-bold mt-1 ${stats.successRate >= 80 ? 'text-green-400' : stats.successRate >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
            {stats.successRate.toFixed(1)}%
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase tracking-wider">Avg Duration</div>
          <div className="text-2xl font-bold text-white mt-1">{(stats.avgDuration / 1000).toFixed(1)}s</div>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase tracking-wider">Successful</div>
          <div className="text-2xl font-bold text-green-400 mt-1">{stats.successCount}</div>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase tracking-wider">Failed</div>
          <div className="text-2xl font-bold text-red-400 mt-1">{stats.failureCount}</div>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase tracking-wider">Content Generated</div>
          <div className="text-2xl font-bold text-brand-violet-hover mt-1">{stats.contentItemsGenerated}</div>
        </div>
      </div>

      {stats.totalRuns > 0 && (
        <div className="bg-slate-800/50 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase tracking-wider mb-3">Success/Failure Ratio</div>
          <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
            <div
              className="bg-green-500 h-full rounded-full transition-all"
              style={{ width: `${stats.successRate}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-slate-500">
            <span>{stats.successCount} succeeded</span>
            <span>{stats.failureCount} failed</span>
          </div>
        </div>
      )}
    </div>
  );
}

function AutonomyConfigTab({ agentId, liveStatus, onConfigChange }: {
  agentId: string;
  liveStatus?: AgentStatusInfo;
  onConfigChange: () => void;
}) {
  const [autonomyLevel, setAutonomyLevel] = useState(liveStatus?.autonomyLevel || 'manual');
  const [guardrails, setGuardrails] = useState(liveStatus?.guardrails || {
    maxActionsPerDay: 10,
    maxSpendPerDay: 0,
    maxPostsPerDay: 5,
    contentBlocklist: [],
  });
  const [blocklistInput, setBlocklistInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAutonomyLevel(liveStatus?.autonomyLevel || 'manual');
    setGuardrails(liveStatus?.guardrails || {
      maxActionsPerDay: 10,
      maxSpendPerDay: 0,
      maxPostsPerDay: 5,
      contentBlocklist: [],
    });
  }, [liveStatus]);

  const handleSaveAutonomy = async (level: string) => {
    setSaving(true);
    try {
      await api.updateAgentConfig(agentId, { autonomyLevel: level });
      setAutonomyLevel(level as any);
      onConfigChange();
    } catch (error) {
      console.error('Failed to update autonomy:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGuardrails = async () => {
    setSaving(true);
    try {
      await api.updateAgentConfig(agentId, { guardrails });
      onConfigChange();
    } catch (error) {
      console.error('Failed to update guardrails:', error);
    } finally {
      setSaving(false);
    }
  };

  const addBlocklistTerm = () => {
    if (blocklistInput.trim() && !guardrails.contentBlocklist.includes(blocklistInput.trim())) {
      setGuardrails({
        ...guardrails,
        contentBlocklist: [...guardrails.contentBlocklist, blocklistInput.trim()],
      });
      setBlocklistInput('');
    }
  };

  const removeBlocklistTerm = (term: string) => {
    setGuardrails({
      ...guardrails,
      contentBlocklist: guardrails.contentBlocklist.filter(t => t !== term),
    });
  };

  const autonomyOptions = [
    {
      value: 'manual',
      label: 'Manual',
      desc: 'All content requires approval before any action',
      color: 'border-slate-500/30 bg-slate-500/10',
      activeColor: 'border-blue-500 bg-blue-500/20 ring-1 ring-blue-500/50',
    },
    {
      value: 'semi_autonomous',
      label: 'Semi-Autonomous',
      desc: 'Low-risk actions auto-execute; high-risk ones need approval',
      color: 'border-yellow-500/30 bg-yellow-500/10',
      activeColor: 'border-yellow-500 bg-yellow-500/20 ring-1 ring-yellow-500/50',
    },
    {
      value: 'autonomous',
      label: 'Fully Autonomous',
      desc: 'All actions execute within guardrails; you get notified after',
      color: 'border-green-500/30 bg-green-500/10',
      activeColor: 'border-green-500 bg-green-500/20 ring-1 ring-green-500/50',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-white font-medium mb-3 flex items-center gap-2">
          <Shield size={16} className="text-brand-violet" /> Autonomy Level
        </h4>
        <div className="grid gap-3">
          {autonomyOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleSaveAutonomy(opt.value)}
              disabled={saving}
              className={`p-4 rounded-xl border text-left transition-all ${
                autonomyLevel === opt.value ? opt.activeColor : opt.color
              } ${saving ? 'opacity-50' : 'hover:opacity-80'}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-white">{opt.label}</span>
                {autonomyLevel === opt.value && <Check size={16} className="text-green-400" />}
              </div>
              <p className="text-xs text-slate-400 mt-1">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-xl p-6 space-y-4">
        <h4 className="text-white font-medium flex items-center gap-2">
          <Shield size={16} className="text-orange-400" /> Guardrails
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Max Actions/Day</label>
            <input
              type="number"
              min={1}
              value={guardrails.maxActionsPerDay}
              onChange={(e) => setGuardrails({ ...guardrails, maxActionsPerDay: parseInt(e.target.value) || 1 })}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-violet"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Max Posts/Day</label>
            <input
              type="number"
              min={0}
              value={guardrails.maxPostsPerDay}
              onChange={(e) => setGuardrails({ ...guardrails, maxPostsPerDay: parseInt(e.target.value) || 0 })}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-violet"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Max Spend/Day ($)</label>
            <input
              type="number"
              min={0}
              value={guardrails.maxSpendPerDay}
              onChange={(e) => setGuardrails({ ...guardrails, maxSpendPerDay: parseFloat(e.target.value) || 0 })}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-violet"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-400 block mb-1">Content Blocklist</label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={blocklistInput}
              onChange={(e) => setBlocklistInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addBlocklistTerm()}
              placeholder="Add blocked term..."
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-violet"
            />
            <button
              onClick={addBlocklistTerm}
              className="px-3 py-2 rounded-lg bg-slate-700 text-white text-sm hover:bg-slate-600"
            >
              <Plus size={14} />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {guardrails.contentBlocklist.map((term) => (
              <span key={term} className="flex items-center gap-1 px-2 py-1 rounded bg-red-500/20 text-red-300 text-xs">
                {term}
                <button onClick={() => removeBlocklistTerm(term)} className="hover:text-red-100">
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        </div>

        <button
          onClick={handleSaveGuardrails}
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-brand-violet text-white text-sm font-medium hover:bg-brand-violet/80 disabled:opacity-50"
        >
          Save Guardrails
        </button>
      </div>
    </div>
  );
}

function ExecutionLogTab({ agentId }: { agentId: string }) {
  const [logs, setLogs] = useState<ExecutionLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLogs = async () => {
      try {
        const resp = await api.getExecutionLog(agentId, 50);
        const data = Array.isArray(resp) ? resp : resp?.data || [];
        setLogs(data);
      } catch (error) {
        console.error('Failed to load execution log:', error);
      } finally {
        setLoading(false);
      }
    };
    loadLogs();
  }, [agentId]);

  if (loading) return <LoadingSpinner />;

  const resultColors: Record<string, string> = {
    success: 'bg-green-500/20 text-green-300',
    error: 'bg-red-500/20 text-red-300',
    queued: 'bg-yellow-500/20 text-yellow-300',
  };

  const guardrailColors: Record<string, string> = {
    passed: 'text-green-400',
    blocked: 'text-red-400',
    escalated: 'text-yellow-400',
  };

  return (
    <div className="space-y-3">
      {logs.length === 0 ? (
        <p className="text-slate-400 text-center py-6">No execution logs yet</p>
      ) : (
        logs.map((log) => (
          <div key={log.id} className="border border-brand-violet/10 rounded-lg p-4 bg-brand-violet-pressed/5">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <span className="text-sm font-medium text-white">{log.action_description || log.action_type}</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded ${resultColors[log.execution_result] || 'bg-slate-500/20 text-slate-300'}`}>
                    {log.execution_result}
                  </span>
                  <span className={`text-xs ${guardrailColors[log.guardrail_result] || 'text-slate-400'}`}>
                    Guardrails: {log.guardrail_result}
                  </span>
                  <span className="text-xs text-slate-500">{log.autonomy_level}</span>
                </div>
              </div>
              <time className="text-xs text-slate-500">{new Date(log.executed_at).toLocaleString()}</time>
            </div>
            {log.guardrails_checked && log.guardrails_checked.length > 0 && (
              <div className="flex gap-1 flex-wrap mt-2">
                {log.guardrails_checked.map((g, i) => (
                  <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">{g}</span>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

function ScheduleConfigTab({ agentId, liveStatus, onConfigChange }: {
  agentId: string;
  liveStatus?: AgentStatusInfo;
  onConfigChange: () => void;
}) {
  const [enabled, setEnabled] = useState(liveStatus?.enabled ?? true);
  const [cronExpression, setCronExpression] = useState(liveStatus?.cronExpression || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEnabled(liveStatus?.enabled ?? true);
    setCronExpression(liveStatus?.cronExpression || '');
  }, [liveStatus]);

  const handleToggle = async () => {
    setSaving(true);
    try {
      await api.updateAgentConfig(agentId, { enabled: !enabled });
      setEnabled(!enabled);
      onConfigChange();
    } catch (error) {
      console.error('Failed to toggle agent:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCron = async () => {
    if (!cronExpression.trim()) return;
    setSaving(true);
    try {
      await api.updateAgentConfig(agentId, { cronExpression: cronExpression.trim() });
      onConfigChange();
    } catch (error) {
      console.error('Failed to update schedule:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-800/50 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-white font-medium">Agent Enabled</h4>
            <p className="text-sm text-slate-400 mt-1">When disabled, scheduled runs will be skipped</p>
          </div>
          <button
            onClick={handleToggle}
            disabled={saving}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
              enabled ? 'bg-green-500' : 'bg-slate-600'
            } ${saving ? 'opacity-50' : ''}`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
              enabled ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-xl p-6">
        <h4 className="text-white font-medium mb-3">Schedule (Cron Expression)</h4>
        <p className="text-sm text-slate-400 mb-4">Current: {liveStatus?.nextRunAt || 'Not scheduled'}</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={cronExpression}
            onChange={(e) => setCronExpression(e.target.value)}
            placeholder="e.g., 0 9 * * 1 (Mondays at 9 AM)"
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-violet font-mono"
          />
          <button
            onClick={handleSaveCron}
            disabled={saving || !cronExpression.trim()}
            className="px-4 py-2 rounded-lg bg-brand-violet text-white text-sm font-medium hover:bg-brand-violet/80 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
        <div className="mt-3 text-xs text-slate-500 space-y-1">
          <p>Format: minute hour day-of-month month day-of-week (IST timezone)</p>
          <p>Examples: <code className="text-slate-400">0 7 * * *</code> = Daily 7 AM | <code className="text-slate-400">0 9 * * 1,3,5</code> = Mon/Wed/Fri 9 AM</p>
        </div>
      </div>
    </div>
  );
}

interface AgentMemoryData {
  working: any | null;
  shortTerm: Array<{ id: string; category: string; content: string; expiresAt: string; createdAt: string }>;
  longTerm: Array<{ id: string; category: string; pattern: string; confidence: number; occurrenceCount: number; createdAt: string }>;
  episodic: Array<{ id: string; eventType: string; title: string; description: string; impact?: string; tags: string[]; occurredAt: string }>;
  semantic: Array<{ id: string; content: string; category: string; createdAt: string }>;
}

function MemoryTab({ agentId }: { agentId: string }) {
  const [memory, setMemory] = useState<AgentMemoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeLayer, setActiveLayer] = useState<'short_term' | 'long_term' | 'episodic' | 'semantic' | 'working'>('short_term');
  const [showAddForm, setShowAddForm] = useState(false);
  const [addContent, setAddContent] = useState('');
  const [addCategory, setAddCategory] = useState('general');
  const [addTitle, setAddTitle] = useState('');
  const [addDescription, setAddDescription] = useState('');
  const [addEventType, setAddEventType] = useState('manual');
  const [saving, setSaving] = useState(false);

  const loadMemory = useCallback(async () => {
    try {
      const resp = await api.getAgentMemory(agentId);
      setMemory(resp?.data || resp);
    } catch (error) {
      console.error('Failed to load memory:', error);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => { loadMemory(); }, [loadMemory]);

  const handleAdd = async () => {
    if (!addContent.trim() && activeLayer !== 'episodic') return;
    setSaving(true);
    try {
      const payload: Record<string, any> = { layer: activeLayer };
      if (activeLayer === 'short_term') {
        payload.content = addContent;
        payload.category = addCategory;
      } else if (activeLayer === 'long_term') {
        payload.pattern = addContent;
        payload.category = addCategory;
      } else if (activeLayer === 'episodic') {
        payload.title = addTitle;
        payload.description = addDescription || addContent;
        payload.eventType = addEventType;
        payload.content = addContent;
      } else if (activeLayer === 'semantic') {
        payload.content = addContent;
        payload.category = addCategory;
      } else if (activeLayer === 'working') {
        try { payload.data = JSON.parse(addContent); } catch { payload.data = { note: addContent }; }
      }
      await api.addAgentMemory(agentId, payload);
      setAddContent(''); setAddTitle(''); setAddDescription('');
      setShowAddForm(false);
      await loadMemory();
    } catch (error) {
      console.error('Failed to add memory:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (memoryId: string, layer: string) => {
    try {
      await api.deleteAgentMemory(agentId, memoryId, layer);
      await loadMemory();
    } catch (error) {
      console.error('Failed to delete memory:', error);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!memory) return <ErrorState message="Failed to load memory data" />;

  const layers = [
    { id: 'short_term' as const, label: 'Short-Term', count: memory.shortTerm.length },
    { id: 'long_term' as const, label: 'Long-Term', count: memory.longTerm.length },
    { id: 'episodic' as const, label: 'Episodic', count: memory.episodic.length },
    { id: 'semantic' as const, label: 'Semantic', count: memory.semantic.length },
    { id: 'working' as const, label: 'Working', count: memory.working ? 1 : 0 },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2 overflow-x-auto">
          {layers.map(layer => (
            <button
              key={layer.id}
              onClick={() => { setActiveLayer(layer.id); setShowAddForm(false); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                activeLayer === layer.id
                  ? 'bg-brand-violet text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {layer.label} ({layer.count})
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-500/20 text-green-300 hover:bg-green-500/30 border border-green-500/30"
        >
          <Plus size={14} /> Add
        </button>
      </div>

      {showAddForm && (
        <div className="border border-brand-violet/20 rounded-lg p-4 bg-brand-violet-pressed/10 space-y-3">
          <div className="text-sm font-medium text-white">Add {layers.find(l => l.id === activeLayer)?.label} Memory</div>

          {(activeLayer === 'short_term' || activeLayer === 'long_term' || activeLayer === 'semantic') && (
            <input
              type="text"
              value={addCategory}
              onChange={e => setAddCategory(e.target.value)}
              placeholder="Category"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-violet"
            />
          )}

          {activeLayer === 'episodic' && (
            <>
              <input
                type="text"
                value={addEventType}
                onChange={e => setAddEventType(e.target.value)}
                placeholder="Event type (e.g., success, failure, milestone)"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-violet"
              />
              <input
                type="text"
                value={addTitle}
                onChange={e => setAddTitle(e.target.value)}
                placeholder="Event title"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-violet"
              />
              <textarea
                value={addDescription}
                onChange={e => setAddDescription(e.target.value)}
                placeholder="Event description"
                rows={2}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-violet resize-none"
              />
            </>
          )}

          <textarea
            value={addContent}
            onChange={e => setAddContent(e.target.value)}
            placeholder={activeLayer === 'working' ? 'JSON data or plain text' : 'Memory content'}
            rows={3}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-violet resize-none"
          />

          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={saving || (!addContent.trim() && activeLayer !== 'episodic')}
              className="px-4 py-1.5 rounded-lg text-xs font-medium bg-brand-violet text-white hover:bg-brand-violet/80 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {activeLayer === 'working' && (
          memory.working ? (
            <div className="border border-brand-violet/10 rounded-lg p-4 bg-brand-violet-pressed/5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-brand-violet-hover uppercase">Working Memory</span>
                <button onClick={() => handleDelete('working', 'working')} className="text-red-400 hover:text-red-300">
                  <Trash2 size={14} />
                </button>
              </div>
              <pre className="text-xs text-slate-300 bg-black/20 p-2 rounded overflow-auto max-h-48">
                {JSON.stringify(memory.working, null, 2)}
              </pre>
            </div>
          ) : (
            <p className="text-slate-400 text-center py-6">No working memory set</p>
          )
        )}

        {activeLayer === 'short_term' && (
          memory.shortTerm.length === 0 ? (
            <p className="text-slate-400 text-center py-6">No short-term memories</p>
          ) : (
            memory.shortTerm.map(mem => (
              <div key={mem.id} className="border border-brand-violet/10 rounded-lg p-4 bg-brand-violet-pressed/5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300">{mem.category}</span>
                    <p className="text-sm text-slate-200 mt-2">{mem.content}</p>
                    <div className="flex gap-3 mt-2 text-xs text-slate-500">
                      <span>Created: {new Date(mem.createdAt).toLocaleString()}</span>
                      <span>Expires: {new Date(mem.expiresAt).toLocaleString()}</span>
                    </div>
                  </div>
                  <button onClick={() => handleDelete(mem.id, 'short_term')} className="text-red-400 hover:text-red-300 ml-2">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )
        )}

        {activeLayer === 'long_term' && (
          memory.longTerm.length === 0 ? (
            <p className="text-slate-400 text-center py-6">No long-term memories</p>
          ) : (
            memory.longTerm.map(mem => (
              <div key={mem.id} className="border border-brand-violet/10 rounded-lg p-4 bg-brand-violet-pressed/5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300">{mem.category}</span>
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                        mem.confidence >= 0.8 ? 'bg-green-500/20 text-green-300' :
                        mem.confidence >= 0.5 ? 'bg-yellow-500/20 text-yellow-300' :
                        'bg-slate-500/20 text-slate-300'
                      }`}>
                        {(mem.confidence * 100).toFixed(0)}% confidence
                      </span>
                      <span className="text-xs text-slate-500">{mem.occurrenceCount}x observed</span>
                    </div>
                    <p className="text-sm text-slate-200">{mem.pattern}</p>
                  </div>
                  <button onClick={() => handleDelete(mem.id, 'long_term')} className="text-red-400 hover:text-red-300 ml-2">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )
        )}

        {activeLayer === 'episodic' && (
          memory.episodic.length === 0 ? (
            <p className="text-slate-400 text-center py-6">No episodic memories</p>
          ) : (
            memory.episodic.map(mem => (
              <div key={mem.id} className="border border-brand-violet/10 rounded-lg p-4 bg-brand-violet-pressed/5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300">{mem.eventType}</span>
                      {mem.impact && (
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                          mem.impact === 'positive' ? 'bg-green-500/20 text-green-300' :
                          mem.impact === 'negative' ? 'bg-red-500/20 text-red-300' :
                          'bg-slate-500/20 text-slate-300'
                        }`}>{mem.impact}</span>
                      )}
                    </div>
                    <h4 className="text-sm font-medium text-white">{mem.title}</h4>
                    <p className="text-sm text-slate-300 mt-1">{mem.description}</p>
                    {mem.tags.length > 0 && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {mem.tags.map((tag, i) => (
                          <span key={i} className="text-xs px-2 py-0.5 rounded bg-brand-violet/20 text-brand-violet-hover">{tag}</span>
                        ))}
                      </div>
                    )}
                    <span className="text-xs text-slate-500 mt-2 block">{new Date(mem.occurredAt).toLocaleString()}</span>
                  </div>
                  <button onClick={() => handleDelete(mem.id, 'episodic')} className="text-red-400 hover:text-red-300 ml-2">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )
        )}

        {activeLayer === 'semantic' && (
          memory.semantic.length === 0 ? (
            <p className="text-slate-400 text-center py-6">No semantic memories</p>
          ) : (
            memory.semantic.map(mem => (
              <div key={mem.id} className="border border-brand-violet/10 rounded-lg p-4 bg-brand-violet-pressed/5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300">{mem.category}</span>
                    <p className="text-sm text-slate-200 mt-2">{mem.content}</p>
                    <span className="text-xs text-slate-500 mt-2 block">{new Date(mem.createdAt).toLocaleString()}</span>
                  </div>
                  <button onClick={() => handleDelete(mem.id, 'semantic')} className="text-red-400 hover:text-red-300 ml-2">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
}

function DetailPanel({ agent, onClose, liveStatus, onConfigChange }: {
  agent: Agent;
  onClose: () => void;
  liveStatus?: AgentStatusInfo;
  onConfigChange: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'autonomy' | 'activity' | 'history' | 'accountability' | 'tasks' | 'content' | 'chat' | 'schedule' | 'code' | 'memory' | 'execlog'>('autonomy');

  const autonomyLabel = liveStatus?.autonomyLevel === 'autonomous' ? 'Autonomous' :
    liveStatus?.autonomyLevel === 'semi_autonomous' ? 'Semi-Auto' : 'Manual';

  const autonomyColor = liveStatus?.autonomyLevel === 'autonomous' ? 'bg-green-500/20 text-green-300' :
    liveStatus?.autonomyLevel === 'semi_autonomous' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-slate-500/20 text-slate-300';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-950 border border-brand-violet/10 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-start justify-between p-6 border-b border-brand-violet/10">
          <div className="flex items-center gap-4">
            <div className="text-brand-violet-hover">{AGENT_ICONS[agent.icon]}</div>
            <div>
              <h2 className="text-xl font-bold text-white">{agent.name}</h2>
              <p className="text-sm text-slate-400">{agent.role}</p>
              {liveStatus && (
                <div className="flex items-center gap-2 mt-1">
                  <StatusBadge status={liveStatus.status} />
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${autonomyColor}`}>
                    {autonomyLabel}
                  </span>
                  {!liveStatus.enabled && (
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-400">Disabled</span>
                  )}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex gap-2 px-6 pt-4 border-b border-slate-700 overflow-x-auto">
          {[
            { id: 'autonomy', label: 'Autonomy & Guardrails' },
            { id: 'accountability', label: 'Accountability' },
            { id: 'execlog', label: 'Execution Log' },
            { id: 'history', label: 'Run History' },
            { id: 'schedule', label: 'Schedule' },
            { id: 'activity', label: 'Activity Log' },
            { id: 'tasks', label: 'Tasks' },
            { id: 'content', label: 'Content Queue' },
            { id: 'memory', label: 'Memory' },
            { id: 'chat', label: 'Chat' },
            { id: 'code', label: 'Code Changes' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-brand-violet text-brand-violet'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'autonomy' && <AutonomyConfigTab agentId={agent.id} liveStatus={liveStatus} onConfigChange={onConfigChange} />}
          {activeTab === 'accountability' && <AccountabilityTab agentId={agent.id} />}
          {activeTab === 'execlog' && <ExecutionLogTab agentId={agent.id} />}
          {activeTab === 'history' && <RunHistoryTab agentId={agent.id} />}
          {activeTab === 'schedule' && <ScheduleConfigTab agentId={agent.id} liveStatus={liveStatus} onConfigChange={onConfigChange} />}
          {activeTab === 'activity' && <ActivityLogTab agentId={agent.id} />}
          {activeTab === 'tasks' && <TasksTab agentId={agent.id} />}
          {activeTab === 'content' && <ContentQueueTab agentId={agent.id} />}
          {activeTab === 'memory' && <MemoryTab agentId={agent.id} />}
          {activeTab === 'chat' && <ChatTab agentId={agent.id} />}
          {activeTab === 'code' && <CodeChangesTab agentId={agent.id} />}
        </div>
      </div>
    </div>
  );
}

function MetricsView() {
  const [metrics, setMetrics] = useState<CampaignMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);

  useEffect(() => {
    const loadMetrics = async () => {
      try {
        const data = await fetchSupabase<CampaignMetric>('dm_campaign_metrics');
        setMetrics(data);
      } catch (error) {
        console.error('Failed to load metrics:', error);
      } finally {
        setLoading(false);
      }
    };
    loadMetrics();
  }, []);

  if (loading) return <LoadingSpinner />;

  const sources = Array.from(new Set(metrics.map(m => m.source)));
  const filteredMetrics = selectedSource ? metrics.filter(m => m.source === selectedSource) : metrics;

  return (
    <div className="space-y-6">
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setSelectedSource(null)}
          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
            selectedSource === null
              ? 'bg-brand-violet text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          All Sources
        </button>
        {sources.map((source) => (
          <button
            key={source}
            onClick={() => setSelectedSource(source)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              selectedSource === source
                ? 'bg-brand-violet text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {source}
          </button>
        ))}
      </div>

      {filteredMetrics.length === 0 ? (
        <p className="text-slate-400 text-center py-12">No metrics data available</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredMetrics.map((metric) => (
            <div key={metric.id} className="bg-gradient-to-br from-brand-violet-pressed/20 to-brand-violet/10 border border-brand-violet/20 rounded-xl p-6">
              <h3 className="font-semibold text-white mb-4">{metric.campaign_name}</h3>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(metric.metrics || {}).map(([key, value]: [string, any]) => (
                  <div key={key} className="bg-slate-800/50 rounded-lg p-3">
                    <div className="text-xs text-slate-400 uppercase tracking-wider">{key}</div>
                    <div className="text-lg font-bold text-white mt-1">
                      {typeof value === 'number' ? value.toLocaleString() : value}
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-xs text-slate-500 mt-4">
                {new Date(metric.metric_date).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ContentApprovalView() {
  const [items, setItems] = useState<ContentQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);

  useEffect(() => {
    const loadItems = async () => {
      try {
        const data = await fetchSupabase<ContentQueueItem>('dm_content_queue');
        setItems(data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      } catch (error) {
        console.error('Failed to load content queue:', error);
      } finally {
        setLoading(false);
      }
    };
    loadItems();
  }, []);

  const handleApproveAll = useCallback(async () => {
    const pendingItems = filteredItems.filter(i => i.status === 'pending');
    for (const item of pendingItems) {
      try {
        await updateSupabase('dm_content_queue', item.id, { status: 'approved' });
      } catch (error) {
        console.error('Failed to approve:', error);
      }
    }
    setItems(items.map(i =>
      pendingItems.some(p => p.id === i.id) ? { ...i, status: 'approved' } : i
    ));
  }, [items]);

  const channels = Array.from(new Set(items.map(i => i.channel)));
  const filteredItems = filter ? items.filter(i => i.channel === filter) : items;

  if (loading) return <LoadingSpinner />;

  const pendingCount = filteredItems.filter(i => i.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter(null)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === null
                ? 'bg-brand-violet text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            All Channels
          </button>
          {channels.map((channel) => (
            <button
              key={channel}
              onClick={() => setFilter(channel)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === channel
                  ? 'bg-brand-violet text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {channel}
            </button>
          ))}
        </div>
        {pendingCount > 0 && (
          <button
            onClick={handleApproveAll}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700"
          >
            <Check size={16} />
            Approve All ({pendingCount})
          </button>
        )}
      </div>

      {filteredItems.length === 0 ? (
        <p className="text-slate-400 text-center py-12">No content in queue</p>
      ) : (
        <div className="grid gap-4">
          {filteredItems.map((item) => (
            <ContentQueueItemCard key={item.id} item={item} onUpdate={(id, status: any) => {
              setItems(items.map(i => i.id === id ? { ...i, status } : i));
            }} />
          ))}
        </div>
      )}
    </div>
  );
}

function ContentQueueItemCard({
  item,
  onUpdate
}: {
  item: ContentQueueItem;
  onUpdate: (id: number, status: string) => void;
}) {
  const [updating, setUpdating] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const handleAction = useCallback(async (status: string) => {
    setUpdating(true);
    try {
      await updateSupabase('dm_content_queue', item.id, { status });
      onUpdate(item.id, status);
    } catch (error) {
      console.error('Failed to update:', error);
    } finally {
      setUpdating(false);
    }
  }, [item.id, onUpdate]);

  const handlePublish = useCallback(async () => {
    setPublishing(true);
    try {
      const result = await api.publishContent(item.id);
      if (result?.data?.success || result?.success) {
        onUpdate(item.id, 'published');
      } else {
        alert(`Publish failed: ${result?.data?.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to publish:', error);
      alert('Failed to publish content');
    } finally {
      setPublishing(false);
    }
  }, [item.id, onUpdate]);

  return (
    <div className="border border-brand-violet/10 rounded-lg p-4 bg-brand-violet-pressed/5">
      <div className="mb-4">
        <h4 className="font-semibold text-white">{item.title}</h4>
        <p className="text-sm text-slate-300 mt-2">{item.body}</p>
      </div>

      <div className="flex items-center gap-4 text-xs text-slate-400 mb-4">
        <span className="px-2 py-1 rounded bg-slate-700 text-slate-200">{item.channel}</span>
        <span>{item.content_type}</span>
        <span>Scheduled: {new Date(item.scheduled_for).toLocaleString()}</span>
      </div>

      {item.status === 'pending' && (
        <div className="flex gap-2">
          <button
            onClick={() => handleAction('approved')}
            disabled={updating}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-green-500/20 text-green-300 hover:bg-green-500/30 border border-green-500/30 text-sm font-medium disabled:opacity-50"
          >
            <Check size={16} /> Approve
          </button>
          <button
            onClick={() => handleAction('rejected')}
            disabled={updating}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30 text-sm font-medium disabled:opacity-50"
          >
            <XCircle size={16} /> Reject
          </button>
        </div>
      )}

      {item.status === 'approved' && (
        <div className="flex gap-2">
          <div className="flex-1 px-3 py-2 rounded-lg text-sm font-medium text-center bg-green-500/20 text-green-300">
            Approved
          </div>
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-violet text-white text-sm font-medium hover:bg-brand-violet/80 disabled:opacity-50"
          >
            <Upload size={14} />
            {publishing ? 'Publishing...' : 'Publish'}
          </button>
        </div>
      )}

      {item.status === 'published' && (
        <div className="px-3 py-2 rounded-lg text-sm font-medium text-center bg-brand-violet/20 text-brand-violet-hover">
          Published
        </div>
      )}

      {item.status === 'rejected' && (
        <div className="px-3 py-2 rounded-lg text-sm font-medium text-center bg-red-500/20 text-red-300">
          Rejected
        </div>
      )}
    </div>
  );
}

// Main Component
export function AgentsManagement() {
  const [view, setView] = useState<'overview' | 'metrics' | 'approval'>('overview');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [stats, setStats] = useState<Record<string, { tasksToday: number; contentPending: number; messagesUnread: number }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [agentStatuses, setAgentStatuses] = useState<AgentStatusInfo[]>([]);
  const [emergencyStopping, setEmergencyStopping] = useState(false);

  const loadStatuses = useCallback(async () => {
    try {
      const resp = await api.getAgentStatuses();
      const data = Array.isArray(resp) ? resp : resp?.data || [];
      setAgentStatuses(data);
    } catch (err) {
      console.error('Failed to load agent statuses:', err);
    }
  }, []);

  const handleEmergencyStop = useCallback(async () => {
    if (!confirm('This will immediately pause ALL autonomous agent activity and set all agents to Manual mode. Continue?')) return;
    setEmergencyStopping(true);
    try {
      await api.emergencyStopAllAgents();
      await loadStatuses();
    } catch (err) {
      console.error('Emergency stop failed:', err);
    } finally {
      setEmergencyStopping(false);
    }
  }, [loadStatuses]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const agentsData = await fetchSupabase<Agent>('dm_agents');
        setAgents(agentsData);

        await loadStatuses();

        const stats: Record<string, any> = {};
        for (const agent of agentsData) {
          const today = new Date().toISOString().split('T')[0];

          const tasks = await fetchSupabase<AgentTask>(
            'dm_agent_tasks',
            'id',
            { agent_id: agent.id }
          );
          const tasksToday = tasks.filter(t => t.created_at && t.created_at.startsWith(today) && t.status === 'completed').length;

          const content = await fetchSupabase<ContentQueueItem>(
            'dm_content_queue',
            'id',
            { agent_id: agent.id }
          );
          const contentPending = content.filter(c => c.status === 'pending').length;

          const messages = await fetchSupabase<AgentMessage>(
            'dm_agent_messages',
            'id',
            { agent_id: agent.id }
          );
          const messagesUnread = messages.filter(m => !m.read && m.direction === 'outbound').length;

          stats[agent.id] = { tasksToday, contentPending, messagesUnread };
        }
        setStats(stats);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load agents');
      } finally {
        setLoading(false);
      }
    };

    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadStatuses]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} />;

  const hasAutonomousAgents = agentStatuses.some(s => s.autonomyLevel !== 'manual');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">AI Agent Workforce</h2>
        <div className="flex gap-2 items-center">
          {hasAutonomousAgents && (
            <button
              onClick={handleEmergencyStop}
              disabled={emergencyStopping}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-50 animate-pulse hover:animate-none"
            >
              <Octagon size={16} />
              {emergencyStopping ? 'Stopping...' : 'Emergency Stop'}
            </button>
          )}
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'metrics', label: 'Metrics' },
            { id: 'approval', label: 'Content Approval' },
          ].map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                view === v.id
                  ? 'bg-brand-violet text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {view === 'overview' && (
        <div className="space-y-6">
          {(() => {
            const openclawAgents = agents.filter(a => ['cleya-marketing', 'cleya-growth', 'cleya-finance', 'cleya-sales'].includes(a.id));
            const otherAgents = agents.filter(a => !['cleya-marketing', 'cleya-growth', 'cleya-finance', 'cleya-sales'].includes(a.id));
            return (
              <>
                {openclawAgents.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <span>🐾</span> OpenClaw Agents
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {openclawAgents.map((agent) => (
                        <AgentCard
                          key={agent.id}
                          agent={agent}
                          stats={stats[agent.id] || { tasksToday: 0, contentPending: 0, messagesUnread: 0 }}
                          onClick={() => setSelectedAgent(agent)}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {otherAgents.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <span>⚙️</span> Other Agents
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {otherAgents.map((agent) => (
                        <AgentCard
                          key={agent.id}
                          agent={agent}
                          stats={stats[agent.id] || { tasksToday: 0, contentPending: 0, messagesUnread: 0 }}
                          onClick={() => setSelectedAgent(agent)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {view === 'metrics' && <MetricsView />}
      {view === 'approval' && <ContentApprovalView />}

      {selectedAgent && (
        <DetailPanel
          agent={selectedAgent}
          onClose={() => setSelectedAgent(null)}
          liveStatus={agentStatuses.find(s => s.agentId === selectedAgent.id)}
          onConfigChange={loadStatuses}
        />
      )}
    </div>
  );
}
