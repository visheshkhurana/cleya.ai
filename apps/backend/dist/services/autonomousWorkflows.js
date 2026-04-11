"use strict";
/**
 * Autonomous Workflows — scheduled automation routines for all Cleya Control Tower agents.
 *
 * Each function gathers data from relevant APIs, uses the LLM router for insights/content,
 * saves reports to Supabase, and executes actions where appropriate.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runNexusDailyBrief = runNexusDailyBrief;
exports.runMavenContentPost = runMavenContentPost;
exports.runLedgerFinancialMonitor = runLedgerFinancialMonitor;
exports.runLedgerWeeklyReview = runLedgerWeeklyReview;
exports.runSentinelHealthCheck = runSentinelHealthCheck;
exports.runAllyEngagementCheck = runAllyEngagementCheck;
exports.runCatalystGrowthAnalysis = runCatalystGrowthAnalysis;
exports.runCatalystWeeklyReview = runCatalystWeeklyReview;
exports.runCloserSalesPipeline = runCloserSalesPipeline;
exports.runAdCampaignAutomation = runAdCampaignAutomation;
const ai_1 = require("@cleya/ai");
const supabaseClient_1 = require("./supabaseClient");
const modelRouter_1 = require("./modelRouter");
const ga4Service_1 = require("./ga4Service");
const posthogService_1 = require("./posthogService");
const sentryService_1 = require("./sentryService");
const ayrshareService_1 = require("./ayrshareService");
const adsService_1 = require("./adsService");
const adCampaignAutomation_1 = require("./adCampaignAutomation");
// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------
let sharedAI = null;
function getAI() {
    if (!sharedAI) {
        if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY && !process.env.GOOGLE_AI_API_KEY)
            return null;
        sharedAI = (0, ai_1.createAIService)({ provider: 'openai', model: 'gpt-4o-mini' });
    }
    return sharedAI;
}
async function llmGenerate(agentId, taskType, prompt) {
    const ai = getAI();
    if (!ai)
        return '[LLM unavailable — no API key configured]';
    const routing = (0, modelRouter_1.routeModel)({ agentId, taskType });
    try {
        const result = await ai.chat([{ role: 'user', content: prompt }], { model: routing.primaryModel });
        return result.content;
    }
    catch (primaryErr) {
        console.warn(`[AutonomousWorkflows] Primary model ${routing.primaryModel} failed for ${agentId}: ${primaryErr.message}`);
        try {
            const result = await ai.chat([{ role: 'user', content: prompt }], { model: routing.fallbackModel });
            return result.content;
        }
        catch (fallbackErr) {
            console.error(`[AutonomousWorkflows] Fallback model also failed for ${agentId}: ${fallbackErr.message}`);
            return `[LLM generation failed: ${primaryErr.message}]`;
        }
    }
}
function todayISO() {
    return new Date().toISOString().split('T')[0];
}
function todayIST() {
    return new Date().toLocaleDateString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'Asia/Kolkata',
    });
}
async function safeQuery(label, fn) {
    try {
        return await fn();
    }
    catch (err) {
        console.warn(`[AutonomousWorkflows] ${label} failed: ${err.message}`);
        return null;
    }
}
// ---------------------------------------------------------------------------
// 1. NEXUS — Daily Operations Brief (8 AM IST)
// ---------------------------------------------------------------------------
async function runNexusDailyBrief() {
    console.log('[AutonomousWorkflows] Running Nexus Daily Operations Brief...');
    // Collect last runs from all agents
    const agentLogs = await safeQuery('agent logs', () => (0, supabaseClient_1.supabaseSelect)('dm_agent_logs', {}, { order: 'created_at.desc', limit: 50 })) || [];
    // Check integration health
    const integrationStatus = {
        ayrshare: ayrshareService_1.ayrshareService.isConfigured(),
        ga4: ga4Service_1.ga4Service.isConfigured(),
        posthog: posthogService_1.posthogService.isConfigured(),
        sentry: sentryService_1.sentryService.isConfigured(),
        meta_ads: !!(process.env.META_ADS_ACCESS_TOKEN && process.env.META_AD_ACCOUNT_ID),
    };
    // Gather yesterday's metrics
    const ga4Metrics = await safeQuery('GA4', () => ga4Service_1.ga4Service.getMetrics('7d'));
    const posthogMetrics = await safeQuery('PostHog', () => posthogService_1.posthogService.getMetrics('7d'));
    const sentryMetrics = await safeQuery('Sentry', () => sentryService_1.sentryService.getMetrics('7d'));
    // Check latest Probe/Scout reports
    const latestQA = await safeQuery('QA report', () => (0, supabaseClient_1.supabaseSelect)('qa_daily_reports', {}, { order: 'report_date.desc', limit: 1 }));
    const latestSEO = await safeQuery('SEO report', () => (0, supabaseClient_1.supabaseSelect)('seo_daily_reports', {}, { order: 'report_date.desc', limit: 1 }));
    // Generate daily brief via LLM
    const briefPrompt = `You are Nexus, the Orchestrator for Cleya.ai's Control Tower.
Today is ${todayIST()}.

Generate a Daily Operations Brief based on this data:

## Agent Activity (Last 24h)
${JSON.stringify(agentLogs.slice(0, 20), null, 2)}

## Integration Status
${JSON.stringify(integrationStatus, null, 2)}

## GA4 Metrics (7d)
${ga4Metrics ? JSON.stringify({ pageviews: ga4Metrics.pageviews, sessions: ga4Metrics.sessions, activeUsers: ga4Metrics.activeUsers, bounceRate: ga4Metrics.bounceRate }, null, 2) : 'Not available'}

## PostHog Metrics (7d)
${posthogMetrics ? JSON.stringify({ uniqueUsers: posthogMetrics.uniqueUsers, totalEvents: posthogMetrics.totalEvents, avgEventsPerUser: posthogMetrics.avgEventsPerUser }, null, 2) : 'Not available'}

## Sentry Metrics (7d)
${sentryMetrics ? JSON.stringify({ totalErrors: sentryMetrics.totalErrors, unresolvedIssues: sentryMetrics.unresolvedIssues, topIssues: sentryMetrics.topIssues?.slice(0, 3) }, null, 2) : 'Not available'}

## Latest QA Report
${latestQA?.[0]?.summary || 'No recent QA report'}

## Latest SEO Report
${latestSEO?.[0]?.summary || 'No recent SEO report'}

Output a structured daily brief with:
1. Executive Summary (2-3 sentences)
2. System Health Status (all integrations)
3. Key Metrics (users, sessions, engagement, errors)
4. Critical Issues (from Probe/Scout/Sentry)
5. Today's Priorities (actionable list for the team)
6. Agent Performance Summary

Keep it concise and actionable. Focus on the Indian startup ecosystem context.`;
    const briefContent = await llmGenerate('nexus', 'operational_plan', briefPrompt);
    // Save to Supabase
    await safeQuery('save brief', () => (0, supabaseClient_1.supabaseUpsert)('daily_ops_briefs', {
        report_date: todayISO(),
        summary: briefContent.substring(0, 500),
        full_report: { content: briefContent, generated_at: new Date().toISOString() },
        agent_statuses: agentLogs.slice(0, 20),
        system_health: integrationStatus,
        metrics_summary: {
            ga4: ga4Metrics ? { pageviews: ga4Metrics.pageviews, sessions: ga4Metrics.sessions, activeUsers: ga4Metrics.activeUsers } : null,
            posthog: posthogMetrics ? { uniqueUsers: posthogMetrics.uniqueUsers, totalEvents: posthogMetrics.totalEvents } : null,
            sentry: sentryMetrics ? { totalErrors: sentryMetrics.totalErrors, unresolvedIssues: sentryMetrics.unresolvedIssues } : null,
        },
        critical_issues: sentryMetrics?.topIssues?.slice(0, 5) || [],
        priorities: [],
        created_at: new Date().toISOString(),
    }, 'report_date'));
    console.log(`[AutonomousWorkflows] Nexus Daily Brief completed (${briefContent.length} chars)`);
    return briefContent;
}
// ---------------------------------------------------------------------------
// 2. MAVEN — Automated Content Engine (9 AM / 1 PM / 6 PM IST)
// ---------------------------------------------------------------------------
const WEEKLY_THEMES = {
    1: 'Fundraising tips & investor insights',
    2: 'Hiring & talent in Indian startups',
    3: 'Sector spotlight (Fintech, HealthTech, SaaS, D2C, EdTech)',
    4: 'City spotlight (Bangalore, Delhi, Mumbai, Hyderabad, Pune)',
    5: 'Weekly network stats & success stories',
    6: 'Weekend reading recommendations',
    0: 'Founder motivation & mindset',
};
const MAVEN_HASHTAGS = '#CleyaAI #StartupIndia #Founders #Networking #IndianStartups #VentureCapital #BuildInPublic';
async function runMavenContentPost(timeSlot) {
    console.log(`[AutonomousWorkflows] Running Maven Content Post — ${timeSlot}...`);
    const dayOfWeek = new Date().getDay();
    const theme = WEEKLY_THEMES[dayOfWeek];
    const slotConfig = {
        morning: {
            type: 'Morning Insight',
            instruction: 'Generate a "Morning Insight" — a startup ecosystem tip, networking advice, or industry statistic relevant to Indian founders.',
            platforms: ['linkedin', 'facebook'],
        },
        afternoon: {
            type: 'Founder Spotlight',
            instruction: 'Generate a "Founder Spotlight" or "Connection Story" — share success stories of networking, fundraising stats, or hiring wins from India\'s startup ecosystem.',
            platforms: ['linkedin', 'instagram'],
        },
        evening: {
            type: 'Evening Engagement',
            instruction: 'Generate an "Evening Engagement" post — a thought-provoking question, poll idea, or community highlight that sparks conversation among founders.',
            platforms: ['linkedin', 'facebook'],
        },
    };
    const config = slotConfig[timeSlot];
    const contentPrompt = `You are Maven, Cleya.ai's Marketing Agent.
Today is ${todayIST()}. Theme of the day: "${theme}".

${config.instruction}

Requirements:
- Be relevant to India's startup ecosystem
- Include relevant hashtags: ${MAVEN_HASHTAGS}
- Be appropriate for ${config.platforms.join(' and ')} (LinkedIn = professional tone, Instagram = visual with caption, Facebook = community tone)
- Include a CTA: "Apply now at cleya.ai" or "Only limited spots remaining — apply at cleya.ai"
- Do NOT mention being AI-generated
- Keep it engaging, authentic, and value-driven
- LinkedIn: 150-250 words, use line breaks for readability
- Instagram/Facebook: 50-150 words, concise and punchy

Cleya.ai is a members-only AI-powered networking platform connecting founders, investors, and operators across 49+ cities in India. 1 Lakh+ connections made. Stats: 31+ industries represented.

Output the post text ONLY — no JSON, no markdown fences, just the ready-to-post content.`;
    const postContent = await llmGenerate('maven', 'linkedin_post', contentPrompt);
    // Post to each platform via Ayrshare
    const results = [];
    if (ayrshareService_1.ayrshareService.isConfigured()) {
        try {
            const postResult = await ayrshareService_1.ayrshareService.post({
                content: postContent,
                platforms: config.platforms,
            });
            results.push(postResult);
            console.log(`[AutonomousWorkflows] Maven posted to ${config.platforms.join(', ')}: ${postResult.success ? 'Success' : postResult.error}`);
        }
        catch (err) {
            console.error(`[AutonomousWorkflows] Maven Ayrshare post failed: ${err.message}`);
            results.push({ success: false, error: err.message });
        }
    }
    else {
        console.log('[AutonomousWorkflows] Ayrshare not configured — saving content without posting');
        results.push({ success: false, error: 'Ayrshare not configured' });
    }
    // Log to content_posts_log
    await safeQuery('save post log', () => (0, supabaseClient_1.supabaseInsert)('content_posts_log', {
        post_date: todayISO(),
        time_slot: timeSlot,
        platform: config.platforms.join(','),
        content: postContent,
        hashtags: MAVEN_HASHTAGS,
        post_type: config.type,
        theme,
        ayrshare_response: results,
        status: results.some(r => r.success) ? 'posted' : 'failed',
        created_at: new Date().toISOString(),
    }));
    // Also insert into content_calendar for tracking
    await safeQuery('save to calendar', () => (0, supabaseClient_1.supabaseInsert)('content_calendar', {
        agent_id: 'maven',
        platform: config.platforms[0],
        content_type: 'post',
        title: `${config.type} — ${todayISO()}`,
        body: postContent,
        media_urls: [],
        media_hints: '',
        content_pillar: 'community',
        hook: postContent.split('\n')[0] || '',
        cta: 'Apply now at cleya.ai',
        target_audience: 'founders',
        funnel_stage: 'awareness',
        scheduled_time: new Date().toISOString(),
        published_at: results.some(r => r.success) ? new Date().toISOString() : null,
        risk_score: 1,
        risk_factors: [],
        status: results.some(r => r.success) ? 'published' : 'draft',
        metadata: { autonomous: true, time_slot: timeSlot, theme, platforms: config.platforms },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    }));
    const summary = `Maven ${config.type}: posted to ${config.platforms.join(', ')} (${results.some(r => r.success) ? 'success' : 'failed'})`;
    console.log(`[AutonomousWorkflows] ${summary}`);
    return summary;
}
// ---------------------------------------------------------------------------
// 3. LEDGER — Daily Financial Monitor (10 AM IST) + Weekly Monday Review
// ---------------------------------------------------------------------------
async function runLedgerFinancialMonitor() {
    console.log('[AutonomousWorkflows] Running Ledger Daily Financial Monitor...');
    // Check Meta Ads campaign performance
    const metaCampaigns = await safeQuery('Meta Ads', () => adsService_1.adsService.getCampaigns('meta'));
    const linkedInCampaigns = await safeQuery('LinkedIn Ads', () => adsService_1.adsService.getCampaigns('linkedin'));
    // Check Razorpay (via environment — actual API integration)
    const razorpayConfigured = !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
    let razorpayData = null;
    if (razorpayConfigured) {
        razorpayData = await safeQuery('Razorpay', async () => {
            const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
            const res = await fetch('https://api.razorpay.com/v1/payments?count=20', {
                headers: { Authorization: `Basic ${auth}` },
            });
            if (!res.ok)
                throw new Error(`Razorpay API error: ${res.status}`);
            return res.json();
        });
    }
    // Identify campaigns needing action
    const campaignsToReview = [];
    if (metaCampaigns?.success && Array.isArray(metaCampaigns.data)) {
        for (const campaign of metaCampaigns.data) {
            const insights = campaign.insights?.data?.[0];
            if (insights) {
                const ctr = parseFloat(insights.ctr || '0');
                const cpc = parseFloat(insights.cpc || '0');
                const spend = parseFloat(insights.spend || '0');
                if (ctr < 0.5 && spend > 0) {
                    campaignsToReview.push({ ...campaign, action: 'PAUSE', reason: `CTR ${ctr}% < 0.5% threshold` });
                }
            }
        }
    }
    // Generate financial report via LLM
    const financePrompt = `You are Ledger, Cleya.ai's Finance Agent.
Today is ${todayIST()}.

Generate a Daily Financial Monitor Report based on:

## Meta Ads Campaigns
${metaCampaigns?.success ? JSON.stringify(metaCampaigns.data, null, 2) : 'Not configured or no data'}

## LinkedIn Ads Campaigns
${linkedInCampaigns?.success ? JSON.stringify(linkedInCampaigns.data, null, 2) : 'Not configured or no data'}

## Campaigns Flagged for Review
${campaignsToReview.length > 0 ? JSON.stringify(campaignsToReview, null, 2) : 'None flagged'}

## Razorpay Payments
${razorpayData ? JSON.stringify(razorpayData, null, 2) : 'Not configured'}

Provide:
1. Daily Ad Spend Summary (across all platforms)
2. Top Performing Campaigns (best CTR, lowest CPC)
3. Underperforming Campaigns (flag for pausing: CTR < 0.5%, CPL > Rs.3,000)
4. Scaling Opportunities (ROAS > 3x campaigns)
5. Razorpay Summary (new payments, refunds, failed transactions)
6. Actionable Recommendations

All amounts in INR. Keep it concise and data-driven.`;
    const reportContent = await llmGenerate('ledger', 'financial_report', financePrompt);
    // Save to financial_daily_reports
    await safeQuery('save financial report', () => (0, supabaseClient_1.supabaseUpsert)('financial_daily_reports', {
        report_date: todayISO(),
        report_type: 'daily',
        summary: reportContent.substring(0, 500),
        full_report: { content: reportContent, generated_at: new Date().toISOString() },
        ad_spend: {
            meta: metaCampaigns?.success ? metaCampaigns.data : null,
            linkedin: linkedInCampaigns?.success ? linkedInCampaigns.data : null,
        },
        campaign_performance: campaignsToReview,
        razorpay_summary: razorpayData,
        recommendations: [],
        created_at: new Date().toISOString(),
    }, 'report_date'));
    console.log(`[AutonomousWorkflows] Ledger Financial Monitor completed (${reportContent.length} chars)`);
    return reportContent;
}
async function runLedgerWeeklyReview() {
    console.log('[AutonomousWorkflows] Running Ledger Weekly Budget Review...');
    // Get past 7 days of financial reports
    const weeklyReports = await safeQuery('weekly reports', () => (0, supabaseClient_1.supabaseSelect)('financial_daily_reports', {}, { order: 'report_date.desc', limit: 7 })) || [];
    const weeklyPrompt = `You are Ledger, Cleya.ai's Finance Agent.
Today is ${todayIST()}.

Generate a Weekly Budget Review based on the past 7 days of financial data:

${JSON.stringify(weeklyReports.map(r => ({ date: r.report_date, summary: r.summary })), null, 2)}

Provide:
1. Weekly Ad Spend Total (all platforms)
2. Cost Per Acquisition trend
3. ROAS analysis
4. Budget vs Actuals comparison
5. Recommendations for next week's budget allocation
6. Key wins and areas of concern

All amounts in INR. Be specific with numbers.`;
    const weeklyContent = await llmGenerate('ledger', 'financial_analysis', weeklyPrompt);
    await safeQuery('save weekly review', () => (0, supabaseClient_1.supabaseInsert)('financial_daily_reports', {
        report_date: todayISO(),
        report_type: 'weekly',
        summary: weeklyContent.substring(0, 500),
        full_report: { content: weeklyContent, generated_at: new Date().toISOString(), type: 'weekly_review' },
        ad_spend: {},
        campaign_performance: {},
        razorpay_summary: null,
        recommendations: [],
        created_at: new Date().toISOString(),
    }));
    console.log(`[AutonomousWorkflows] Ledger Weekly Review completed (${weeklyContent.length} chars)`);
    return weeklyContent;
}
// ---------------------------------------------------------------------------
// 4. SENTINEL — System Health Monitor (Every 6 hours)
// ---------------------------------------------------------------------------
async function runSentinelHealthCheck() {
    console.log('[AutonomousWorkflows] Running Sentinel System Health Check...');
    const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.REPLIT_DEV_DOMAIN
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : 'https://cleya.ai';
    // Check API endpoints
    const endpoints = [
        { name: 'Homepage', url: `${BASE_URL}/` },
        { name: 'API Health', url: `${BASE_URL}/api/health` },
        { name: 'Control Tower', url: `${BASE_URL}/controltower` },
    ];
    const endpointResults = [];
    for (const ep of endpoints) {
        const start = Date.now();
        try {
            const res = await fetch(ep.url, { signal: AbortSignal.timeout(15000) });
            endpointResults.push({
                name: ep.name,
                url: ep.url,
                status: res.status,
                ok: res.ok,
                responseTime: Date.now() - start,
            });
        }
        catch (err) {
            endpointResults.push({
                name: ep.name,
                url: ep.url,
                status: 0,
                ok: false,
                responseTime: Date.now() - start,
                error: err.message,
            });
        }
    }
    // Query GA4 for traffic
    const ga4Metrics = await safeQuery('GA4', () => ga4Service_1.ga4Service.getMetrics('7d'));
    // Query PostHog for product usage
    const posthogMetrics = await safeQuery('PostHog', () => posthogService_1.posthogService.getMetrics('7d'));
    // Check Sentry for errors in last 6 hours
    const sentryMetrics = await safeQuery('Sentry', () => sentryService_1.sentryService.getMetrics('7d'));
    // Determine overall health
    const criticalIssues = [];
    for (const ep of endpointResults) {
        if (!ep.ok)
            criticalIssues.push(`${ep.name} is DOWN (status: ${ep.status})`);
        if (ep.responseTime > 5000)
            criticalIssues.push(`${ep.name} is SLOW (${ep.responseTime}ms)`);
    }
    if (sentryMetrics && sentryMetrics.unresolvedIssues > 10) {
        criticalIssues.push(`${sentryMetrics.unresolvedIssues} unresolved Sentry issues`);
    }
    const overallStatus = criticalIssues.length > 0 ? 'degraded' : 'healthy';
    // Generate health report via LLM
    const healthPrompt = `You are Sentinel, Cleya.ai's CTO Agent.
Today is ${todayIST()}.

Generate a System Health Report:

## Endpoint Status
${JSON.stringify(endpointResults, null, 2)}

## GA4 Traffic (7d)
${ga4Metrics ? JSON.stringify({ activeUsers: ga4Metrics.activeUsers, sessions: ga4Metrics.sessions, bounceRate: ga4Metrics.bounceRate }, null, 2) : 'Not available'}

## PostHog Usage (7d)
${posthogMetrics ? JSON.stringify({ uniqueUsers: posthogMetrics.uniqueUsers, totalEvents: posthogMetrics.totalEvents, avgSessionDuration: posthogMetrics.avgSessionDurationSeconds }, null, 2) : 'Not available'}

## Sentry Errors (7d)
${sentryMetrics ? JSON.stringify({ totalErrors: sentryMetrics.totalErrors, unresolvedIssues: sentryMetrics.unresolvedIssues, topIssues: sentryMetrics.topIssues?.slice(0, 5).map(i => ({ title: i.title, count: i.count, level: i.level })) }, null, 2) : 'Not available'}

## Critical Issues
${criticalIssues.length > 0 ? criticalIssues.join('\n') : 'None — all systems operational'}

Overall Status: ${overallStatus.toUpperCase()}

Provide:
1. System Health Summary (1-2 sentences)
2. Endpoint Performance Analysis
3. Traffic & Usage Anomalies
4. Error Analysis (new/critical Sentry issues)
5. Performance Recommendations
6. Action Items (if any critical issues)

Focus on actionable insights. Flag anything that needs immediate attention.`;
    const healthContent = await llmGenerate('sentinel', 'tech_report', healthPrompt);
    // Save to system_health_reports
    await safeQuery('save health report', () => (0, supabaseClient_1.supabaseInsert)('system_health_reports', {
        report_timestamp: new Date().toISOString(),
        summary: healthContent.substring(0, 500),
        full_report: { content: healthContent, generated_at: new Date().toISOString() },
        endpoints_status: endpointResults,
        ga4_metrics: ga4Metrics,
        posthog_metrics: posthogMetrics,
        sentry_metrics: sentryMetrics,
        response_times: endpointResults.map(ep => ({ name: ep.name, ms: ep.responseTime })),
        alerts: criticalIssues,
        overall_status: overallStatus,
        created_at: new Date().toISOString(),
    }));
    console.log(`[AutonomousWorkflows] Sentinel Health Check completed — status: ${overallStatus}`);
    return healthContent;
}
// ---------------------------------------------------------------------------
// 5. ALLY — Member Engagement Automation (Every 2 hours during business hours)
// ---------------------------------------------------------------------------
async function runAllyEngagementCheck() {
    console.log('[AutonomousWorkflows] Running Ally Member Engagement Check...');
    // Check for new member applications
    const pendingApplications = await safeQuery('pending applications', () => (0, supabaseClient_1.supabaseSelect)('profiles', { status: 'pending' }, { order: 'created_at.desc', limit: 20 }));
    // Check for recently approved members (last 24h)
    const recentApprovals = await safeQuery('recent approvals', () => (0, supabaseClient_1.supabaseSelect)('profiles', { status: 'approved' }, { order: 'updated_at.desc', limit: 10 }));
    // Identify inactive members (no login in 7+ days) — query from profiles or auth
    const inactiveMembers = await safeQuery('inactive members', async () => {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        return (0, supabaseClient_1.supabaseSelect)('profiles', {}, {
            order: 'last_sign_in_at.asc',
            limit: 20,
        });
    });
    // Check for open support tickets
    const openTickets = await safeQuery('open tickets', () => (0, supabaseClient_1.supabaseSelect)('tickets', { status: 'open' }, { order: 'created_at.desc', limit: 10 }));
    const isFriday = new Date().getDay() === 5;
    // Generate engagement report via LLM
    const engagementPrompt = `You are Ally, Cleya.ai's Support Agent.
Today is ${todayIST()}.

Generate a Member Engagement Report:

## Pending Applications
${pendingApplications ? `${pendingApplications.length} pending applications` : 'Unable to query'}

## Recently Approved Members
${recentApprovals ? `${recentApprovals.length} recently approved` : 'Unable to query'}

## Potentially Inactive Members
${inactiveMembers ? `${inactiveMembers.length} members returned (check last login dates)` : 'Unable to query'}

## Open Support Tickets
${openTickets ? JSON.stringify(openTickets.map(t => ({ subject: t.subject, priority: t.priority, status: t.status })), null, 2) : 'No open tickets or unable to query'}

${isFriday ? 'Today is Friday — also include a Weekly Member Satisfaction Summary.' : ''}

Provide:
1. Applications Summary (how many pending, recommended actions)
2. Welcome Messages (draft 1-2 personalized welcome messages for newly approved members)
3. Re-engagement Ideas (for inactive members — personalized nudges, feature highlights)
4. Support Ticket Status (any urgent tickets needing attention)
${isFriday ? '5. Weekly Satisfaction Summary (trends, NPS estimate, recommendations)' : ''}

Keep messages warm, personal, and aligned with Cleya.ai's founders community brand.`;
    const engagementContent = await llmGenerate('ally', 'support_reply', engagementPrompt);
    // Save to member_engagement_reports
    await safeQuery('save engagement report', () => (0, supabaseClient_1.supabaseInsert)('member_engagement_reports', {
        report_date: todayISO(),
        report_type: isFriday ? 'weekly' : 'daily',
        summary: engagementContent.substring(0, 500),
        full_report: { content: engagementContent, generated_at: new Date().toISOString() },
        new_applications: pendingApplications?.length || 0,
        approved_members: recentApprovals?.length || 0,
        inactive_members: inactiveMembers?.length || 0,
        welcome_messages_drafted: recentApprovals?.length ? Math.min(recentApprovals.length, 2) : 0,
        reengagement_messages_drafted: inactiveMembers?.length ? Math.min(inactiveMembers.length, 3) : 0,
        created_at: new Date().toISOString(),
    }));
    console.log(`[AutonomousWorkflows] Ally Engagement Check completed (${engagementContent.length} chars)`);
    return engagementContent;
}
// ---------------------------------------------------------------------------
// 6. CATALYST — Growth Automation (Daily 11 AM IST) + Weekly Wednesday
// ---------------------------------------------------------------------------
async function runCatalystGrowthAnalysis() {
    console.log('[AutonomousWorkflows] Running Catalyst Growth Analysis...');
    // Analyze funnel metrics from GA4 + PostHog
    const ga4Metrics = await safeQuery('GA4', () => ga4Service_1.ga4Service.getMetrics('7d'));
    const posthogMetrics = await safeQuery('PostHog', () => posthogService_1.posthogService.getMetrics('7d'));
    // Get recent ad performance
    const metaCampaigns = await safeQuery('Meta Ads', () => adsService_1.adsService.getCampaigns('meta'));
    // Get recent Maven content performance
    const recentPosts = await safeQuery('recent posts', () => (0, supabaseClient_1.supabaseSelect)('content_posts_log', {}, { order: 'created_at.desc', limit: 10 }));
    // Get active experiments
    const experiments = await safeQuery('experiments', () => (0, supabaseClient_1.supabaseSelect)('experiments', { status: 'active' }, { order: 'created_at.desc', limit: 10 }));
    const growthPrompt = `You are Catalyst, Cleya.ai's Growth Agent.
Today is ${todayIST()}.

Generate a Daily Growth Analysis:

## GA4 Funnel Data (7d)
${ga4Metrics ? JSON.stringify({
        visitors: ga4Metrics.activeUsers,
        sessions: ga4Metrics.sessions,
        pageviews: ga4Metrics.pageviews,
        bounceRate: ga4Metrics.bounceRate,
        topPages: ga4Metrics.topPages?.slice(0, 5),
        trafficSources: ga4Metrics.trafficSources?.slice(0, 5),
    }, null, 2) : 'Not available'}

## PostHog Product Usage (7d)
${posthogMetrics ? JSON.stringify({
        uniqueUsers: posthogMetrics.uniqueUsers,
        totalEvents: posthogMetrics.totalEvents,
        retention: posthogMetrics.retention?.slice(0, 5),
        featureUsage: posthogMetrics.featureUsage?.slice(0, 5),
    }, null, 2) : 'Not available'}

## Ad Campaign Performance
${metaCampaigns?.success ? JSON.stringify(metaCampaigns.data, null, 2) : 'Not available'}

## Recent Content Posts
${recentPosts ? JSON.stringify(recentPosts.map(p => ({ date: p.post_date, type: p.post_type, status: p.status })), null, 2) : 'No recent posts'}

## Active Experiments
${experiments ? JSON.stringify(experiments, null, 2) : 'No active experiments'}

Cleya.ai is a members-only platform — growth is about quality signups, not just traffic.
Current network: 49+ cities, 31+ industries, 1 Lakh+ connections.

Provide:
1. Funnel Analysis (visitors → signups → applications → approved members)
2. Conversion Rates at each stage (estimate from available data)
3. Drop-off Points (where are we losing people?)
4. Top 3 Growth Experiment Ideas (A/B tests, new channels, referral programs)
5. Content Performance (which Maven posts are driving traffic?)
6. Channel Performance Ranking

Think India-first distribution. Network density > raw user count.`;
    const growthContent = await llmGenerate('catalyst', 'growth_experiment', growthPrompt);
    // Save to growth_reports
    await safeQuery('save growth report', () => (0, supabaseClient_1.supabaseInsert)('growth_reports', {
        report_date: todayISO(),
        report_type: 'daily',
        summary: growthContent.substring(0, 500),
        full_report: { content: growthContent, generated_at: new Date().toISOString() },
        funnel_metrics: {
            ga4: ga4Metrics ? { visitors: ga4Metrics.activeUsers, sessions: ga4Metrics.sessions } : null,
            posthog: posthogMetrics ? { uniqueUsers: posthogMetrics.uniqueUsers } : null,
        },
        conversion_rates: {},
        drop_off_analysis: {},
        experiment_ideas: [],
        recommendations: [],
        created_at: new Date().toISOString(),
    }));
    console.log(`[AutonomousWorkflows] Catalyst Growth Analysis completed (${growthContent.length} chars)`);
    return growthContent;
}
async function runCatalystWeeklyReview() {
    console.log('[AutonomousWorkflows] Running Catalyst Weekly Growth Review...');
    // Get past 7 days of growth reports
    const weeklyReports = await safeQuery('weekly reports', () => (0, supabaseClient_1.supabaseSelect)('growth_reports', {}, { order: 'report_date.desc', limit: 7 })) || [];
    const weeklyPrompt = `You are Catalyst, Cleya.ai's Growth Agent.
Today is ${todayIST()}.

Generate a Weekly Growth Review based on the past 7 days:

${JSON.stringify(weeklyReports.map(r => ({ date: r.report_date, summary: r.summary })), null, 2)}

Provide:
1. Week-over-Week Growth Metrics
2. Channel Performance Comparison (organic, paid, referral, social)
3. Experiment Results (what worked, what didn't)
4. Top Recommendations for Scaling Winners
5. Recommendations for Killing Losers
6. Next Week's Growth Priorities

Be specific with numbers and recommendations. Think network effects.`;
    const weeklyContent = await llmGenerate('catalyst', 'growth_experiment', weeklyPrompt);
    await safeQuery('save weekly review', () => (0, supabaseClient_1.supabaseInsert)('growth_reports', {
        report_date: todayISO(),
        report_type: 'weekly',
        summary: weeklyContent.substring(0, 500),
        full_report: { content: weeklyContent, generated_at: new Date().toISOString(), type: 'weekly_review' },
        funnel_metrics: {},
        conversion_rates: {},
        drop_off_analysis: {},
        experiment_ideas: [],
        recommendations: [],
        created_at: new Date().toISOString(),
    }));
    console.log(`[AutonomousWorkflows] Catalyst Weekly Review completed (${weeklyContent.length} chars)`);
    return weeklyContent;
}
// ---------------------------------------------------------------------------
// 7. CLOSER — Sales Pipeline Automation (Daily 9:30 AM IST)
// ---------------------------------------------------------------------------
async function runCloserSalesPipeline() {
    console.log('[AutonomousWorkflows] Running Closer Sales Pipeline Analysis...');
    // Get pipeline data from outreach_crm
    const pipelineData = await safeQuery('pipeline', () => (0, supabaseClient_1.supabaseSelect)('outreach_crm', {}, { order: 'score.desc', limit: 50 })) || [];
    // Get membership applications (potential leads)
    const applications = await safeQuery('applications', () => (0, supabaseClient_1.supabaseSelect)('profiles', { status: 'pending' }, { order: 'created_at.desc', limit: 20 }));
    // Get Razorpay revenue data
    const razorpayConfigured = !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
    let revenueData = null;
    if (razorpayConfigured) {
        revenueData = await safeQuery('Razorpay', async () => {
            const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
            const res = await fetch('https://api.razorpay.com/v1/payments?count=50', {
                headers: { Authorization: `Basic ${auth}` },
            });
            if (!res.ok)
                throw new Error(`Razorpay API error: ${res.status}`);
            return res.json();
        });
    }
    const isFriday = new Date().getDay() === 5;
    const salesPrompt = `You are Closer, Cleya.ai's Sales Agent.
Today is ${todayIST()}.

Generate a Daily Sales Pipeline Report:

## CRM Pipeline (Top 50 leads by score)
${pipelineData.length > 0 ? JSON.stringify(pipelineData.map(l => ({
        name: l.contact_name,
        company: l.company,
        role: l.role,
        stage: l.stage,
        score: l.score,
        last_contacted: l.last_contacted_at,
        next_followup: l.next_follow_up,
    })), null, 2) : 'No leads in CRM'}

## Pending Applications
${applications ? `${applications.length} pending membership applications` : 'Unable to query'}

## Revenue Data (Razorpay)
${revenueData ? JSON.stringify(revenueData, null, 2) : 'Not configured'}

Cleya.ai targets:
- Founders with funding history
- Active angel investors
- Operators at funded startups
- Accelerator partners (100X.VC, Antler, YC India alumni)

Provide:
1. Pipeline Summary (by stage: prospect, contacted, interested, negotiation, closed)
2. High-Value Lead Identification (from applications — founders with funding, active investors)
3. Personalized Outreach Drafts (2-3 for top leads)
4. Conversion Metrics (free → paid membership)
${isFriday ? '5. Weekly Sales Report (revenue, conversions, pipeline velocity)' : '5. Today\'s Follow-up Actions'}
6. Revenue Metrics via Razorpay

Outreach should use the 4-step sequence: Day 1 email → Day 3 LinkedIn → Day 5 follow-up → Day 8 final.
Keep messages concise, value-focused. Aim for >15% reply rate.`;
    const salesContent = await llmGenerate('closer', 'sales_outreach', salesPrompt);
    // Save to sales_pipeline_reports
    await safeQuery('save sales report', () => (0, supabaseClient_1.supabaseInsert)('sales_pipeline_reports', {
        report_date: todayISO(),
        report_type: isFriday ? 'weekly' : 'daily',
        summary: salesContent.substring(0, 500),
        full_report: { content: salesContent, generated_at: new Date().toISOString() },
        pipeline_status: {
            total_leads: pipelineData.length,
            by_stage: pipelineData.reduce((acc, l) => {
                acc[l.stage || 'unknown'] = (acc[l.stage || 'unknown'] || 0) + 1;
                return acc;
            }, {}),
        },
        high_value_leads: pipelineData.filter(l => (l.score || 0) >= 7).slice(0, 10),
        outreach_drafted: 3,
        conversion_metrics: {},
        revenue_metrics: revenueData,
        created_at: new Date().toISOString(),
    }));
    console.log(`[AutonomousWorkflows] Closer Sales Pipeline completed (${salesContent.length} chars)`);
    return salesContent;
}
// ---------------------------------------------------------------------------
// 8. AD CAMPAIGN AUTOMATION — Autonomous Ad Management (Every 6 hours)
// ---------------------------------------------------------------------------
async function runAdCampaignAutomation() {
    console.log('[AutonomousWorkflows] Running Ad Campaign Automation...');
    // 1. Monitor & optimize all active campaigns
    const optimizationResult = await safeQuery('ad optimization', () => adCampaignAutomation_1.adCampaignAutomation.monitorAndOptimize());
    // 2. Generate cross-platform campaign report
    const reportResult = await safeQuery('campaign report', () => adCampaignAutomation_1.adCampaignAutomation.generateCampaignReport());
    // 3. Check if it's time to launch fresh campaigns (weekly — Mondays)
    const isMonday = new Date().getDay() === 1;
    let newCampaignResult = null;
    if (isMonday) {
        // Get Catalyst's latest growth recommendations to inform new campaigns
        const growthReports = await safeQuery('growth reports', () => (0, supabaseClient_1.supabaseSelect)('growth_reports', {}, { order: 'report_date.desc', limit: 1 }));
        const growthContext = growthReports?.[0]?.summary || '';
        const strategyPrompt = `You are Ledger, Cleya.ai's Finance Agent working with Catalyst's growth insights.

Latest growth analysis: ${growthContext}

Based on this data, what should be the primary advertising objective this week?
Choose ONE from: BRAND_AWARENESS, LEAD_GENERATION, CONVERSIONS, TRAFFIC
Reply with just the objective word.`;
        const objectiveRaw = await llmGenerate('ledger', 'financial_report', strategyPrompt);
        const objective = ['BRAND_AWARENESS', 'LEAD_GENERATION', 'CONVERSIONS', 'TRAFFIC'].find(o => objectiveRaw.toUpperCase().includes(o)) || 'LEAD_GENERATION';
        const strategy = await safeQuery('generate strategy', () => adCampaignAutomation_1.adCampaignAutomation.generateCampaignStrategy(objective, 30000, ['meta', 'linkedin', 'google']));
        if (strategy) {
            newCampaignResult = await safeQuery('launch campaigns', () => adCampaignAutomation_1.adCampaignAutomation.launchCampaign(strategy));
        }
    }
    // 4. Build combined report
    const summaryParts = [];
    if (optimizationResult) {
        summaryParts.push(`Optimization: ${optimizationResult.summary}`);
        if (optimizationResult.actions.length > 0) {
            for (const action of optimizationResult.actions) {
                summaryParts.push(`  - ${action.action.toUpperCase()} ${action.platform}/${action.campaignName || action.campaignId}: ${action.reason}`);
            }
        }
    }
    else {
        summaryParts.push('Optimization: skipped (error)');
    }
    if (reportResult) {
        summaryParts.push(`Report: generated (${reportResult.report.length} chars)`);
    }
    if (newCampaignResult) {
        const successCount = newCampaignResult.results?.filter((r) => r.success).length || 0;
        const totalCount = newCampaignResult.results?.length || 0;
        summaryParts.push(`New campaigns: ${successCount}/${totalCount} launched successfully`);
    }
    const combinedSummary = summaryParts.join('\n');
    // 5. Save to financial_daily_reports
    await safeQuery('save automation report', () => (0, supabaseClient_1.supabaseInsert)('financial_daily_reports', {
        report_date: todayISO(),
        report_type: 'ad_automation',
        summary: combinedSummary.substring(0, 500),
        full_report: {
            content: combinedSummary,
            optimization: optimizationResult,
            campaignReport: reportResult?.report?.substring(0, 2000),
            newCampaigns: newCampaignResult,
            generated_at: new Date().toISOString(),
        },
        ad_spend: reportResult?.platformData || {},
        campaign_performance: optimizationResult?.actions || [],
        razorpay_summary: null,
        recommendations: [],
        created_at: new Date().toISOString(),
    }));
    console.log(`[AutonomousWorkflows] Ad Campaign Automation completed (${combinedSummary.length} chars)`);
    return combinedSummary;
}
//# sourceMappingURL=autonomousWorkflows.js.map