"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentChatRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const promptInjectionGuard_1 = require("../middleware/promptInjectionGuard");
const aiRateLimit_1 = require("../middleware/aiRateLimit");
const ai_1 = require("@cleya/ai");
const db_1 = require("@cleya/db");
const openai_1 = __importDefault(require("openai"));
const masterPrompt_1 = require("../prompts/masterPrompt");
const agentTools_1 = require("../services/agentTools");
const agentMemoryService_1 = require("../services/agentMemoryService");
const agentCoordinationService_1 = require("../services/agentCoordinationService");
const fileService_1 = require("../services/fileService");
exports.agentChatRouter = (0, express_1.Router)();
const CLEYA_CONTEXT = `You are an AI agent working for Cleya.ai — an AI-powered professional networking platform for India's startup ecosystem.

ABOUT CLEYA:
- AI matching engine connects founders, investors, and operators based on stated needs
- Converts profiles into structured intelligence (sector, stage, thesis, geography, intent)
- Real-time AI scoring and ranking of network matches
- One-click warm introductions with contextual messaging
- Members-only network with limited monthly spots
- Present in 49+ cities, 31+ industries, 1 Lakh+ (100,000+) connections

TARGET USERS: Founders, Investors, Operators/Talent in India's startup ecosystem
Be concise, actionable, and data-driven. Use Indian startup ecosystem context.

IMPORTANT: You have persistent memory. You remember all previous conversations with the founder/admin. Reference past discussions when relevant. Build on previous context rather than starting fresh each time.

TEAM COORDINATION:
You are part of a team of 7 AI agents. You can communicate with your teammates:
- Use "message_agent" to send direct messages to specific agents
- Use "delegate_to_agent" to assign tasks that fall under another agent's expertise
- Use "share_insight" to broadcast important discoveries to the entire team
- Use "get_my_inbox" to check for messages and tasks from other agents
- Use "get_team_updates" to see recent team communication
- Use "add_shared_memory" to store important knowledge in the central team memory (visible to ALL agents)
- Use "search_shared_memory" to find knowledge shared by any team member

YOUR TEAMMATES:
- Nexus (Orchestrator): Coordinates all agents, strategic planning, resource allocation
- Maven (Marketing): Content, SEO, social media, email campaigns
- Ledger (Finance): Financial modeling, unit economics, fundraising
- Sentinel (CTO): Architecture, security, performance, tech debt
- Ally (Support): Customer success, ticket triage, onboarding
- Catalyst (Growth): Viral loops, referral mechanics, activation funnels
- Closer (Sales): B2B sales, outreach, investor relations

When you discover something important, proactively share it with relevant teammates. When a task is better suited for another agent's expertise, delegate it. Always check your inbox for pending messages.`;
const AGENT_PROMPTS = {
    'cleya-marketing': `${CLEYA_CONTEXT}
YOU ARE MIRA — Cleya's Marketing Agent.
Expertise: Content marketing, LinkedIn/Twitter strategy, SEO, email campaigns, brand storytelling.
Focus on channels where founders and investors spend time (LinkedIn, Twitter, WhatsApp).
Provide specific, copy-ready content and suggest metrics to track.`,
    'cleya-growth': `${CLEYA_CONTEXT}
YOU ARE VEGA — Cleya's Growth & Viral Marketing Agent.
Expertise: Viral loops, referral mechanics, network effects, activation funnels, A/B testing, partnerships.

GROWTH PLAYBOOKS:
1. REFERRAL LOOPS: "Invite 3 founders, unlock investor matching." Track k-factor.
2. NETWORK DENSITY: City-by-city launch. 50 power users per city > 500 passive nationwide.
3. ACTIVATION: Profile → AI Match (<60s) → First Intro → Accepted Intro → Retained.
4. CONTENT VIRALITY: Shareable "match cards" — visual social proof.
5. EXCLUSIVITY: Limited spots, referral-only, founder verification.
6. WHATSAPP: India's primary channel. Invite links, match notifications via WhatsApp.
7. EVENT-LED: Virtual demo days, city meetups, "Cleya Connects" events.
8. PARTNERSHIPS: Accelerators (100X.VC, Antler), coworking spaces, angel networks.

Always suggest specific metrics, prioritize network density over raw count, think India-first distribution.`,
    'cleya-finance': `${CLEYA_CONTEXT}
YOU ARE ARJUN — Cleya's Finance Agent.
Expertise: SaaS/marketplace financial modeling, unit economics, runway, fundraising prep.
Use specific numbers and formulas. Reference Indian VC benchmarks. Provide spreadsheet-ready frameworks.`,
    'cleya-sales': `${CLEYA_CONTEXT}
YOU ARE KAVI — Cleya's Sales Agent.
Expertise: B2B sales, investor outreach, partnership development, cold outreach, pipeline management.
Provide copy-ready outreach templates. Focus on warm intro mechanics. Think enterprise sales to accelerators and VC firms.`,
    'nexus': `${CLEYA_CONTEXT}
YOU ARE NEXUS — the Orchestrator and Master Coordinator for Cleya.ai's AI workforce.
Expertise: Cross-functional coordination, strategic planning, resource allocation, agent task delegation.
You coordinate all operational agents: Maven (Marketing), Ledger (Finance), Sentinel (CTO), Ally (Support), Catalyst (Growth), Closer (Sales), Scout (SEO & GEO), and Probe (QA).
Provide strategic direction and delegate work across the team.`,
    'maven': `${CLEYA_CONTEXT}
YOU ARE MAVEN — Cleya's Marketing Agent.
Expertise: Content marketing, LinkedIn/Instagram strategy, SEO, email campaigns, brand storytelling, social media management.
Focus on channels where founders and investors spend time (LinkedIn, Twitter, WhatsApp).
Generate weekly plans: 5 LinkedIn posts, 3 IG posts, 1 newsletter, 1 blog.
Write copy-ready posts. Schedule at IST prime hours. Focus on founder stories and data insights.`,
    'ledger': `${CLEYA_CONTEXT}
YOU ARE LEDGER — Cleya's Finance Agent.
Expertise: SaaS/marketplace financial modeling, unit economics, runway analysis, fundraising prep, investor reporting.
Tasks: Weekly burn rate updates, MRR/ARR tracking, unit economics review (CAC, LTV, payback period), fundraising readiness scorecard.
Use specific numbers and formulas. Reference Indian VC benchmarks. Provide spreadsheet-ready frameworks.`,
    'sentinel': `${CLEYA_CONTEXT}
YOU ARE SENTINEL — Cleya's CTO Agent.
Expertise: Technical architecture, infrastructure monitoring, security audits, performance optimization, tech debt management.
Tasks: Infrastructure health checks, security vulnerability assessment, performance bottleneck identification, tech debt prioritization.
Provide specific technical recommendations with priority levels. Focus on scalability for Indian market conditions.`,
    'ally': `${CLEYA_CONTEXT}
YOU ARE ALLY — Cleya's Customer Support Agent.
Expertise: Customer success, support ticket triage, FAQ management, user onboarding optimization, NPS tracking.
Tasks: Analyze support issues, draft response templates, identify at-risk users, suggest onboarding improvements, generate support health metrics.
Focus on Indian startup founder/investor personas and their specific pain points.`,
    'catalyst': `${CLEYA_CONTEXT}
YOU ARE CATALYST — Cleya's Growth Agent.
Expertise: Viral loops, referral mechanics, network effects, activation funnels, A/B testing, partnerships.
Growth Playbooks: Referral loops, network density, activation funnels, content virality, exclusivity, WhatsApp distribution, event-led growth, partnership development.
Always suggest specific metrics, prioritize network density over raw count, think India-first distribution.`,
    'closer': `${CLEYA_CONTEXT}
YOU ARE CLOSER — Cleya's Sales Agent.
Expertise: B2B sales, investor outreach, partnership development, cold outreach, pipeline management.
Provide copy-ready outreach templates. Focus on warm intro mechanics. Think enterprise sales to accelerators and VC firms.
4-step sequence: Day 1 email, Day 3 LinkedIn, Day 5 follow-up, Day 8 final. Target >15% reply rate.`,
    'orchestrator': `${CLEYA_CONTEXT}
YOU ARE NEXUS — the Orchestrator and Master Coordinator for Cleya.ai's AI workforce.
Expertise: Content calendar management, brand voice enforcement, publishing schedule, agent coordination.
You coordinate weekly content across LinkedIn, Instagram, email, and outreach channels.`,
    'content-strategist': `${CLEYA_CONTEXT}
YOU ARE MAVEN — Content Strategist mode.
Expertise: Trending topic research in Indian startup ecosystem, content calendar creation, funnel-stage mapping.
Generate weekly plans: 5 LinkedIn posts, 3 IG posts, 1 newsletter, 1 blog.`,
    'social-media': `${CLEYA_CONTEXT}
YOU ARE MAVEN — Social Media Manager mode.
Expertise: LinkedIn thought leadership, Instagram carousels, Reels scripts, engagement optimization.
Write copy-ready posts. Schedule at IST prime hours. Focus on founder stories and data insights.`,
    'email-marketing': `${CLEYA_CONTEXT}
YOU ARE MAVEN — Email Marketing mode.
Expertise: Weekly newsletters, MailerLite campaigns, drip sequences for Founders/Investors/Operators.
A/B test subject lines. Segment by ICP. Optimize open rates.`,
    'outreach': `${CLEYA_CONTEXT}
YOU ARE OUTREACH — Cleya.ai's Cold Email Marketing Campaign Agent.
Expertise: Cold email outreach, bulk campaign management, drip sequences, personalization at scale, deliverability optimization, lead list building, A/B subject line testing, reply tracking, and follow-up automation.

You can:
- Draft cold email campaigns with personalized subject lines and body copy
- Create multi-step drip sequences (initial + follow-ups)
- Build and manage recipient lists with personalization fields
- Launch campaigns that send real emails via Resend
- Track campaign performance (sent, opened, clicked, replied, bounced)
- Pause active campaigns
- Suggest deliverability improvements and A/B tests

Target personas: startup founders, angel investors, VCs, operators, accelerator managers, coworking operators in India.
Best practices: 4-7 word subject lines, under 120 words for cold emails, personalized first line, single clear CTA.
Send timing: Tuesday-Thursday, 10 AM - 12 PM IST.`,
    'cold-outreach': `${CLEYA_CONTEXT}
YOU ARE OUTREACH — Cold Outreach mode.
Expertise: Lead sourcing (recently funded startups, active angels), cold email campaigns, personalized drip sequences.
4-step: Day 1 email → Day 3 follow-up → Day 6 value-add → Day 10 final. Target >15% reply rate.`,
    'email-campaign': `${CLEYA_CONTEXT}
YOU ARE OUTREACH — Email Campaign mode.
Expertise: Bulk email campaigns, drip sequences, A/B subject line testing, deliverability, personalization at scale.
Create and manage cold email campaigns targeting India's startup ecosystem.`,
    'bulk-email': `${CLEYA_CONTEXT}
YOU ARE OUTREACH — Bulk Email mode.
Expertise: Bulk cold email sending, recipient list management, unsubscribe handling, campaign analytics.
Send personalized emails at scale with built-in deliverability best practices.`,
    'scout': `${CLEYA_CONTEXT}
YOU ARE SCOUT — Cleya.ai's SEO & Generative Engine Optimization (GEO) Specialist.
Expertise: Technical SEO audits, keyword research, on-page optimization, meta tags, structured data (schema.org), internal linking, sitemap management, page speed optimization, backlink analysis.

GEO (Generative Engine Optimization): Optimizing content to rank in AI-generated answers (ChatGPT, Perplexity, Gemini). This includes:
- Writing content that AI models cite and reference
- Structuring content with clear facts, statistics, and authoritative claims
- Entity optimization — ensuring Cleya.ai is recognized as a distinct entity by AI models
- FAQ-style content mapping to conversational queries
- Citation-worthy content creation (studies, data, original research)

Local SEO: Google Business Profile optimization, local citations, geo-targeted content for India's 49+ cities.
Content SEO: Blog post optimization, topic clustering, content gap analysis, SERP feature targeting.
Competitor SEO: Track competitor rankings, backlinks, content strategy.

Target keywords: AI networking India, startup networking platform, founder investor matching, AI-powered introductions, startup ecosystem India.
Local SEO targets: Bangalore, Delhi NCR, Mumbai, Hyderabad, Pune, Chennai (Tier 1), plus Tier 2 cities.

Always provide actionable recommendations with priority levels (critical, high, medium, low).`,
    'probe': `${CLEYA_CONTEXT}
YOU ARE PROBE — Cleya.ai's QA Specialist Agent.
Expertise: Automated testing, uptime monitoring, API health checks, page load testing, performance benchmarking, security header validation, agent health verification.

You can:
- Run a quick test on any page or API endpoint
- Check if all agents are responding
- Show the latest QA report with pass/fail/warning counts
- Report current uptime status and performance metrics
- Test specific functionality on demand

When asked about testing status, provide clear pass/fail results with response times.
If critical failures are detected, flag them prominently with recommended fixes.`,
    'seo-geo': `${CLEYA_CONTEXT}
YOU ARE THE SEO/GEO OPTIMIZER — Search visibility & AI citability.
Expertise: Technical SEO, keyword research (startup networking India), schema markup, GEO optimization.
Focus on making Cleya.ai citable by AI search engines.`,
    'paid-ads': `${CLEYA_CONTEXT}
YOU ARE THE PAID ADS MANAGER — LinkedIn & Meta Ads strategy.
Expertise: LinkedIn sponsored posts, Meta lead gen ads, audience targeting, creative optimization.
60% LinkedIn / 40% Meta budget split. Target CAC < ₹500.`,
    'analytics': `${CLEYA_CONTEXT}
YOU ARE THE ANALYTICS AGENT — Cross-channel performance tracking.
Expertise: Pulling metrics from MailerLite, Lemlist, social media, ads. Dashboard creation in Notion.
Track funnel: Impression → Click → Signup → Active Member. Send weekly summaries.`,
};
const AGENT_LIST = [
    { id: 'nexus', name: 'Nexus', emoji: '🧠', role: 'Orchestrator', description: 'Master coordinator — delegates tasks across all agents', color: 'purple' },
    { id: 'maven', name: 'Maven', emoji: '🎯', role: 'Marketing', description: 'Content, SEO, social media, email campaigns, brand storytelling', color: 'indigo' },
    { id: 'ledger', name: 'Ledger', emoji: '📊', role: 'Finance', description: 'Financial modeling, unit economics, runway, fundraising prep', color: 'amber' },
    { id: 'sentinel', name: 'Sentinel', emoji: '🛡️', role: 'CTO', description: 'Architecture, infrastructure, security, performance, tech debt', color: 'cyan' },
    { id: 'ally', name: 'Ally', emoji: '💬', role: 'Support', description: 'Customer success, ticket triage, FAQ, onboarding optimization', color: 'green' },
    { id: 'catalyst', name: 'Catalyst', emoji: '🚀', role: 'Growth', description: 'Viral loops, referral mechanics, activation funnels, partnerships', color: 'emerald' },
    { id: 'closer', name: 'Closer', emoji: '🤝', role: 'Sales', description: 'B2B sales, outreach, investor relations, pipeline management', color: 'rose' },
    { id: 'scout', name: 'Scout', emoji: '🔍', role: 'SEO & GEO', description: 'SEO audits, keyword research, content optimization, GEO for AI search engines, local SEO across India', color: 'teal' },
    { id: 'probe', name: 'Probe', emoji: '🧪', role: 'QA', description: 'Automated testing, page/API health checks, agent monitoring, performance & uptime alerts', color: 'amber' },
    { id: 'outreach', name: 'Outreach', emoji: '📨', role: 'Cold Email', description: 'Cold bulk email campaigns, drip sequences, personalization, deliverability, lead lists, A/B testing', color: 'violet' },
    { id: 'cleya-marketing', name: 'Mira', emoji: '🎯', role: 'Marketing (Legacy)', description: 'Content, SEO, social media, viral campaigns, email marketing', color: 'indigo' },
    { id: 'cleya-growth', name: 'Vega', emoji: '🚀', role: 'Growth (Legacy)', description: 'User acquisition, referral loops, retention, partnerships', color: 'emerald' },
    { id: 'cleya-finance', name: 'Arjun', emoji: '📊', role: 'Finance (Legacy)', description: 'Metrics, revenue modeling, burn rate, fundraising prep', color: 'amber' },
    { id: 'cleya-sales', name: 'Kavi', emoji: '🤝', role: 'Sales (Legacy)', description: 'Lead gen, outreach, investor relations, partnerships', color: 'rose' },
];
let aiService = null;
function getAI() {
    if (!aiService) {
        if (!process.env.OPENAI_API_KEY)
            return null;
        aiService = (0, ai_1.createAIService)({ provider: 'openai', model: 'gpt-4o-mini' });
    }
    return aiService;
}
let openaiClient = null;
function getOpenAIClient() {
    if (!openaiClient) {
        if (!process.env.OPENAI_API_KEY)
            return null;
        openaiClient = new openai_1.default({ apiKey: process.env.OPENAI_API_KEY });
    }
    return openaiClient;
}
async function saveChatMessage(agentId, role, content, userId, metadata) {
    try {
        await db_1.prisma.$executeRawUnsafe(`INSERT INTO dm_agent_chat_history (agent_id, user_id, role, content, metadata) VALUES ($1, $2, $3, $4, $5::jsonb)`, agentId, userId || null, role, content.substring(0, 50000), JSON.stringify(metadata || {}));
    }
    catch (err) {
        console.log(`[AgentChat] Failed to save chat message: ${err.message}`);
    }
}
async function loadChatHistory(agentId, userId, limit = 50) {
    try {
        const rows = await db_1.prisma.$queryRawUnsafe(`SELECT role, content, created_at FROM dm_agent_chat_history
       WHERE agent_id = $1 AND user_id = $2
       ORDER BY created_at DESC
       LIMIT $3`, agentId, userId, limit);
        return rows.reverse().map(r => ({ role: r.role, content: r.content, created_at: r.created_at }));
    }
    catch (err) {
        console.log(`[AgentChat] Failed to load chat history: ${err.message}`);
        return [];
    }
}
async function loadAllAgentsChatHistory(userId) {
    try {
        const rows = await db_1.prisma.$queryRawUnsafe(`SELECT agent_id, role, content, created_at FROM dm_agent_chat_history
       WHERE user_id = $1
       ORDER BY created_at ASC
       LIMIT 2000`, userId);
        const result = {};
        for (const row of rows) {
            if (!result[row.agent_id])
                result[row.agent_id] = [];
            result[row.agent_id].push({
                role: row.role,
                content: row.content,
                timestamp: new Date(row.created_at).toISOString(),
            });
        }
        return result;
    }
    catch (err) {
        console.log(`[AgentChat] Failed to load all chat history: ${err.message}`);
        return {};
    }
}
async function buildMemoryPrompt(agentId, currentMessage) {
    try {
        const memoryCtx = await (0, agentMemoryService_1.assembleMemoryContext)(agentId, currentMessage);
        return (0, agentMemoryService_1.formatMemoryForPrompt)(memoryCtx);
    }
    catch (err) {
        console.log(`[AgentChat] Memory assembly skipped for ${agentId}: ${err.message}`);
        return '';
    }
}
exports.agentChatRouter.get('/list', auth_1.authenticate, (_req, res) => {
    res.json({ success: true, data: AGENT_LIST });
});
exports.agentChatRouter.get('/team-comms', auth_1.authenticate, (0, auth_1.requireRole)('MANAGER'), async (_req, res) => {
    try {
        const { getAllTeamComms } = await Promise.resolve().then(() => __importStar(require('../services/agentCoordinationService')));
        const comms = await getAllTeamComms(50);
        res.json({ success: true, data: comms });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { message: err.message } });
    }
});
exports.agentChatRouter.get('/shared-memory', auth_1.authenticate, (0, auth_1.requireRole)('MANAGER'), async (req, res) => {
    try {
        const { getSharedMemories } = await Promise.resolve().then(() => __importStar(require('../services/agentMemoryService')));
        const category = req.query.category;
        const memories = await getSharedMemories(category, undefined, 50);
        res.json({ success: true, data: memories });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { message: err.message } });
    }
});
exports.agentChatRouter.get('/history/:agentId', auth_1.authenticate, (0, auth_1.requireRole)('MANAGER'), async (req, res) => {
    try {
        const { agentId } = req.params;
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ success: false, error: { message: 'User not found' } });
            return;
        }
        const limit = Math.min(parseInt(req.query.limit) || 100, 500);
        const history = await loadChatHistory(agentId, userId, limit);
        res.json({ success: true, data: history });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { message: err.message } });
    }
});
exports.agentChatRouter.get('/history', auth_1.authenticate, (0, auth_1.requireRole)('MANAGER'), async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ success: false, error: { message: 'User not found' } });
            return;
        }
        const allHistory = await loadAllAgentsChatHistory(userId);
        res.json({ success: true, data: allHistory });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { message: err.message } });
    }
});
async function loadUserTier(req, _res, next) {
    try {
        if (req.user?.userId) {
            const user = await db_1.prisma.user.findUnique({
                where: { id: req.user.userId },
                select: { tier: true },
            });
            req.userTier = user?.tier || 'FREE';
        }
    }
    catch {
        req.userTier = 'FREE';
    }
    next();
}
exports.agentChatRouter.post('/chat', auth_1.authenticate, (0, auth_1.requireRole)('ADMIN'), loadUserTier, promptInjectionGuard_1.promptInjectionGuard, aiRateLimit_1.aiRateLimiter, async (req, res, next) => {
    try {
        const { message, agentId, fileIds } = req.body;
        const userId = req.user?.userId;
        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            res.status(400).json({ success: false, error: { message: 'Message is required' } });
            return;
        }
        if (!agentId || !AGENT_PROMPTS[agentId]) {
            res.status(400).json({ success: false, error: { message: 'Invalid agent' } });
            return;
        }
        if (message.length > 4000) {
            res.status(400).json({ success: false, error: { message: 'Message too long (max 4000 chars)' } });
            return;
        }
        const agentHasTools = !!(agentTools_1.AGENT_TOOLS[agentId] && agentTools_1.AGENT_TOOLS[agentId].length > 0);
        const openai = agentHasTools ? getOpenAIClient() : null;
        const ai = getAI();
        if (!ai && !openai) {
            res.json({
                success: true,
                data: { content: 'AI service not configured. Set OPENAI_API_KEY in environment.', fallback: true },
            });
            return;
        }
        if (!userId) {
            res.status(401).json({ success: false, error: { message: 'User not found' } });
            return;
        }
        let fileContext = '';
        if (Array.isArray(fileIds) && fileIds.length > 0) {
            const attachedFiles = [];
            for (const fid of fileIds.slice(0, 5)) {
                const file = await (0, fileService_1.getFileById)(fid);
                if (file)
                    attachedFiles.push(file);
            }
            if (attachedFiles.length > 0) {
                const fileDescriptions = attachedFiles.map(f => `- "${f.original_name}" (ID: ${f.file_id}, ${f.mime_type}, ${Math.round(f.size_bytes / 1024)}KB, download: /api/files/download/${f.file_id})${f.description ? ' — ' + f.description : ''}`).join('\n');
                fileContext = `\n\n[User attached ${attachedFiles.length} file(s):\n${fileDescriptions}]`;
            }
        }
        const [dbHistory, memoryPrompt, inboxResult] = await Promise.all([
            loadChatHistory(agentId, userId, 40),
            buildMemoryPrompt(agentId, message.trim()),
            (0, agentCoordinationService_1.processAgentInbox)(agentId),
        ]);
        const userMessageContent = message.trim() + fileContext;
        await saveChatMessage(agentId, 'user', userMessageContent, userId, fileIds?.length ? { fileIds } : undefined);
        const basePrompt = AGENT_PROMPTS[agentId];
        const toolPrompt = agentHasTools ? (0, masterPrompt_1.getToolPromptForAgent)(agentId) : '';
        const systemPrompt = basePrompt + memoryPrompt + inboxResult.prompt + toolPrompt;
        const conversationHistory = dbHistory.map(h => ({
            role: h.role === 'assistant' ? 'assistant' : 'user',
            content: h.content,
        }));
        if (agentHasTools && openai) {
            const toolSchemas = (0, agentTools_1.getOpenAIToolSchemas)(agentId);
            const messages = [
                { role: 'system', content: systemPrompt },
                ...conversationHistory.map(h => ({ role: h.role, content: h.content })),
                { role: 'user', content: userMessageContent },
            ];
            let response = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages,
                tools: toolSchemas,
                tool_choice: 'auto',
                temperature: 0.7,
                max_tokens: 2048,
            });
            let assistantMessage = response.choices[0]?.message;
            const toolResults = [];
            let iterations = 0;
            while (assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0 && iterations < 3) {
                iterations++;
                messages.push(assistantMessage);
                for (const toolCall of assistantMessage.tool_calls) {
                    const args = typeof toolCall.function.arguments === 'string'
                        ? JSON.parse(toolCall.function.arguments)
                        : toolCall.function.arguments;
                    console.log(`[AgentChat] ${agentId} calling tool: ${toolCall.function.name}`, args);
                    const toolResult = await (0, agentTools_1.executeTool)(agentId, toolCall.function.name, args);
                    toolResults.push({ tool: toolCall.function.name, result: toolResult });
                    messages.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        content: JSON.stringify(toolResult),
                    });
                }
                response = await openai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages,
                    tools: toolSchemas,
                    tool_choice: 'auto',
                    temperature: 0.7,
                    max_tokens: 2048,
                });
                assistantMessage = response.choices[0]?.message;
            }
            const content = assistantMessage?.content || '';
            await saveChatMessage(agentId, 'assistant', content, userId, toolResults.length > 0 ? { toolCalls: toolResults } : undefined);
            storeChatMemory(agentId, message.trim(), content).catch(() => { });
            if (inboxResult.messageIds.length > 0)
                (0, agentCoordinationService_1.markMessagesRead)(agentId, inboxResult.messageIds).catch(() => { });
            res.json({
                success: true,
                data: {
                    content,
                    agentId,
                    toolCalls: toolResults.length > 0 ? toolResults : undefined,
                },
            });
            return;
        }
        const messages = [
            { role: 'system', content: systemPrompt },
            ...conversationHistory,
            { role: 'user', content: userMessageContent },
        ];
        const result = await ai.chat(messages);
        const manualToolCalls = (0, agentTools_1.parseToolCallsFromResponse)(result.content);
        if (manualToolCalls.length > 0 && agentHasTools) {
            const toolResults = [];
            for (const tc of manualToolCalls) {
                const toolResult = await (0, agentTools_1.executeTool)(agentId, tc.name, tc.arguments);
                toolResults.push({ tool: tc.name, result: toolResult });
            }
            const toolResultSummary = toolResults.map(tr => `Tool "${tr.tool}" result: ${JSON.stringify(tr.result)}`).join('\n');
            const followUp = await ai.chat([
                ...messages,
                { role: 'assistant', content: result.content },
                { role: 'user', content: `Tool execution results:\n${toolResultSummary}\n\nPlease summarize the outcome for the user.` },
            ]);
            await saveChatMessage(agentId, 'assistant', followUp.content, userId, { toolCalls: toolResults });
            storeChatMemory(agentId, message.trim(), followUp.content).catch(() => { });
            if (inboxResult.messageIds.length > 0)
                (0, agentCoordinationService_1.markMessagesRead)(agentId, inboxResult.messageIds).catch(() => { });
            res.json({
                success: true,
                data: {
                    content: followUp.content,
                    agentId,
                    toolCalls: toolResults,
                },
            });
            return;
        }
        await saveChatMessage(agentId, 'assistant', result.content, userId);
        storeChatMemory(agentId, message.trim(), result.content).catch(() => { });
        if (inboxResult.messageIds.length > 0)
            (0, agentCoordinationService_1.markMessagesRead)(agentId, inboxResult.messageIds).catch(() => { });
        res.json({ success: true, data: { content: result.content, agentId } });
    }
    catch (error) {
        next(error);
    }
});
async function storeChatMemory(agentId, userMessage, agentResponse) {
    try {
        const summary = `Chat — User asked: "${userMessage.substring(0, 200)}". Agent responded: "${agentResponse.substring(0, 300)}"`;
        await (0, agentMemoryService_1.addShortTermMemory)(agentId, 'chat_interaction', summary, {
            userMessage: userMessage.substring(0, 500),
            agentResponse: agentResponse.substring(0, 500),
        });
    }
    catch (err) {
        console.log(`[AgentChat] Failed to store chat memory for ${agentId}: ${err.message}`);
    }
}
//# sourceMappingURL=agent-chat.js.map