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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ga4Service = void 0;
const env_1 = require("../config/env");
const analyticsService_1 = require("./analyticsService");
const GA4_PROPERTY_ID = env_1.env.GA4_PROPERTY_ID;
const GA4_SERVICE_ACCOUNT_KEY = env_1.env.GA4_SERVICE_ACCOUNT_KEY;
const GOOGLE_ANALYTICS_REFRESH_TOKEN = env_1.env.GOOGLE_ANALYTICS_REFRESH_TOKEN;
const GOOGLE_CLIENT_ID = env_1.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = env_1.env.GOOGLE_CLIENT_SECRET;
const OAUTH_CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '';
const OAUTH_CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '';
const OAUTH_REFRESH_TOKEN = process.env.GOOGLE_ANALYTICS_REFRESH_TOKEN || '';
function isServiceAccountConfigured() {
    return !!(GA4_PROPERTY_ID && GA4_SERVICE_ACCOUNT_KEY);
}
function isOAuthConfigured() {
    return !!(OAUTH_CLIENT_ID && OAUTH_CLIENT_SECRET && OAUTH_REFRESH_TOKEN);
}
function isConfigured() {
    return isServiceAccountConfigured() || isOAuthConfigured();
}
function getAuthMethod() {
    if (OAUTH_REFRESH_TOKEN || GOOGLE_ANALYTICS_REFRESH_TOKEN)
        return 'oauth';
    if (GA4_SERVICE_ACCOUNT_KEY)
        return 'service_account';
    return 'none';
}
async function getMetricsViaOAuth(dateRange = '30d') {
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
    const startDate = `${days}daysAgo`;
    const endDate = 'today';
    try {
        const [summary, topPagesData, trafficData] = await Promise.all([
            (0, analyticsService_1.getAnalyticsSummary)(),
            (0, analyticsService_1.getTopPages)(startDate, endDate, 10),
            (0, analyticsService_1.getTrafficSources)(startDate, endDate),
        ]);
        const s = summary;
        const overview = s.overview || {};
        return {
            pageviews: overview.pageViews || 0,
            sessions: overview.sessions || 0,
            activeUsers: overview.totalUsers || 0,
            bounceRate: Math.round((overview.bounceRate || 0) * 100) / 100,
            topPages: (topPagesData || []).map((p) => ({
                page: p.pagePath || '',
                views: p.pageViews || 0,
            })),
            trafficSources: (trafficData || []).map((t) => ({
                source: t.source || '(direct)',
                sessions: t.sessions || 0,
            })),
            geoBreakdown: [],
            dailyTrend: [],
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('GA4 OAuth fetch error:', message);
        throw error;
    }
}
async function getMetrics(dateRange = '30d') {
    if (isServiceAccountConfigured()) {
        return getMetricsViaServiceAccount(dateRange);
    }
    if (isOAuthConfigured()) {
        return getMetricsViaOAuth(dateRange);
    }
    return null;
}
async function getMetricsViaServiceAccount(dateRange = '30d') {
    try {
        const { google } = await Promise.resolve().then(() => __importStar(require('googleapis')));
        let auth;
        if (GOOGLE_ANALYTICS_REFRESH_TOKEN && GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
            const oauth2Client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
            oauth2Client.setCredentials({ refresh_token: GOOGLE_ANALYTICS_REFRESH_TOKEN });
            auth = oauth2Client;
        }
        else if (GA4_SERVICE_ACCOUNT_KEY) {
            let credentials;
            let keyFile;
            try {
                const parsed = JSON.parse(GA4_SERVICE_ACCOUNT_KEY);
                if (typeof parsed === 'object' && parsed !== null) {
                    credentials = parsed;
                }
            }
            catch {
                keyFile = GA4_SERVICE_ACCOUNT_KEY;
            }
            auth = new google.auth.GoogleAuth({
                credentials,
                keyFile,
                scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
            });
        }
        else {
            return null;
        }
        const analyticsData = google.analyticsdata({ version: 'v1beta', auth });
        const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
        const startDate = `${days}daysAgo`;
        const [overviewRes, pagesRes, sourcesRes, geoRes, trendRes] = await Promise.all([
            analyticsData.properties.runReport({
                property: `properties/${GA4_PROPERTY_ID}`,
                requestBody: {
                    dateRanges: [{ startDate, endDate: 'today' }],
                    metrics: [
                        { name: 'screenPageViews' },
                        { name: 'sessions' },
                        { name: 'activeUsers' },
                        { name: 'bounceRate' },
                    ],
                },
            }),
            analyticsData.properties.runReport({
                property: `properties/${GA4_PROPERTY_ID}`,
                requestBody: {
                    dateRanges: [{ startDate, endDate: 'today' }],
                    dimensions: [{ name: 'pagePath' }],
                    metrics: [{ name: 'screenPageViews' }],
                    orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
                    limit: '10',
                },
            }),
            analyticsData.properties.runReport({
                property: `properties/${GA4_PROPERTY_ID}`,
                requestBody: {
                    dateRanges: [{ startDate, endDate: 'today' }],
                    dimensions: [{ name: 'sessionSource' }],
                    metrics: [{ name: 'sessions' }],
                    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
                    limit: '10',
                },
            }),
            analyticsData.properties.runReport({
                property: `properties/${GA4_PROPERTY_ID}`,
                requestBody: {
                    dateRanges: [{ startDate, endDate: 'today' }],
                    dimensions: [{ name: 'country' }],
                    metrics: [{ name: 'activeUsers' }],
                    orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
                    limit: '10',
                },
            }),
            analyticsData.properties.runReport({
                property: `properties/${GA4_PROPERTY_ID}`,
                requestBody: {
                    dateRanges: [{ startDate, endDate: 'today' }],
                    dimensions: [{ name: 'date' }],
                    metrics: [
                        { name: 'screenPageViews' },
                        { name: 'sessions' },
                        { name: 'activeUsers' },
                    ],
                    orderBys: [{ dimension: { dimensionName: 'date' } }],
                },
            }),
        ]);
        const overviewRow = overviewRes.data.rows?.[0];
        const pageviews = parseInt(overviewRow?.metricValues?.[0]?.value || '0');
        const sessions = parseInt(overviewRow?.metricValues?.[1]?.value || '0');
        const activeUsers = parseInt(overviewRow?.metricValues?.[2]?.value || '0');
        const bounceRate = parseFloat(overviewRow?.metricValues?.[3]?.value || '0');
        const topPages = (pagesRes.data.rows || []).map((r) => ({
            page: r.dimensionValues?.[0]?.value || '',
            views: parseInt(r.metricValues?.[0]?.value || '0'),
        }));
        const trafficSources = (sourcesRes.data.rows || []).map((r) => ({
            source: r.dimensionValues?.[0]?.value || '(direct)',
            sessions: parseInt(r.metricValues?.[0]?.value || '0'),
        }));
        const geoBreakdown = (geoRes.data.rows || []).map((r) => ({
            country: r.dimensionValues?.[0]?.value || '',
            users: parseInt(r.metricValues?.[0]?.value || '0'),
        }));
        const dailyTrend = (trendRes.data.rows || []).map((r) => {
            const raw = r.dimensionValues?.[0]?.value || '';
            const date = raw.length === 8 ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}` : raw;
            return {
                date,
                pageviews: parseInt(r.metricValues?.[0]?.value || '0'),
                sessions: parseInt(r.metricValues?.[1]?.value || '0'),
                users: parseInt(r.metricValues?.[2]?.value || '0'),
            };
        });
        return { pageviews, sessions, activeUsers, bounceRate: Math.round(bounceRate * 100) / 100, topPages, trafficSources, geoBreakdown, dailyTrend };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('invalid_grant') || message.includes('Invalid JWT') || message.includes('PERMISSION_DENIED')) {
            const method = getAuthMethod();
            console.error(`GA4 authentication failed (method: ${method}) — check credentials for property`, GA4_PROPERTY_ID, ':', message);
        }
        else {
            console.error('GA4 fetch error:', message);
        }
        throw error;
    }
}
exports.ga4Service = { isConfigured, getAuthMethod, getMetrics };
//# sourceMappingURL=ga4Service.js.map