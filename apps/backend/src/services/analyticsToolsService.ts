import { prisma } from '@cleya/db';
import { posthogService } from './posthogService';
import { ga4Service } from './ga4Service';
import { analyticsAggregatorService } from './analyticsAggregatorService';

type DateRange = '7d' | '30d' | '90d';

function parseDateRange(range?: string): DateRange {
  if (range === '7d' || range === '30d' || range === '90d') return range;
  return '30d';
}

async function getPostHogInsights(dateRange?: string): Promise<Record<string, any>> {
  const range = parseDateRange(dateRange);
  const result = await analyticsAggregatorService.getPostHog(range);
  if (!result.configured) {
    return { configured: false, message: 'PostHog is not configured. POSTHOG_API_KEY is missing.' };
  }
  if (!result.data) {
    return { configured: true, data: null, error: result.error || 'No data returned from PostHog' };
  }
  return {
    configured: true,
    dateRange: range,
    uniqueUsers: result.data.uniqueUsers,
    totalEvents: result.data.totalEvents,
    avgEventsPerUser: result.data.avgEventsPerUser,
    avgSessionDurationSeconds: result.data.avgSessionDurationSeconds,
    topEvents: result.data.topEvents,
    dailyEventVolume: result.data.dailyEventVolume,
    retention: result.data.retention,
    featureUsage: result.data.featureUsage,
  };
}

async function getGA4Insights(dateRange?: string): Promise<Record<string, any>> {
  const range = parseDateRange(dateRange);
  const result = await analyticsAggregatorService.getGA4(range);
  if (!result.configured) {
    return { configured: false, message: 'Google Analytics is not configured. GA4_PROPERTY_ID and GA4_SERVICE_ACCOUNT_KEY are required.' };
  }
  if (!result.data) {
    return { configured: true, data: null, error: result.error || 'No data returned from GA4' };
  }
  return {
    configured: true,
    dateRange: range,
    pageviews: result.data.pageviews,
    sessions: result.data.sessions,
    activeUsers: result.data.activeUsers,
    bounceRate: result.data.bounceRate,
    topPages: result.data.topPages,
    trafficSources: result.data.trafficSources,
    geoBreakdown: result.data.geoBreakdown,
    dailyTrend: result.data.dailyTrend,
  };
}

async function getAnalyticsOverview(dateRange?: string): Promise<Record<string, any>> {
  const range = parseDateRange(dateRange);
  const overview = await analyticsAggregatorService.getOverview(range);
  return { dateRange: range, ...overview };
}

async function getPlatformStats(): Promise<Record<string, any>> {
  try {
    const [
      userCount,
      profileCount,
      matchCount,
      conversationCount,
      callCount,
      eventCount,
    ] = await Promise.all([
      prisma.user.count().catch(() => 0),
      prisma.profile.count().catch(() => 0),
      prisma.match.count().catch(() => 0),
      prisma.conversation.count().catch(() => 0),
      prisma.call.count().catch(() => 0),
      prisma.event.count().catch(() => 0),
    ]);

    const recentUsers = await prisma.user.count({
      where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    }).catch(() => 0);

    const recentMatches = await prisma.match.count({
      where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    }).catch(() => 0);

    const acceptedMatches = await prisma.match.count({
      where: { status: 'ACCEPTED' },
    }).catch(() => 0);

    const pendingMatches = await prisma.match.count({
      where: { status: { in: ['PENDING_A', 'PENDING_B', 'PROPOSED'] } },
    }).catch(() => 0);

    const completedCalls = await prisma.call.count({
      where: { status: 'COMPLETED' },
    }).catch(() => 0);

    let topCities: { city: string; count: number }[] = [];
    try {
      const cityData = await prisma.$queryRaw<{ city: string; count: bigint }[]>`
        SELECT COALESCE(p."cityBased", p."location") as city, COUNT(*)::int as count FROM "profiles" p
        WHERE (p."cityBased" IS NOT NULL AND p."cityBased" != '') OR (p."location" IS NOT NULL AND p."location" != '')
        GROUP BY COALESCE(p."cityBased", p."location") ORDER BY count DESC LIMIT 10
      `;
      topCities = cityData.map(c => ({ city: c.city, count: Number(c.count) }));
    } catch {}

    let topRoles: { role: string; count: number }[] = [];
    try {
      const roleData = await prisma.$queryRaw<{ role: string; count: bigint }[]>`
        SELECT p."currentRole" as role, COUNT(*)::int as count FROM "profiles" p
        WHERE p."currentRole" IS NOT NULL AND p."currentRole" != ''
        GROUP BY p."currentRole" ORDER BY count DESC LIMIT 10
      `;
      topRoles = roleData.map(r => ({ role: r.role, count: Number(r.count) }));
    } catch {}

    const matchAcceptRate = matchCount > 0 ? Math.round((acceptedMatches / matchCount) * 100) : 0;

    return {
      totalUsers: userCount,
      totalProfiles: profileCount,
      totalMatches: matchCount,
      totalConversations: conversationCount,
      totalCalls: callCount,
      totalEvents: eventCount,
      newUsersLast7Days: recentUsers,
      newMatchesLast7Days: recentMatches,
      acceptedMatches,
      pendingMatches,
      matchAcceptRate,
      completedCalls,
      callCompletionRate: callCount > 0 ? Math.round((completedCalls / callCount) * 100) : 0,
      topCities,
      topRoles,
    };
  } catch (err: any) {
    return { error: `Failed to fetch platform stats: ${err.message}` };
  }
}

async function getUserGrowthTrend(days: number = 30): Promise<Record<string, any>> {
  const safeDays = Math.max(1, Math.min(90, Math.floor(Number(days) || 30)));
  try {
    const startDate = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);
    const dailySignups = await prisma.$queryRaw<{ date: string; count: bigint }[]>`
      SELECT DATE("createdAt")::text as date, COUNT(*)::int as count
      FROM "users"
      WHERE "createdAt" >= ${startDate}
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `;

    const dailyMatches = await prisma.$queryRaw<{ date: string; count: bigint }[]>`
      SELECT DATE("createdAt")::text as date, COUNT(*)::int as count
      FROM "matches"
      WHERE "createdAt" >= ${startDate}
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `;

    return {
      period: `${safeDays} days`,
      dailySignups: dailySignups.map(d => ({ date: d.date, count: Number(d.count) })),
      dailyMatches: dailyMatches.map(d => ({ date: d.date, count: Number(d.count) })),
      totalNewUsers: dailySignups.reduce((s, d) => s + Number(d.count), 0),
      totalNewMatches: dailyMatches.reduce((s, d) => s + Number(d.count), 0),
    };
  } catch (err: any) {
    return { error: `Failed to fetch growth trend: ${err.message}` };
  }
}

async function getFunnelMetrics(): Promise<Record<string, any>> {
  try {
    const totalUsers = await prisma.user.count().catch(() => 0);
    const withProfile = await prisma.profile.count().catch(() => 0);
    const withMatch = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(DISTINCT uid)::int as count FROM (
        SELECT "userAId" as uid FROM "matches" UNION SELECT "userBId" as uid FROM "matches"
      ) sub
    `.then(r => Number(r[0]?.count || 0)).catch(() => 0);
    const withAccepted = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(DISTINCT uid)::int as count FROM (
        SELECT "userAId" as uid FROM "matches" WHERE status = 'ACCEPTED'
        UNION SELECT "userBId" as uid FROM "matches" WHERE status = 'ACCEPTED'
      ) sub
    `.then(r => Number(r[0]?.count || 0)).catch(() => 0);
    const withConversation = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(DISTINCT c."userId")::int as count FROM "conversations" c
    `.then(r => Number(r[0]?.count || 0)).catch(() => 0);
    const withCall = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(DISTINCT "userId")::int as count FROM "calls" WHERE status = 'COMPLETED'
    `.then(r => Number(r[0]?.count || 0)).catch(() => 0);

    return {
      funnel: [
        { stage: 'Signed Up', users: totalUsers, percentage: 100 },
        { stage: 'Completed Profile', users: withProfile, percentage: totalUsers > 0 ? Math.round((withProfile / totalUsers) * 100) : 0 },
        { stage: 'Received Match', users: withMatch, percentage: totalUsers > 0 ? Math.round((withMatch / totalUsers) * 100) : 0 },
        { stage: 'Accepted Match', users: withAccepted, percentage: totalUsers > 0 ? Math.round((withAccepted / totalUsers) * 100) : 0 },
        { stage: 'Started Conversation', users: withConversation, percentage: totalUsers > 0 ? Math.round((withConversation / totalUsers) * 100) : 0 },
        { stage: 'Completed Call', users: withCall, percentage: totalUsers > 0 ? Math.round((withCall / totalUsers) * 100) : 0 },
      ],
    };
  } catch (err: any) {
    return { error: `Failed to fetch funnel metrics: ${err.message}` };
  }
}

async function getAgentPerformanceData(): Promise<Record<string, any>> {
  try {
    const logs = await prisma.$queryRawUnsafe<any[]>(
      `SELECT agent_id, status, COUNT(*)::int as count
       FROM dm_agent_logs
       GROUP BY agent_id, status
       ORDER BY agent_id, count DESC`
    ).catch(() => []);

    const contentStats = await prisma.$queryRawUnsafe<any[]>(
      `SELECT agent_id, status, COUNT(*)::int as count
       FROM dm_content_queue
       GROUP BY agent_id, status
       ORDER BY agent_id`
    ).catch(() => []);

    const recentRuns = await prisma.$queryRawUnsafe<any[]>(
      `SELECT agent_id, status, last_run_at::text, last_run_duration, last_run_status, enabled
       FROM dm_agent_state
       ORDER BY last_run_at DESC NULLS LAST`
    ).catch(() => []);

    return {
      agentLogs: logs,
      contentStats,
      agentStates: recentRuns,
    };
  } catch (err: any) {
    return { error: `Failed to fetch agent performance: ${err.message}` };
  }
}

export const analyticsToolsService = {
  getPostHogInsights,
  getGA4Insights,
  getAnalyticsOverview,
  getPlatformStats,
  getUserGrowthTrend,
  getFunnelMetrics,
  getAgentPerformanceData,
};
