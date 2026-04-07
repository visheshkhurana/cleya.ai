const SENTRY_AUTH_TOKEN = process.env.SENTRY_AUTH_TOKEN;
const SENTRY_ORG = process.env.SENTRY_ORG;
const SENTRY_PROJECT = process.env.SENTRY_PROJECT;

const SENTRY_API_BASE = 'https://sentry.io/api/0';

interface SentryIssue {
  id: string;
  title: string;
  shortId: string;
  count: string;
  userCount: number;
  firstSeen: string;
  lastSeen: string;
  level: string;
  status: string;
  permalink: string;
}

interface SentryMetrics {
  totalErrors: number;
  unresolvedIssues: number;
  topIssues: {
    id: string;
    title: string;
    shortId: string;
    count: number;
    userCount: number;
    level: string;
    lastSeen: string;
    permalink: string;
  }[];
  errorTrend: { date: string; count: number }[];
  transactionStats: {
    totalTransactions: number;
    avgDuration: number;
    p95Duration: number;
  } | null;
}

function isConfigured(): boolean {
  return !!(SENTRY_AUTH_TOKEN && SENTRY_ORG && SENTRY_PROJECT);
}

interface SentryResponse<T> {
  data: T;
  headers: Headers;
}

async function sentryFetchRaw<T = unknown>(path: string): Promise<SentryResponse<T>> {
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

  const data = await res.json() as T;
  return { data, headers: res.headers };
}

async function sentryFetch<T = unknown>(path: string): Promise<T> {
  const result = await sentryFetchRaw<T>(path);
  return result.data;
}

async function getMetrics(dateRange: '7d' | '30d' | '90d' = '30d'): Promise<SentryMetrics | null> {
  if (!isConfigured()) return null;

  const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
  const since = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000);

  let topIssues: SentryMetrics['topIssues'] = [];
  let totalErrors = 0;
  let unresolvedIssues = 0;
  let issuesLoaded = false;

  try {
    const issuesResponse = await sentryFetchRaw<SentryIssue[]>(
      `/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/issues/?query=is:unresolved&sort=freq&limit=10&statsPeriod=${days}d`
    );

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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Sentry issues fetch error:', message);
    if (message.includes('authentication failed')) {
      throw err;
    }
  }

  let errorTrend: SentryMetrics['errorTrend'] = [];
  let statsLoaded = false;

  try {
    const statsData = await sentryFetch<[number, number][]>(
      `/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/stats/?stat=received&resolution=1d&since=${since}`
    );

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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Sentry stats fetch error:', message);
  }

  let transactionStats: SentryMetrics['transactionStats'] = null;

  try {
    type EventsResponse = { data: Array<Record<string, unknown>>; meta: unknown };
    const txnData = await sentryFetch<EventsResponse>(
      `/organizations/${SENTRY_ORG}/events/?field=count()&field=avg(transaction.duration)&field=p95(transaction.duration)&project=${SENTRY_PROJECT}&statsPeriod=${days}d&query=event.type:transaction`
    );

    if (txnData?.data?.[0]) {
      const row = txnData.data[0];
      transactionStats = {
        totalTransactions: (row['count()'] as number) || 0,
        avgDuration: Math.round((row['avg(transaction.duration)'] as number) || 0),
        p95Duration: Math.round((row['p95(transaction.duration)'] as number) || 0),
      };
    }
  } catch (err: unknown) {
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

export const sentryService = { isConfigured, getMetrics };
export type { SentryMetrics };
