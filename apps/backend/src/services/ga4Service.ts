import { env } from '../config/env';
import { getAnalyticsSummary, getTopPages, getTrafficSources } from './analyticsService';

const GA4_PROPERTY_ID = env.GA4_PROPERTY_ID;
const GA4_SERVICE_ACCOUNT_KEY = env.GA4_SERVICE_ACCOUNT_KEY;
const GOOGLE_ANALYTICS_REFRESH_TOKEN = env.GOOGLE_ANALYTICS_REFRESH_TOKEN;
const GOOGLE_CLIENT_ID = env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET;

const OAUTH_CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '';
const OAUTH_CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '';
const OAUTH_REFRESH_TOKEN = process.env.GOOGLE_ANALYTICS_REFRESH_TOKEN || '';

interface GA4Metrics {
  pageviews: number;
  sessions: number;
  activeUsers: number;
  bounceRate: number;
  topPages: { page: string; views: number }[];
  trafficSources: { source: string; sessions: number }[];
  geoBreakdown: { country: string; users: number }[];
  dailyTrend: { date: string; pageviews: number; sessions: number; users: number }[];
}

interface ServiceAccountCredentials {
  type?: string;
  project_id?: string;
  private_key_id?: string;
  private_key?: string;
  client_email?: string;
  client_id?: string;
  [key: string]: unknown;
}

function isServiceAccountConfigured(): boolean {
  return !!(GA4_PROPERTY_ID && GA4_SERVICE_ACCOUNT_KEY);
}

function isOAuthConfigured(): boolean {
  return !!(OAUTH_CLIENT_ID && OAUTH_CLIENT_SECRET && OAUTH_REFRESH_TOKEN);
}

function isConfigured(): boolean {
  return isServiceAccountConfigured() || isOAuthConfigured();
}

function getAuthMethod(): 'oauth' | 'service_account' | 'none' {
  if (OAUTH_REFRESH_TOKEN || GOOGLE_ANALYTICS_REFRESH_TOKEN) return 'oauth';
  if (GA4_SERVICE_ACCOUNT_KEY) return 'service_account';
  return 'none';
}

async function getMetricsViaOAuth(dateRange: '7d' | '30d' | '90d' = '30d'): Promise<GA4Metrics | null> {
  const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
  const startDate = `${days}daysAgo`;
  const endDate = 'today';

  try {
    const [summary, topPagesData, trafficData] = await Promise.all([
      getAnalyticsSummary(),
      getTopPages(startDate, endDate, 10),
      getTrafficSources(startDate, endDate),
    ]);

    const s = summary as any;
    const overview = s.overview || {};

    return {
      pageviews: overview.pageViews || 0,
      sessions: overview.sessions || 0,
      activeUsers: overview.totalUsers || 0,
      bounceRate: Math.round((overview.bounceRate || 0) * 100) / 100,
      topPages: (topPagesData || []).map((p: any) => ({
        page: p.pagePath || '',
        views: p.pageViews || 0,
      })),
      trafficSources: (trafficData || []).map((t: any) => ({
        source: t.source || '(direct)',
        sessions: t.sessions || 0,
      })),
      geoBreakdown: [],
      dailyTrend: [],
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('GA4 OAuth fetch error:', message);
    throw error;
  }
}

async function getMetrics(dateRange: '7d' | '30d' | '90d' = '30d'): Promise<GA4Metrics | null> {
  if (isServiceAccountConfigured()) {
    return getMetricsViaServiceAccount(dateRange);
  }
  if (isOAuthConfigured()) {
    return getMetricsViaOAuth(dateRange);
  }
  return null;
}

async function getMetricsViaServiceAccount(dateRange: '7d' | '30d' | '90d' = '30d'): Promise<GA4Metrics | null> {
  try {
    const { google } = await import('googleapis');

    let auth;
    if (GOOGLE_ANALYTICS_REFRESH_TOKEN && GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
      const oauth2Client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
      oauth2Client.setCredentials({ refresh_token: GOOGLE_ANALYTICS_REFRESH_TOKEN });
      auth = oauth2Client;
    } else if (GA4_SERVICE_ACCOUNT_KEY) {
      let credentials: ServiceAccountCredentials | undefined;
      let keyFile: string | undefined;

      try {
        const parsed: unknown = JSON.parse(GA4_SERVICE_ACCOUNT_KEY);
        if (typeof parsed === 'object' && parsed !== null) {
          credentials = parsed as ServiceAccountCredentials;
        }
      } catch {
        keyFile = GA4_SERVICE_ACCOUNT_KEY;
      }

      auth = new google.auth.GoogleAuth({
        credentials,
        keyFile,
        scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
      });
    } else {
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('invalid_grant') || message.includes('Invalid JWT') || message.includes('PERMISSION_DENIED')) {
      const method = getAuthMethod();
      console.error(`GA4 authentication failed (method: ${method}) — check credentials for property`, GA4_PROPERTY_ID, ':', message);
    } else {
      console.error('GA4 fetch error:', message);
    }
    throw error;
  }
}

export const ga4Service = { isConfigured, getAuthMethod, getMetrics };
export type { GA4Metrics };
