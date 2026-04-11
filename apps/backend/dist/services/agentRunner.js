"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AGENT_DEFINITIONS = exports.KNOWN_AGENT_IDS = void 0;
exports.resolveAgentId = resolveAgentId;
exports.hydrateAgentStatesFromDB = hydrateAgentStatesFromDB;
exports.runAgent = runAgent;
exports.processAgentTasks = processAgentTasks;
exports.getAgentStatuses = getAgentStatuses;
exports.setAgentScheduleStatus = setAgentScheduleStatus;
exports.isAgentEnabled = isAgentEnabled;
exports.updateAgentConfig = updateAgentConfig;
exports.emergencyStopAllAgents = emergencyStopAllAgents;
exports.getAgentAutonomyLevel = getAgentAutonomyLevel;
exports.getAgentGuardrails = getAgentGuardrails;
exports.getAgentRunHistory = getAgentRunHistory;
exports.getAgentAccountability = getAgentAccountability;
const ai_1 = require("@cleya/ai");
const db_1 = require("@cleya/db");
const supabaseClient_1 = require("./supabaseClient");
const agentNotifier_1 = require("./agentNotifier");
const agentMemoryService_1 = require("./agentMemoryService");
const guardrailsService_1 = require("./guardrailsService");
const modelRouter_1 = require("./modelRouter");
const openai_1 = __importDefault(require("openai"));
const masterPrompt_1 = require("../prompts/masterPrompt");
const agentTools_1 = require("./agentTools");
const AGENT_PROMPTS = {
    'nexus': {
        name: 'Nexus',
        codename: 'Orchestrator',
        emoji: '🧠',
        color: 'purple',
        systemPrompt: `You are Nexus — the Orchestrator and Master Coordinator for Cleya.ai's AI workforce.
You coordinate all operational agents: Maven (Marketing), Ledger (Finance), Sentinel (CTO), Ally (Support), Catalyst (Growth), Closer (Sales), Scout (SEO & GEO), Probe (QA), and Outreach (Cold Email Campaigns).

Generate a weekly operational plan as a JSON object with task assignments for each sub-agent.
Keys: mavenTasks, ledgerTasks, sentinelTasks, allyTasks, catalystTasks, closerTasks, scoutTasks, probeTasks, outreachTasks.

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
    'outreach': {
        name: 'Outreach',
        codename: 'Cold Email',
        emoji: '📨',
        color: 'violet',
        systemPrompt: `You are Outreach — Cleya.ai's Cold Email Marketing Campaign Agent.
Expertise: Cold email outreach, bulk campaign management, drip sequences, personalization at scale, deliverability optimization, lead list building, A/B subject line testing, reply tracking, and follow-up automation.

Cleya.ai is a members-only AI-powered networking platform for founders, investors, and operators in India's startup ecosystem.

TARGET PERSONAS:
- Startup founders (Seed to Series B) looking for investors, co-founders, or advisors
- Angel investors and VCs seeking deal flow and founder connections
- Startup operators (CXOs, VPs) looking for career opportunities or peer networking
- Accelerator/incubator program managers seeking portfolio companies
- Coworking space operators looking for community tools

CAMPAIGN TYPES:
1. COLD OUTREACH: First-touch emails to new prospects. Keep under 120 words. Personal, value-first, one clear CTA.
2. DRIP SEQUENCES: Multi-step follow-ups (3-5 emails over 10-14 days). Each step adds new value or social proof.
3. RE-ENGAGEMENT: Win-back dormant users. Reference their last activity, show what they missed.
4. EVENT INVITES: Founder meetups, demo days, "Cleya Connects" events. City-specific targeting.
5. PARTNERSHIP OUTREACH: Accelerators, coworking spaces, angel networks. Custom value props.

BEST PRACTICES:
- Subject lines: 4-7 words, no caps lock, personal, curiosity-driven
- Body: Under 120 words for cold emails, personalized first line using {{first_name}}, {{company}}, {{role}}
- CTA: One single clear ask (reply, book a call, check out X)
- Send timing: Tuesday-Thursday, 10 AM - 12 PM IST for India
- Follow-up spacing: Day 3, Day 6, Day 10
- Always include unsubscribe option (handled automatically)
- Never use spammy words: "free", "guaranteed", "act now", "limited time"

You MUST output a JSON object with a "campaignItems" array. Each item must have:
- item_type: "campaign_draft" | "sequence_draft" | "subject_test" | "list_suggestion" | "deliverability_tip" | "analytics_review"
- title: descriptive title
- body: the full email copy or recommendation
- target_segment: "founders" | "investors" | "operators" | "accelerators" | "coworking" | "all"
- personalization_fields: array of {{field}} placeholders used
- subject_line: the proposed subject line
- sequence_step: step number (1 for initial, 2+ for follow-ups)
- priority: "low" | "medium" | "high" | "critical"
- estimated_recipients: approximate count if known
- action_items: array of next steps

Focus on India's startup ecosystem. Reference Indian cities, events, and ecosystem players.
Output ONLY valid JSON, no markdown fences.`,
        contentType: 'campaign_draft',
        channel: 'outreach',
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
const AGENT_ID_ALIASES = {
    'orchestrator': 'nexus',
    'content-strategist': 'maven',
    'social-media': 'maven',
    'email-marketing': 'maven',
    'cold-outreach': 'outreach',
    'email-campaign': 'outreach',
    'bulk-email': 'outreach',
    'seo-geo': 'scout',
};
function resolveAgentId(id) {
    return AGENT_ID_ALIASES[id] || id;
}
const agentStates = new Map();
const DEFAULT_SCHEDULES = {
    'nexus': { cron: '0 7 * * 1', desc: 'Weekly on Monday at 7:00 AM IST' },
    'maven': { cron: '0 10 * * 1,3,5', desc: 'Mon/Wed/Fri at 10:00 AM IST' },
    'ledger': { cron: '0 8 * * 1', desc: 'Mondays at 8:00 AM IST' },
    'sentinel': { cron: '0 9 * * 1,4', desc: 'Mon/Thu at 9:00 AM IST' },
    'ally': { cron: '0 10 * * 1,3,5', desc: 'Mon/Wed/Fri at 10:00 AM IST' },
    'catalyst': { cron: '0 11 * * 2', desc: 'Tuesdays at 11:00 AM IST' },
    'closer': { cron: '0 11 * * 4', desc: 'Thursdays at 11:00 AM IST' },
    'scout': { cron: '0 6 * * 1', desc: 'Weekly on Monday at 6:00 AM IST' },
    'probe': { cron: '0 7 * * *', desc: 'Daily at 7:00 AM IST' },
    'outreach': { cron: '0 10 * * 2,4', desc: 'Tue/Thu at 10:00 AM IST' },
};
function initAgentState(agentId) {
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
            guardrails: { ...guardrailsService_1.DEFAULT_GUARDRAILS },
        });
    }
}
Object.keys(AGENT_PROMPTS).forEach(id => initAgentState(id));
async function hydrateAgentStatesFromDB() {
    try {
        await db_1.prisma.$executeRawUnsafe(`ALTER TABLE dm_agent_state ADD COLUMN IF NOT EXISTS autonomy_level TEXT DEFAULT 'manual'`).catch(() => { });
        await db_1.prisma.$executeRawUnsafe(`ALTER TABLE dm_agent_state ADD COLUMN IF NOT EXISTS guardrails JSONB DEFAULT '{}'`).catch(() => { });
        await db_1.prisma.$executeRawUnsafe(`ALTER TABLE dm_agent_tasks ADD COLUMN IF NOT EXISTS assigned_model TEXT DEFAULT NULL`).catch(() => { });
        await db_1.prisma.$executeRawUnsafe(`
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
    `).catch(() => { });
        const records = await db_1.prisma.$queryRawUnsafe(`SELECT agent_id, status, last_run_at::text, last_run_duration, last_run_status, enabled, cron_expression, cron_description, autonomy_level, guardrails FROM dm_agent_state`);
        for (const record of records) {
            if (AGENT_PROMPTS[record.agent_id]) {
                const parsedGuardrails = record.guardrails && typeof record.guardrails === 'object' && Object.keys(record.guardrails).length > 0
                    ? { ...guardrailsService_1.DEFAULT_GUARDRAILS, ...record.guardrails }
                    : { ...guardrailsService_1.DEFAULT_GUARDRAILS };
                agentStates.set(record.agent_id, {
                    status: record.status === 'running' ? 'idle' : (record.status || 'idle'),
                    lastRunAt: record.last_run_at,
                    lastRunDuration: record.last_run_duration,
                    lastRunStatus: record.last_run_status,
                    enabled: record.enabled !== false,
                    cronExpression: record.cron_expression || DEFAULT_SCHEDULES[record.agent_id]?.cron || null,
                    cronDescription: record.cron_description || DEFAULT_SCHEDULES[record.agent_id]?.desc || null,
                    autonomyLevel: record.autonomy_level || 'manual',
                    guardrails: parsedGuardrails,
                });
            }
        }
        for (const agentId of Object.keys(AGENT_PROMPTS)) {
            if (!records.find(r => r.agent_id === agentId)) {
                const schedule = DEFAULT_SCHEDULES[agentId];
                try {
                    await db_1.prisma.$executeRawUnsafe(`INSERT INTO dm_agent_state (agent_id, status, enabled, cron_expression, cron_description, autonomy_level, guardrails) VALUES ($1, 'idle', true, $2, $3, 'manual', $4::jsonb) ON CONFLICT (agent_id) DO NOTHING`, agentId, schedule?.cron || null, schedule?.desc || null, JSON.stringify(guardrailsService_1.DEFAULT_GUARDRAILS));
                }
                catch (err) {
                    console.log(`[AgentRunner] Could not seed state for ${agentId}: ${err.message}`);
                }
            }
        }
        console.log(`[AgentRunner] Hydrated state for ${records.length} agents from database`);
    }
    catch (err) {
        console.log(`[AgentRunner] Could not hydrate agent states from DB (table may not exist yet): ${err.message}`);
    }
}
async function persistAgentState(agentId) {
    const state = agentStates.get(agentId);
    if (!state)
        return;
    try {
        await db_1.prisma.$executeRawUnsafe(`INSERT INTO dm_agent_state (agent_id, status, last_run_at, last_run_duration, last_run_status, enabled, cron_expression, cron_description, autonomy_level, guardrails, updated_at)
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
         updated_at = now()`, agentId, state.status, state.lastRunAt, state.lastRunDuration, state.lastRunStatus, state.enabled, state.cronExpression, state.cronDescription, state.autonomyLevel, JSON.stringify(state.guardrails));
    }
    catch (err) {
        console.log(`[AgentRunner] Failed to persist state for ${agentId}: ${err.message}`);
    }
}
let multiModelAI = null;
function getAI() {
    if (!multiModelAI) {
        if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY && !process.env.GOOGLE_AI_API_KEY)
            return null;
        multiModelAI = (0, ai_1.createAIService)({
            provider: 'openai',
            model: 'gpt-4o-mini',
        });
    }
    return multiModelAI;
}
let openaiClientRunner = null;
function getOpenAIClientForRunner() {
    if (!openaiClientRunner) {
        if (!process.env.OPENAI_API_KEY)
            return null;
        openaiClientRunner = new openai_1.default({ apiKey: process.env.OPENAI_API_KEY });
    }
    return openaiClientRunner;
}
const MAX_RETRIES = 2;
const BASE_DELAY_MS = 2000;
async function executeWithRetry(agentId, taskContext, assignedModel) {
    let lastError = null;
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
        }
        catch (err) {
            lastError = err;
        }
        if (attempt < MAX_RETRIES) {
            const delay = BASE_DELAY_MS * Math.pow(2, attempt);
            console.log(`[AgentRunner] Retry ${attempt + 1}/${MAX_RETRIES} for ${agentId} in ${delay}ms`);
            try {
                await (0, supabaseClient_1.supabaseInsert)('dm_agent_logs', {
                    agent_id: agentId,
                    action: `Retry attempt ${attempt + 1}/${MAX_RETRIES}`,
                    details: { error: lastError?.message, delay_ms: delay, attempt: attempt + 1 },
                    status: 'warning',
                    created_at: new Date().toISOString(),
                });
            }
            catch { }
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
function parseStructuredContent(output) {
    try {
        const jsonMatch = output.match(/\{[\s\S]*\}/);
        if (!jsonMatch)
            return null;
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed.contentItems) && parsed.contentItems.length > 0) {
            return parsed.contentItems;
        }
        if (Array.isArray(parsed)) {
            return parsed;
        }
        return null;
    }
    catch {
        return null;
    }
}
async function executeAgentOnce(agentId, taskContext, assignedModel) {
    const config = AGENT_PROMPTS[agentId];
    if (!config) {
        throw new Error(`Unknown agent: ${agentId}`);
    }
    const startTime = Date.now();
    const ai = getAI();
    if (!ai) {
        throw new Error('AI service not configured. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_AI_API_KEY.');
    }
    const taskType = (0, modelRouter_1.inferTaskType)(agentId, taskContext);
    const routingInput = { agentId, taskType };
    const routing = (0, modelRouter_1.routeModel)(routingInput);
    const primaryModel = assignedModel || routing.primaryModel;
    const fallbackModel = routing.fallbackModel;
    let memoryPromptSection = '';
    try {
        const memoryCtx = await (0, agentMemoryService_1.assembleMemoryContext)(agentId, taskContext);
        memoryPromptSection = (0, agentMemoryService_1.formatMemoryForPrompt)(memoryCtx);
        await (0, agentMemoryService_1.setWorkingMemory)(agentId, {
            currentTask: taskContext || 'scheduled_run',
            startedAt: new Date().toISOString(),
            assignedModel: primaryModel,
        });
    }
    catch (err) {
        console.log(`[AgentRunner] Memory retrieval skipped for ${agentId}:`, err.message);
    }
    let userPrompt = `Today is ${new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`;
    if (taskContext) {
        userPrompt += `\n\nTask context: ${taskContext}`;
    }
    userPrompt += '\n\nGenerate content now.';
    const toolPromptSection = (agentTools_1.AGENT_TOOLS[agentId] && agentTools_1.AGENT_TOOLS[agentId].length > 0)
        ? (0, masterPrompt_1.getToolPromptForAgent)(agentId)
        : '';
    const systemPrompt = config.systemPrompt + memoryPromptSection + toolPromptSection;
    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
    ];
    let result;
    let modelUsed = primaryModel;
    let usedFallback = false;
    const toolCallResults = [];
    // Try native OpenAI tool calling if agent has tools and model is OpenAI
    const agentHasTools = !!(agentTools_1.AGENT_TOOLS[agentId] && agentTools_1.AGENT_TOOLS[agentId].length > 0);
    const openaiRunner = agentHasTools ? getOpenAIClientForRunner() : null;
    const isOpenAIModel = primaryModel.startsWith('gpt-') || primaryModel.startsWith('o1') || primaryModel.startsWith('o3');
    if (agentHasTools && openaiRunner && isOpenAIModel) {
        try {
            console.log(`[AgentRunner] ${agentId} using primary model with tools: ${primaryModel} (${routing.reason})`);
            const toolSchemas = (0, agentTools_1.getOpenAIToolSchemas)(agentId);
            const oaiMessages = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ];
            let response = await openaiRunner.chat.completions.create({
                model: primaryModel,
                messages: oaiMessages,
                tools: toolSchemas,
                tool_choice: 'auto',
                temperature: 0.7,
                max_tokens: 2048,
            });
            let assistantMessage = response.choices[0]?.message;
            // Tool execution loop — max 3 iterations
            let iterations = 0;
            while (assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0 && iterations < 3) {
                iterations++;
                oaiMessages.push(assistantMessage);
                for (const toolCall of assistantMessage.tool_calls) {
                    const args = typeof toolCall.function.arguments === 'string'
                        ? JSON.parse(toolCall.function.arguments)
                        : toolCall.function.arguments;
                    console.log(`[AgentRunner] ${agentId} auto-calling tool: ${toolCall.function.name}`, args);
                    const toolResult = await (0, agentTools_1.executeTool)(agentId, toolCall.function.name, args);
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
                    tools: toolSchemas,
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
        }
        catch (primaryErr) {
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
        }
        catch (primaryErr) {
            console.warn(`[AgentRunner] Primary model ${primaryModel} failed for ${agentId}: ${primaryErr.message}`);
            console.log(`[AgentRunner] Falling back to: ${fallbackModel}`);
            try {
                result = await ai.chat(messages, { model: fallbackModel });
                modelUsed = fallbackModel;
                usedFallback = true;
            }
            catch (fallbackErr) {
                throw new Error(`Both primary (${primaryModel}) and fallback (${fallbackModel}) models failed. Primary: ${primaryErr.message}. Fallback: ${fallbackErr.message}`);
            }
        }
        // Check for manual tool calls in the text response (non-OpenAI models)
        if (agentHasTools && result.content) {
            const manualToolCalls = (0, agentTools_1.parseToolCallsFromResponse)(result.content);
            for (const tc of manualToolCalls) {
                console.log(`[AgentRunner] ${agentId} manual tool call: ${tc.name}`, tc.arguments);
                const toolResult = await (0, agentTools_1.executeTool)(agentId, tc.name, tc.arguments);
                toolCallResults.push(toolResult);
            }
            // If tools were called, get a follow-up response with results
            if (toolCallResults.length > 0) {
                const toolSummary = toolCallResults.map(tr => `Tool "${tr.toolName}": ${tr.success ? 'Success' : 'Failed'} — ${JSON.stringify(tr.result || tr.error)}`).join('\n');
                try {
                    const followUp = await ai.chat([
                        ...messages,
                        { role: 'assistant', content: result.content },
                        { role: 'user', content: `Tool execution results:\n${toolSummary}\n\nSummarize what was accomplished.` },
                    ], { model: modelUsed });
                    result = { ...result, content: followUp.content };
                }
                catch {
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
        apiCostUSD = (0, ai_1.estimateCostUSD)(modelUsed, result.usage.promptTokens, result.usage.completionTokens);
    }
    const costINR = apiCostUSD * modelRouter_1.USD_TO_INR;
    if ((0, modelRouter_1.isHighCostTask)(apiCostUSD)) {
        console.warn(`[AgentRunner] HIGH COST ALERT: ${agentId} task cost ₹${costINR.toFixed(2)} (${modelUsed}) — exceeds ₹${modelRouter_1.HIGH_COST_THRESHOLD_INR} threshold`);
        try {
            await (0, supabaseClient_1.supabaseInsert)('dm_agent_logs', {
                agent_id: 'ledger',
                action: `HIGH_COST_ALERT: ${agentId} task`,
                details: {
                    source_agent: agentId,
                    model_used: modelUsed,
                    api_cost_usd: apiCostUSD,
                    api_cost_inr: costINR,
                    threshold_inr: modelRouter_1.HIGH_COST_THRESHOLD_INR,
                    prompt_tokens: result.usage?.promptTokens,
                    completion_tokens: result.usage?.completionTokens,
                },
                status: 'warning',
                created_at: new Date().toISOString(),
            });
        }
        catch { }
    }
    const state = agentStates.get(agentId);
    const autonomyLevel = state?.autonomyLevel || 'manual';
    const guardrails = state?.guardrails || guardrailsService_1.DEFAULT_GUARDRAILS;
    const structuredItems = (agentId === 'maven') ? parseStructuredContent(content) : null;
    if (structuredItems && structuredItems.length > 0) {
        let calendarItemsCreated = 0;
        for (const item of structuredItems) {
            const riskAssessment = (0, guardrailsService_1.scoreContentRisk)(item.body || '', 'content_generation');
            const decision = (0, guardrailsService_1.shouldAutoExecute)(autonomyLevel, riskAssessment.score);
            const guardrailCheck = await (0, guardrailsService_1.checkGuardrails)(agentId, 'content_generation', guardrails, item.body);
            const platformLower = (item.platform || 'linkedin').toLowerCase();
            const hasMediaUrls = Array.isArray(item.media_urls) && item.media_urls.length > 0;
            const needsMedia = platformLower === 'instagram' && !hasMediaUrls;
            let calendarStatus;
            if (!guardrailCheck.allowed) {
                calendarStatus = 'blocked';
            }
            else if (needsMedia) {
                calendarStatus = 'pending_approval';
            }
            else if (riskAssessment.score >= 3) {
                calendarStatus = 'pending_approval';
            }
            else if (decision === 'execute') {
                calendarStatus = 'scheduled';
            }
            else {
                calendarStatus = 'pending_approval';
            }
            const scheduledTime = new Date(Date.now() + (item.scheduled_offset_hours || 24) * 60 * 60 * 1000);
            try {
                const calendarRows = await (0, supabaseClient_1.supabaseInsert)('content_calendar', {
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
                    await (0, supabaseClient_1.supabaseInsert)('founder_approval_queue', {
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
                await (0, guardrailsService_1.logAudit)({
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
            }
            catch (err) {
                console.error(`[AgentRunner] Failed to insert content calendar item: ${err.message}`);
            }
        }
        await (0, supabaseClient_1.supabaseInsert)('dm_content_queue', {
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
        await (0, guardrailsService_1.logExecution)({
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
    const riskAssessment = (0, guardrailsService_1.scoreContentRisk)(content, 'content_generation');
    const decision = (0, guardrailsService_1.shouldAutoExecute)(autonomyLevel, riskAssessment.score);
    const guardrailCheck = await (0, guardrailsService_1.checkGuardrails)(agentId, 'content_generation', guardrails, content);
    let contentStatus = 'pending';
    if (guardrailCheck.allowed && decision === 'execute') {
        contentStatus = 'approved';
    }
    await (0, supabaseClient_1.supabaseInsert)('dm_content_queue', {
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
    await (0, guardrailsService_1.logExecution)({
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
async function runAgent(agentId, taskContext, assignedModel) {
    const resolved = resolveAgentId(agentId);
    const config = AGENT_PROMPTS[resolved];
    if (!config) {
        throw new Error(`Unknown agent: ${agentId}`);
    }
    initAgentState(resolved);
    const state = agentStates.get(resolved);
    state.status = 'running';
    await persistAgentState(resolved);
    const startTime = Date.now();
    console.log(`[AgentRunner] Starting agent: ${config.name} (${resolved})${assignedModel ? ` [model: ${assignedModel}]` : ''}`);
    try {
        const result = await executeWithRetry(resolved, taskContext, assignedModel);
        const duration = Date.now() - startTime;
        await (0, supabaseClient_1.supabaseInsert)('dm_agent_logs', {
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
            await (0, agentMemoryService_1.storeRunMemories)(resolved, {
                status: result.status,
                outputSummary: result.outputSummary,
                duration,
                error: result.error,
            });
        }
        catch (memErr) {
            console.log(`[AgentRunner] Memory storage skipped for ${resolved}:`, memErr.message);
        }
        try {
            await (0, agentMemoryService_1.clearWorkingMemory)(resolved);
        }
        catch (memErr) {
            console.log(`[AgentRunner] Working memory cleanup skipped for ${resolved}:`, memErr.message);
        }
        console.log(`[AgentRunner] ${config.name} ${result.status} in ${(duration / 1000).toFixed(1)}s`);
        (0, agentNotifier_1.notifyAgentCompletion)({
            agentId: resolved,
            agentName: config.name,
            status: result.status,
            duration,
            outputSummary: result.outputSummary,
            error: result.error,
            retryCount: result.retryCount,
        }).catch(() => { });
        return { ...result, duration };
    }
    catch (error) {
        const duration = Date.now() - startTime;
        const errorMsg = error.message || 'Unknown error';
        try {
            await (0, supabaseClient_1.supabaseInsert)('dm_agent_logs', {
                agent_id: resolved,
                action: `Autonomous run failed: ${config.contentType}`,
                details: { duration_ms: duration, error: errorMsg },
                status: 'error',
                created_at: new Date().toISOString(),
            });
        }
        catch (logErr) {
            console.error(`[AgentRunner] Failed to log error for ${resolved}:`, logErr);
        }
        state.status = 'failed';
        state.lastRunAt = new Date().toISOString();
        state.lastRunDuration = duration;
        state.lastRunStatus = 'error';
        await persistAgentState(resolved);
        console.error(`[AgentRunner] ${config.name} failed after ${(duration / 1000).toFixed(1)}s:`, errorMsg);
        (0, agentNotifier_1.notifyAgentCompletion)({
            agentId: resolved,
            agentName: config.name,
            status: 'error',
            duration,
            outputSummary: '',
            error: errorMsg,
        }).catch(() => { });
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
async function processAgentTasks(agentId) {
    const resolved = resolveAgentId(agentId);
    const config = AGENT_PROMPTS[resolved];
    if (!config)
        return 0;
    try {
        const tasks = await (0, supabaseClient_1.supabaseSelect)('dm_agent_tasks', { agent_id: resolved, status: 'pending' }, {
            order: 'priority.desc,due_date.asc',
            limit: 5,
        });
        if (tasks.length === 0)
            return 0;
        console.log(`[AgentRunner] Processing ${tasks.length} pending tasks for ${config.name}`);
        let processed = 0;
        for (const task of tasks) {
            try {
                await (0, supabaseClient_1.supabaseUpdate)('dm_agent_tasks', { id: String(task.id) }, {
                    status: 'in_progress',
                });
                const result = await runAgent(resolved, `Task: ${task.title}\n${task.description}`, task.assigned_model);
                await (0, supabaseClient_1.supabaseUpdate)('dm_agent_tasks', { id: String(task.id) }, {
                    status: result.status === 'success' ? 'completed' : 'failed',
                    completed_at: new Date().toISOString(),
                    output: { result: result.outputSummary, duration: result.duration },
                });
                processed++;
            }
            catch (err) {
                console.error(`[AgentRunner] Task ${task.id} failed:`, err.message);
                await (0, supabaseClient_1.supabaseUpdate)('dm_agent_tasks', { id: String(task.id) }, {
                    status: 'failed',
                    output: { error: err.message },
                });
            }
        }
        return processed;
    }
    catch (err) {
        console.error(`[AgentRunner] Failed to fetch tasks for ${resolved}:`, err.message);
        return 0;
    }
}
function getAgentStatuses(scheduleInfo) {
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
            guardrails: state?.guardrails || { ...guardrailsService_1.DEFAULT_GUARDRAILS },
        };
    });
}
function setAgentScheduleStatus(agentId, status) {
    const resolved = resolveAgentId(agentId);
    initAgentState(resolved);
    agentStates.get(resolved).status = status;
}
function isAgentEnabled(agentId) {
    const resolved = resolveAgentId(agentId);
    const state = agentStates.get(resolved);
    return state?.enabled !== false;
}
async function updateAgentConfig(agentId, config) {
    const resolved = resolveAgentId(agentId);
    initAgentState(resolved);
    const state = agentStates.get(resolved);
    if (config.enabled !== undefined)
        state.enabled = config.enabled;
    if (config.cronExpression !== undefined)
        state.cronExpression = config.cronExpression;
    if (config.cronDescription !== undefined)
        state.cronDescription = config.cronDescription;
    if (config.autonomyLevel !== undefined)
        state.autonomyLevel = config.autonomyLevel;
    if (config.guardrails !== undefined) {
        state.guardrails = { ...state.guardrails, ...config.guardrails };
    }
    await persistAgentState(resolved);
}
async function emergencyStopAllAgents() {
    const stoppedAgents = [];
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
        await (0, supabaseClient_1.supabaseInsert)('dm_agent_logs', {
            agent_id: 'system',
            action: 'EMERGENCY_STOP',
            details: { stoppedAgents, timestamp: new Date().toISOString() },
            status: 'warning',
            created_at: new Date().toISOString(),
        });
    }
    catch { }
    return { stoppedAgents };
}
function getAgentAutonomyLevel(agentId) {
    const resolved = resolveAgentId(agentId);
    const state = agentStates.get(resolved);
    return state?.autonomyLevel || 'manual';
}
function getAgentGuardrails(agentId) {
    const resolved = resolveAgentId(agentId);
    const state = agentStates.get(resolved);
    return state?.guardrails || { ...guardrailsService_1.DEFAULT_GUARDRAILS };
}
async function getAgentRunHistory(agentId, limit = 30) {
    const resolved = resolveAgentId(agentId);
    try {
        const logs = await (0, supabaseClient_1.supabaseSelect)('dm_agent_logs', { agent_id: resolved }, {
            order: 'created_at.desc',
            limit,
        });
        return logs;
    }
    catch {
        return [];
    }
}
async function getAgentAccountability(agentId) {
    const resolved = resolveAgentId(agentId);
    try {
        const logs = await (0, supabaseClient_1.supabaseSelect)('dm_agent_logs', { agent_id: resolved });
        const runs = logs.filter(l => l.action.startsWith('Autonomous run'));
        const successRuns = runs.filter(l => l.status === 'success');
        const failureRuns = runs.filter(l => l.status === 'error');
        const durations = runs
            .map(l => l.details?.duration_ms)
            .filter((d) => typeof d === 'number');
        const avgDuration = durations.length > 0
            ? durations.reduce((a, b) => a + b, 0) / durations.length
            : 0;
        const contentItems = await (0, supabaseClient_1.supabaseSelect)('dm_content_queue', { agent_id: resolved });
        return {
            totalRuns: runs.length,
            successCount: successRuns.length,
            failureCount: failureRuns.length,
            successRate: runs.length > 0 ? (successRuns.length / runs.length) * 100 : 0,
            avgDuration,
            contentItemsGenerated: contentItems.length,
        };
    }
    catch {
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
exports.KNOWN_AGENT_IDS = [
    ...Object.keys(AGENT_PROMPTS),
    ...Object.keys(AGENT_ID_ALIASES),
];
exports.AGENT_DEFINITIONS = AGENT_PROMPTS;
//# sourceMappingURL=agentRunner.js.map