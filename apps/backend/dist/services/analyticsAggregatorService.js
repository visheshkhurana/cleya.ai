"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsAggregatorService = void 0;
const ga4Service_1 = require("./ga4Service");
const instagramService_1 = require("./instagramService");
const posthogService_1 = require("./posthogService");
const sentryService_1 = require("./sentryService");
const CACHE_TTL = 5 * 60 * 1000;
const cache = {
    ga4: new Map(),
    instagram: new Map(),
    posthog: new Map(),
    sentry: new Map(),
};
function getCached(store, key) {
    const entry = store.get(key);
    if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
        return entry.data;
    }
    if (entry)
        store.delete(key);
    return undefined;
}
function setCache(store, key, data) {
    store.set(key, { data, timestamp: Date.now() });
}
async function getGA4(dateRange = '30d') {
    if (!ga4Service_1.ga4Service.isConfigured()) {
        return { configured: false, data: null };
    }
    const cached = getCached(cache.ga4, dateRange);
    if (cached !== undefined)
        return { configured: true, data: cached };
    try {
        const data = await ga4Service_1.ga4Service.getMetrics(dateRange);
        setCache(cache.ga4, dateRange, data);
        return { configured: true, data };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('GA4 aggregator error:', message);
        return { configured: true, data: null, error: message };
    }
}
async function getInstagram(dateRange = '30d') {
    if (!instagramService_1.instagramService.isConfigured()) {
        return { configured: false, data: null };
    }
    const cached = getCached(cache.instagram, dateRange);
    if (cached !== undefined)
        return { configured: true, data: cached };
    try {
        const data = await instagramService_1.instagramService.getMetrics(dateRange);
        setCache(cache.instagram, dateRange, data);
        return { configured: true, data };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Instagram aggregator error:', message);
        return { configured: true, data: null, error: message };
    }
}
async function getPostHog(dateRange = '30d') {
    if (!posthogService_1.posthogService.isConfigured()) {
        return { configured: false, data: null };
    }
    const cached = getCached(cache.posthog, dateRange);
    if (cached !== undefined)
        return { configured: true, data: cached };
    try {
        const data = await posthogService_1.posthogService.getMetrics(dateRange);
        setCache(cache.posthog, dateRange, data);
        return { configured: true, data };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('PostHog aggregator error:', message);
        return { configured: true, data: null, error: message };
    }
}
async function getSentry(dateRange = '30d') {
    if (!sentryService_1.sentryService.isConfigured()) {
        return { configured: false, data: null };
    }
    const cached = getCached(cache.sentry, dateRange);
    if (cached !== undefined)
        return { configured: true, data: cached };
    try {
        const data = await sentryService_1.sentryService.getMetrics(dateRange);
        setCache(cache.sentry, dateRange, data);
        return { configured: true, data };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Sentry aggregator error:', message);
        return { configured: true, data: null, error: message };
    }
}
async function getOverview(dateRange = '30d') {
    const [ga4, instagram, posthog, sentry] = await Promise.all([
        getGA4(dateRange),
        getInstagram(dateRange),
        getPostHog(dateRange),
        getSentry(dateRange),
    ]);
    return {
        ga4: {
            configured: ga4.configured,
            hasData: !!ga4.data,
            summary: ga4.data ? {
                pageviews: ga4.data.pageviews,
                sessions: ga4.data.sessions,
                activeUsers: ga4.data.activeUsers,
                bounceRate: ga4.data.bounceRate,
            } : null,
        },
        instagram: {
            configured: instagram.configured,
            hasData: !!instagram.data,
            summary: instagram.data ? {
                followers: instagram.data.accountInfo.followersCount,
                followerGrowth: instagram.data.followerGrowth,
                reach: instagram.data.postReach,
                engagementRate: instagram.data.engagementRate,
            } : null,
        },
        posthog: {
            configured: posthog.configured,
            hasData: !!posthog.data,
            summary: posthog.data ? {
                uniqueUsers: posthog.data.uniqueUsers,
                totalEvents: posthog.data.totalEvents,
                avgSessionDurationSeconds: posthog.data.avgSessionDurationSeconds,
            } : null,
        },
        sentry: {
            configured: sentry.configured,
            hasData: !!sentry.data,
            summary: sentry.data ? {
                totalErrors: sentry.data.totalErrors,
                unresolvedIssues: sentry.data.unresolvedIssues,
            } : null,
        },
    };
}
exports.analyticsAggregatorService = {
    getGA4,
    getInstagram,
    getPostHog,
    getSentry,
    getOverview,
};
//# sourceMappingURL=analyticsAggregatorService.js.map