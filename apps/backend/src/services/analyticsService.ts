/**
 * Google Analytics Data API v1 — OAuth2-based access.
 *
 * Uses the same Google OAuth client credentials as Google Ads
 * (GOOGLE_ADS_CLIENT_ID / GOOGLE_ADS_CLIENT_SECRET) with a dedicated
 * refresh token (GOOGLE_ANALYTICS_REFRESH_TOKEN) that carries the
 * analytics.readonly scope.
 *
 * Scope: https://www.googleapis.com/auth/analytics.readonly
 */

const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID || '530514964';
const CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '';
const REFRESH_TOKEN = process.env.GOOGLE_ANALYTICS_REFRESH_TOKEN || '';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GA4_BASE = 'https://analyticsdata.googleapis.com/v1beta';

// --- Token cache ---
let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;

function isConfigured(): boolean {
  return !!(CLIENT_ID && CLIENT_SECRET && REFRESH_TOKEN);
}

async function getAccessToken(): Promise<string> {
  if (cachedAccessToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedAccessToken;
  }

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to refresh GA4 access token: ${res.status} ${body}`);
  }

  const data: any = await res.json();
  cachedAccessToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in ?? 3600) * 1000;
  return cachedAccessToken!;
}

async function ga4Fetch(path: string, body?: object): Promise<any> {
  const token = await getAccessToken();
  const url = `${GA4_BASE}/properties/${GA4_PROPERTY_ID}:${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GA4 API ${path} failed: ${res.status} ${text}`);
  }
  return res.json();
}

// --- Public API ---

export async function getPageViews(startDate: string, endDate: string) {
  const data = await ga4Fetch('runReport', {
    dateRanges: [{ startDate, endDate }],
    metrics: [
      { name: 'screenPageViews' },
      { name: 'sessions' },
    ],
  });

  const row = data.rows?.[0];
  return {
    pageViews: parseInt(row?.metricValues?.[0]?.value || '0'),
    sessions: parseInt(row?.metricValues?.[1]?.value || '0'),
  };
}

export async function getTopPages(startDate: string, endDate: string, limit = 10) {
  const data = await ga4Fetch('runReport', {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'pagePath' }],
    metrics: [
      { name: 'screenPageViews' },
      { name: 'sessions' },
    ],
    orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
    limit,
  });

  return (data.rows || []).map((r: any) => ({
    pagePath: r.dimensionValues?.[0]?.value || '',
    pageViews: parseInt(r.metricValues?.[0]?.value || '0'),
    sessions: parseInt(r.metricValues?.[1]?.value || '0'),
  }));
}

export async function getTrafficSources(startDate: string, endDate: string) {
  const data = await ga4Fetch('runReport', {
    dateRanges: [{ startDate, endDate }],
    dimensions: [
      { name: 'sessionSource' },
      { name: 'sessionMedium' },
    ],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
    ],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 20,
  });

  return (data.rows || []).map((r: any) => ({
    source: r.dimensionValues?.[0]?.value || '(direct)',
    medium: r.dimensionValues?.[1]?.value || '(none)',
    sessions: parseInt(r.metricValues?.[0]?.value || '0'),
    users: parseInt(r.metricValues?.[1]?.value || '0'),
  }));
}

export async function getUserMetrics(startDate: string, endDate: string) {
  const data = await ga4Fetch('runReport', {
    dateRanges: [{ startDate, endDate }],
    metrics: [
      { name: 'totalUsers' },
      { name: 'newUsers' },
      { name: 'sessions' },
      { name: 'averageSessionDuration' },
      { name: 'bounceRate' },
    ],
  });

  const row = data.rows?.[0];
  return {
    totalUsers: parseInt(row?.metricValues?.[0]?.value || '0'),
    newUsers: parseInt(row?.metricValues?.[1]?.value || '0'),
    sessions: parseInt(row?.metricValues?.[2]?.value || '0'),
    averageSessionDuration: parseFloat(row?.metricValues?.[3]?.value || '0'),
    bounceRate: parseFloat(row?.metricValues?.[4]?.value || '0'),
  };
}

export async function getRealTimeUsers() {
  const token = await getAccessToken();
  const url = `${GA4_BASE}/properties/${GA4_PROPERTY_ID}:runRealtimeReport`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      metrics: [{ name: 'activeUsers' }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GA4 realtime API failed: ${res.status} ${text}`);
  }

  const data: any = await res.json();
  const row = data.rows?.[0];
  return {
    activeUsers: parseInt(row?.metricValues?.[0]?.value || '0'),
  };
}

export async function getAnalyticsSummary(): Promise<object> {
  if (!isConfigured()) {
    return {
      configured: false,
      message: 'Google Analytics OAuth not configured. Set GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, and GOOGLE_ANALYTICS_REFRESH_TOKEN.',
    };
  }

  const endDate = 'today';
  const startDate = '7daysAgo';

  try {
    const [pageViews, topPages, trafficSources, userMetrics] = await Promise.all([
      getPageViews(startDate, endDate),
      getTopPages(startDate, endDate, 10),
      getTrafficSources(startDate, endDate),
      getUserMetrics(startDate, endDate),
    ]);

    let realtime = null;
    try {
      realtime = await getRealTimeUsers();
    } catch {
      // Realtime API may not be available for all properties
    }

    return {
      configured: true,
      period: 'last 7 days',
      overview: {
        ...pageViews,
        ...userMetrics,
      },
      realTimeUsers: realtime?.activeUsers ?? null,
      topPages,
      trafficSources,
    };
  } catch (err: any) {
    return {
      configured: true,
      error: err.message,
      hint: 'Check that GOOGLE_ANALYTICS_REFRESH_TOKEN is valid and the OAuth app has analytics.readonly scope.',
    };
  }
}

export const analyticsOAuthService = { isConfigured, getAccessToken };
