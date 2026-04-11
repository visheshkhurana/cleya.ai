"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sentryService = void 0;
const env_1 = require("../config/env");
const SENTRY_AUTH_TOKEN = env_1.env.SENTRY_AUTH_TOKEN;
const SENTRY_ORG = env_1.env.SENTRY_ORG;
const SENTRY_PROJECT = env_1.env.SENTRY_PROJECT;
const SENTRY_API_BASE = 'https://sentry.io/api/0';
function isConfigured() {
    return !!(SENTRY_AUTH_TOKEN && SENTRY_ORG && SENTRY_PROJECT);
}
async function sentryFetchRaw(path) {
    const url = `${SENTRY_API_BASE}${path}`;
    const res = await fetch(url, {
        headers: {
            Authorization: `Bearer ${SENTRY_AUTH_TOKEN}`,
            'Content-Type': 'application/json',
        },
    });
    if (!res.ok) {
        const err = await res.text();
        if (res.status === 401 || res.status === 403) {
            throw new Error(`Sentry authentication failed (${res.status}). Check SENTRY_AUTH_TOKEN permissions.`);
        }
        throw new Error(`Sentry API error: ${res.status} - ${err}`);
    }
    const data = await res.json();
    return { data, headers: res.headers };
}
async function sentryFetch(path) {
    const result = await sentryFetchRaw(path);
    return result.data;
}
async function getMetrics(dateRange = '30d') {
    if (!isConfigured())
        return null;
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
    const since = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000);
    let topIssues = [];
    let totalErrors = 0;
    let unresolvedIssues = 0;
    let issuesLoaded = false;
    try {
        const issuesResponse = await sentryFetchRaw(`/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/issues/?query=is:unresolved&sort=freq&limit=10&statsPeriod=${days}d`);
        topIssues = (issuesResponse.data || []).map((issue) => ({
            id: issue.id,
            title: issue.title,
            shortId: issue.shortId,
            count: parseInt(issue.count) || 0,
            userCount: issue.userCount || 0,
            level: issue.level,
            lastSeen: issue.lastSeen,
            permalink: issue.permalink,
        }));
        const xTotalCount = issuesResponse.headers.get('X-Total-Count');
        unresolvedIssues = xTotalCount ? parseInt(xTotalCount) : topIssues.length;
        totalErrors = topIssues.reduce((sum, i) => sum + i.count, 0);
        issuesLoaded = true;
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('Sentry issues fetch error:', message);
        if (message.includes('authentication failed')) {
            throw err;
        }
    }
    let errorTrend = [];
    let statsLoaded = false;
    try {
        const statsData = await sentryFetch(`/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/stats/?stat=received&resolution=1d&since=${since}`);
        if (Array.isArray(statsData)) {
            errorTrend = statsData.map((point) => ({
                date: new Date(point[0] * 1000).toISOString().split('T')[0],
                count: point[1] || 0,
            }));
            const statsTotalErrors = statsData.reduce((sum, point) => sum + (point[1] || 0), 0);
            if (statsTotalErrors > totalErrors) {
                totalErrors = statsTotalErrors;
            }
            statsLoaded = true;
        }
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('Sentry stats fetch error:', message);
    }
    let transactionStats = null;
    try {
        const txnData = await sentryFetch(`/organizations/${SENTRY_ORG}/events/?field=count()&field=avg(transaction.duration)&field=p95(transaction.duration)&project=${SENTRY_PROJECT}&statsPeriod=${days}d&query=event.type:transaction`);
        if (txnData?.data?.[0]) {
            const row = txnData.data[0];
            transactionStats = {
                totalTransactions: row['count()'] || 0,
                avgDuration: Math.round(row['avg(transaction.duration)'] || 0),
                p95Duration: Math.round(row['p95(transaction.duration)'] || 0),
            };
        }
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('Sentry transactions fetch error:', message);
    }
    if (!issuesLoaded && !statsLoaded) {
        throw new Error('Failed to fetch any Sentry data. Check SENTRY_AUTH_TOKEN, SENTRY_ORG, and SENTRY_PROJECT.');
    }
    return {
        totalErrors,
        unresolvedIssues,
        topIssues,
        errorTrend,
        transactionStats,
    };
}
exports.sentryService = { isConfigured, getMetrics };
//# sourceMappingURL=sentryService.js.map