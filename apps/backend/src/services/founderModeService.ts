import { prisma } from '@cleya/db';
import { createAIService } from '@cleya/ai';
import { supabaseInsert, supabaseSelect, supabaseUpdate } from './supabaseClient';

export interface Decision {
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

export interface DebateEntry {
  id: number;
  decision_id: number;
  agent_id: string;
  agent_name: string;
  position: 'for' | 'against' | 'neutral';
  argument: string;
  data_points: Record<string, any>;
  created_at: string;
}

export interface DailyBriefing {
  date: string;
  metrics: Record<string, any>;
  agentActivity: any[];
  pendingDecisions: Decision[];
  pendingContent: any[];
  priorityItems: any[];
  actionList: string[];
}

let aiService: ReturnType<typeof createAIService> | null = null;
function getAI() {
  if (!aiService) {
    if (!process.env.OPENAI_API_KEY) return null;
    aiService = createAIService({ provider: 'openai', model: 'gpt-4o-mini' });
  }
  return aiService;
}

export async function ensureFounderModeTables(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS dm_decisions (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        context TEXT NOT NULL DEFAULT '',
        options TEXT[] DEFAULT '{}',
        requesting_agent TEXT NOT NULL,
        urgency TEXT DEFAULT 'medium',
        status TEXT DEFAULT 'pending',
        chosen_option TEXT,
        outcome TEXT,
        founder_notes TEXT,
        created_at TIMESTAMPTZ DEFAULT now(),
        decided_at TIMESTAMPTZ
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS dm_decision_debates (
        id SERIAL PRIMARY KEY,
        decision_id INTEGER NOT NULL REFERENCES dm_decisions(id) ON DELETE CASCADE,
        agent_id TEXT NOT NULL,
        agent_name TEXT NOT NULL,
        position TEXT DEFAULT 'neutral',
        argument TEXT NOT NULL DEFAULT '',
        data_points JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS dm_daily_briefings (
        id SERIAL PRIMARY KEY,
        briefing_date DATE NOT NULL,
        content JSONB NOT NULL DEFAULT '{}',
        generated_by TEXT DEFAULT 'nexus',
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `);

    try {
      await prisma.$executeRawUnsafe(`NOTIFY pgrst, 'reload schema';`);
    } catch {}

    console.log('[FounderMode] Decision tables ensured');
  } catch (err: any) {
    console.log(`[FounderMode] Could not create tables: ${err.message}`);
  }
}

export async function createDecision(data: {
  title: string;
  context: string;
  options: string[];
  requesting_agent: string;
  urgency: string;
}): Promise<Decision> {
  const rows = await supabaseInsert<Decision>('dm_decisions', {
    title: data.title,
    context: data.context,
    options: data.options,
    requesting_agent: data.requesting_agent,
    urgency: data.urgency,
    status: 'pending',
    created_at: new Date().toISOString(),
  });
  return rows[0];
}

export async function getDecisions(filters?: {
  status?: string;
  urgency?: string;
  limit?: number;
}): Promise<Decision[]> {
  const queryFilters: Record<string, string> = {};
  if (filters?.status) queryFilters.status = filters.status;
  if (filters?.urgency) queryFilters.urgency = filters.urgency;

  return supabaseSelect<Decision>(
    'dm_decisions',
    Object.keys(queryFilters).length > 0 ? queryFilters : undefined,
    { order: 'created_at.desc', limit: filters?.limit || 50 }
  );
}

export async function updateDecisionStatus(
  id: number,
  status: 'approved' | 'rejected' | 'deferred',
  chosenOption?: string,
  founderNotes?: string
): Promise<void> {
  const updateData: Record<string, any> = {
    status,
    decided_at: new Date().toISOString(),
  };
  if (chosenOption) updateData.chosen_option = chosenOption;
  if (founderNotes) updateData.founder_notes = founderNotes;

  await supabaseUpdate('dm_decisions', { id: String(id) }, updateData);
}

export async function updateDecisionOutcome(id: number, outcome: string): Promise<void> {
  await supabaseUpdate('dm_decisions', { id: String(id) }, { outcome });
}

const AGENT_DEBATE_CONFIG: Record<string, { name: string; emoji: string; expertise: string }> = {
  nexus: { name: 'Nexus', emoji: '🧠', expertise: 'Strategic coordination, cross-functional impact analysis' },
  maven: { name: 'Maven', emoji: '🎯', expertise: 'Marketing impact, brand positioning, audience reach' },
  ledger: { name: 'Ledger', emoji: '📊', expertise: 'Financial impact, ROI analysis, budget implications' },
  sentinel: { name: 'Sentinel', emoji: '🛡️', expertise: 'Technical feasibility, infrastructure impact, security' },
  ally: { name: 'Ally', emoji: '💬', expertise: 'Customer impact, support implications, user experience' },
  catalyst: { name: 'Catalyst', emoji: '🚀', expertise: 'Growth impact, viral potential, network effects' },
  closer: { name: 'Closer', emoji: '🤝', expertise: 'Sales impact, pipeline effect, partnership implications' },
};

function selectDebateAgents(requestingAgent: string): string[] {
  const allAgents = Object.keys(AGENT_DEBATE_CONFIG);
  const candidates = allAgents.filter(a => a !== requestingAgent && a !== 'nexus');
  const selected = candidates.sort(() => Math.random() - 0.5).slice(0, 2);
  if (!selected.includes('nexus')) {
    selected.push('nexus');
  }
  return selected;
}

export async function triggerDebate(decisionId: number): Promise<DebateEntry[]> {
  const decisions = await supabaseSelect<Decision>('dm_decisions', { id: String(decisionId) });
  if (decisions.length === 0) {
    throw new Error('Decision not found');
  }
  const decision = decisions[0];

  const ai = getAI();
  if (!ai) {
    throw new Error('AI service not configured');
  }

  const agentIds = selectDebateAgents(decision.requesting_agent);
  const entries: DebateEntry[] = [];

  for (const agentId of agentIds) {
    const config = AGENT_DEBATE_CONFIG[agentId];
    if (!config) continue;

    const positions = ['for', 'against', 'neutral'] as const;
    const position = positions[Math.floor(Math.random() * positions.length)];

    const systemPrompt = `You are ${config.name}, an AI agent with expertise in: ${config.expertise}.
You are participating in a multi-agent debate about a business decision for Cleya.ai (AI-powered professional networking platform for India's startup ecosystem).

Your position in this debate is: ${position === 'for' ? 'IN FAVOR' : position === 'against' ? 'AGAINST' : 'NEUTRAL/ANALYTICAL'}.

Provide a concise, data-driven argument (2-3 paragraphs max). Include specific metrics, projections, or benchmarks where relevant.
Focus on your area of expertise. Be direct and actionable.

Format your response as JSON:
{
  "argument": "Your main argument text here",
  "dataPoints": {
    "key_metric_1": "value or projection",
    "key_metric_2": "value or projection"
  }
}`;

    const userPrompt = `Decision: ${decision.title}
Context: ${decision.context}
Options: ${(decision.options || []).join(', ')}
Requested by: ${decision.requesting_agent}
Urgency: ${decision.urgency}

Provide your ${position === 'for' ? 'supporting' : position === 'against' ? 'opposing' : 'analytical'} perspective.`;

    try {
      const result = await ai.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]);

      let argument = result.content;
      let dataPoints: Record<string, any> = {};

      try {
        const jsonMatch = result.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          argument = parsed.argument || argument;
          dataPoints = parsed.dataPoints || parsed.data_points || {};
        }
      } catch {}

      const inserted = await supabaseInsert<DebateEntry>('dm_decision_debates', {
        decision_id: decisionId,
        agent_id: agentId,
        agent_name: config.name,
        position,
        argument,
        data_points: dataPoints,
        created_at: new Date().toISOString(),
      });

      if (inserted.length > 0) entries.push(inserted[0]);
    } catch (err: any) {
      console.error(`[FounderMode] Debate entry failed for ${agentId}:`, err.message);
    }
  }

  return entries;
}

export async function getDebateEntries(decisionId: number): Promise<DebateEntry[]> {
  return supabaseSelect<DebateEntry>(
    'dm_decision_debates',
    { decision_id: String(decisionId) },
    { order: 'created_at.asc' }
  );
}

export async function generateDailyBriefing(): Promise<DailyBriefing> {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    completedProfiles,
    totalMatches,
    acceptedMatches,
    recentSignups,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.profile.count({ where: { isComplete: true } }),
    prisma.match.count(),
    prisma.match.count({ where: { status: 'ACCEPTED' } }),
    prisma.user.count({ where: { createdAt: { gte: yesterday } } }),
  ]);

  let agentActivity: any[] = [];
  try {
    agentActivity = await supabaseSelect('dm_agent_logs', undefined, {
      order: 'created_at.desc',
      limit: 20,
    });
    agentActivity = agentActivity.filter(
      (log: any) => new Date(log.created_at) >= yesterday
    );
  } catch {}

  let pendingContent: any[] = [];
  try {
    pendingContent = await supabaseSelect('dm_content_queue', { status: 'pending' }, {
      order: 'created_at.desc',
      limit: 20,
    });
  } catch {}

  let pendingDecisions: Decision[] = [];
  try {
    pendingDecisions = await getDecisions({ status: 'pending', limit: 20 });
  } catch {}

  let agentErrors: any[] = [];
  try {
    const allLogs = await supabaseSelect('dm_agent_logs', { status: 'error' }, {
      order: 'created_at.desc',
      limit: 10,
    });
    agentErrors = allLogs.filter(
      (log: any) => new Date(log.created_at) >= yesterday
    );
  } catch {}

  const metrics = {
    totalUsers,
    completedProfiles,
    totalMatches,
    acceptedMatches,
    matchAcceptRate: totalMatches > 0 ? Math.round((acceptedMatches / totalMatches) * 100) : 0,
    recentSignups,
  };

  const priorityItems: any[] = [];

  pendingDecisions.filter(d => d.urgency === 'critical' || d.urgency === 'high').forEach(d => {
    priorityItems.push({ type: 'decision', urgency: d.urgency, title: d.title, id: d.id });
  });

  pendingContent.slice(0, 5).forEach(c => {
    priorityItems.push({ type: 'content_approval', urgency: 'medium', title: c.title, id: c.id });
  });

  agentErrors.forEach(e => {
    priorityItems.push({ type: 'agent_error', urgency: 'high', title: `${e.agent_id}: ${e.action}`, id: e.id });
  });

  const actionList = [
    ...(pendingDecisions.length > 0 ? [`Review ${pendingDecisions.length} pending decision(s)`] : []),
    ...(pendingContent.length > 0 ? [`Approve ${pendingContent.length} content item(s) in queue`] : []),
    ...(agentErrors.length > 0 ? [`Investigate ${agentErrors.length} agent error(s) from last 24h`] : []),
    ...(recentSignups > 0 ? [`${recentSignups} new signup(s) — review onboarding funnel`] : []),
  ];

  if (actionList.length === 0) {
    actionList.push('All clear — no urgent items today');
  }

  const briefing: DailyBriefing = {
    date: now.toISOString().split('T')[0],
    metrics,
    agentActivity,
    pendingDecisions,
    pendingContent,
    priorityItems,
    actionList,
  };

  try {
    await supabaseInsert('dm_daily_briefings', {
      briefing_date: briefing.date,
      content: briefing,
      generated_by: 'nexus',
      created_at: now.toISOString(),
    });
  } catch (err: any) {
    console.log(`[FounderMode] Could not store briefing: ${err.message}`);
  }

  return briefing;
}

export async function getPriorityInbox(): Promise<{
  pendingDecisions: Decision[];
  pendingContent: any[];
  agentErrors: any[];
  criticalAlerts: any[];
  totalCount: number;
}> {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  let pendingDecisions: Decision[] = [];
  try {
    pendingDecisions = await getDecisions({ status: 'pending', limit: 50 });
  } catch {}

  let pendingContent: any[] = [];
  try {
    pendingContent = await supabaseSelect('dm_content_queue', { status: 'pending' }, {
      order: 'created_at.desc',
      limit: 30,
    });
  } catch {}

  let agentErrors: any[] = [];
  try {
    const allErrors = await supabaseSelect('dm_agent_logs', { status: 'error' }, {
      order: 'created_at.desc',
      limit: 20,
    });
    agentErrors = allErrors.filter(
      (log: any) => new Date(log.created_at) >= yesterday
    );
  } catch {}

  const criticalAlerts = pendingDecisions
    .filter(d => d.urgency === 'critical')
    .map(d => ({ type: 'critical_decision', ...d }));

  return {
    pendingDecisions,
    pendingContent,
    agentErrors,
    criticalAlerts,
    totalCount: pendingDecisions.length + pendingContent.length + agentErrors.length,
  };
}

export async function getLatestBriefing(): Promise<any | null> {
  try {
    const briefings = await supabaseSelect('dm_daily_briefings', undefined, {
      order: 'created_at.desc',
      limit: 1,
    });
    return briefings.length > 0 ? briefings[0] : null;
  } catch {
    return null;
  }
}
