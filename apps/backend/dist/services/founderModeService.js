"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureFounderModeTables = ensureFounderModeTables;
exports.createDecision = createDecision;
exports.getDecisions = getDecisions;
exports.updateDecisionStatus = updateDecisionStatus;
exports.updateDecisionOutcome = updateDecisionOutcome;
exports.triggerDebate = triggerDebate;
exports.getDebateEntries = getDebateEntries;
exports.generateDailyBriefing = generateDailyBriefing;
exports.getPriorityInbox = getPriorityInbox;
exports.getLatestBriefing = getLatestBriefing;
const db_1 = require("@cleya/db");
const ai_1 = require("@cleya/ai");
const supabaseClient_1 = require("./supabaseClient");
const founderSafetyService_1 = require("./founderSafetyService");
let aiService = null;
function getAI() {
    if (!aiService) {
        if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY && !process.env.GOOGLE_AI_API_KEY)
            return null;
        aiService = (0, ai_1.createAIService)({ provider: 'openai', model: 'gpt-4o-mini' });
    }
    return aiService;
}
async function ensureFounderModeTables() {
    try {
        await db_1.prisma.$executeRawUnsafe(`
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
        await db_1.prisma.$executeRawUnsafe(`
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
        await db_1.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS dm_daily_briefings (
        id SERIAL PRIMARY KEY,
        briefing_date DATE NOT NULL,
        content JSONB NOT NULL DEFAULT '{}',
        generated_by TEXT DEFAULT 'nexus',
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `);
        try {
            await db_1.prisma.$executeRawUnsafe(`NOTIFY pgrst, 'reload schema';`);
        }
        catch { }
        console.log('[FounderMode] Decision tables ensured');
    }
    catch (err) {
        console.log(`[FounderMode] Could not create tables: ${err.message}`);
    }
}
async function createDecision(data) {
    const rows = await (0, supabaseClient_1.supabaseInsert)('dm_decisions', {
        title: data.title,
        context: data.context,
        options: data.options,
        requesting_agent: data.requesting_agent,
        urgency: data.urgency,
        status: 'pending',
        created_at: new Date().toISOString(),
    });
    const decision = rows[0];
    try {
        await (0, founderSafetyService_1.notifyApprovalNeeded)({
            id: decision.id,
            title: decision.title,
            context: decision.context,
            requesting_agent: decision.requesting_agent,
            urgency: decision.urgency,
            options: decision.options,
        });
    }
    catch (err) {
        console.log(`[FounderMode] Failed to send approval notification: ${err.message}`);
    }
    return decision;
}
async function getDecisions(filters) {
    const queryFilters = {};
    if (filters?.status)
        queryFilters.status = filters.status;
    if (filters?.urgency)
        queryFilters.urgency = filters.urgency;
    return (0, supabaseClient_1.supabaseSelect)('dm_decisions', Object.keys(queryFilters).length > 0 ? queryFilters : undefined, { order: 'created_at.desc', limit: filters?.limit || 50 });
}
async function updateDecisionStatus(id, status, chosenOption, founderNotes) {
    const updateData = {
        status,
        decided_at: new Date().toISOString(),
    };
    if (chosenOption)
        updateData.chosen_option = chosenOption;
    if (founderNotes)
        updateData.founder_notes = founderNotes;
    await (0, supabaseClient_1.supabaseUpdate)('dm_decisions', { id: String(id) }, updateData);
}
async function updateDecisionOutcome(id, outcome) {
    await (0, supabaseClient_1.supabaseUpdate)('dm_decisions', { id: String(id) }, { outcome });
}
const AGENT_DEBATE_CONFIG = {
    nexus: { name: 'Nexus', emoji: '🧠', expertise: 'Strategic coordination, cross-functional impact analysis' },
    maven: { name: 'Maven', emoji: '🎯', expertise: 'Marketing impact, brand positioning, audience reach' },
    ledger: { name: 'Ledger', emoji: '📊', expertise: 'Financial impact, ROI analysis, budget implications' },
    sentinel: { name: 'Sentinel', emoji: '🛡️', expertise: 'Technical feasibility, infrastructure impact, security' },
    ally: { name: 'Ally', emoji: '💬', expertise: 'Customer impact, support implications, user experience' },
    catalyst: { name: 'Catalyst', emoji: '🚀', expertise: 'Growth impact, viral potential, network effects' },
    closer: { name: 'Closer', emoji: '🤝', expertise: 'Sales impact, pipeline effect, partnership implications' },
};
function selectDebateAgents(requestingAgent) {
    const allAgents = Object.keys(AGENT_DEBATE_CONFIG);
    const candidates = allAgents.filter(a => a !== requestingAgent && a !== 'nexus');
    const selected = candidates.sort(() => Math.random() - 0.5).slice(0, 2);
    if (!selected.includes('nexus')) {
        selected.push('nexus');
    }
    return selected;
}
async function triggerDebate(decisionId) {
    const decisions = await (0, supabaseClient_1.supabaseSelect)('dm_decisions', { id: String(decisionId) });
    if (decisions.length === 0) {
        throw new Error('Decision not found');
    }
    const decision = decisions[0];
    const ai = getAI();
    if (!ai) {
        throw new Error('AI service not configured');
    }
    const agentIds = selectDebateAgents(decision.requesting_agent);
    const entries = [];
    for (const agentId of agentIds) {
        const config = AGENT_DEBATE_CONFIG[agentId];
        if (!config)
            continue;
        const positions = ['for', 'against', 'neutral'];
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
            let dataPoints = {};
            try {
                const jsonMatch = result.content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    argument = parsed.argument || argument;
                    dataPoints = parsed.dataPoints || parsed.data_points || {};
                }
            }
            catch { }
            const inserted = await (0, supabaseClient_1.supabaseInsert)('dm_decision_debates', {
                decision_id: decisionId,
                agent_id: agentId,
                agent_name: config.name,
                position,
                argument,
                data_points: dataPoints,
                created_at: new Date().toISOString(),
            });
            if (inserted.length > 0)
                entries.push(inserted[0]);
        }
        catch (err) {
            console.error(`[FounderMode] Debate entry failed for ${agentId}:`, err.message);
        }
    }
    return entries;
}
async function getDebateEntries(decisionId) {
    return (0, supabaseClient_1.supabaseSelect)('dm_decision_debates', { decision_id: String(decisionId) }, { order: 'created_at.asc' });
}
async function generateDailyBriefing() {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const [totalUsers, completedProfiles, totalMatches, acceptedMatches, recentSignups,] = await Promise.all([
        db_1.prisma.user.count(),
        db_1.prisma.profile.count({ where: { isComplete: true } }),
        db_1.prisma.match.count(),
        db_1.prisma.match.count({ where: { status: 'ACCEPTED' } }),
        db_1.prisma.user.count({ where: { createdAt: { gte: yesterday } } }),
    ]);
    let agentActivity = [];
    try {
        agentActivity = await (0, supabaseClient_1.supabaseSelect)('dm_agent_logs', undefined, {
            order: 'created_at.desc',
            limit: 20,
        });
        agentActivity = agentActivity.filter((log) => new Date(log.created_at) >= yesterday);
    }
    catch { }
    let pendingContent = [];
    try {
        pendingContent = await (0, supabaseClient_1.supabaseSelect)('dm_content_queue', { status: 'pending' }, {
            order: 'created_at.desc',
            limit: 20,
        });
    }
    catch { }
    let pendingDecisions = [];
    try {
        pendingDecisions = await getDecisions({ status: 'pending', limit: 20 });
    }
    catch { }
    let agentErrors = [];
    try {
        const allLogs = await (0, supabaseClient_1.supabaseSelect)('dm_agent_logs', { status: 'error' }, {
            order: 'created_at.desc',
            limit: 10,
        });
        agentErrors = allLogs.filter((log) => new Date(log.created_at) >= yesterday);
    }
    catch { }
    let calendarPendingApproval = [];
    let calendarScheduled = [];
    let calendarPublished = [];
    try {
        calendarPendingApproval = await (0, supabaseClient_1.supabaseSelect)('content_calendar', { status: 'pending_approval' }, {
            order: 'scheduled_time.asc',
            limit: 20,
        });
    }
    catch { }
    try {
        calendarScheduled = await (0, supabaseClient_1.supabaseSelect)('content_calendar', { status: 'scheduled' }, {
            order: 'scheduled_time.asc',
            limit: 20,
        });
    }
    catch { }
    try {
        const recentPublished = await (0, supabaseClient_1.supabaseSelect)('content_calendar', { status: 'published' }, {
            order: 'published_at.desc',
            limit: 10,
        });
        calendarPublished = recentPublished.filter((item) => new Date(item.published_at) >= yesterday);
    }
    catch { }
    let adSpendSummary = { totalSpend: 0, platforms: {}, campaigns: 0 };
    try {
        const adRows = await (0, supabaseClient_1.supabaseSelect)('ad_performance', undefined, {
            order: 'date.desc',
            limit: 100,
        });
        const recentAds = adRows.filter((a) => new Date(a.date) >= yesterday);
        adSpendSummary.campaigns = recentAds.length;
        for (const ad of recentAds) {
            const spend = Number(ad.spend) || 0;
            adSpendSummary.totalSpend += spend;
            const plat = ad.platform || 'unknown';
            adSpendSummary.platforms[plat] = (adSpendSummary.platforms[plat] || 0) + spend;
        }
    }
    catch { }
    let auditCostSummary = { totalCost: 0, actionCount: 0 };
    try {
        const auditRows = await (0, supabaseClient_1.supabaseSelect)('audit_log', undefined, {
            order: 'created_at.desc',
            limit: 200,
        });
        const recentAudits = auditRows.filter((a) => new Date(a.created_at) >= yesterday);
        auditCostSummary.actionCount = recentAudits.length;
        for (const entry of recentAudits) {
            auditCostSummary.totalCost += Number(entry.cost_amount) || 0;
        }
    }
    catch { }
    const metrics = {
        totalUsers,
        completedProfiles,
        totalMatches,
        acceptedMatches,
        matchAcceptRate: totalMatches > 0 ? Math.round((acceptedMatches / totalMatches) * 100) : 0,
        recentSignups,
        contentCalendar: {
            pendingApproval: calendarPendingApproval.length,
            scheduled: calendarScheduled.length,
            publishedLast24h: calendarPublished.length,
        },
        adSpend: adSpendSummary,
        auditCosts: auditCostSummary,
    };
    const priorityItems = [];
    pendingDecisions.filter(d => d.urgency === 'critical' || d.urgency === 'high').forEach(d => {
        priorityItems.push({ type: 'decision', urgency: d.urgency, title: d.title, id: d.id });
    });
    calendarPendingApproval.forEach(c => {
        priorityItems.push({ type: 'content_approval', urgency: c.risk_score >= 4 ? 'high' : 'medium', title: `[${c.platform}] ${c.title}`, id: c.id });
    });
    pendingContent.slice(0, 5).forEach(c => {
        priorityItems.push({ type: 'legacy_content_approval', urgency: 'medium', title: c.title, id: c.id });
    });
    agentErrors.forEach(e => {
        priorityItems.push({ type: 'agent_error', urgency: 'high', title: `${e.agent_id}: ${e.action}`, id: e.id });
    });
    const actionList = [
        ...(calendarPendingApproval.length > 0 ? [`Review ${calendarPendingApproval.length} content calendar item(s) pending approval`] : []),
        ...(calendarScheduled.length > 0 ? [`${calendarScheduled.length} content item(s) scheduled for publishing`] : []),
        ...(calendarPublished.length > 0 ? [`${calendarPublished.length} content item(s) published in last 24h`] : []),
        ...(adSpendSummary.totalSpend > 0 ? [`Ad spend last 24h: $${adSpendSummary.totalSpend.toFixed(2)} across ${adSpendSummary.campaigns} campaign(s)`] : []),
        ...(auditCostSummary.totalCost > 0 ? [`Agent action costs last 24h: $${auditCostSummary.totalCost.toFixed(2)} (${auditCostSummary.actionCount} actions)`] : []),
        ...(pendingDecisions.length > 0 ? [`Review ${pendingDecisions.length} pending decision(s)`] : []),
        ...(pendingContent.length > 0 ? [`Approve ${pendingContent.length} legacy content item(s) in queue`] : []),
        ...(agentErrors.length > 0 ? [`Investigate ${agentErrors.length} agent error(s) from last 24h`] : []),
        ...(recentSignups > 0 ? [`${recentSignups} new signup(s) — review onboarding funnel`] : []),
    ];
    if (actionList.length === 0) {
        actionList.push('All clear — no urgent items today');
    }
    const briefing = {
        date: now.toISOString().split('T')[0],
        metrics,
        agentActivity,
        pendingDecisions,
        pendingContent,
        priorityItems,
        actionList,
    };
    try {
        await (0, supabaseClient_1.supabaseInsert)('dm_daily_briefings', {
            briefing_date: briefing.date,
            content: briefing,
            generated_by: 'nexus',
            created_at: now.toISOString(),
        });
    }
    catch (err) {
        console.log(`[FounderMode] Could not store briefing: ${err.message}`);
    }
    return briefing;
}
async function getPriorityInbox() {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    let pendingDecisions = [];
    try {
        pendingDecisions = await getDecisions({ status: 'pending', limit: 50 });
    }
    catch { }
    let pendingContent = [];
    try {
        pendingContent = await (0, supabaseClient_1.supabaseSelect)('dm_content_queue', { status: 'pending' }, {
            order: 'created_at.desc',
            limit: 30,
        });
    }
    catch { }
    let agentErrors = [];
    try {
        const allErrors = await (0, supabaseClient_1.supabaseSelect)('dm_agent_logs', { status: 'error' }, {
            order: 'created_at.desc',
            limit: 20,
        });
        agentErrors = allErrors.filter((log) => new Date(log.created_at) >= yesterday);
    }
    catch { }
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
async function getLatestBriefing() {
    try {
        const briefings = await (0, supabaseClient_1.supabaseSelect)('dm_daily_briefings', undefined, {
            order: 'created_at.desc',
            limit: 1,
        });
        return briefings.length > 0 ? briefings[0] : null;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=founderModeService.js.map