"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.investorStatsService = exports.InvestorStatsService = void 0;
const db_1 = require("@cleya/db");
class InvestorStatsService {
    async computeForUser(userId) {
        const profile = await db_1.prisma.profile.findUnique({
            where: { userId },
            select: { persona: true },
        });
        if (profile?.persona !== 'INVESTOR')
            return null;
        const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const [intros, introsThisMonth, lastMatch, user] = await Promise.all([
            db_1.prisma.introductionRecord.findMany({
                where: { OR: [{ userAId: userId }, { userBId: userId }] },
                select: { status: true, createdAt: true, updatedAt: true, sentAt: true },
                orderBy: { createdAt: 'desc' },
                take: 200,
            }),
            db_1.prisma.introductionRecord.count({
                where: {
                    OR: [{ userAId: userId }, { userBId: userId }],
                    createdAt: { gte: monthAgo },
                },
            }),
            db_1.prisma.match.findFirst({
                where: {
                    OR: [{ userAId: userId }, { userBId: userId }],
                },
                orderBy: { updatedAt: 'desc' },
                select: { updatedAt: true },
            }),
            db_1.prisma.user.findUnique({ where: { id: userId }, select: { tier: true } }),
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
        const stats = await db_1.prisma.investorStats.upsert({
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
    async runDailyAggregation() {
        const investors = await db_1.prisma.profile.findMany({
            where: { persona: 'INVESTOR', isComplete: true },
            select: { userId: true },
        });
        let updated = 0;
        let errors = 0;
        for (const inv of investors) {
            try {
                await this.computeForUser(inv.userId);
                updated++;
            }
            catch (e) {
                errors++;
                console.log(`[InvestorStats] compute failed for ${inv.userId}:`, e?.message || e);
            }
        }
        console.log(`[InvestorStats] Daily aggregation: ${updated} updated, ${errors} errors`);
        return { updated, errors };
    }
    async getView(userId) {
        const stats = await db_1.prisma.investorStats.findUnique({ where: { userId } });
        if (!stats) {
            // Compute on demand if missing
            const fresh = await this.computeForUser(userId);
            if (!fresh)
                return null;
            return this.toView(fresh);
        }
        // Recompute if stale (>24h)
        if (Date.now() - stats.computedAt.getTime() > 24 * 60 * 60 * 1000) {
            const fresh = await this.computeForUser(userId).catch(() => null);
            if (fresh)
                return this.toView(fresh);
        }
        return this.toView(stats);
    }
    toView(stats) {
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
    async setHideStats(userId, hide) {
        return db_1.prisma.investorStats.upsert({
            where: { userId },
            create: { userId, hideStats: hide },
            update: { hideStats: hide },
        });
    }
}
exports.InvestorStatsService = InvestorStatsService;
exports.investorStatsService = new InvestorStatsService();
//# sourceMappingURL=investorStatsService.js.map