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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchScheduler = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const db_1 = require("@cleya/db");
const matching_1 = require("@cleya/matching");
const matchingService_1 = require("./matchingService");
const vectorMatchingService_1 = require("./vectorMatchingService");
const slackService_1 = require("./slackService");
const linkedinEnrichmentService_1 = require("./linkedinEnrichmentService");
const dripCampaignService_1 = require("./dripCampaignService");
const razorpayService_1 = require("./razorpayService");
const matchMetrics_1 = require("./matchMetrics");
const num = (v, d) => {
    const n = v ? Number(v) : NaN;
    return Number.isFinite(n) ? n : d;
};
const TICK_CRON = process.env.MATCH_TICK_CRON || '*/2 * * * *';
const TICK_CHUNK_SIZE = num(process.env.MATCH_TICK_CHUNK_SIZE, 25);
const REVISIT_INTERVAL_MS = num(process.env.MATCH_REVISIT_HOURS, 6) * 60 * 60 * 1000;
const PER_USER_PROPOSE_LIMIT = num(process.env.MATCH_PER_USER_PROPOSE_LIMIT, 3);
// Cadence: pace match delivery so each new proposal feels like a moment of delight.
// New users (account < NEW_USER_DAYS AND lifetime matches < NEW_USER_FAST_QUOTA) bypass
// the gap so they get their first 2-3 matches quickly. Established users get a
// minimum gap between any new proposal being created for them.
const NEW_USER_DAYS = num(process.env.MATCH_NEW_USER_DAYS, 7);
const NEW_USER_FAST_QUOTA = num(process.env.MATCH_NEW_USER_FAST_QUOTA, 3);
const ESTABLISHED_GAP_HOURS = num(process.env.MATCH_ESTABLISHED_GAP_HOURS, 36);
const RECHECK_PEER_LIMIT = num(process.env.MATCH_RECHECK_PEER_LIMIT, 50);
const TICK_STALL_THRESHOLD_MIN = num(process.env.MATCH_TICK_STALL_MINUTES, 10);
const TICK_WATCHDOG_CRON = process.env.MATCH_TICK_WATCHDOG_CRON || '*/2 * * * *';
const TICK_REPEAT_ALERT_MIN = num(process.env.MATCH_TICK_STALL_REPEAT_MINUTES, 60);
const TREND_WINDOW_MS = 24 * 60 * 60 * 1000;
const PRUNE_EVERY_TICKS = 30;
class MatchScheduler {
    tasks = [];
    tickRunning = false;
    safetyRunning = false;
    started = false;
    pendingQueue = new Set();
    lastCheckAt = new Map();
    startedAt = null;
    stallAlertActive = false;
    stallAlertedAt = null;
    lastStallAlertAt = null;
    stats = {
        ticks: 0,
        usersConsidered: 0,
        proposalsCreated: 0,
        proposalsBlocked: 0,
        errors: 0,
        lastTickAt: null,
    };
    start() {
        if (this.started) {
            console.log('[MatchScheduler] Already started, skipping');
            return;
        }
        const tickJob = node_cron_1.default.schedule(TICK_CRON, () => {
            this.runTick().catch(err => console.error('[MatchScheduler] Continuous tick failed:', err));
        }, { timezone: 'Asia/Kolkata' });
        const safetyNetJob = node_cron_1.default.schedule('0 4 * * *', () => {
            this.runSafetyNetSweep().catch(err => console.error('[MatchScheduler] Safety-net sweep failed:', err));
        }, { timezone: 'Asia/Kolkata' });
        const dailyReportJob = node_cron_1.default.schedule('0 21 * * *', () => {
            slackService_1.slackService.sendDailyReport().catch(err => console.error('[MatchScheduler] Daily report failed:', err));
        }, { timezone: 'Asia/Kolkata' });
        const enrichmentJob = node_cron_1.default.schedule('0 3 * * *', () => {
            this.runLinkedinEnrichment().catch(err => console.error('[MatchScheduler] LinkedIn enrichment failed:', err));
        }, { timezone: 'Asia/Kolkata' });
        const dripJob = node_cron_1.default.schedule('0 10 * * *', () => {
            this.runDripCampaign().catch(err => console.error('[MatchScheduler] Drip campaign failed:', err));
        }, { timezone: 'Asia/Kolkata' });
        const weeklyDigestJob = node_cron_1.default.schedule('0 9 * * 1', () => {
            this.runWeeklyDigest().catch(err => console.error('[MatchScheduler] Weekly digest failed:', err));
        }, { timezone: 'Asia/Kolkata' });
        const investorStatsJob = node_cron_1.default.schedule('30 3 * * *', () => {
            this.runInvestorStatsAggregation().catch(err => console.error('[MatchScheduler] Investor stats aggregation failed:', err));
        }, { timezone: 'Asia/Kolkata' });
        const watchdogJob = node_cron_1.default.schedule(TICK_WATCHDOG_CRON, () => {
            this.runTickWatchdog().catch(err => console.error('[MatchScheduler] Tick watchdog failed:', err));
        }, { timezone: 'Asia/Kolkata' });
        const freeTierResetJob = node_cron_1.default.schedule('5 0 * * *', () => {
            this.runFreeTierReset().catch(err => console.error('[MatchScheduler] Free-tier reset failed:', err));
        }, { timezone: 'Asia/Kolkata' });
        this.tasks.push(tickJob, safetyNetJob, dailyReportJob, enrichmentJob, dripJob, weeklyDigestJob, investorStatsJob, watchdogJob, freeTierResetJob);
        this.startedAt = new Date();
        this.started = true;
        console.log(`[MatchScheduler] Continuous matchmaking tick scheduled (${TICK_CRON}, chunk=${TICK_CHUNK_SIZE})`);
        console.log('[MatchScheduler] Safety-net sweep scheduled at 4:00 IST');
        console.log('[MatchScheduler] Daily Slack report at 21:00 IST');
        console.log('[MatchScheduler] LinkedIn enrichment at 3:00 IST');
        console.log('[MatchScheduler] Drip campaign at 10:00 IST');
        console.log('[MatchScheduler] Weekly digest at Mon 9:00 IST');
        console.log('[MatchScheduler] Investor stats aggregation at 3:30 IST');
        console.log(`[MatchScheduler] Tick watchdog scheduled (${TICK_WATCHDOG_CRON}, threshold=${TICK_STALL_THRESHOLD_MIN}m)`);
        console.log('[MatchScheduler] Free-tier monthly reset scheduled at 00:05 IST');
    }
    async runFreeTierReset() {
        const now = new Date();
        const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const result = await db_1.prisma.user.updateMany({
            where: { tier: 'FREE', monthlyResetAt: { lte: cutoff } },
            data: { monthlyMatchesUsed: 0, monthlyResetAt: now },
        });
        if (result.count > 0) {
            console.log(`[MatchScheduler] Free-tier reset: refreshed ${result.count} users`);
        }
    }
    async runTickWatchdog() {
        if (!this.started)
            return;
        const now = Date.now();
        const reference = this.stats.lastTickAt ?? this.startedAt;
        if (!reference)
            return;
        const minutesSinceTick = (now - reference.getTime()) / 60000;
        const isStalled = minutesSinceTick >= TICK_STALL_THRESHOLD_MIN;
        if (isStalled) {
            const shouldFire = !this.stallAlertActive ||
                (this.lastStallAlertAt !== null &&
                    (now - this.lastStallAlertAt.getTime()) / 60000 >= TICK_REPEAT_ALERT_MIN);
            if (shouldFire) {
                if (!this.stallAlertActive) {
                    this.stallAlertedAt = new Date();
                }
                this.stallAlertActive = true;
                this.lastStallAlertAt = new Date();
                console.warn(`[MatchScheduler] Tick stalled: ${minutesSinceTick.toFixed(1)}m since last tick ` +
                    `(threshold ${TICK_STALL_THRESHOLD_MIN}m). Sending Slack alert.`);
                await slackService_1.slackService
                    .notifyMatchmakingStalled({
                    minutesSinceLastTick: minutesSinceTick,
                    lastTickAt: this.stats.lastTickAt,
                    thresholdMinutes: TICK_STALL_THRESHOLD_MIN,
                })
                    .catch(err => console.error('[MatchScheduler] Failed to send stall alert:', err));
            }
            return;
        }
        if (this.stallAlertActive && this.stats.lastTickAt) {
            // Approximate stall onset as the last successful tick before the gap
            // (or scheduler startup if there had never been one). This gives a
            // truer downtime than measuring from when we first paged.
            const stallOnset = this.stallAlertedAt
                ? new Date(this.stallAlertedAt.getTime() - TICK_STALL_THRESHOLD_MIN * 60000)
                : this.startedAt ?? this.stats.lastTickAt;
            const downtimeMs = this.stats.lastTickAt.getTime() - stallOnset.getTime();
            const downtimeMinutes = Math.max(0, downtimeMs / 60000);
            this.stallAlertActive = false;
            this.lastStallAlertAt = null;
            const recoveredFrom = this.stallAlertedAt;
            this.stallAlertedAt = null;
            console.log(`[MatchScheduler] Ticks resumed after ${downtimeMinutes.toFixed(1)}m ` +
                `(stall started ${recoveredFrom?.toISOString() ?? 'unknown'}). Sending Slack recovery.`);
            await slackService_1.slackService
                .notifyMatchmakingResumed({
                downtimeMinutes,
                lastTickAt: this.stats.lastTickAt,
            })
                .catch(err => console.error('[MatchScheduler] Failed to send recovery alert:', err));
        }
    }
    stop() {
        this.tasks.forEach(t => t.stop());
        this.tasks = [];
        this.started = false;
        this.startedAt = null;
        this.stallAlertActive = false;
        this.stallAlertedAt = null;
        this.lastStallAlertAt = null;
        console.log('[MatchScheduler] All scheduled tasks stopped');
    }
    enqueueUserCheck(userId) {
        this.pendingQueue.add(userId);
        console.log(`[MatchScheduler] Enqueued user ${userId} (queue size=${this.pendingQueue.size})`);
    }
    async enqueueRecheckPeers(userId) {
        try {
            const profile = await db_1.prisma.profile.findUnique({
                where: { userId },
                select: { persona: true },
            });
            if (!profile?.persona)
                return;
            const compatible = Object.entries(matching_1.PERSONA_COMPATIBILITY[profile.persona] || {})
                .filter(([, score]) => score >= 0.7)
                .map(([persona]) => persona)
                .filter((p) => p in db_1.PersonaType);
            if (compatible.length === 0)
                return;
            const peers = await db_1.prisma.profile.findMany({
                where: {
                    isComplete: true,
                    persona: { in: compatible },
                    userId: { not: userId },
                },
                select: { userId: true },
                orderBy: { updatedAt: 'desc' },
                take: RECHECK_PEER_LIMIT,
            });
            for (const p of peers)
                this.pendingQueue.add(p.userId);
            console.log(`[MatchScheduler] Re-queued ${peers.length} compatible peers for ${userId}`);
        }
        catch (e) {
            console.log('[MatchScheduler] enqueueRecheckPeers failed:', e.message);
        }
    }
    getStats() {
        return {
            ...this.stats,
            metrics: (0, matchMetrics_1.snapshot)(),
            queueSize: this.pendingQueue.size,
        };
    }
    async runTick() {
        if (this.tickRunning)
            return;
        this.tickRunning = true;
        const startTime = Date.now();
        const metricsBefore = (0, matchMetrics_1.snapshot)();
        let considered = 0;
        let errors = 0;
        let proposed = 0;
        let blocked = 0;
        try {
            const candidates = await this.selectDueUsers(TICK_CHUNK_SIZE);
            if (candidates.length === 0) {
                this.stats.ticks++;
                this.stats.lastTickAt = new Date();
                console.log('[MatchScheduler] tick: idle (no due users)');
                await this.recordSample({
                    considered: 0,
                    proposed: 0,
                    blocked: 0,
                    errors: 0,
                    queueSize: this.pendingQueue.size,
                    durationMs: Date.now() - startTime,
                });
                return;
            }
            for (const userId of candidates) {
                considered++;
                this.lastCheckAt.set(userId, Date.now());
                this.pendingQueue.delete(userId);
                await db_1.prisma.profile
                    .update({ where: { userId }, data: { matchLastCheckedAt: new Date() } })
                    .catch(() => null);
                try {
                    const paywall = await razorpayService_1.razorpayService.checkPaywall(userId).catch(() => null);
                    if (!paywall)
                        continue;
                    if (paywall.tier === 'FREE' && !paywall.allowed) {
                        (0, matchMetrics_1.recordProposalSkipped)('FREE_LIMIT');
                        continue;
                    }
                    await vectorMatchingService_1.vectorMatchingService.ensureEmbedding(userId).catch(() => null);
                    await matchingService_1.matchingService.findAndAutoPropose(userId, PER_USER_PROPOSE_LIMIT);
                }
                catch (err) {
                    errors++;
                    console.log(`[MatchScheduler] Tick user ${userId} error: ${err?.message || err}`);
                }
            }
            const tickDelta = (0, matchMetrics_1.diffSince)(metricsBefore);
            const blockedTotal = Object.values(tickDelta.proposalsSkipped).reduce((a, b) => a + b, 0) +
                Object.values(tickDelta.notificationsSkipped).reduce((a, b) => a + b, 0);
            const duration = Date.now() - startTime;
            proposed = tickDelta.proposalsCreated;
            blocked = blockedTotal;
            this.stats.ticks++;
            this.stats.usersConsidered += considered;
            this.stats.proposalsCreated += proposed;
            this.stats.proposalsBlocked += blocked;
            this.stats.errors += errors;
            this.stats.lastTickAt = new Date();
            console.log(`[MatchScheduler] tick: considered=${considered} ` +
                `proposed=${tickDelta.proposalsCreated} notifSent=${tickDelta.notificationsSent} ` +
                `${(0, matchMetrics_1.formatSkipBreakdown)(tickDelta)} ` +
                `errors=${errors} queueLeft=${this.pendingQueue.size} duration=${duration}ms`);
            await this.recordSample({
                considered,
                proposed,
                blocked,
                errors,
                queueSize: this.pendingQueue.size,
                durationMs: duration,
            });
        }
        finally {
            this.tickRunning = false;
        }
    }
    async recordSample(sample) {
        try {
            await db_1.prisma.matchmakingTickSample.create({
                data: {
                    considered: sample.considered,
                    proposed: sample.proposed,
                    blocked: sample.blocked,
                    errors: sample.errors,
                    queueSize: sample.queueSize,
                    durationMs: sample.durationMs,
                },
            });
        }
        catch (err) {
            console.log('[MatchScheduler] recordSample failed:', err?.message || err);
        }
        if (this.stats.ticks % PRUNE_EVERY_TICKS === 0) {
            const cutoff = new Date(Date.now() - TREND_WINDOW_MS);
            try {
                await db_1.prisma.matchmakingTickSample.deleteMany({
                    where: { tickAt: { lt: cutoff } },
                });
            }
            catch (err) {
                console.log('[MatchScheduler] prune samples failed:', err?.message || err);
            }
        }
    }
    async getTrend(windowMs = TREND_WINDOW_MS) {
        const since = new Date(Date.now() - windowMs);
        const samples = await db_1.prisma.matchmakingTickSample.findMany({
            where: { tickAt: { gte: since } },
            orderBy: { tickAt: 'asc' },
            select: {
                tickAt: true,
                considered: true,
                proposed: true,
                blocked: true,
                errors: true,
            },
        });
        return samples.map((s) => ({
            ts: s.tickAt.toISOString(),
            usersConsidered: s.considered,
            proposalsCreated: s.proposed,
            proposalsBlocked: s.blocked,
            errors: s.errors,
        }));
    }
    async selectDueUsers(limit) {
        const result = [];
        const seen = new Set();
        // 1. Drain explicit queue first
        for (const userId of this.pendingQueue) {
            if (result.length >= limit)
                break;
            if (seen.has(userId))
                continue;
            result.push(userId);
            seen.add(userId);
        }
        if (result.length >= limit)
            return result;
        // 2. Pull globally least-recently-checked complete profiles. Nulls
        // (never checked) sort first, then oldest matchLastCheckedAt.
        const cutoff = new Date(Date.now() - REVISIT_INTERVAL_MS);
        // Pull a wider candidate pool than `limit` so we can apply per-user
        // cadence filtering and still hit the chunk size for active users.
        const poolSize = Math.max(limit * 4, limit);
        const due = await db_1.prisma.profile.findMany({
            where: {
                isComplete: true,
                OR: [
                    { matchLastCheckedAt: null },
                    { matchLastCheckedAt: { lt: cutoff } },
                ],
            },
            select: { userId: true, user: { select: { createdAt: true } } },
            orderBy: [{ matchLastCheckedAt: { sort: 'asc', nulls: 'first' } }],
            take: poolSize,
        });
        if (due.length === 0)
            return result;
        // Pace established users: skip if they already received a proposal
        // within the gap window. New users (recently joined AND haven't yet
        // hit the fast-quota of lifetime matches) bypass the gap entirely so
        // their first 2-3 matches feel immediate and welcoming.
        const dueIds = due.map(d => d.userId);
        const gapCutoff = new Date(Date.now() - ESTABLISHED_GAP_HOURS * 60 * 60 * 1000);
        const newUserCutoff = new Date(Date.now() - NEW_USER_DAYS * 24 * 60 * 60 * 1000);
        // Per-user lifetime match count + most recent timestamp, counted on
        // BOTH sides of the match (userA and userB are both notified, so both
        // sides count as "received a proposal" for cadence purposes).
        const [aGroups, bGroups] = await Promise.all([
            db_1.prisma.match.groupBy({
                by: ['userAId'],
                where: { userAId: { in: dueIds } },
                _count: { userAId: true },
                _max: { createdAt: true },
            }).catch(() => []),
            db_1.prisma.match.groupBy({
                by: ['userBId'],
                where: { userBId: { in: dueIds } },
                _count: { userBId: true },
                _max: { createdAt: true },
            }).catch(() => []),
        ]);
        const lifetimeMap = new Map();
        const lastMatchMap = new Map();
        for (const g of aGroups) {
            lifetimeMap.set(g.userAId, (lifetimeMap.get(g.userAId) || 0) + g._count.userAId);
            if (g._max.createdAt)
                lastMatchMap.set(g.userAId, g._max.createdAt);
        }
        for (const g of bGroups) {
            lifetimeMap.set(g.userBId, (lifetimeMap.get(g.userBId) || 0) + g._count.userBId);
            const prev = lastMatchMap.get(g.userBId);
            if (g._max.createdAt && (!prev || g._max.createdAt > prev)) {
                lastMatchMap.set(g.userBId, g._max.createdAt);
            }
        }
        for (const p of due) {
            if (result.length >= limit)
                break;
            if (seen.has(p.userId))
                continue;
            const joinedAt = p.user?.createdAt ?? new Date(0);
            const isNewUser = joinedAt >= newUserCutoff;
            const lifetime = lifetimeMap.get(p.userId) || 0;
            const lastMatchAt = lastMatchMap.get(p.userId);
            const inFastQuota = isNewUser && lifetime < NEW_USER_FAST_QUOTA;
            if (!inFastQuota && lastMatchAt && lastMatchAt > gapCutoff) {
                // Established user with a recent proposal — skip this tick to let
                // the moment of delight breathe. Bump matchLastCheckedAt so we
                // don't re-evaluate them every tick.
                (0, matchMetrics_1.recordProposalSkipped)('CADENCE_GAP');
                await db_1.prisma.profile
                    .update({ where: { userId: p.userId }, data: { matchLastCheckedAt: new Date() } })
                    .catch(() => null);
                seen.add(p.userId);
                continue;
            }
            result.push(p.userId);
            seen.add(p.userId);
        }
        return result;
    }
    async runSafetyNetSweep() {
        if (this.safetyRunning) {
            console.log('[MatchScheduler] Safety-net already running, skipping');
            return { usersProcessed: 0, totalProposed: 0, errors: 0, skipped: true };
        }
        this.safetyRunning = true;
        const startTime = Date.now();
        const metricsBefore = (0, matchMetrics_1.snapshot)();
        try {
            console.log('[MatchScheduler] Starting safety-net sweep...');
            const profiles = await db_1.prisma.profile.findMany({
                where: { isComplete: true },
                select: { userId: true },
            });
            let embeddingsBackfilled = 0;
            for (const p of profiles) {
                try {
                    const created = await vectorMatchingService_1.vectorMatchingService.ensureEmbedding(p.userId);
                    if (created)
                        embeddingsBackfilled++;
                }
                catch { }
            }
            if (embeddingsBackfilled > 0) {
                console.log(`[MatchScheduler] Backfilled ${embeddingsBackfilled} embeddings`);
            }
            let usersProcessed = 0;
            let totalProposed = 0;
            const errors = [];
            for (const p of profiles) {
                try {
                    const paywall = await razorpayService_1.razorpayService.checkPaywall(p.userId).catch(() => null);
                    if (!paywall)
                        continue;
                    if (paywall.tier === 'FREE' && !paywall.allowed) {
                        continue;
                    }
                    const proposed = await matchingService_1.matchingService.findAndAutoPropose(p.userId, PER_USER_PROPOSE_LIMIT);
                    totalProposed += proposed.length;
                    usersProcessed++;
                    this.lastCheckAt.set(p.userId, Date.now());
                    await db_1.prisma.profile
                        .update({ where: { userId: p.userId }, data: { matchLastCheckedAt: new Date() } })
                        .catch(() => null);
                }
                catch (err) {
                    errors.push(`${p.userId}: ${err?.message || err}`);
                }
            }
            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            const sweepDelta = (0, matchMetrics_1.diffSince)(metricsBefore);
            console.log(`[MatchScheduler] Safety-net complete in ${duration}s: ` +
                `${usersProcessed}/${profiles.length} processed, ` +
                `${totalProposed} matches proposed, ${errors.length} errors, ` +
                `${(0, matchMetrics_1.formatSkipBreakdown)(sweepDelta)}`);
            if (errors.length > 0) {
                console.log(`[MatchScheduler] Errors: ${errors.slice(0, 5).join('; ')}`);
            }
            return { usersProcessed, totalProposed, errors: errors.length, duration: `${duration}s` };
        }
        finally {
            this.safetyRunning = false;
        }
    }
    /** @deprecated kept for backwards-compatibility — runs the safety-net sweep. */
    async runBatchMatching() {
        return this.runSafetyNetSweep();
    }
    async runDripCampaign() {
        console.log('[MatchScheduler] Starting drip campaign processing...');
        const startTime = Date.now();
        try {
            const result = await dripCampaignService_1.dripCampaignService.processDue();
            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`[MatchScheduler] Drip campaign complete in ${duration}s: ` +
                `${result.sent} sent, ${result.skipped} skipped, ${result.failed} failed`);
            return result;
        }
        catch (err) {
            console.error('[MatchScheduler] Drip campaign batch failed:', err);
            throw err;
        }
    }
    async runWeeklyDigest() {
        console.log('[MatchScheduler] Starting weekly digest send...');
        const startTime = Date.now();
        try {
            const { emailService } = await Promise.resolve().then(() => __importStar(require('./email')));
            const result = await emailService.sendDigestToAll();
            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`[MatchScheduler] Weekly digest complete in ${duration}s:`, result);
            return result;
        }
        catch (err) {
            console.error('[MatchScheduler] Weekly digest failed:', err);
            throw err;
        }
    }
    async runInvestorStatsAggregation() {
        console.log('[MatchScheduler] Starting investor stats aggregation...');
        const startTime = Date.now();
        try {
            const { investorStatsService } = await Promise.resolve().then(() => __importStar(require('./investorStatsService')));
            const result = await investorStatsService.runDailyAggregation();
            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`[MatchScheduler] Investor stats aggregation complete in ${duration}s:`, result);
            return result;
        }
        catch (err) {
            console.error('[MatchScheduler] Investor stats aggregation failed:', err);
            throw err;
        }
    }
    async runLinkedinEnrichment() {
        console.log('[MatchScheduler] Starting LinkedIn enrichment batch...');
        const startTime = Date.now();
        try {
            const result = await linkedinEnrichmentService_1.linkedinEnrichmentService.enrichBatch(15);
            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`[MatchScheduler] LinkedIn enrichment complete in ${duration}s: ` +
                `${result.enriched} enriched, ${result.skipped} skipped, ${result.errors} errors`);
            return result;
        }
        catch (err) {
            console.error('[MatchScheduler] LinkedIn enrichment batch failed:', err);
            throw err;
        }
    }
}
exports.matchScheduler = new MatchScheduler();
//# sourceMappingURL=matchScheduler.js.map