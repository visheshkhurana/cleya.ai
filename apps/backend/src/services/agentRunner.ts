import { createAIService } from '@cleya/ai';
import { prisma } from '@cleya/db';
import { supabaseInsert, supabaseSelect, supabaseUpdate, supabaseUpsert } from './supabaseClient';
import { notifyAgentCompletion } from './agentNotifier';
import { assembleMemoryContext, formatMemoryForPrompt, storeRunMemories, setWorkingMemory, clearWorkingMemory } from './agentMemoryService';

const AGENT_PROMPTS: Record<string, { name: string; codename: string; systemPrompt: string; contentType: string; channel: string }> = {
  'nexus': {
    name: 'Nexus',
    codename: 'Orchestrator',
    systemPrompt: `You are Nexus — the Orchestrator and Master Coordinator for Cleya.ai's AI workforce.
You coordinate all operational agents: Maven (Marketing), Ledger (Finance), Sentinel (CTO), Ally (Support), Catalyst (Growth), and Closer (Sales).
Generate a weekly operational plan. Output a structured JSON object with task assignments for each sub-agent:
- maven: marketing content, campaigns, and brand activities
- ledger: financial analysis, runway tracking, unit economics
- sentinel: technical priorities, infrastructure, security reviews
- ally: customer support improvements, FAQ updates, ticket triage
- catalyst: growth experiments, referral loops, activation funnels
- closer: sales pipeline, outreach sequences, partnership deals

Format your response as a JSON object with keys: mavenTasks, ledgerTasks, sentinelTasks, allyTasks, catalystTasks, closerTasks.
Each should be an array of {title, description, channel, priority} objects where priority is "low"|"medium"|"high"|"critical".
Be specific to Indian startup ecosystem context. Include dates relative to today.`,
    contentType: 'operational_plan',
    channel: 'internal',
  },
  'maven': {
    name: 'Maven',
    codename: 'Marketing',
    systemPrompt: `You are Maven — Cleya.ai's Marketing Agent.
Expertise: Content marketing, LinkedIn/Instagram strategy, SEO, email campaigns, brand storytelling for India's startup ecosystem.
Generate a weekly content plan: 5 LinkedIn posts, 3 Instagram posts, 1 newsletter, 1 blog article.
Each piece should include: title, hook/opening line, key points, CTA, and target audience segment (Founders/Investors/Operators).
Focus on trending topics in Indian startup ecosystem. Map content to funnel stages (Awareness/Consideration/Activation).
Also generate copy-ready social media posts, email drafts, and outreach sequences.
Output each content piece as a separate section with clear formatting.`,
    contentType: 'content_draft',
    channel: 'marketing',
  },
  'ledger': {
    name: 'Ledger',
    codename: 'Finance',
    systemPrompt: `You are Ledger — Cleya.ai's Finance Agent.
Expertise: SaaS/marketplace financial modeling, unit economics, runway analysis, fundraising prep, investor reporting.
Tasks:
- Weekly burn rate and runway update
- Monthly MRR/ARR tracking and projections
- Unit economics review (CAC, LTV, payback period)
- Fundraising readiness scorecard
- Budget variance analysis
Provide spreadsheet-ready frameworks and specific numbers. Reference Indian VC benchmarks.
Output structured financial summaries with actionable recommendations.`,
    contentType: 'financial_report',
    channel: 'finance',
  },
  'sentinel': {
    name: 'Sentinel',
    codename: 'CTO',
    systemPrompt: `You are Sentinel — Cleya.ai's CTO Agent.
Expertise: Technical architecture, infrastructure monitoring, security audits, performance optimization, tech debt management.
Tasks:
- Weekly infrastructure health check
- Security vulnerability assessment
- Performance bottleneck identification
- Tech debt prioritization
- Feature deployment readiness review
- Uptime and reliability metrics
Provide specific technical recommendations with priority levels.
Focus on scalability for Indian market conditions (variable connectivity, mobile-first users).`,
    contentType: 'tech_report',
    channel: 'engineering',
  },
  'ally': {
    name: 'Ally',
    codename: 'Support',
    systemPrompt: `You are Ally — Cleya.ai's Customer Support Agent.
Expertise: Customer success, support ticket triage, FAQ management, user onboarding optimization, NPS tracking.
Tasks:
- Analyze common support issues and create FAQ updates
- Draft response templates for frequent queries
- Identify at-risk users from support patterns
- Suggest onboarding flow improvements
- Generate weekly support health metrics (response time, resolution rate, CSAT)
Focus on Indian startup founder/investor user personas and their specific pain points.
Prioritize self-service solutions to reduce support volume.`,
    contentType: 'support_report',
    channel: 'support',
  },
  'catalyst': {
    name: 'Catalyst',
    codename: 'Growth',
    systemPrompt: `You are Catalyst — Cleya.ai's Growth Agent.
Expertise: Viral loops, referral mechanics, network effects, activation funnels, A/B testing, partnerships.
Growth Playbooks:
1. REFERRAL LOOPS: "Invite 3 founders, unlock investor matching." Track k-factor.
2. NETWORK DENSITY: City-by-city launch. 50 power users per city > 500 passive nationwide.
3. ACTIVATION: Profile creation → AI Match (<60s) → First Intro → Accepted Intro → Retained.
4. CONTENT VIRALITY: Shareable "match cards" — visual social proof.
5. EXCLUSIVITY: Limited spots, referral-only, founder verification.
6. WHATSAPP: India's primary channel. Invite links, match notifications via WhatsApp.
7. EVENT-LED: Virtual demo days, city meetups, "Cleya Connects" events.
8. PARTNERSHIPS: Accelerators (100X.VC, Antler), coworking spaces, angel networks.
Generate specific experiments with hypotheses, metrics, and timelines.
Always prioritize network density over raw user count. Think India-first distribution.`,
    contentType: 'growth_plan',
    channel: 'growth',
  },
  'closer': {
    name: 'Closer',
    codename: 'Sales',
    systemPrompt: `You are Closer — Cleya.ai's Sales Agent.
Expertise: B2B sales, investor outreach, partnership development, cold outreach, pipeline management.
Tasks:
- Generate outreach sequences for target accounts (accelerators, VC firms, coworking spaces)
- Create personalized pitch decks and one-pagers
- Build sales pipeline with stage tracking
- Draft partnership proposals
- Lead scoring and prioritization
Provide copy-ready outreach templates. Focus on warm intro mechanics.
Target recently funded startups and active angel investors in India.
4-step sequence: Day 1 email → Day 3 LinkedIn → Day 5 follow-up → Day 8 final.
Aim for >15% reply rate. Keep messages concise and value-focused.`,
    contentType: 'sales_plan',
    channel: 'sales',
  },
};

const AGENT_ID_ALIASES: Record<string, string> = {
  'orchestrator': 'nexus',
  'content-strategist': 'maven',
  'social-media': 'maven',
  'email-marketing': 'maven',
  'cold-outreach': 'closer',
};

export function resolveAgentId(id: string): string {
  return AGENT_ID_ALIASES[id] || id;
}

interface AgentRunResult {
  agentId: string;
  status: 'success' | 'error';
  duration: number;
  outputSummary: string;
  fullOutput?: string;
  contentItems: number;
  error?: string;
  retryCount?: number;
}

type AgentStatus = 'idle' | 'running' | 'completed' | 'failed' | 'scheduled';

interface AgentStatusInfo {
  agentId: string;
  name: string;
  codename: string;
  status: AgentStatus;
  lastRunAt: string | null;
  lastRunDuration: number | null;
  lastRunStatus: string | null;
  nextRunAt: string | null;
  enabled: boolean;
  cronExpression: string | null;
}

interface AgentStateRecord {
  agent_id: string;
  status: AgentStatus;
  last_run_at: string | null;
  last_run_duration: number | null;
  last_run_status: string | null;
  enabled: boolean;
  cron_expression: string | null;
  cron_description: string | null;
}

const agentStates = new Map<string, {
  status: AgentStatus;
  lastRunAt: string | null;
  lastRunDuration: number | null;
  lastRunStatus: string | null;
  enabled: boolean;
  cronExpression: string | null;
  cronDescription: string | null;
}>();

const DEFAULT_SCHEDULES: Record<string, { cron: string; desc: string }> = {
  'nexus': { cron: '0 7 * * *', desc: 'Daily at 7:00 AM IST' },
  'maven': { cron: '30 7 * * 1', desc: 'Mondays at 7:30 AM IST' },
  'ledger': { cron: '0 8 * * 1', desc: 'Mondays at 8:00 AM IST' },
  'sentinel': { cron: '0 9 * * 1,4', desc: 'Mon/Thu at 9:00 AM IST' },
  'ally': { cron: '0 10 * * 1,3,5', desc: 'Mon/Wed/Fri at 10:00 AM IST' },
  'catalyst': { cron: '0 11 * * 2', desc: 'Tuesdays at 11:00 AM IST' },
  'closer': { cron: '0 11 * * 4', desc: 'Thursdays at 11:00 AM IST' },
};

function initAgentState(agentId: string) {
  if (!agentStates.has(agentId)) {
    const schedule = DEFAULT_SCHEDULES[agentId];
    agentStates.set(agentId, {
      status: 'idle',
      lastRunAt: null,
      lastRunDuration: null,
      lastRunStatus: null,
      enabled: true,
      cronExpression: schedule?.cron || null,
      cronDescription: schedule?.desc || null,
    });
  }
}

Object.keys(AGENT_PROMPTS).forEach(id => initAgentState(id));

export async function hydrateAgentStatesFromDB(): Promise<void> {
  try {
    const records = await prisma.$queryRawUnsafe<AgentStateRecord[]>(
      `SELECT agent_id, status, last_run_at::text, last_run_duration, last_run_status, enabled, cron_expression, cron_description FROM dm_agent_state`
    );

    for (const record of records) {
      if (AGENT_PROMPTS[record.agent_id]) {
        agentStates.set(record.agent_id, {
          status: record.status === 'running' ? 'idle' : ((record.status as AgentStatus) || 'idle'),
          lastRunAt: record.last_run_at,
          lastRunDuration: record.last_run_duration,
          lastRunStatus: record.last_run_status,
          enabled: record.enabled !== false,
          cronExpression: record.cron_expression || DEFAULT_SCHEDULES[record.agent_id]?.cron || null,
          cronDescription: record.cron_description || DEFAULT_SCHEDULES[record.agent_id]?.desc || null,
        });
      }
    }

    for (const agentId of Object.keys(AGENT_PROMPTS)) {
      if (!records.find(r => r.agent_id === agentId)) {
        const schedule = DEFAULT_SCHEDULES[agentId];
        try {
          await prisma.$executeRawUnsafe(
            `INSERT INTO dm_agent_state (agent_id, status, enabled, cron_expression, cron_description) VALUES ($1, 'idle', true, $2, $3) ON CONFLICT (agent_id) DO NOTHING`,
            agentId,
            schedule?.cron || null,
            schedule?.desc || null
          );
        } catch (err: any) {
          console.log(`[AgentRunner] Could not seed state for ${agentId}: ${err.message}`);
        }
      }
    }

    console.log(`[AgentRunner] Hydrated state for ${records.length} agents from database`);
  } catch (err: any) {
    console.log(`[AgentRunner] Could not hydrate agent states from DB (table may not exist yet): ${err.message}`);
  }
}

async function persistAgentState(agentId: string): Promise<void> {
  const state = agentStates.get(agentId);
  if (!state) return;

  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO dm_agent_state (agent_id, status, last_run_at, last_run_duration, last_run_status, enabled, cron_expression, cron_description, updated_at)
       VALUES ($1, $2, $3::timestamptz, $4, $5, $6, $7, $8, now())
       ON CONFLICT (agent_id) DO UPDATE SET
         status = EXCLUDED.status,
         last_run_at = EXCLUDED.last_run_at,
         last_run_duration = EXCLUDED.last_run_duration,
         last_run_status = EXCLUDED.last_run_status,
         enabled = EXCLUDED.enabled,
         cron_expression = EXCLUDED.cron_expression,
         cron_description = EXCLUDED.cron_description,
         updated_at = now()`,
      agentId,
      state.status,
      state.lastRunAt,
      state.lastRunDuration,
      state.lastRunStatus,
      state.enabled,
      state.cronExpression,
      state.cronDescription
    );
  } catch (err: any) {
    console.log(`[AgentRunner] Failed to persist state for ${agentId}: ${err.message}`);
  }
}

let aiService: ReturnType<typeof createAIService> | null = null;
function getAI() {
  if (!aiService) {
    if (!process.env.OPENAI_API_KEY) return null;
    aiService = createAIService({ provider: 'openai', model: 'gpt-4o-mini' });
  }
  return aiService;
}

const MAX_RETRIES = 2;
const BASE_DELAY_MS = 2000;

async function executeWithRetry(agentId: string, taskContext?: string): Promise<AgentRunResult> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await executeAgentOnce(agentId, taskContext);
      if (result.status === 'success') {
        if (attempt > 0) {
          result.retryCount = attempt;
        }
        return result;
      }
      lastError = new Error(result.error || 'Agent returned error status');
    } catch (err: any) {
      lastError = err;
    }

    if (attempt < MAX_RETRIES) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt);
      console.log(`[AgentRunner] Retry ${attempt + 1}/${MAX_RETRIES} for ${agentId} in ${delay}ms`);

      try {
        await supabaseInsert('dm_agent_logs', {
          agent_id: agentId,
          action: `Retry attempt ${attempt + 1}/${MAX_RETRIES}`,
          details: { error: lastError?.message, delay_ms: delay, attempt: attempt + 1 },
          status: 'warning',
          created_at: new Date().toISOString(),
        });
      } catch {}

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return {
    agentId,
    status: 'error',
    duration: 0,
    outputSummary: '',
    contentItems: 0,
    error: lastError?.message || 'All retries exhausted',
    retryCount: MAX_RETRIES,
  };
}

async function executeAgentOnce(agentId: string, taskContext?: string): Promise<AgentRunResult> {
  const config = AGENT_PROMPTS[agentId];
  if (!config) {
    throw new Error(`Unknown agent: ${agentId}`);
  }

  const startTime = Date.now();

  const ai = getAI();
  if (!ai) {
    throw new Error('AI service not configured. Set OPENAI_API_KEY.');
  }

  let memoryPromptSection = '';
  try {
    const memoryCtx = await assembleMemoryContext(agentId, taskContext);
    memoryPromptSection = formatMemoryForPrompt(memoryCtx);
    await setWorkingMemory(agentId, {
      currentTask: taskContext || 'scheduled_run',
      startedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.log(`[AgentRunner] Memory retrieval skipped for ${agentId}:`, (err as Error).message);
  }

  let userPrompt = `Today is ${new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`;
  if (taskContext) {
    userPrompt += `\n\nTask context: ${taskContext}`;
  }
  userPrompt += '\n\nGenerate content now.';

  const systemPrompt = config.systemPrompt + memoryPromptSection;

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: userPrompt },
  ];

  const result = await ai.chat(messages);
  const content = result.content;
  const duration = Date.now() - startTime;
  const outputSummary = content.substring(0, 200) + (content.length > 200 ? '...' : '');

  await supabaseInsert('dm_content_queue', {
    agent_id: agentId,
    channel: config.channel,
    content_type: config.contentType,
    title: `${config.name} (${config.codename}) — ${new Date().toLocaleDateString('en-IN')}`,
    body: content,
    media_urls: [],
    scheduled_for: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    status: 'pending',
    metadata: { generated_by: 'agent_scheduler', task_context: taskContext || null },
    created_at: new Date().toISOString(),
  });

  return {
    agentId,
    status: 'success',
    duration,
    outputSummary,
    fullOutput: content,
    contentItems: 1,
  };
}

export async function runAgent(agentId: string, taskContext?: string): Promise<AgentRunResult> {
  const resolved = resolveAgentId(agentId);
  const config = AGENT_PROMPTS[resolved];
  if (!config) {
    throw new Error(`Unknown agent: ${agentId}`);
  }

  initAgentState(resolved);
  const state = agentStates.get(resolved)!;
  state.status = 'running';
  await persistAgentState(resolved);

  const startTime = Date.now();
  console.log(`[AgentRunner] Starting agent: ${config.name} (${resolved})`);

  try {
    const result = await executeWithRetry(resolved, taskContext);
    const duration = Date.now() - startTime;

    await supabaseInsert('dm_agent_logs', {
      agent_id: resolved,
      action: `Autonomous run: ${config.contentType}`,
      details: {
        duration_ms: duration,
        output_length: result.fullOutput?.length || result.outputSummary.length,
        output_summary: result.outputSummary,
        content_type: config.contentType,
        channel: config.channel,
        retry_count: result.retryCount || 0,
      },
      status: result.status === 'success' ? 'success' : 'error',
      created_at: new Date().toISOString(),
    });

    state.status = result.status === 'success' ? 'completed' : 'failed';
    state.lastRunAt = new Date().toISOString();
    state.lastRunDuration = duration;
    state.lastRunStatus = result.status;
    await persistAgentState(resolved);

    try {
      await storeRunMemories(resolved, {
        status: result.status,
        outputSummary: result.outputSummary,
        duration,
        error: result.error,
      });
    } catch (memErr) {
      console.log(`[AgentRunner] Memory storage skipped for ${resolved}:`, (memErr as Error).message);
    }
    try {
      await clearWorkingMemory(resolved);
    } catch (memErr) {
      console.log(`[AgentRunner] Working memory cleanup skipped for ${resolved}:`, (memErr as Error).message);
    }

    console.log(`[AgentRunner] ${config.name} ${result.status} in ${(duration / 1000).toFixed(1)}s`);

    notifyAgentCompletion({
      agentId: resolved,
      agentName: config.name,
      status: result.status,
      duration,
      outputSummary: result.outputSummary,
      error: result.error,
      retryCount: result.retryCount,
    }).catch(() => {});

    return { ...result, duration };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    const errorMsg = error.message || 'Unknown error';

    try {
      await supabaseInsert('dm_agent_logs', {
        agent_id: resolved,
        action: `Autonomous run failed: ${config.contentType}`,
        details: { duration_ms: duration, error: errorMsg },
        status: 'error',
        created_at: new Date().toISOString(),
      });
    } catch (logErr) {
      console.error(`[AgentRunner] Failed to log error for ${resolved}:`, logErr);
    }

    state.status = 'failed';
    state.lastRunAt = new Date().toISOString();
    state.lastRunDuration = duration;
    state.lastRunStatus = 'error';
    await persistAgentState(resolved);

    console.error(`[AgentRunner] ${config.name} failed after ${(duration / 1000).toFixed(1)}s:`, errorMsg);

    notifyAgentCompletion({
      agentId: resolved,
      agentName: config.name,
      status: 'error',
      duration,
      outputSummary: '',
      error: errorMsg,
    }).catch(() => {});

    return {
      agentId: resolved,
      status: 'error',
      duration,
      outputSummary: '',
      contentItems: 0,
      error: errorMsg,
    };
  }
}

export async function processAgentTasks(agentId: string): Promise<number> {
  const resolved = resolveAgentId(agentId);
  const config = AGENT_PROMPTS[resolved];
  if (!config) return 0;

  try {
    const tasks = await supabaseSelect<{
      id: number;
      title: string;
      description: string;
      priority: string;
      status: string;
      due_date: string;
    }>('dm_agent_tasks', { agent_id: resolved, status: 'pending' }, {
      order: 'priority.desc,due_date.asc',
      limit: 5,
    });

    if (tasks.length === 0) return 0;

    console.log(`[AgentRunner] Processing ${tasks.length} pending tasks for ${config.name}`);

    let processed = 0;
    for (const task of tasks) {
      try {
        await supabaseUpdate('dm_agent_tasks', { id: String(task.id) }, {
          status: 'in_progress',
        });

        const result = await runAgent(resolved, `Task: ${task.title}\n${task.description}`);

        await supabaseUpdate('dm_agent_tasks', { id: String(task.id) }, {
          status: result.status === 'success' ? 'completed' : 'failed',
          completed_at: new Date().toISOString(),
          output: { result: result.outputSummary, duration: result.duration },
        });

        processed++;
      } catch (err: any) {
        console.error(`[AgentRunner] Task ${task.id} failed:`, err.message);
        await supabaseUpdate('dm_agent_tasks', { id: String(task.id) }, {
          status: 'failed',
          output: { error: err.message },
        });
      }
    }

    return processed;
  } catch (err: any) {
    console.error(`[AgentRunner] Failed to fetch tasks for ${resolved}:`, err.message);
    return 0;
  }
}

export function getAgentStatuses(scheduleInfo?: Record<string, string>): AgentStatusInfo[] {
  return Object.entries(AGENT_PROMPTS).map(([id, config]) => {
    const state = agentStates.get(id);
    return {
      agentId: id,
      name: config.name,
      codename: config.codename,
      status: state?.status || 'idle',
      lastRunAt: state?.lastRunAt || null,
      lastRunDuration: state?.lastRunDuration || null,
      lastRunStatus: state?.lastRunStatus || null,
      nextRunAt: scheduleInfo?.[id] || state?.cronDescription || null,
      enabled: state?.enabled !== false,
      cronExpression: state?.cronExpression || null,
    };
  });
}

export function setAgentScheduleStatus(agentId: string, status: AgentStatus) {
  const resolved = resolveAgentId(agentId);
  initAgentState(resolved);
  agentStates.get(resolved)!.status = status;
}

export function isAgentEnabled(agentId: string): boolean {
  const resolved = resolveAgentId(agentId);
  const state = agentStates.get(resolved);
  return state?.enabled !== false;
}

export async function updateAgentConfig(agentId: string, config: {
  enabled?: boolean;
  cronExpression?: string;
  cronDescription?: string;
}): Promise<void> {
  const resolved = resolveAgentId(agentId);
  initAgentState(resolved);
  const state = agentStates.get(resolved)!;

  if (config.enabled !== undefined) state.enabled = config.enabled;
  if (config.cronExpression !== undefined) state.cronExpression = config.cronExpression;
  if (config.cronDescription !== undefined) state.cronDescription = config.cronDescription;

  await persistAgentState(resolved);
}

export async function getAgentRunHistory(agentId: string, limit: number = 30): Promise<any[]> {
  const resolved = resolveAgentId(agentId);
  try {
    const logs = await supabaseSelect('dm_agent_logs', { agent_id: resolved }, {
      order: 'created_at.desc',
      limit,
    });
    return logs;
  } catch {
    return [];
  }
}

export async function getAgentAccountability(agentId: string): Promise<{
  totalRuns: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  avgDuration: number;
  contentItemsGenerated: number;
}> {
  const resolved = resolveAgentId(agentId);
  try {
    const logs = await supabaseSelect<{
      status: string;
      details: { duration_ms?: number };
      action: string;
    }>('dm_agent_logs', { agent_id: resolved });

    const runs = logs.filter(l => l.action.startsWith('Autonomous run'));
    const successRuns = runs.filter(l => l.status === 'success');
    const failureRuns = runs.filter(l => l.status === 'error');
    const durations = runs
      .map(l => l.details?.duration_ms)
      .filter((d): d is number => typeof d === 'number');
    const avgDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    const contentItems = await supabaseSelect('dm_content_queue', { agent_id: resolved });

    return {
      totalRuns: runs.length,
      successCount: successRuns.length,
      failureCount: failureRuns.length,
      successRate: runs.length > 0 ? (successRuns.length / runs.length) * 100 : 0,
      avgDuration,
      contentItemsGenerated: contentItems.length,
    };
  } catch {
    return {
      totalRuns: 0,
      successCount: 0,
      failureCount: 0,
      successRate: 0,
      avgDuration: 0,
      contentItemsGenerated: 0,
    };
  }
}

export const KNOWN_AGENT_IDS = [
  ...Object.keys(AGENT_PROMPTS),
  ...Object.keys(AGENT_ID_ALIASES),
];

export const AGENT_DEFINITIONS = AGENT_PROMPTS;
