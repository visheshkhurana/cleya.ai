import { AGENT_REGISTRY, type AgentDefinition } from '@/lib/agentDefinitions';

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

const ROLE_DESCRIPTIONS: Record<string, string> = {
  nexus: 'Orchestrator \u2014 coordinates all agents',
  maven: 'Marketing \u2014 content, SEO, social',
  ledger: 'Finance \u2014 modeling, runway, fundraising',
  sentinel: 'CTO \u2014 architecture, security, performance',
  ally: 'Support \u2014 customer success, onboarding',
  catalyst: 'Growth \u2014 viral loops, referrals, activation',
  closer: 'Sales \u2014 outreach, pipeline, investor relations',
};

export const AGENT_CHANNELS: Channel[] = [
  { id: 'founder-room', name: 'founder-room', type: 'special', emoji: '\uD83C\uDFE0', description: 'Your command center \u2014 talk to any agent', color: 'indigo', unreadCount: 0, presence: 'active' },
  { id: 'all-agents', name: 'all-agents', type: 'special', emoji: '\uD83D\uDCE2', description: 'Broadcast to all agents', color: 'violet', unreadCount: 0, presence: 'active' },
  ...Object.values(AGENT_REGISTRY).map((agent: AgentDefinition) => ({
    id: agent.id,
    name: agent.id,
    type: 'agent' as const,
    agentId: agent.id,
    emoji: agent.emoji,
    description: ROLE_DESCRIPTIONS[agent.id] || agent.description,
    color: agent.color,
    unreadCount: 0,
    presence: 'idle' as const,
  })),
];

export const AGENT_MAP: Record<string, AgentInfo> = Object.fromEntries(
  Object.entries(AGENT_REGISTRY).map(([id, agent]) => [id, {
    id: agent.id,
    name: agent.name,
    emoji: agent.emoji,
    role: agent.role,
    description: agent.description,
    color: agent.color,
  }])
);

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
