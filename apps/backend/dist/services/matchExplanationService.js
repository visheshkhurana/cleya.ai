"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchExplanationService = exports.MatchExplanationService = void 0;
const db_1 = require("@cleya/db");
const FACTOR_DEFS = [
    { key: 'industryScore', label: 'Sector overlap', weight: 0.25 },
    { key: 'stageScore', label: 'Stage alignment', weight: 0.10 },
    { key: 'locationScore', label: 'Location', weight: 0.10 },
    { key: 'goalsScore', label: 'Thesis / goal fit', weight: 0.20 },
    { key: 'skillsScore', label: 'Skills complementarity', weight: 0.10 },
    { key: 'personaScore', label: 'Role fit', weight: 0.15 },
    { key: 'semanticScore', label: 'Profile similarity', weight: 0.10 },
];
class MatchExplanationService {
    async getForUser(matchId, userId) {
        const match = await db_1.prisma.match.findFirst({
            where: {
                id: matchId,
                OR: [{ userAId: userId }, { userBId: userId }],
            },
            include: {
                userA: { include: { profile: true } },
                userB: { include: { profile: true } },
            },
        });
        if (!match)
            return null;
        const breakdown = match.scoreBreakdown || {};
        const factors = FACTOR_DEFS.map((f) => ({
            key: f.key,
            label: f.label,
            value: typeof breakdown[f.key] === 'number' ? breakdown[f.key] : 0,
            weight: f.weight,
        })).filter((f) => f.value > 0 || ['industryScore', 'stageScore', 'personaScore'].includes(f.key));
        // Mutual connections: count of other users this person and the match are both ACCEPTED with
        const isUserA = match.userAId === userId;
        const otherId = isUserA ? match.userBId : match.userAId;
        const myAccepted = await db_1.prisma.match.findMany({
            where: {
                status: 'ACCEPTED',
                OR: [{ userAId: userId }, { userBId: userId }],
            },
            select: { userAId: true, userBId: true },
        });
        const mySet = new Set();
        for (const m of myAccepted) {
            mySet.add(m.userAId === userId ? m.userBId : m.userAId);
        }
        const otherAccepted = await db_1.prisma.match.findMany({
            where: {
                status: 'ACCEPTED',
                OR: [{ userAId: otherId }, { userBId: otherId }],
            },
            select: { userAId: true, userBId: true },
        });
        let mutual = 0;
        for (const m of otherAccepted) {
            const counterpart = m.userAId === otherId ? m.userBId : m.userAId;
            if (mySet.has(counterpart))
                mutual++;
        }
        // Recent activity (last match update)
        const lastActivity = await db_1.prisma.match.findFirst({
            where: { OR: [{ userAId: otherId }, { userBId: otherId }] },
            orderBy: { updatedAt: 'desc' },
            select: { updatedAt: true },
        });
        const activityStr = lastActivity ? this.formatActivity(lastActivity.updatedAt) : null;
        const summary = this.buildSummary(factors, mutual);
        return {
            matchId: match.id,
            overallScore: match.score,
            factors,
            rationale: match.reason || summary,
            summary,
            mutualConnections: mutual,
            recentActivity: activityStr,
        };
    }
    buildSummary(factors, mutual) {
        const top = [...factors].sort((a, b) => b.value * b.weight - a.value * a.weight).slice(0, 2);
        const parts = top.map((f) => `${f.label.toLowerCase()} (${Math.round(f.value * 100)}%)`);
        let s = `Strongest signals: ${parts.join(', ')}.`;
        if (mutual > 0)
            s += ` You share ${mutual} mutual connection${mutual === 1 ? '' : 's'}.`;
        return s;
    }
    formatActivity(d) {
        const diff = Date.now() - d.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        if (days < 1)
            return 'Active today';
        if (days < 7)
            return `Active ${days}d ago`;
        if (days < 30)
            return `Active ${Math.floor(days / 7)}w ago`;
        return `Active ${Math.floor(days / 30)}mo ago`;
    }
}
exports.MatchExplanationService = MatchExplanationService;
exports.matchExplanationService = new MatchExplanationService();
//# sourceMappingURL=matchExplanationService.js.map