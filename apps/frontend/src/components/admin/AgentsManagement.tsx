'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Brain, Lightbulb, Share2, Mail, Target, Globe, Zap, BarChart3,
  Clock, AlertCircle, CheckCircle, ChevronRight, X, Send, Plus,
  Filter, Download, Eye, Check, XCircle, Loader
} from 'lucide-react';

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

const SUPABASE_URL = 'https://lyuiazskqubmlzwuokzm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5dWlhenNrcXVibWx6d3Vva3ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQwMDcwMjgsImV4cCI6MjA1OTU4MzAyOH0.Zt7JieKib-_lBjgOBiWIzZ9wQnDHLloGWVavSijJwXM';

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

function StatusBadge({ status }: { status: 'active' | 'idle' | 'error' }) {
  const statusConfig = {
    active: 'bg-green-500/20 text-green-300 border-green-500/30',
    idle: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
    error: 'bg-red-500/20 text-red-300 border-red-500/30',
  };

  return (
    <div className={`flex items-center gap-2 px-3 py-1 rounded-lg border text-xs font-medium ${statusConfig[status]}`}>
      <div
        className={`w-2 h-2 rounded-full ${
          status === 'active' ? 'bg-green-400 animate-pulse' :
          status === 'error' ? 'bg-red-400' :
          'bg-slate-400'
        }`}
      />
      {status === 'active' ? 'Active' : status === 'idle' ? 'Idle' : 'Error'}
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

    setSending(true);
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/dm_agent_messages`,
        {
          method: 'POST',
          headers: { ...supabaseHeaders, 'Prefer': 'return=representation' },
          body: JSON.stringify({
            agent_id: agentId,
            direction: 'inbound',
            message: newMessage,
            message_type: 'text',
            metadata: {},
            read: false,
          }),
        }
      );
      if (response.ok) {
        const newMsg = await response.json();
        setMessages([...messages, newMsg[0]]);
        setNewMessage('');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
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

function DetailPanel({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'activity' | 'tasks' | 'content' | 'chat' | 'code'>('activity');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-950 border border-brand-violet/10 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-start justify-between p-6 border-b border-brand-violet/10">
          <div className="flex items-center gap-4">
            <div className="text-brand-violet-hover">{AGENT_ICONS[agent.icon]}</div>
            <div>
              <h2 className="text-xl font-bold text-white">{agent.name}</h2>
              <p className="text-sm text-slate-400">{agent.role}</p>
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
            { id: 'activity', label: 'Activity Log' },
            { id: 'tasks', label: 'Tasks' },
            { id: 'content', label: 'Content Queue' },
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
          {activeTab === 'activity' && <ActivityLogTab agentId={agent.id} />}
          {activeTab === 'tasks' && <TasksTab agentId={agent.id} />}
          {activeTab === 'content' && <ContentQueueTab agentId={agent.id} />}
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

      {item.status !== 'pending' && (
        <div className={`px-3 py-2 rounded-lg text-sm font-medium text-center ${
          item.status === 'approved' ? 'bg-green-500/20 text-green-300' :
          item.status === 'rejected' ? 'bg-red-500/20 text-red-300' :
          'bg-brand-violet/20 text-brand-violet-hover'
        }`}>
          {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
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

  useEffect(() => {
    const loadData = async () => {
      try {
        const agentsData = await fetchSupabase<Agent>('dm_agents');
        setAgents(agentsData);

        const stats: Record<string, any> = {};
        for (const agent of agentsData) {
          const today = new Date().toISOString().split('T')[0];

          const tasks = await fetchSupabase<AgentTask>(
            'dm_agent_tasks',
            'id',
            { agent_id: agent.id }
          );
          const tasksToday = tasks.filter(t => t.created_at.startsWith(today) && t.status === 'completed').length;

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
  }, []);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Digital Marketing Agents</h2>
        <div className="flex gap-2">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              stats={stats[agent.id] || { tasksToday: 0, contentPending: 0, messagesUnread: 0 }}
              onClick={() => setSelectedAgent(agent)}
            />
          ))}
        </div>
      )}

      {view === 'metrics' && <MetricsView />}
      {view === 'approval' && <ContentApprovalView />}

      {selectedAgent && (
        <DetailPanel agent={selectedAgent} onClose={() => setSelectedAgent(null)} />
      )}
    </div>
  );
}
