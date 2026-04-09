import { api } from '@/lib/api';

export interface AgentDefinition {
  id: string;
  name: string;
  emoji: string;
  role: string;
  description: string;
  color: string;
}

let cachedAgents: Record<string, AgentDefinition> | null = null;
let fetchPromise: Promise<Record<string, AgentDefinition>> | null = null;

export async function fetchAgentDefinitions(): Promise<Record<string, AgentDefinition>> {
  if (cachedAgents && Object.keys(cachedAgents).length > 0) return cachedAgents;
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    try {
      const data = await api.getAgentStatuses();
      const agents = Array.isArray(data) ? data : [];
      const registry: Record<string, AgentDefinition> = {};
      for (const a of agents) {
        registry[a.agentId] = {
          id: a.agentId,
          name: a.name,
          emoji: a.emoji || '🤖',
          role: a.codename,
          description: `${a.codename} agent`,
          color: a.color || 'slate',
        };
      }
      if (Object.keys(registry).length > 0) {
        cachedAgents = registry;
      }
      return registry;
    } catch (err: any) {
      const msg = err?.message || '';
      if (!msg.includes('authorization') && !msg.includes('401')) {
        console.error('Failed to fetch agent definitions:', err);
      }
      return {};
    } finally {
      fetchPromise = null;
    }
  })();

  return fetchPromise;
}

export function clearAgentCache() {
  cachedAgents = null;
  fetchPromise = null;
}
