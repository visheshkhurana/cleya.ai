export interface Channel {
  id: string;
  name: string;
  type: 'agent' | 'special';
  agentId?: string;
  emoji: string;
  description: string;
  color: string;
  unreadCount: number;
  presence: 'idle' | 'running' | 'active' | 'offline';
  hasNewActivity?: boolean;
}

export interface ChatMessage {
  id: string;
  channelId: string;
  sender: 'user' | 'agent' | 'system';
  agentId?: string;
  agentName?: string;
  agentEmoji?: string;
  content: string;
  timestamp: Date;
  type: 'chat' | 'run-output' | 'system-event' | 'error';
  threadId?: string;
  threadCount?: number;
  mentions?: string[];
}

export interface Thread {
  parentMessage: ChatMessage;
  replies: ChatMessage[];
}

export interface AgentInfo {
  id: string;
  name: string;
  emoji: string;
  role: string;
  description: string;
  color: string;
}

export interface CommandAction {
  id: string;
  label: string;
  description: string;
  shortcut?: string;
  icon: string;
  category: 'command' | 'channel' | 'agent';
  action: () => void;
}

export const AGENT_CHANNELS: Channel[] = [
  { id: 'founder-room', name: 'founder-room', type: 'special', emoji: '\uD83C\uDFE0', description: 'Your command center \u2014 talk to any agent', color: 'indigo', unreadCount: 0, presence: 'active' },
  { id: 'all-agents', name: 'all-agents', type: 'special', emoji: '\uD83D\uDCE2', description: 'Broadcast to all agents', color: 'violet', unreadCount: 0, presence: 'active' },
  { id: 'nexus', name: 'nexus', type: 'agent', agentId: 'nexus', emoji: '\uD83E\uDDE0', description: 'Orchestrator \u2014 coordinates all agents', color: 'purple', unreadCount: 0, presence: 'idle' },
  { id: 'maven', name: 'maven', type: 'agent', agentId: 'maven', emoji: '\uD83C\uDFAF', description: 'Marketing \u2014 content, SEO, social', color: 'blue', unreadCount: 0, presence: 'idle' },
  { id: 'ledger', name: 'ledger', type: 'agent', agentId: 'ledger', emoji: '\uD83D\uDCCA', description: 'Finance \u2014 modeling, runway, fundraising', color: 'amber', unreadCount: 0, presence: 'idle' },
  { id: 'sentinel', name: 'sentinel', type: 'agent', agentId: 'sentinel', emoji: '\uD83D\uDEE1\uFE0F', description: 'CTO \u2014 architecture, security, performance', color: 'cyan', unreadCount: 0, presence: 'idle' },
  { id: 'ally', name: 'ally', type: 'agent', agentId: 'ally', emoji: '\uD83D\uDCAC', description: 'Support \u2014 customer success, onboarding', color: 'green', unreadCount: 0, presence: 'idle' },
  { id: 'catalyst', name: 'catalyst', type: 'agent', agentId: 'catalyst', emoji: '\uD83D\uDE80', description: 'Growth \u2014 viral loops, referrals, activation', color: 'emerald', unreadCount: 0, presence: 'idle' },
  { id: 'closer', name: 'closer', type: 'agent', agentId: 'closer', emoji: '\uD83E\uDD1D', description: 'Sales \u2014 outreach, pipeline, investor relations', color: 'rose', unreadCount: 0, presence: 'idle' },
];

export const AGENT_MAP: Record<string, AgentInfo> = {
  nexus: { id: 'nexus', name: 'Nexus', emoji: '\uD83E\uDDE0', role: 'Orchestrator', description: 'Master coordinator', color: 'purple' },
  maven: { id: 'maven', name: 'Maven', emoji: '\uD83C\uDFAF', role: 'Marketing', description: 'Content, SEO, social media', color: 'blue' },
  ledger: { id: 'ledger', name: 'Ledger', emoji: '\uD83D\uDCCA', role: 'Finance', description: 'Financial modeling, runway', color: 'amber' },
  sentinel: { id: 'sentinel', name: 'Sentinel', emoji: '\uD83D\uDEE1\uFE0F', role: 'CTO', description: 'Architecture, security', color: 'cyan' },
  ally: { id: 'ally', name: 'Ally', emoji: '\uD83D\uDCAC', role: 'Support', description: 'Customer success', color: 'green' },
  catalyst: { id: 'catalyst', name: 'Catalyst', emoji: '\uD83D\uDE80', role: 'Growth', description: 'Viral loops, referrals', color: 'emerald' },
  closer: { id: 'closer', name: 'Closer', emoji: '\uD83E\uDD1D', role: 'Sales', description: 'B2B sales, outreach', color: 'rose' },
};

export const PRESENCE_COLORS: Record<string, string> = {
  active: 'bg-green-400',
  running: 'bg-yellow-400 animate-pulse',
  idle: 'bg-slate-500',
  offline: 'bg-slate-700',
};

export const CHANNEL_COLORS: Record<string, string> = {
  purple: 'text-purple-400',
  indigo: 'text-indigo-400',
  blue: 'text-blue-400',
  cyan: 'text-cyan-400',
  green: 'text-green-400',
  emerald: 'text-emerald-400',
  amber: 'text-amber-400',
  rose: 'text-rose-400',
  violet: 'text-violet-400',
};
