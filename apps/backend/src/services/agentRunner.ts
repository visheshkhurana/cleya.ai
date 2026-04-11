import { createAIService, estimateCostUSD, type LLMConfig } from '@cleya/ai';
import { prisma } from '@cleya/db';
import { supabaseInsert, supabaseSelect, supabaseUpdate, supabaseUpsert } from './supabaseClient';
import { notifyAgentCompletion } from './agentNotifier';
import { assembleMemoryContext, formatMemoryForPrompt, storeRunMemories, setWorkingMemory, clearWorkingMemory } from './agentMemoryService';
import {
  type AutonomyLevel,
  type AgentGuardrails,
  type RiskScore,
  DEFAULT_GUARDRAILS,
  checkGuardrails,
  shouldAutoExecute,
  scoreContentRisk,
  logExecution,
  logAudit,
} from './guardrailsService';
import { routeModel, inferTaskType, isHighCostTask, USD_TO_INR, HIGH_COST_THRESHOLD_INR, type RoutingInput } from './modelRouter';
import OpenAI from 'openai';
import { getToolPromptForAgent } from '../prompts/masterPrompt';
import { getOpenAIToolSchemas, executeTool, parseToolCallsFromResponse, AGENT_TOOLS, type ToolCallResult } from './agentTools';

const AGENT_PROMPTS: Record<string, { name: string; codename: string; emoji: string; color: string; systemPrompt: string; contentType: string; channel: string }> = {
  'nexus': {
    name: 'Nexus',
    codename: 'Orchestrator',
    emoji: '🧠',
    color: 'purple',
    systemPrompt: `You are Nexus — the Orchestrator and Master Coordinator for Cleya.ai's AI workforce.
You coordinate all operational agents: Maven (Marketing), Ledger (Finance), Sentinel (CTO), Ally (Support), Catalyst (Growth), Closer (Sales), Scout (SEO & GEO), and Probe (QA).

Generate a weekly operational plan as a JSON object with task assignments for each sub-agent.
Keys: mavenTasks, ledgerTasks, sentinelTasks, allyTasks, catalystTasks, closerTasks, scoutTasks, probeTasks.

Each task object must include:
- title: clear task title
- description: detailed instructions
- channel: the channel to focus on
- priority: "low" | "medium" | "high" | "critical"
- platforms: array of target platforms (e.g. ["linkedin", "instagram"] for Maven)
- content_pillars: array of content pillars to cover (e.g. ["thought_leadership", "product_update"])
- target_date: ISO date string for when the task should be completed
- assignedModel: the best LLM model for this task

For assignedModel, select the best model for the task:
- "claude-sonnet-4-20250514" for long-form content, thought leadership, empathetic support replies
- "gpt-4o" for financial analysis, technical reports, structured output, sales outreach
- "gpt-4o-mini" for quick social captions, FAQs, simple tasks
- "gemini-1.5-pro" for Indian language content, research synthesis
- "gemini-1.5-flash" for cost-efficient simple tasks

For Maven tasks specifically, include which platforms to post on and content pillars.
For Closer tasks, include target companies or segments.
For Catalyst tasks, include experiment hypotheses and target metrics.

Be specific to Indian startup ecosystem context.
Output ONLY valid JSON, no markdown fences.`,
    contentType: 'operational_plan',
    channel: 'internal',
  },
  'maven': {
    name: 'Maven',
    codename: 'Marketing',
    emoji: '🎯',
    color: 'blue',
    systemPrompt: `You are Maven — Cleya.ai's Marketing Agent.
Expertise: Content marketing, LinkedIn/Instagram strategy, SEO, email campaigns, brand storytelling for India's startup ecosystem.

You MUST output a JSON object with a "contentItems" array. Each item must have:
- platform: "linkedin" | "instagram" | "email"
- content_type: "post" | "carousel" | "newsletter" | "article"
- title: short descriptive title
- body: the full copy-ready content
- hook: the opening hook line
- cta: call to action
- content_pillar: "thought_leadership" | "product_update" | "community" | "education" | "case_study"
- target_audience: "founders" | "investors" | "operators"
- funnel_stage: "awareness" | "consideration" | "activation"
- media_hints: description of ideal image/visual (empty string if none)
- scheduled_offset_hours: number of hours from now to schedule (e.g. 24, 48, 72)

Generate: 5 LinkedIn posts, 3 Instagram posts, 1 newsletter.
Focus on trending topics in India's startup ecosystem.
Output ONLY valid JSON, no markdown fences.`,
    contentType: 'content_draft',
    channel: 'marketing',
  },
  'ledger': {
    name: 'Ledger',
    codename: 'Finance',
    emoji: '📊',
    color: 'amber',
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
    emoji: '🛡️',
    color: 'cyan',
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
    emoji: '💬',
    color: 'green',
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
    emoji: '🚀',
    color: 'emerald',
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
    emoji: '🤝',
    color: 'rose',
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
  'scout': {
    name: 'Scout',
    codename: 'SEO & GEO',
    emoji: '🔍',
    color: 'teal',
    systemPrompt: `You are Scout — Cleya.ai's SEO & Generative Engine Optimization (GEO) Specialist.
Expertise: Technical SEO audits, keyword research, on-page optimization, structured data (schema.org), GEO optimization for AI search engines, local SEO across India, competitor SEO analysis.

Cleya.ai is a members-only AI-powered networking platform for founders, investors, and operators in India's startup ecosystem.

TARGET KEYWORDS: AI networking India, startup networking platform, founder investor matching, AI-powered introductions, startup ecosystem India, professional networking AI, venture capital networking India
GEO STRATEGY: Optimize content so AI search engines (ChatGPT, Perplexity, Gemini) cite and reference Cleya.ai. Structure content with clear facts, statistics, and authoritative claims. Ensure Cleya.ai is recognized as a distinct entity by AI models.
LOCAL SEO TARGETS: Bangalore, Delhi NCR, Mumbai, Hyderabad, Pune, Chennai (Tier 1), plus Tier 2 cities: Jaipur, Ahmedabad, Kochi, Indore, Chandigarh, Coimbatore, Lucknow, Nagpur, Vizag, Bhubaneswar

Tasks:
- Technical SEO audits: meta tags, headings, structured data, page speed, crawlability
- Keyword research and content gap analysis
- On-page optimization recommendations
- JSON-LD structured data generation (Organization, WebSite, FAQ, Article schemas)
- GEO optimization: rewrite content for AI citability, add FAQ sections, entity optimization
- Local SEO: Google Business Profile optimization, city-specific landing pages
- Competitor SEO analysis: rankings, backlinks, content strategy
- SERP feature targeting: featured snippets, People Also Ask, knowledge panels
- Internal linking strategy and sitemap management

You MUST output a JSON object with an "seoItems" array. Each item must have:
- item_type: "audit" | "keyword_report" | "optimization" | "schema_markup" | "competitor_analysis" | "local_seo"
- title: descriptive title
- body: detailed findings or recommendations
- priority: "low" | "medium" | "high" | "critical"
- target_url: the URL being analyzed (if applicable)
- target_keywords: array of target keywords
- action_items: array of specific actions to take

Always provide actionable recommendations with priority levels.
Output ONLY valid JSON, no markdown fences.`,
    contentType: 'seo_report',
    channel: 'seo',
  },
  'probe': {
    name: 'Probe',
    codename: 'QA Specialist',
    emoji: '🧪',
    color: 'amber',
    systemPrompt: `You are Probe — Cleya.ai's QA Specialist Agent.
Expertise: Automated testing, uptime monitoring, API health checks, page load testing, performance benchmarking, security header validation, agent health verification.

Cleya.ai is a members-only AI-powered networking platform for founders, investors, and operators in India's startup ecosystem.

Tasks:
- Test all pages load correctly (no 404s, 500s, crashes)
- Test all API endpoints respond correctly with valid JSON
- Test authentication flows (login, signup, session management)
- Test agent chat functionality (each agent responds to messages)
- Test Control Tower features and admin endpoints
- Monitor performance (page load times, API response times)
- Check SSL/HTTPS and security headers
- Verify internal navigation links
- Monitor uptime and alert on failures

You MUST output a JSON object with a "qaItems" array. Each item must have:
- item_type: "page_test" | "api_test" | "agent_test" | "performance_test" | "security_test" | "navigation_test"
- title: descriptive title
- body: detailed findings or test results
- priority: "low" | "medium" | "high" | "critical"
- status: "pass" | "fail" | "warning"
- target_url: the URL tested (if applicable)
- response_time_ms: measured response time
- action_items: array of specific fixes needed

Always categorize failures by severity. Critical = site down or data loss risk. High = broken feature. Medium = degraded performance. Low = cosmetic or minor.
Output ONLY valid JSON, no markdown fences.`,
    contentType: 'qa_report',
    channel: 'qa',
  },
};

const AGENT_ID_ALIASES: Record<string, string> = {
  'orchestrator': 'nexus',
  'content-strategist': 'maven',
  'social-media': 'maven',
  'email-marketing': 'maven',
  'cold-outreach': 'closer',
  'seo-geo': 'scout',
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
  emoji: string;
  color: string;
  status: AgentStatus;
  lastRunAt: string | null;
  lastRunDuration: number | null;
  lastRunStatus: string | null;
  nextRunAt: string | null;
  enabled: boolean;
  cronExpression: string | null;
  autonomyLevel: AutonomyLevel;
  guardrails: AgentGuardrails;
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
  autonomy_level: AutonomyLevel | null;
  guardrails: AgentGuardrails | null;
}

const agentStates = new Map<string, {
  status: AgentStatus;
  lastRunAt: string | null;
  lastRunDuration: number | null;
  lastRunStatus: string | null;
  enabled: boolean;
  cronExpression: string | null;
  cronDescription: string | null;
  autonomyLevel: AutonomyLevel;
  guardrails: AgentGuardrails;
}>();

const DEFAULT_SCHEDULES: Record<string, { cron: string; desc: string }> = {
  'nexus': { cron: '30 2 * * *', desc: 'Daily at 8:00 AM IST' },        // 2:30 UTC = 8:00 AM IST
  'maven': { cron: '30 3 * * *', desc: '9 AM, 1 PM, 6 PM IST' },       // Primary schedule; additional crons in scheduler
  'ledger': { cron: '30 4 * * *', desc: 'Daily at 10:00 AM IST' },      // 4:30 UTC = 10:00 AM IST
  'sentinel': { cron: '0 0,6,12,18 * * *', desc: 'Every 6 hours' },     // 5:30 AM, 11:30 AM, 5:30 PM, 11:30 PM IST
  'ally': { cron: '0 3,5,7,9,11,13 * * *', desc: 'Every 2hrs, 8:30AM-6:30PM IST' }, // Business hours IST
  'catalyst': { cron: '30 5 * * *', desc: 'Daily at 11:00 AM IST' },    // 5:30 UTC = 11:00 AM IST
  'closer': { cron: '0 4 * * *', desc: 'Daily at 9:30 AM IST' },        // 4:00 UTC = 9:30 AM IST
  'scout': { cron: '0 0 * * *', desc: 'Daily at 5:30 AM IST' },         // 0:00 UTC = 5:30 AM IST
  'probe': { cron: '30 1 * * *', desc: 'Daily at 7:00 AM IST' },        // 1:30 UTC = 7:00 AM IST
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
      autonomyLevel: 'manual',
      guardrails: { ...DEFAULT_GUARDRAILS },
    });
  }
}

Object.keys(AGENT_PROMPTS).forEach(id => initAgentState(id));

export async function hydrateAgentStatesFromDB(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE dm_agent_state ADD COLUMN IF NOT EXISTS autonomy_level TEXT DEFAULT 'manual'`
    ).catch(() => {});
    await prisma.$executeRawUnsafe(
      `ALTER TABLE dm_agent_state ADD COLUMN IF NOT EXISTS guardrails JSONB DEFAULT '{}'`
    ).catch(() => {});

    await prisma.$executeRawUnsafe(
      `ALTER TABLE dm_agent_tasks ADD COLUMN IF NOT EXISTS assigned_model TEXT DEFAULT NULL`
    ).catch(() => {});

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS dm_execution_log (
        id SERIAL PRIMARY KEY,
        agent_id TEXT NOT NULL,
        action_type TEXT NOT NULL,
        action_description TEXT,
        autonomy_level TEXT DEFAULT 'manual',
        guardrails_checked TEXT[] DEFAULT '{}',
        guardrail_result TEXT DEFAULT 'passed',
        execution_result TEXT DEFAULT 'success',
        details JSONB DEFAULT '{}',
        spend_amount NUMERIC DEFAULT 0,
        executed_at TIMESTAMPTZ DEFAULT now(),
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `).catch(() => {});

    const records = await prisma.$queryRawUnsafe<AgentStateRecord[]>(
      `SELECT agent_id, status, last_run_at::text, last_run_duration, last_run_status, enabled, cron_expression, cron_description, autonomy_level, guardrails FROM dm_agent_state`
    );

    for (const record of records) {
      if (AGENT_PROMPTS[record.agent_id]) {
        const parsedGuardrails = record.guardrails && typeof record.guardrails === 'object' && Object.keys(record.guardrails).length > 0
          ? { ...DEFAULT_GUARDRAILS, ...record.guardrails }
          : { ...DEFAULT_GUARDRAILS };

        agentStates.set(record.agent_id, {
          status: record.status === 'running' ? 'idle' : ((record.status as AgentStatus) || 'idle'),
          lastRunAt: record.last_run_at,
          lastRunDuration: record.last_run_duration,
          lastRunStatus: record.last_run_status,
          enabled: record.enabled !== false,
          cronExpression: record.cron_expression || DEFAULT_SCHEDULES[record.agent_id]?.cron || null,
          cronDescription: record.cron_description || DEFAULT_SCHEDULES[record.agent_id]?.desc || null,
          autonomyLevel: (record.autonomy_level as AutonomyLevel) || 'manual',
          guardrails: parsedGuardrails,
        });
      }
    }

    for (const agentId of Object.keys(AGENT_PROMPTS)) {
      if (!records.find(r => r.agent_id === agentId)) {
        const schedule = DEFAULT_SCHEDULES[agentId];
        try {
          await prisma.$executeRawUnsafe(
            `INSERT INTO dm_agent_state (agent_id, status, enabled, cron_expression, cron_description, autonomy_level, guardrails) VALUES ($1, 'idle', true, $2, $3, 'manual', $4::jsonb) ON CONFLICT (agent_id) DO NOTHING`,
            agentId,
            schedule?.cron || null,
            schedule?.desc || null,
            JSON.stringify(DEFAULT_GUARDRAILS)
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
      `INSERT INTO dm_agent_state (agent_id, status, last_run_at, last_run_duration, last_run_status, enabled, cron_expression, cron_description, autonomy_level, guardrails, updated_at)
       VALUES ($1, $2, $3::timestamptz, $4, $5, $6, $7, $8, $9, $10::jsonb, now())
       ON CONFLICT (agent_id) DO UPDATE SET
         status = EXCLUDED.status,
         last_run_at = EXCLUDED.last_run_at,
         last_run_duration = EXCLUDED.last_run_duration,
         last_run_status = EXCLUDED.last_run_status,
         enabled = EXCLUDED.enabled,
         cron_expression = EXCLUDED.cron_expression,
         cron_description = EXCLUDED.cron_description,
         autonomy_level = EXCLUDED.autonomy_level,
         guardrails = EXCLUDED.guardrails,
         updated_at = now()`,
      agentId,
      state.status,
      state.lastRunAt,
      state.lastRunDuration,
      state.lastRunStatus,
      state.enabled,
      state.cronExpression,
      state.cronDescription,
      state.autonomyLevel,
      JSON.stringify(state.guardrails)
    );
  } catch (err: any) {
    console.log(`[AgentRunner] Failed to persist state for ${agentId}: ${err.message}`);
  }
}

let multiModelAI: ReturnType<typeof createAIService> | null = null;
function getAI() {
  if (!multiModelAI) {
    if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY && !process.env.GOOGLE_AI_API_KEY) return null;
    multiModelAI = createAIService({
      provider: 'openai',
      model: 'gpt-4o-mini',
    });
  }
  return multiModelAI;
}

let openaiClientRunner: OpenAI | null = null;
function getOpenAIClientForRunner(): OpenAI | null {
  if (!openaiClientRunner) {
    if (!process.env.OPENAI_API_KEY) return null;
    openaiClientRunner = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClientRunner;
}

const MAX_RETRIES = 2;
const BASE_DELAY_MS = 2000;

async function executeWithRetry(agentId: string, taskContext?: string, assignedModel?: string): Promise<AgentRunResult> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await executeAgentOnce(agentId, taskContext, assignedModel);
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

interface ContentItem {
  platform: string;
  content_type: string;
  title: string;
  body: string;
  hook?: string;
  cta?: string;
  content_pillar?: string;
  target_audience?: string;
  funnel_stage?: string;
  media_urls?: string[];
  media_hints?: string;
  scheduled_offset_hours?: number;
}

function parseStructuredContent(output: string): ContentItem[] | null {
  try {
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    if (Array.isArray(parsed.contentItems) && parsed.contentItems.length > 0) {
      return parsed.contentItems;
    }
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

async function executeAgentOnce(agentId: string, taskContext?: string, assignedModel?: string): Promise<AgentRunResult> {
  const config = AGENT_PROMPTS[agentId];
  if (!config) {
    throw new Error(`Unknown agent: ${agentId}`);
  }

  const startTime = Date.now();

  const ai = getAI();
  if (!ai) {
    throw new Error('AI service not configured. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_AI_API_KEY.');
  }

  const taskType = inferTaskType(agentId, taskContext);
  const routingInput: RoutingInput = { agentId, taskType };
  const routing = routeModel(routingInput);

  const primaryModel = assignedModel || routing.primaryModel;
  const fallbackModel = routing.fallbackModel;

  let memoryPromptSection = '';
  try {
    const memoryCtx = await assembleMemoryContext(agentId, taskContext);
    memoryPromptSection = formatMemoryForPrompt(memoryCtx);
    await setWorkingMemory(agentId, {
      currentTask: taskContext || 'scheduled_run',
      startedAt: new Date().toISOString(),
      assignedModel: primaryModel,
    });
  } catch (err) {
    console.log(`[AgentRunner] Memory retrieval skipped for ${agentId}:`, (err as Error).message);
  }

  let userPrompt = `Today is ${new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`;
  if (taskContext) {
    userPrompt += `\n\nTask context: ${taskContext}`;
  }
  userPrompt += '\n\nGenerate content now.';

  const toolPromptSection = (AGENT_TOOLS[agentId] && AGENT_TOOLS[agentId].length > 0)
    ? getToolPromptForAgent(agentId)
    : '';
  const systemPrompt = config.systemPrompt + memoryPromptSection + toolPromptSection;

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: userPrompt },
  ];

  let result;
  let modelUsed = primaryModel;
  let usedFallback = false;
  const toolCallResults: ToolCallResult[] = [];

  // Try native OpenAI tool calling if agent has tools and model is OpenAI
  const agentHasTools = !!(AGENT_TOOLS[agentId] && AGENT_TOOLS[agentId].length > 0);
  const openaiRunner = agentHasTools ? getOpenAIClientForRunner() : null;
  const isOpenAIModel = primaryModel.startsWith('gpt-') || primaryModel.startsWith('o1') || primaryModel.startsWith('o3');

  if (agentHasTools && openaiRunner && isOpenAIModel) {
    try {
      console.log(`[AgentRunner] ${agentId} using primary model with tools: ${primaryModel} (${routing.reason})`);
      const toolSchemas = getOpenAIToolSchemas(agentId);

      const oaiMessages: OpenAI.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      let response = await openaiRunner.chat.completions.create({
        model: primaryModel,
        messages: oaiMessages,
        tools: toolSchemas as any,
        tool_choice: 'auto',
        temperature: 0.7,
        max_tokens: 2048,
      });

      let assistantMessage = response.choices[0]?.message;

      // Tool execution loop — max 3 iterations
      let iterations = 0;
      while (assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0 && iterations < 3) {
        iterations++;
        oaiMessages.push(assistantMessage as any);

        for (const toolCall of assistantMessage.tool_calls) {
          const args = typeof toolCall.function.arguments === 'string'
            ? JSON.parse(toolCall.function.arguments)
            : toolCall.function.arguments;

          console.log(`[AgentRunner] ${agentId} auto-calling tool: ${toolCall.function.name}`, args);
          const toolResult = await executeTool(agentId, toolCall.function.name, args);
          toolCallResults.push(toolResult);

          oaiMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult),
          });
        }

        response = await openaiRunner.chat.completions.create({
          model: primaryModel,
          messages: oaiMessages,
          tools: toolSchemas as any,
          tool_choice: 'auto',
          temperature: 0.7,
          max_tokens: 2048,
        });

        assistantMessage = response.choices[0]?.message;
      }

      result = {
        content: assistantMessage?.content || '',
        model: primaryModel,
        provider: 'openai',
        usage: response.usage ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        } : undefined,
      };
    } catch (primaryErr: any) {
      console.warn(`[AgentRunner] Primary model with tools ${primaryModel} failed for ${agentId}: ${primaryErr.message}`);
      // Fall through to standard path below
      result = null;
    }
  }

  // Standard path (no tools, non-OpenAI model, or tool path failed)
  if (!result) {
    try {
      console.log(`[AgentRunner] ${agentId} using primary model: ${primaryModel} (${routing.reason})`);
      result = await ai.chat(messages, { model: primaryModel });
    } catch (primaryErr: any) {
      console.warn(`[AgentRunner] Primary model ${primaryModel} failed for ${agentId}: ${primaryErr.message}`);
      console.log(`[AgentRunner] Falling back to: ${fallbackModel}`);

      try {
        result = await ai.chat(messages, { model: fallbackModel });
        modelUsed = fallbackModel;
        usedFallback = true;
      } catch (fallbackErr: any) {
        throw new Error(`Both primary (${primaryModel}) and fallback (${fallbackModel}) models failed. Primary: ${primaryErr.message}. Fallback: ${fallbackErr.message}`);
      }
    }

    // Check for manual tool calls in the text response (non-OpenAI models)
    if (agentHasTools && result.content) {
      const manualToolCalls = parseToolCallsFromResponse(result.content);
      for (const tc of manualToolCalls) {
        console.log(`[AgentRunner] ${agentId} manual tool call: ${tc.name}`, tc.arguments);
        const toolResult = await executeTool(agentId, tc.name, tc.arguments);
        toolCallResults.push(toolResult);
      }

      // If tools were called, get a follow-up response with results
      if (toolCallResults.length > 0) {
        const toolSummary = toolCallResults.map(tr =>
          `Tool "${tr.toolName}": ${tr.success ? 'Success' : 'Failed'} — ${JSON.stringify(tr.result || tr.error)}`
        ).join('\n');

        try {
          const followUp = await ai.chat([
            ...messages,
            { role: 'assistant' as const, content: result.content },
            { role: 'user' as const, content: `Tool execution results:\n${toolSummary}\n\nSummarize what was accomplished.` },
          ], { model: modelUsed });

          result = { ...result, content: followUp.content };
        } catch {
          // Keep original content if follow-up fails
        }
      }
    }
  }

  const content = result.content;
  const duration = Date.now() - startTime;
  const outputSummary = content.substring(0, 200) + (content.length > 200 ? '...' : '');

  let apiCostUSD = 0;
  if (result.usage) {
    apiCostUSD = estimateCostUSD(modelUsed, result.usage.promptTokens, result.usage.completionTokens);
  }

  const costINR = apiCostUSD * USD_TO_INR;
  if (isHighCostTask(apiCostUSD)) {
    console.warn(`[AgentRunner] HIGH COST ALERT: ${agentId} task cost ₹${costINR.toFixed(2)} (${modelUsed}) — exceeds ₹${HIGH_COST_THRESHOLD_INR} threshold`);
    try {
      await supabaseInsert('dm_agent_logs', {
        agent_id: 'ledger',
        action: `HIGH_COST_ALERT: ${agentId} task`,
        details: {
          source_agent: agentId,
          model_used: modelUsed,
          api_cost_usd: apiCostUSD,
          api_cost_inr: costINR,
          threshold_inr: HIGH_COST_THRESHOLD_INR,
          prompt_tokens: result.usage?.promptTokens,
          completion_tokens: result.usage?.completionTokens,
        },
        status: 'warning',
        created_at: new Date().toISOString(),
      });
    } catch {}
  }

  const state = agentStates.get(agentId);
  const autonomyLevel = state?.autonomyLevel || 'manual';
  const guardrails = state?.guardrails || DEFAULT_GUARDRAILS;

  const structuredItems = (agentId === 'maven') ? parseStructuredContent(content) : null;

  if (structuredItems && structuredItems.length > 0) {
    let calendarItemsCreated = 0;
    for (const item of structuredItems) {
      const riskAssessment = scoreContentRisk(item.body || '', 'content_generation');
      const decision = shouldAutoExecute(autonomyLevel, riskAssessment.score);
      const guardrailCheck = await checkGuardrails(agentId, 'content_generation', guardrails, item.body);

      const platformLower = (item.platform || 'linkedin').toLowerCase();
      const hasMediaUrls = Array.isArray(item.media_urls) && item.media_urls.length > 0;
      const needsMedia = platformLower === 'instagram' && !hasMediaUrls;

      let calendarStatus: string;
      if (!guardrailCheck.allowed) {
        calendarStatus = 'blocked';
      } else if (needsMedia) {
        calendarStatus = 'pending_approval';
      } else if (riskAssessment.score >= 3) {
        calendarStatus = 'pending_approval';
      } else if (decision === 'execute') {
        calendarStatus = 'scheduled';
      } else {
        calendarStatus = 'pending_approval';
      }

      const scheduledTime = new Date(Date.now() + (item.scheduled_offset_hours || 24) * 60 * 60 * 1000);

      try {
        const calendarRows = await supabaseInsert('content_calendar', {
          agent_id: agentId,
          platform: item.platform || 'linkedin',
          content_type: item.content_type || 'post',
          title: item.title || '',
          body: item.body || '',
          media_urls: item.media_urls || [],
          media_hints: item.media_hints || '',
          content_pillar: item.content_pillar || '',
          hook: item.hook || '',
          cta: item.cta || '',
          target_audience: item.target_audience || '',
          funnel_stage: item.funnel_stage || '',
          scheduled_time: scheduledTime.toISOString(),
          risk_score: riskAssessment.score,
          risk_factors: riskAssessment.factors,
          status: calendarStatus,
          metadata: { generated_by: agentId, task_context: taskContext || null, autonomy_level: autonomyLevel },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        if (calendarStatus === 'pending_approval' && calendarRows.length > 0) {
          await supabaseInsert('founder_approval_queue', {
            content_calendar_id: calendarRows[0].id,
            agent_id: agentId,
            title: item.title || '',
            summary: (item.body || '').substring(0, 300),
            risk_score: riskAssessment.score,
            risk_factors: riskAssessment.factors,
            status: 'pending',
            created_at: new Date().toISOString(),
          });
        }

        calendarItemsCreated++;

        const estimatedLlmCost = ((item.body || '').length / 4000) * 0.0006 + 0.0005;

        await logAudit({
          agentId,
          actionType: 'content_calendar_insert',
          actionDescription: `Scheduled ${item.platform} ${item.content_type}: "${item.title}"`,
          entityType: 'content_calendar',
          entityId: calendarRows[0]?.id?.toString() || '',
          riskScore: riskAssessment.score,
          costAmount: Math.round(estimatedLlmCost * 10000) / 10000,
          costCurrency: 'USD',
          status: calendarStatus,
          metadata: { platform: item.platform, content_pillar: item.content_pillar },
        });
      } catch (err: any) {
        console.error(`[AgentRunner] Failed to insert content calendar item: ${err.message}`);
      }
    }

    await supabaseInsert('dm_content_queue', {
      agent_id: agentId,
      channel: config.channel,
      content_type: config.contentType,
      title: `${config.name} (${config.codename}) — ${new Date().toLocaleDateString('en-IN')}`,
      body: content,
      media_urls: [],
      scheduled_for: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      status: 'processed',
      metadata: { generated_by: 'agent_scheduler', task_context: taskContext || null, autonomy_level: autonomyLevel, calendar_items: calendarItemsCreated },
      created_at: new Date().toISOString(),
    });

    await logExecution({
      agentId,
      actionType: 'structured_content_generation',
      actionDescription: `Generated ${calendarItemsCreated} structured content items for content calendar`,
      autonomyLevel,
      guardrailsChecked: ['max_actions_per_day', 'content_blocklist', 'risk_scoring'],
      guardrailResult: 'passed',
      executionResult: 'success',
      details: { contentType: config.contentType, channel: config.channel, calendarItems: calendarItemsCreated },
    });

    return {
      agentId,
      status: 'success',
      duration,
      outputSummary,
      fullOutput: content,
      contentItems: calendarItemsCreated,
    };
  }

  const riskAssessment = scoreContentRisk(content, 'content_generation');
  const decision = shouldAutoExecute(autonomyLevel, riskAssessment.score);
  const guardrailCheck = await checkGuardrails(agentId, 'content_generation', guardrails, content);

  let contentStatus = 'pending';
  if (guardrailCheck.allowed && decision === 'execute') {
    contentStatus = 'approved';
  }

  await supabaseInsert('dm_content_queue', {
    agent_id: agentId,
    channel: config.channel,
    content_type: config.contentType,
    title: `${config.name} (${config.codename}) — ${new Date().toLocaleDateString('en-IN')}`,
    body: content,
    media_urls: [],
    scheduled_for: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    status: contentStatus,
    metadata: {
      generated_by: 'agent_scheduler',
      task_context: taskContext || null,
      autonomy_level: autonomyLevel,
      risk_score: riskAssessment.score,
      risk_factors: riskAssessment.factors,
      model_used: modelUsed,
      model_provider: result.provider || 'unknown',
      used_fallback: usedFallback,
      primary_model: primaryModel,
      fallback_model: fallbackModel,
      routing_reason: routing.reason,
    },
    created_at: new Date().toISOString(),
  });

  await logExecution({
    agentId,
    actionType: 'content_generation',
    actionDescription: `Generated ${config.contentType} for ${config.channel} using ${modelUsed}`,
    autonomyLevel,
    guardrailsChecked: ['max_actions_per_day', 'content_blocklist', 'risk_scoring'],
    guardrailResult: guardrailCheck.allowed ? 'passed' : (guardrailCheck.escalated ? 'escalated' : 'blocked'),
    executionResult: contentStatus === 'approved' ? 'success' : 'queued',
    details: {
      contentType: config.contentType,
      channel: config.channel,
      autoApproved: contentStatus === 'approved',
      riskScore: riskAssessment.score,
      model_used: modelUsed,
      primary_model: primaryModel,
      fallback_model: fallbackModel,
      used_fallback: usedFallback,
      api_cost_usd: apiCostUSD,
      api_cost_inr: costINR,
      prompt_tokens: result.usage?.promptTokens,
      completion_tokens: result.usage?.completionTokens,
      total_tokens: result.usage?.totalTokens,
      tool_calls: toolCallResults.length > 0 ? toolCallResults.map(tc => ({ tool: tc.toolName, success: tc.success })) : undefined,
    },
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

export async function runAgent(agentId: string, taskContext?: string, assignedModel?: string): Promise<AgentRunResult> {
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
  console.log(`[AgentRunner] Starting agent: ${config.name} (${resolved})${assignedModel ? ` [model: ${assignedModel}]` : ''}`);

  try {
    const result = await executeWithRetry(resolved, taskContext, assignedModel);
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
      assigned_model?: string;
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

        const result = await runAgent(resolved, `Task: ${task.title}\n${task.description}`, task.assigned_model);

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
      emoji: config.emoji,
      color: config.color,
      status: state?.status || 'idle',
      lastRunAt: state?.lastRunAt || null,
      lastRunDuration: state?.lastRunDuration || null,
      lastRunStatus: state?.lastRunStatus || null,
      nextRunAt: scheduleInfo?.[id] || state?.cronDescription || null,
      enabled: state?.enabled !== false,
      cronExpression: state?.cronExpression || null,
      autonomyLevel: state?.autonomyLevel || 'manual',
      guardrails: state?.guardrails || { ...DEFAULT_GUARDRAILS },
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
  autonomyLevel?: AutonomyLevel;
  guardrails?: Partial<AgentGuardrails>;
}): Promise<void> {
  const resolved = resolveAgentId(agentId);
  initAgentState(resolved);
  const state = agentStates.get(resolved)!;

  if (config.enabled !== undefined) state.enabled = config.enabled;
  if (config.cronExpression !== undefined) state.cronExpression = config.cronExpression;
  if (config.cronDescription !== undefined) state.cronDescription = config.cronDescription;
  if (config.autonomyLevel !== undefined) state.autonomyLevel = config.autonomyLevel;
  if (config.guardrails !== undefined) {
    state.guardrails = { ...state.guardrails, ...config.guardrails };
  }

  await persistAgentState(resolved);
}

export async function emergencyStopAllAgents(): Promise<{ stoppedAgents: string[] }> {
  const stoppedAgents: string[] = [];

  for (const [agentId, state] of agentStates.entries()) {
    if (state.autonomyLevel !== 'manual' || state.enabled) {
      state.autonomyLevel = 'manual';
      state.enabled = false;
      stoppedAgents.push(agentId);
      await persistAgentState(agentId);
    }
  }

  console.log(`[AgentRunner] EMERGENCY STOP: Paused ${stoppedAgents.length} agents`);

  try {
    await supabaseInsert('dm_agent_logs', {
      agent_id: 'system',
      action: 'EMERGENCY_STOP',
      details: { stoppedAgents, timestamp: new Date().toISOString() },
      status: 'warning',
      created_at: new Date().toISOString(),
    });
  } catch {}

  return { stoppedAgents };
}

export function getAgentAutonomyLevel(agentId: string): AutonomyLevel {
  const resolved = resolveAgentId(agentId);
  const state = agentStates.get(resolved);
  return state?.autonomyLevel || 'manual';
}

export function getAgentGuardrails(agentId: string): AgentGuardrails {
  const resolved = resolveAgentId(agentId);
  const state = agentStates.get(resolved);
  return state?.guardrails || { ...DEFAULT_GUARDRAILS };
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
