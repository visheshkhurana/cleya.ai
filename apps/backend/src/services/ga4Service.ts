import { env } from '../config/env';

const GA4_PROPERTY_ID = env.GA4_PROPERTY_ID;
const GA4_SERVICE_ACCOUNT_KEY = env.GA4_SERVICE_ACCOUNT_KEY;

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

function isConfigured(): boolean {
  return !!(GA4_PROPERTY_ID && GA4_SERVICE_ACCOUNT_KEY);
}

async function getMetrics(dateRange: '7d' | '30d' | '90d' = '30d'): Promise<GA4Metrics | null> {
  if (!isConfigured()) return null;

  try {
    let credentials: ServiceAccountCredentials | undefined;
    let keyFile: string | undefined;

    try {
      const parsed: unknown = JSON.parse(GA4_SERVICE_ACCOUNT_KEY!);
      if (typeof parsed === 'object' && parsed !== null) {
        credentials = parsed as ServiceAccountCredentials;
      }
    } catch {
      keyFile = GA4_SERVICE_ACCOUNT_KEY!;
    }

    const { google } = await import('googleapis');

    const auth = new google.auth.GoogleAuth({
      credentials,
      keyFile,
      scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    });

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
      console.error('GA4 authentication failed — check that GA4_SERVICE_ACCOUNT_KEY is valid JSON and the service account has access to property', GA4_PROPERTY_ID, ':', message);
    } else {
      console.error('GA4 fetch error:', message);
    }
    throw error;
  }
}

export const ga4Service = { isConfigured, getMetrics };
export type { GA4Metrics };
