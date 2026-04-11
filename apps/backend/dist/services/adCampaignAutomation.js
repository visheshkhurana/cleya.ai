"use strict";
/**
 * Ad Campaign Automation — autonomous multi-platform campaign management brain.
 *
 * Handles:
 *  - Campaign strategy generation
 *  - Multi-platform launch orchestration
 *  - Performance monitoring & auto-optimization (pause losers, scale winners, refresh creatives)
 *  - AI-generated ad copy per platform
 *  - Cross-platform reporting
 *
 * SAFETY:
 *  - ₹10,000/day per-campaign cap, ₹50,000 total daily cap
 *  - Campaigns start PAUSED for 1 hour before auto-activation
 *  - All changes logged to ad_audit_log
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.adCampaignAutomation = exports.CLEYA_AUDIENCES = void 0;
exports.generateCampaignStrategy = generateCampaignStrategy;
exports.launchCampaign = launchCampaign;
exports.monitorAndOptimize = monitorAndOptimize;
exports.generateAdCopy = generateAdCopy;
exports.generateCampaignReport = generateCampaignReport;
const ai_1 = require("@cleya/ai");
const supabaseClient_1 = require("./supabaseClient");
const modelRouter_1 = require("./modelRouter");
const adsService_1 = require("./adsService");
// ---------------------------------------------------------------------------
// Shared AI helper (mirrors autonomousWorkflows pattern)
// ---------------------------------------------------------------------------
let _ai = null;
function getAI() {
    if (!_ai) {
        if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY && !process.env.GOOGLE_AI_API_KEY)
            return null;
        _ai = (0, ai_1.createAIService)({ provider: 'openai', model: 'gpt-4o-mini' });
    }
    return _ai;
}
async function llmGenerate(taskType, prompt) {
    const ai = getAI();
    if (!ai)
        return '[LLM unavailable — no API key configured]';
    const routing = (0, modelRouter_1.routeModel)({ agentId: 'ledger', taskType });
    try {
        const result = await ai.chat([{ role: 'user', content: prompt }], { model: routing.primaryModel });
        return result.content;
    }
    catch (primaryErr) {
        try {
            const result = await ai.chat([{ role: 'user', content: prompt }], { model: routing.fallbackModel });
            return result.content;
        }
        catch {
            return `[LLM generation failed: ${primaryErr.message}]`;
        }
    }
}
async function safeQuery(label, fn) {
    try {
        return await fn();
    }
    catch (err) {
        console.warn(`[AdCampaignAutomation] ${label} failed: ${err.message}`);
        return null;
    }
}
function todayISO() {
    return new Date().toISOString().split('T')[0];
}
// ---------------------------------------------------------------------------
// Cleya-specific audience presets
// ---------------------------------------------------------------------------
exports.CLEYA_AUDIENCES = {
    founders: {
        interests: ['Entrepreneurship', 'Startups', 'Venture capital'],
        titles: ['Founder', 'Co-Founder', 'CEO'],
        geo: 'India',
        age_min: 25,
        age_max: 55,
    },
    investors: {
        interests: ['Angel investing', 'Venture capital', 'Private equity'],
        titles: ['Investor', 'VC', 'Angel Investor'],
        geo: 'India',
        age_min: 30,
        age_max: 60,
    },
    operators: {
        interests: ['Technology', 'Product management', 'Growth hacking'],
        titles: ['CTO', 'VP Engineering', 'Product Manager'],
        geo: 'India',
        age_min: 25,
        age_max: 50,
    },
};
const DEFAULT_GOOGLE_KEYWORDS = [
    'AI networking India',
    'founder community India',
    'startup networking platform',
    'connect with investors India',
    'founder investor matching',
    'startup community platform',
    'angel investor network India',
    'VC connect India',
    'professional networking founders',
    'startup ecosystem India',
];
async function generateCampaignStrategy(objective, totalBudget, platforms) {
    const perPlatformBudget = Math.floor(totalBudget / platforms.length);
    const budgetPerCampaign = Math.min(perPlatformBudget, adsService_1.adsService.BUDGET_CAP_INR);
    const audienceSegments = Object.keys(exports.CLEYA_AUDIENCES);
    const campaigns = platforms.flatMap(platform => audienceSegments.map(audience => ({
        platform,
        name: `Cleya ${objective} — ${audience} — ${platform} — ${todayISO()}`,
        budget: Math.min(Math.floor(budgetPerCampaign / audienceSegments.length), adsService_1.adsService.BUDGET_CAP_INR),
        audience,
        objective,
        adVariations: 3,
    })));
    const strategy = {
        objective,
        totalBudget,
        platforms,
        audienceSegments,
        campaigns,
        schedule: {
            launchDate: todayISO(),
            reviewDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
            endDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
        },
        kpis: {
            targetCTR: '>0.5%',
            targetCPC: '<₹100',
            targetROAS: '>2x',
            targetConversions: '10+/day',
        },
    };
    // Save strategy
    await safeQuery('save strategy', () => (0, supabaseClient_1.supabaseInsert)('ad_campaign_strategies', {
        strategy_date: todayISO(),
        objective,
        total_budget: totalBudget,
        platforms: platforms.join(','),
        strategy: strategy,
        status: 'draft',
        created_at: new Date().toISOString(),
    }));
    return strategy;
}
// ---------------------------------------------------------------------------
// 2. launchCampaign
// ---------------------------------------------------------------------------
async function launchCampaign(strategy) {
    const results = [];
    for (const config of strategy.campaigns) {
        const audience = exports.CLEYA_AUDIENCES[config.audience];
        if (!audience) {
            results.push({ platform: config.platform, campaignName: config.name, success: false, error: `Unknown audience: ${config.audience}` });
            continue;
        }
        // Create the campaign (always PAUSED)
        const campaignResult = await adsService_1.adsService.createCampaign({
            platform: config.platform,
            name: config.name,
            budget: config.budget,
            targeting: {
                geo_locations: { countries: ['IN'] },
                age_min: audience.age_min,
                age_max: audience.age_max,
                interests: audience.interests,
            },
            objective: config.objective,
        });
        if (!campaignResult.success) {
            results.push({ platform: config.platform, campaignName: config.name, success: false, error: campaignResult.error });
            continue;
        }
        // Platform-specific ad set / ad group / creative setup
        if (config.platform === 'meta' && campaignResult.data?.id) {
            const adSetResult = await adsService_1.adsService.createMetaAdSet({
                campaignId: campaignResult.data.id,
                name: `AdSet: ${config.audience}`,
                dailyBudget: config.budget,
                targeting: {
                    geo_locations: { countries: ['IN'] },
                    age_min: audience.age_min,
                    age_max: audience.age_max,
                },
            });
            if (adSetResult.success) {
                // Generate ad copy variations
                for (let i = 1; i <= config.adVariations; i++) {
                    const copy = await generateAdCopy('Cleya.ai — members-only AI networking', config.audience, config.platform);
                    await adsService_1.adsService.createMetaAd({
                        adSetId: adSetResult.data.id,
                        name: `Ad V${i}: ${config.audience}`,
                        pageId: process.env.META_PAGE_ID || '',
                        creative: {
                            title: copy.headline,
                            body: copy.body,
                            linkUrl: 'https://cleya.ai',
                            callToAction: 'SIGN_UP',
                        },
                    });
                }
            }
        }
        if (config.platform === 'google' && campaignResult.data?.resourceName) {
            const adGroupResult = await adsService_1.adsService.createGoogleAdGroup({
                campaignResourceName: campaignResult.data.resourceName,
                name: `AdGroup: ${config.audience}`,
                keywords: DEFAULT_GOOGLE_KEYWORDS,
            });
            if (adGroupResult.success && adGroupResult.data?.adGroupResourceName) {
                for (let i = 1; i <= config.adVariations; i++) {
                    const copy = await generateAdCopy('Cleya.ai — members-only AI networking', config.audience, config.platform);
                    await adsService_1.adsService.createGoogleAd({
                        adGroupResourceName: adGroupResult.data.adGroupResourceName,
                        headlines: [copy.headline, ...copy.variations.map(v => v.headline)],
                        descriptions: [copy.body, ...copy.variations.map(v => v.body)],
                        finalUrl: 'https://cleya.ai',
                    });
                }
            }
        }
        if (config.platform === 'linkedin' && campaignResult.data?.campaignId) {
            for (let i = 1; i <= config.adVariations; i++) {
                const copy = await generateAdCopy('Cleya.ai — members-only AI networking', config.audience, config.platform);
                await adsService_1.adsService.createLinkedInAdCreative({
                    campaignId: campaignResult.data.campaignId,
                    commentary: copy.body,
                    title: copy.headline,
                    contentUrl: 'https://cleya.ai',
                });
            }
        }
        results.push({ platform: config.platform, campaignName: config.name, success: true, data: campaignResult.data });
    }
    return { success: results.some(r => r.success), results };
}
async function monitorAndOptimize() {
    console.log('[AdCampaignAutomation] Running monitorAndOptimize...');
    const actions = [];
    // --- Meta campaigns ---
    const metaCampaigns = await safeQuery('Meta campaigns', () => adsService_1.adsService.getCampaigns('meta'));
    if (metaCampaigns?.success && Array.isArray(metaCampaigns.data)) {
        for (const campaign of metaCampaigns.data) {
            if (campaign.status !== 'ACTIVE')
                continue;
            const insights = campaign.insights?.data?.[0];
            if (!insights)
                continue;
            const ctr = parseFloat(insights.ctr || '0');
            const spend = parseFloat(insights.spend || '0');
            const cpc = parseFloat(insights.cpc || '0');
            const impressions = parseInt(insights.impressions || '0', 10);
            // Rule: Pause if CTR < 0.3% after 48hrs and spend > ₹500
            const createdTime = campaign.created_time ? new Date(campaign.created_time).getTime() : 0;
            const hoursActive = (Date.now() - createdTime) / (1000 * 60 * 60);
            if (ctr < 0.3 && hoursActive > 48 && spend > 500) {
                await adsService_1.adsService.pauseCampaign('meta', campaign.id);
                actions.push({
                    platform: 'meta', campaignId: campaign.id, campaignName: campaign.name,
                    action: 'pause', reason: `CTR ${ctr.toFixed(2)}% < 0.3% after ${Math.round(hoursActive)}h, spend ₹${spend}`,
                    details: { ctr, spend, hoursActive },
                });
                continue;
            }
            // Rule: Increase budget by 20% if ROAS > 3x (estimated from conversions)
            const conversions = insights.actions?.find((a) => a.action_type === 'offsite_conversion')?.value || 0;
            const roas = spend > 0 && conversions > 0 ? (conversions * 500) / spend : 0; // assume ₹500 per conversion value
            if (roas > 3 && impressions > 1000) {
                const currentBudget = (campaign.daily_budget || 0) / 100;
                const newBudget = Math.round(currentBudget * 1.2);
                await adsService_1.adsService.updateBudget('meta', campaign.id, newBudget);
                actions.push({
                    platform: 'meta', campaignId: campaign.id, campaignName: campaign.name,
                    action: 'scale_up', reason: `ROAS ~${roas.toFixed(1)}x > 3x — budget ₹${currentBudget} → ₹${newBudget}`,
                    details: { roas, currentBudget, newBudget },
                });
            }
            // Rule: Decrease budget by 30% if CPC > ₹150
            if (cpc > 150 && impressions > 500) {
                const currentBudget = (campaign.daily_budget || 0) / 100;
                const newBudget = Math.round(currentBudget * 0.7);
                await adsService_1.adsService.updateBudget('meta', campaign.id, newBudget);
                actions.push({
                    platform: 'meta', campaignId: campaign.id, campaignName: campaign.name,
                    action: 'scale_down', reason: `CPC ₹${cpc.toFixed(0)} > ₹150 — budget ₹${currentBudget} → ₹${newBudget}`,
                    details: { cpc, currentBudget, newBudget },
                });
            }
            // Rule: Refresh creative if running > 7 days
            if (hoursActive > 168) {
                actions.push({
                    platform: 'meta', campaignId: campaign.id, campaignName: campaign.name,
                    action: 'refresh_creative', reason: `Campaign running ${Math.round(hoursActive / 24)} days — creative fatigue risk`,
                    details: { hoursActive },
                });
            }
        }
    }
    // --- Google campaigns ---
    const googleCampaigns = await safeQuery('Google campaigns', () => adsService_1.adsService.getGoogleCampaignPerformance());
    if (googleCampaigns?.success && Array.isArray(googleCampaigns.data)) {
        for (const campaign of googleCampaigns.data) {
            if (campaign.status !== 'ENABLED')
                continue;
            const ctr = parseFloat(campaign.ctr || '0');
            const costINR = parseInt(campaign.costMicros || '0', 10) / 1_000_000;
            const clicks = parseInt(campaign.clicks || '0', 10);
            const cpc = clicks > 0 ? costINR / clicks : 0;
            if (ctr < 0.003 && costINR > 500) {
                const resourceName = `customers/${(process.env.GOOGLE_ADS_CUSTOMER_ID || '').replace(/-/g, '')}/campaigns/${campaign.id}`;
                await adsService_1.adsService.pauseCampaign('google', resourceName);
                actions.push({
                    platform: 'google', campaignId: campaign.id, campaignName: campaign.name,
                    action: 'pause', reason: `CTR ${(ctr * 100).toFixed(2)}% < 0.3%, spend ₹${costINR.toFixed(0)}`,
                    details: { ctr, costINR },
                });
            }
            if (cpc > 150) {
                actions.push({
                    platform: 'google', campaignId: campaign.id, campaignName: campaign.name,
                    action: 'scale_down', reason: `CPC ₹${cpc.toFixed(0)} > ₹150`,
                    details: { cpc },
                });
            }
        }
    }
    // --- LinkedIn campaigns ---
    const linkedInCampaigns = await safeQuery('LinkedIn campaigns', () => adsService_1.adsService.getCampaigns('linkedin'));
    if (linkedInCampaigns?.success && Array.isArray(linkedInCampaigns.data)) {
        const activeCampaignIds = linkedInCampaigns.data
            .filter((c) => c.status === 'ACTIVE')
            .map((c) => String(c.id || c.campaignId));
        if (activeCampaignIds.length > 0) {
            const analytics = await safeQuery('LinkedIn analytics', () => adsService_1.adsService.getLinkedInCampaignAnalytics(activeCampaignIds));
            if (analytics?.success && Array.isArray(analytics.data)) {
                for (const entry of analytics.data) {
                    const impressions = entry.impressions || 0;
                    const clicks = entry.clicks || 0;
                    const cost = parseFloat(entry.costInLocalCurrency || '0');
                    const ctr = impressions > 0 ? clicks / impressions : 0;
                    const cpc = clicks > 0 ? cost / clicks : 0;
                    if (ctr < 0.003 && cost > 500) {
                        actions.push({
                            platform: 'linkedin', campaignId: entry.pivotValue || '', campaignName: '',
                            action: 'pause', reason: `CTR ${(ctr * 100).toFixed(2)}% < 0.3%, spend ₹${cost.toFixed(0)}`,
                            details: { ctr, cost },
                        });
                    }
                    if (cpc > 150) {
                        actions.push({
                            platform: 'linkedin', campaignId: entry.pivotValue || '', campaignName: '',
                            action: 'scale_down', reason: `CPC ₹${cpc.toFixed(0)} > ₹150`,
                            details: { cpc },
                        });
                    }
                }
            }
        }
    }
    // --- A/B test: pause losing ad variations after 72 hours ---
    // Query ad_audit_log for creatives created per campaign to find multi-variation ad sets
    const recentCreatives = await safeQuery('ab test creatives', () => (0, supabaseClient_1.supabaseSelect)('ad_audit_log', { action_type: 'ad_created' }, { order: 'created_at.desc', limit: 100 }));
    if (recentCreatives && recentCreatives.length > 0) {
        // Group creatives by campaign (via adSetId in details)
        const adSetGroups = {};
        for (const log of recentCreatives) {
            const adSetId = log.details?.adSetId || log.details?.adGroupResourceName || '';
            if (!adSetId)
                continue;
            if (!adSetGroups[adSetId])
                adSetGroups[adSetId] = [];
            adSetGroups[adSetId].push({
                adId: log.campaign_id || log.details?.adId || '',
                createdAt: log.created_at,
                campaignId: log.details?.campaignId || '',
            });
        }
        // For ad sets with 2+ variations that are older than 72 hours, run A/B analysis
        const AB_TEST_HOURS = 72;
        for (const [adSetId, ads] of Object.entries(adSetGroups)) {
            if (ads.length < 2)
                continue;
            const oldestCreated = new Date(ads[0].createdAt).getTime();
            const hoursRunning = (Date.now() - oldestCreated) / (1000 * 60 * 60);
            if (hoursRunning < AB_TEST_HOURS)
                continue;
            // Fetch per-ad insights from Meta (primary A/B testing platform)
            const adInsights = [];
            for (const ad of ads) {
                if (!ad.adId)
                    continue;
                const insights = await safeQuery(`ad insights ${ad.adId}`, async () => {
                    const res = await fetch(`https://graph.facebook.com/v19.0/${ad.adId}/insights?fields=ctr,cpc,spend,impressions&date_preset=last_7d&access_token=${process.env.META_ADS_ACCESS_TOKEN || ''}`);
                    const data = await res.json();
                    return data?.data?.[0] || null;
                });
                if (insights) {
                    adInsights.push({
                        adId: ad.adId,
                        ctr: parseFloat(insights.ctr || '0'),
                        cpc: parseFloat(insights.cpc || '999'),
                        spend: parseFloat(insights.spend || '0'),
                        impressions: parseInt(insights.impressions || '0', 10),
                    });
                }
            }
            // Need at least 2 ads with data to compare
            if (adInsights.length < 2)
                continue;
            // Find the winner (highest CTR) and pause the rest
            const sorted = adInsights.sort((a, b) => b.ctr - a.ctr);
            const winner = sorted[0];
            const losers = sorted.slice(1);
            for (const loser of losers) {
                if (loser.impressions < 100)
                    continue; // not enough data yet
                // Pause the losing ad
                await safeQuery(`pause loser ad ${loser.adId}`, async () => {
                    await fetch(`https://graph.facebook.com/v19.0/${loser.adId}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            access_token: process.env.META_ADS_ACCESS_TOKEN || '',
                            status: 'PAUSED',
                        }),
                    });
                });
                actions.push({
                    platform: 'meta',
                    campaignId: loser.adId,
                    campaignName: `Ad in set ${adSetId}`,
                    action: 'ab_test_pause',
                    reason: `A/B test loser: CTR ${loser.ctr.toFixed(2)}% vs winner ${winner.ctr.toFixed(2)}% after ${Math.round(hoursRunning)}h`,
                    details: { loserCtr: loser.ctr, winnerCtr: winner.ctr, loserAdId: loser.adId, winnerAdId: winner.adId, hoursRunning },
                });
            }
        }
    }
    // Generate summary
    const summary = actions.length === 0
        ? 'No optimization actions needed — all campaigns within thresholds.'
        : `Took ${actions.length} optimization actions: ${actions.map(a => `${a.action}(${a.platform}/${a.campaignId})`).join(', ')}`;
    console.log(`[AdCampaignAutomation] monitorAndOptimize complete: ${summary}`);
    return { actions, summary };
}
// ---------------------------------------------------------------------------
// 4. generateAdCopy
// ---------------------------------------------------------------------------
async function generateAdCopy(product, audience, platform) {
    const audienceInfo = exports.CLEYA_AUDIENCES[audience] || exports.CLEYA_AUDIENCES.founders;
    const platformGuide = {
        meta: 'Facebook/Instagram: casual, visual, emoji-friendly. Headline ≤40 chars, body 80-125 chars. Use social proof.',
        linkedin: 'LinkedIn: professional, data-driven. Headline ≤70 chars, body 100-200 chars. Focus on career value.',
        google: 'Google Ads: concise, keyword-rich. Headline ≤30 chars each (provide 5+), description ≤90 chars each (provide 3+). Include CTA.',
    };
    const prompt = `Generate ad copy for ${product}.

Target audience: ${audience} — ${audienceInfo.titles.join(', ')} in ${audienceInfo.geo}, ages ${audienceInfo.age_min}-${audienceInfo.age_max}.
Interests: ${audienceInfo.interests.join(', ')}.

Platform: ${platform}
${platformGuide[platform]}

Cleya.ai context: members-only AI networking platform, 49+ Indian cities, 1 Lakh+ connections, 31+ industries. For founders, investors, operators.

Return JSON only (no markdown):
{
  "headline": "...",
  "body": "...",
  "callToAction": "...",
  "variations": [
    { "headline": "...", "body": "..." },
    { "headline": "...", "body": "..." }
  ]
}`;
    const raw = await llmGenerate('social_caption', prompt);
    try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
                headline: parsed.headline || 'Join India\'s Top Founders on Cleya',
                body: parsed.body || 'Connect with founders, investors & operators across 49+ cities. Apply now at cleya.ai',
                callToAction: parsed.callToAction || 'Sign Up',
                variations: parsed.variations || [],
            };
        }
    }
    catch {
        // Fallback
    }
    return {
        headline: 'Join India\'s Top Founders on Cleya',
        body: 'Connect with founders, investors & operators across 49+ cities. AI-matched networking for India\'s startup ecosystem. Apply now.',
        callToAction: 'Sign Up',
        variations: [
            { headline: 'AI Networking for Indian Startups', body: '1 Lakh+ connections made. Join the community trusted by India\'s best founders.' },
            { headline: 'Your Next Co-Founder is on Cleya', body: 'Members-only platform connecting founders, investors & operators. Apply at cleya.ai' },
        ],
    };
}
// ---------------------------------------------------------------------------
// 5. generateCampaignReport
// ---------------------------------------------------------------------------
async function generateCampaignReport(dateRange) {
    const metaData = await safeQuery('Meta', () => adsService_1.adsService.getCampaigns('meta'));
    const googleData = await safeQuery('Google', () => adsService_1.adsService.getGoogleCampaignPerformance(dateRange));
    const linkedInData = await safeQuery('LinkedIn', () => adsService_1.adsService.getCampaigns('linkedin'));
    const platformData = {
        meta: metaData?.success ? metaData.data : 'Not available',
        google: googleData?.success ? googleData.data : 'Not available',
        linkedin: linkedInData?.success ? linkedInData.data : 'Not available',
    };
    const prompt = `You are Ledger, Cleya.ai's Finance Agent. Generate a Cross-Platform Ad Campaign Report.

Date range: ${dateRange?.start || 'last 7 days'} to ${dateRange?.end || 'today'}

## Meta Ads
${JSON.stringify(platformData.meta, null, 2)}

## Google Ads
${JSON.stringify(platformData.google, null, 2)}

## LinkedIn Ads
${JSON.stringify(platformData.linkedin, null, 2)}

Provide:
1. Executive Summary (spend, impressions, clicks across all platforms)
2. Platform-by-Platform Breakdown (top campaigns, CTR, CPC, ROAS)
3. Best Performing Campaign (why it won)
4. Worst Performing Campaign (what to fix)
5. Budget Allocation Recommendation (shift $ between platforms)
6. A/B Test Results (if multiple ad variations)
7. Next Actions (specific, actionable)

All amounts in INR. Be data-driven and specific.`;
    const report = await llmGenerate('financial_report', prompt);
    // Save report
    await safeQuery('save report', () => (0, supabaseClient_1.supabaseUpsert)('financial_daily_reports', {
        report_date: todayISO(),
        report_type: 'ad_campaign_report',
        summary: report.substring(0, 500),
        full_report: { content: report, generated_at: new Date().toISOString(), type: 'cross_platform_ad_report' },
        ad_spend: platformData,
        campaign_performance: {},
        razorpay_summary: null,
        recommendations: [],
        created_at: new Date().toISOString(),
    }, 'report_date'));
    return { success: true, report, platformData };
}
// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
exports.adCampaignAutomation = {
    generateCampaignStrategy,
    launchCampaign,
    monitorAndOptimize,
    generateAdCopy,
    generateCampaignReport,
    CLEYA_AUDIENCES: exports.CLEYA_AUDIENCES,
};
//# sourceMappingURL=adCampaignAutomation.js.map