import { ga4Service, type GA4Metrics } from './ga4Service';
import { instagramService, type InstagramMetrics } from './instagramService';
import { posthogService, type PostHogMetrics } from './posthogService';

type DateRange = '7d' | '30d' | '90d';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000;

const cache: {
  ga4: Map<string, CacheEntry<GA4Metrics | null>>;
  instagram: Map<string, CacheEntry<InstagramMetrics | null>>;
  posthog: Map<string, CacheEntry<PostHogMetrics | null>>;
} = {
  ga4: new Map(),
  instagram: new Map(),
  posthog: new Map(),
};

function getCached<T>(store: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const entry = store.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data;
  }
  if (entry) store.delete(key);
  return undefined;
}

function setCache<T>(store: Map<string, CacheEntry<T>>, key: string, data: T): void {
  store.set(key, { data, timestamp: Date.now() });
}

async function getGA4(dateRange: DateRange = '30d'): Promise<{ configured: boolean; data: GA4Metrics | null; error?: string }> {
  if (!ga4Service.isConfigured()) {
    return { configured: false, data: null };
  }

  const cached = getCached(cache.ga4, dateRange);
  if (cached !== undefined) return { configured: true, data: cached };

  try {
    const data = await ga4Service.getMetrics(dateRange);
    setCache(cache.ga4, dateRange, data);
    return { configured: true, data };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { configured: true, data: null, error: message };
  }
}

async function getInstagram(dateRange: DateRange = '30d'): Promise<{ configured: boolean; data: InstagramMetrics | null; error?: string }> {
  if (!instagramService.isConfigured()) {
    return { configured: false, data: null };
  }

  const cached = getCached(cache.instagram, dateRange);
  if (cached !== undefined) return { configured: true, data: cached };

  try {
    const data = await instagramService.getMetrics(dateRange);
    setCache(cache.instagram, dateRange, data);
    return { configured: true, data };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { configured: true, data: null, error: message };
  }
}

async function getPostHog(dateRange: DateRange = '30d'): Promise<{ configured: boolean; data: PostHogMetrics | null; error?: string }> {
  if (!posthogService.isConfigured()) {
    return { configured: false, data: null };
  }

  const cached = getCached(cache.posthog, dateRange);
  if (cached !== undefined) return { configured: true, data: cached };

  try {
    const data = await posthogService.getMetrics(dateRange);
    setCache(cache.posthog, dateRange, data);
    return { configured: true, data };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { configured: true, data: null, error: message };
  }
}

async function getOverview(dateRange: DateRange = '30d') {
  const [ga4, instagram, posthog] = await Promise.all([
    getGA4(dateRange),
    getInstagram(dateRange),
    getPostHog(dateRange),
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
  };
}

export const analyticsAggregatorService = {
  getGA4,
  getInstagram,
  getPostHog,
  getOverview,
};
