"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.posthogService = void 0;
const env_1 = require("../config/env");
const POSTHOG_API_KEY = env_1.env.POSTHOG_API_KEY;
const POSTHOG_HOST = env_1.env.POSTHOG_HOST || 'https://app.posthog.com';
const POSTHOG_PROJECT_ID = env_1.env.POSTHOG_PROJECT_ID;
function isConfigured() {
    return !!POSTHOG_API_KEY;
}
function projectPath() {
    const id = POSTHOG_PROJECT_ID || '@current';
    return `/api/projects/${id}`;
}
function isAuthError(err) {
    const msg = err instanceof Error ? err.message : String(err);
    return msg.includes('401') || msg.includes('403') || msg.includes('authentication');
}
async function phFetch(path, body) {
    const url = `${POSTHOG_HOST}${path}`;
    const headers = {
        Authorization: `Bearer ${POSTHOG_API_KEY}`,
        'Content-Type': 'application/json',
    };
    const res = await fetch(url, {
        method: body ? 'POST' : 'GET',
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
        const err = await res.text();
        if (res.status === 401 || res.status === 403) {
            throw new Error(`PostHog authentication failed (${res.status}). Check POSTHOG_API_KEY.`);
        }
        throw new Error(`PostHog API error: ${res.status} - ${err}`);
    }
    return res.json();
}
function sumSeries(data) {
    if (!Array.isArray(data))
        return 0;
    return data.reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0);
}
async function getMetrics(dateRange = '30d') {
    if (!isConfigured())
        return null;
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
    const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const base = projectPath();
    let totalEvents = 0;
    let uniqueUsers = 0;
    let avgEventsPerUser = 0;
    let dailyEventVolume = [];
    let topEvents = [];
    let avgSessionDurationSeconds = 0;
    let retention = [];
    let featureUsage = [];
    let coreLoaded = false;
    try {
        const totalData = await phFetch(`${base}/insights/trend/`, {
            events: [{ id: '$pageview', name: '$pageview', type: 'events', math: 'total' }],
            date_from: dateFrom,
            interval: 'day',
        });
        const resultArr = totalData.result;
        if (resultArr?.[0]) {
            const result = resultArr[0];
            totalEvents = sumSeries(result.data);
            dailyEventVolume = (result.labels || []).map((label, i) => ({
                date: label,
                count: result.data?.[i] || 0,
            }));
        }
        coreLoaded = true;
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('PostHog total events fetch error:', message);
        if (isAuthError(err))
            throw err;
    }
    try {
        const uniqueData = await phFetch(`${base}/insights/trend/`, {
            events: [{ id: '$pageview', name: '$pageview', type: 'events', math: 'dau' }],
            date_from: dateFrom,
            interval: 'day',
        });
        const resultArr = uniqueData.result;
        if (resultArr?.[0]) {
            const vals = resultArr[0].data || [];
            uniqueUsers = Math.max(...vals, 0);
        }
        coreLoaded = true;
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('PostHog unique users fetch error:', message);
        if (isAuthError(err))
            throw err;
    }
    if (uniqueUsers > 0 && totalEvents > 0) {
        avgEventsPerUser = Math.round((totalEvents / uniqueUsers) * 100) / 100;
    }
    try {
        const eventBreakdown = await phFetch(`${base}/insights/trend/`, {
            events: [
                { id: '$pageview', name: '$pageview', type: 'events', math: 'total' },
                { id: '$autocapture', name: '$autocapture', type: 'events', math: 'total' },
                { id: '$pageleave', name: '$pageleave', type: 'events', math: 'total' },
                { id: 'signed_up', name: 'signed_up', type: 'events', math: 'total' },
                { id: 'login', name: 'login', type: 'events', math: 'total' },
            ],
            date_from: dateFrom,
        });
        const resultArr = eventBreakdown.result;
        if (resultArr) {
            topEvents = resultArr
                .map((r) => ({
                event: r.label || 'unknown',
                count: sumSeries(r.data),
            }))
                .filter((e) => e.count > 0)
                .sort((a, b) => b.count - a.count);
        }
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('PostHog top events fetch error:', message);
        if (isAuthError(err))
            throw err;
    }
    try {
        const sessionData = await phFetch(`${base}/insights/trend/`, {
            events: [{ id: '$session', name: '$session', type: 'events', math: 'median', math_property: '$session_duration' }],
            date_from: dateFrom,
        });
        const resultArr = sessionData.result;
        if (resultArr?.[0]) {
            const vals = resultArr[0].data || [];
            const nonZero = vals.filter((v) => v > 0);
            avgSessionDurationSeconds = nonZero.length > 0
                ? Math.round(nonZero.reduce((s, v) => s + v, 0) / nonZero.length)
                : 0;
        }
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('PostHog session duration fetch error:', message);
        if (isAuthError(err))
            throw err;
    }
    try {
        const retentionData = await phFetch(`${base}/insights/retention/`, {
            target_entity: { id: '$pageview', type: 'events' },
            returning_entity: { id: '$pageview', type: 'events' },
            date_from: dateFrom,
            period: 'Day',
            retention_type: 'retention_first_time',
            total_intervals: Math.min(days, 11),
        });
        const resultArr = retentionData.result;
        if (resultArr && resultArr.length > 0) {
            const firstCohort = resultArr[0];
            const baseSize = firstCohort?.values?.[0]?.count || 0;
            if (baseSize > 0) {
                retention = (firstCohort.values || []).map((v, i) => ({
                    day: i,
                    percentage: Math.round((v.count / baseSize) * 100),
                }));
            }
        }
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('PostHog retention fetch error:', message);
        if (isAuthError(err))
            throw err;
    }
    try {
        const featureData = await phFetch(`${base}/insights/trend/`, {
            events: [
                { id: 'feature_interaction', name: 'feature_interaction', type: 'events', math: 'total' },
                { id: '$screen', name: '$screen', type: 'events', math: 'total' },
                { id: 'button_click', name: 'button_click', type: 'events', math: 'total' },
                { id: 'form_submit', name: 'form_submit', type: 'events', math: 'total' },
            ],
            date_from: dateFrom,
        });
        const resultArr = featureData.result;
        if (resultArr) {
            featureUsage = resultArr
                .map((r) => ({
                feature: r.label || 'unknown',
                count: sumSeries(r.data),
            }))
                .filter((e) => e.count > 0)
                .sort((a, b) => b.count - a.count);
        }
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('PostHog feature usage fetch error:', message);
        if (isAuthError(err))
            throw err;
    }
    if (!coreLoaded) {
        throw new Error('Failed to fetch any PostHog data. Check POSTHOG_API_KEY and POSTHOG_HOST.');
    }
    return {
        uniqueUsers,
        totalEvents,
        topEvents,
        avgEventsPerUser,
        dailyEventVolume,
        avgSessionDurationSeconds,
        retention,
        featureUsage,
    };
}
exports.posthogService = { isConfigured, getMetrics };
//# sourceMappingURL=posthogService.js.map