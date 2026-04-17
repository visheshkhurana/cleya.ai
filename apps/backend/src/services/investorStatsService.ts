import { prisma } from '@cleya/db';

export interface InvestorStatsView {
  responseRate: number;
  avgResponseTimeHours: number;
  lastActiveAt: Date | null;
  introsThisMonth: number;
  acceptanceRate: number;
  totalIntros: number;
  hidden: boolean;
}

export class InvestorStatsService {
  async computeForUser(userId: string) {
    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: { persona: true },
    });
    if (profile?.persona !== 'INVESTOR') return null;

    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [intros, introsThisMonth, lastMatch, user] = await Promise.all([
      prisma.introductionRecord.findMany({
        where: { OR: [{ userAId: userId }, { userBId: userId }] },
        select: { status: true, createdAt: true, updatedAt: true, sentAt: true },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      prisma.introductionRecord.count({
        where: {
          OR: [{ userAId: userId }, { userBId: userId }],
          createdAt: { gte: monthAgo },
        },
      }),
      prisma.match.findFirst({
        where: {
          OR: [{ userAId: userId }, { userBId: userId }],
        },
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
      }),
      prisma.user.findUnique({ where: { id: userId }, select: { tier: true } }),
    ]);

    const total = intros.length;
    const responded = intros.filter((i) => ['RESPONDED', 'MEETING_SCHEDULED', 'COMPLETED'].includes(i.status));
    const accepted = intros.filter((i) => ['MEETING_SCHEDULED', 'COMPLETED'].includes(i.status));

    const responseTimes = responded
      .map((i) => {
        const sent = i.sentAt ?? i.createdAt;
        return i.updatedAt.getTime() - sent.getTime();
      })
      .filter((n) => n > 0);
    const avgResponseTimeMs = responseTimes.length
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : 0;

    const responseRate = total > 0 ? responded.length / total : 0;
    const acceptanceRate = total > 0 ? accepted.length / total : 0;

    const stats = await prisma.investorStats.upsert({
      where: { userId },
      create: {
        userId,
        responseRate,
        avgResponseTimeMs,
        lastActiveAt: lastMatch?.updatedAt ?? null,
        introsThisMonth,
        acceptanceRate,
        totalIntros: total,
        totalAcceptedIntros: accepted.length,
        hideStats: user?.tier === 'PRO' ? false : false,
      },
      update: {
        responseRate,
        avgResponseTimeMs,
        lastActiveAt: lastMatch?.updatedAt ?? null,
        introsThisMonth,
        acceptanceRate,
        totalIntros: total,
        totalAcceptedIntros: accepted.length,
        computedAt: new Date(),
      },
    });
    return stats;
  }

  async runDailyAggregation(): Promise<{ updated: number; errors: number }> {
    const investors = await prisma.profile.findMany({
      where: { persona: 'INVESTOR', isComplete: true },
      select: { userId: true },
    });
    let updated = 0;
    let errors = 0;
    for (const inv of investors) {
      try {
        await this.computeForUser(inv.userId);
        updated++;
      } catch (e: any) {
        errors++;
        console.log(`[InvestorStats] compute failed for ${inv.userId}:`, e?.message || e);
      }
    }
    console.log(`[InvestorStats] Daily aggregation: ${updated} updated, ${errors} errors`);
    return { updated, errors };
  }

  async getView(userId: string): Promise<InvestorStatsView | null> {
    const stats = await prisma.investorStats.findUnique({ where: { userId } });
    if (!stats) {
      // Compute on demand if missing
      const fresh = await this.computeForUser(userId);
      if (!fresh) return null;
      return this.toView(fresh);
    }
    // Recompute if stale (>24h)
    if (Date.now() - stats.computedAt.getTime() > 24 * 60 * 60 * 1000) {
      const fresh = await this.computeForUser(userId).catch(() => null);
      if (fresh) return this.toView(fresh);
    }
    return this.toView(stats);
  }

  private toView(stats: any): InvestorStatsView {
    return {
      responseRate: Math.round(stats.responseRate * 100) / 100,
      avgResponseTimeHours: Math.round(stats.avgResponseTimeMs / (1000 * 60 * 60) * 10) / 10,
      lastActiveAt: stats.lastActiveAt,
      introsThisMonth: stats.introsThisMonth,
      acceptanceRate: Math.round(stats.acceptanceRate * 100) / 100,
      totalIntros: stats.totalIntros,
      hidden: stats.hideStats,
    };
  }

  async setHideStats(userId: string, hide: boolean) {
    return prisma.investorStats.upsert({
      where: { userId },
      create: { userId, hideStats: hide },
      update: { hideStats: hide },
    });
  }
}

export const investorStatsService = new InvestorStatsService();
