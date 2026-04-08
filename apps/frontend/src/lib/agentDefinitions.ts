export interface AgentDefinition {
  id: string;
  name: string;
  emoji: string;
  role: string;
  description: string;
  color: string;
}

export const AGENT_REGISTRY: Record<string, AgentDefinition> = {
  nexus: { id: 'nexus', name: 'Nexus', emoji: '\uD83E\uDDE0', role: 'Orchestrator', description: 'Master coordinator', color: 'purple' },
  maven: { id: 'maven', name: 'Maven', emoji: '\uD83C\uDFAF', role: 'Marketing', description: 'Content, SEO, social media', color: 'blue' },
  ledger: { id: 'ledger', name: 'Ledger', emoji: '\uD83D\uDCCA', role: 'Finance', description: 'Financial modeling, runway', color: 'amber' },
  sentinel: { id: 'sentinel', name: 'Sentinel', emoji: '\uD83D\uDEE1\uFE0F', role: 'CTO', description: 'Architecture, security', color: 'cyan' },
  ally: { id: 'ally', name: 'Ally', emoji: '\uD83D\uDCAC', role: 'Support', description: 'Customer success', color: 'green' },
  catalyst: { id: 'catalyst', name: 'Catalyst', emoji: '\uD83D\uDE80', role: 'Growth', description: 'Viral loops, referrals', color: 'emerald' },
  closer: { id: 'closer', name: 'Closer', emoji: '\uD83E\uDD1D', role: 'Sales', description: 'B2B sales, outreach', color: 'rose' },
};

export const AGENT_IDS = Object.keys(AGENT_REGISTRY);
