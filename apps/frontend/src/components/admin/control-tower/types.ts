import { useState, useEffect } from 'react';
import { fetchAgentDefinitions, clearAgentCache, type AgentDefinition } from '@/lib/agentDefinitions';

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

export function buildAgentChannels(registry: Record<string, AgentDefinition>): Channel[] {
  return [
    { id: 'founder-room', name: 'founder-room', type: 'special', emoji: '\uD83C\uDFE0', description: 'Your command center \u2014 talk to any agent', color: 'indigo', unreadCount: 0, presence: 'active' },
    { id: 'all-agents', name: 'all-agents', type: 'special', emoji: '\uD83D\uDCE2', description: 'Broadcast to all agents', color: 'violet', unreadCount: 0, presence: 'active' },
    ...Object.values(registry).map((agent: AgentDefinition) => ({
      id: agent.id,
      name: agent.id,
      type: 'agent' as const,
      agentId: agent.id,
      emoji: agent.emoji,
      description: agent.role ? `${agent.role} \u2014 ${agent.description}` : agent.description,
      color: agent.color,
      unreadCount: 0,
      presence: 'idle' as const,
    })),
  ];
}

export function buildAgentMap(registry: Record<string, AgentDefinition>): Record<string, AgentInfo> {
  return Object.fromEntries(
    Object.entries(registry).map(([id, agent]) => [id, {
      id: agent.id,
      name: agent.name,
      emoji: agent.emoji,
      role: agent.role,
      description: agent.description,
      color: agent.color,
    }])
  );
}

const SPECIAL_CHANNELS: Channel[] = [
  { id: 'founder-room', name: 'founder-room', type: 'special', emoji: '\uD83C\uDFE0', description: 'Your command center \u2014 talk to any agent', color: 'indigo', unreadCount: 0, presence: 'active' },
  { id: 'all-agents', name: 'all-agents', type: 'special', emoji: '\uD83D\uDCE2', description: 'Broadcast to all agents', color: 'violet', unreadCount: 0, presence: 'active' },
];

let sharedAgentMap: Record<string, AgentInfo> = {};
let sharedAgentChannels: Channel[] = [...SPECIAL_CHANNELS];
let sharedLoaded = false;
let sharedListeners: Set<() => void> = new Set();

function notifyListeners() {
  sharedListeners.forEach(fn => fn());
}

async function loadAgentData() {
  const registry = await fetchAgentDefinitions();
  if (Object.keys(registry).length > 0) {
    sharedAgentMap = buildAgentMap(registry);
    sharedAgentChannels = buildAgentChannels(registry);
  }
  sharedLoaded = true;
  notifyListeners();
}

export function refreshAgentData() {
  clearAgentCache();
  sharedLoaded = false;
  loadAgentData();
}

export function useAgentData() {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const listener = () => forceUpdate(n => n + 1);
    sharedListeners.add(listener);

    if (!sharedLoaded) {
      loadAgentData();
    }

    return () => { sharedListeners.delete(listener); };
  }, []);

  return { agentChannels: sharedAgentChannels, agentMap: sharedAgentMap, loading: !sharedLoaded };
}

export function getAgentMap(): Record<string, AgentInfo> {
  return sharedAgentMap;
}

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
