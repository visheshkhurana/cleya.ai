import cron, { ScheduledTask } from 'node-cron';
import { prisma, PersonaType } from '@cleya/db';
import { PERSONA_COMPATIBILITY } from '@cleya/matching';
import { matchingService } from './matchingService';
import { vectorMatchingService } from './vectorMatchingService';
import { slackService } from './slackService';
import { linkedinEnrichmentService } from './linkedinEnrichmentService';
import { dripCampaignService } from './dripCampaignService';
import { FREE_MATCH_LIMIT } from './razorpayService';
import {
  diffSince,
  formatSkipBreakdown,
  recordProposalSkipped,
  snapshot,
  type MatchMetrics,
} from './matchMetrics';

const num = (v: string | undefined, d: number) => {
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : d;
};

const TICK_CRON = process.env.MATCH_TICK_CRON || '*/2 * * * *';
const TICK_CHUNK_SIZE = num(process.env.MATCH_TICK_CHUNK_SIZE, 25);
const REVISIT_INTERVAL_MS = num(process.env.MATCH_REVISIT_HOURS, 6) * 60 * 60 * 1000;
const PER_USER_PROPOSE_LIMIT = num(process.env.MATCH_PER_USER_PROPOSE_LIMIT, 3);
const RECHECK_PEER_LIMIT = num(process.env.MATCH_RECHECK_PEER_LIMIT, 50);

interface TickStats {
  ticks: number;
  usersConsidered: number;
  proposalsCreated: number;
  proposalsBlocked: number;
  errors: number;
  lastTickAt: Date | null;
}

class MatchScheduler {
  private tasks: ScheduledTask[] = [];
  private tickRunning = false;
  private safetyRunning = false;
  private started = false;

  private pendingQueue = new Set<string>();
  private lastCheckAt = new Map<string, number>();
  private stats: TickStats = {
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

    const tickJob = cron.schedule(TICK_CRON, () => {
      this.runTick().catch(err =>
        console.error('[MatchScheduler] Continuous tick failed:', err)
      );
    }, { timezone: 'Asia/Kolkata' });

    const safetyNetJob = cron.schedule('0 4 * * *', () => {
      this.runSafetyNetSweep().catch(err =>
        console.error('[MatchScheduler] Safety-net sweep failed:', err)
      );
    }, { timezone: 'Asia/Kolkata' });

    const dailyReportJob = cron.schedule('0 21 * * *', () => {
      slackService.sendDailyReport().catch(err =>
        console.error('[MatchScheduler] Daily report failed:', err)
      );
    }, { timezone: 'Asia/Kolkata' });

    const enrichmentJob = cron.schedule('0 3 * * *', () => {
      this.runLinkedinEnrichment().catch(err =>
        console.error('[MatchScheduler] LinkedIn enrichment failed:', err)
      );
    }, { timezone: 'Asia/Kolkata' });

    const dripJob = cron.schedule('0 10 * * *', () => {
      this.runDripCampaign().catch(err =>
        console.error('[MatchScheduler] Drip campaign failed:', err)
      );
    }, { timezone: 'Asia/Kolkata' });

    this.tasks.push(tickJob, safetyNetJob, dailyReportJob, enrichmentJob, dripJob);
    this.started = true;
    console.log(`[MatchScheduler] Continuous matchmaking tick scheduled (${TICK_CRON}, chunk=${TICK_CHUNK_SIZE})`);
    console.log('[MatchScheduler] Safety-net sweep scheduled at 4:00 IST');
    console.log('[MatchScheduler] Daily Slack report at 21:00 IST');
    console.log('[MatchScheduler] LinkedIn enrichment at 3:00 IST');
    console.log('[MatchScheduler] Drip campaign at 10:00 IST');
  }

  stop() {
    this.tasks.forEach(t => t.stop());
    this.tasks = [];
    this.started = false;
    console.log('[MatchScheduler] All scheduled tasks stopped');
  }

  enqueueUserCheck(userId: string) {
    this.pendingQueue.add(userId);
    console.log(`[MatchScheduler] Enqueued user ${userId} (queue size=${this.pendingQueue.size})`);
  }

  async enqueueRecheckPeers(userId: string) {
    try {
      const profile = await prisma.profile.findUnique({
        where: { userId },
        select: { persona: true },
      });
      if (!profile?.persona) return;

      const compatible = (Object.entries(PERSONA_COMPATIBILITY[profile.persona] || {}) as [string, number][])
        .filter(([, score]) => score >= 0.7)
        .map(([persona]) => persona)
        .filter((p): p is PersonaType => p in PersonaType);

      if (compatible.length === 0) return;

      const peers = await prisma.profile.findMany({
        where: {
          isComplete: true,
          persona: { in: compatible },
          userId: { not: userId },
        },
        select: { userId: true },
        orderBy: { updatedAt: 'desc' },
        take: RECHECK_PEER_LIMIT,
      });

      for (const p of peers) this.pendingQueue.add(p.userId);
      console.log(`[MatchScheduler] Re-queued ${peers.length} compatible peers for ${userId}`);
    } catch (e) {
      console.log('[MatchScheduler] enqueueRecheckPeers failed:', (e as Error).message);
    }
  }

  getStats(): TickStats & { metrics: MatchMetrics } {
    return { ...this.stats, metrics: snapshot() };
  }

  async runTick() {
    if (this.tickRunning) return;
    this.tickRunning = true;
    const startTime = Date.now();
    const metricsBefore: MatchMetrics = snapshot();
    let considered = 0;
    let errors = 0;

    try {
      const candidates = await this.selectDueUsers(TICK_CHUNK_SIZE);
      if (candidates.length === 0) {
        this.stats.ticks++;
        this.stats.lastTickAt = new Date();
        console.log('[MatchScheduler] tick: idle (no due users)');
        return;
      }

      for (const userId of candidates) {
        considered++;
        this.lastCheckAt.set(userId, Date.now());
        this.pendingQueue.delete(userId);
        await prisma.profile
          .update({ where: { userId }, data: { matchLastCheckedAt: new Date() } })
          .catch(() => null);
        try {
          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { tier: true, matchesUsed: true, bonusMatches: true },
          });
          if (!user) continue;
          if (
            user.tier === 'FREE' &&
            user.matchesUsed >= FREE_MATCH_LIMIT + (user.bonusMatches || 0)
          ) {
            recordProposalSkipped('FREE_LIMIT');
            continue;
          }

          await vectorMatchingService.ensureEmbedding(userId).catch(() => null);

          await matchingService.findAndAutoPropose(userId, PER_USER_PROPOSE_LIMIT);
        } catch (err: any) {
          errors++;
          console.log(`[MatchScheduler] Tick user ${userId} error: ${err?.message || err}`);
        }
      }

      const tickDelta = diffSince(metricsBefore);
      const blockedTotal =
        Object.values(tickDelta.proposalsSkipped).reduce((a, b) => a + b, 0) +
        Object.values(tickDelta.notificationsSkipped).reduce((a, b) => a + b, 0);

      const duration = Date.now() - startTime;
      this.stats.ticks++;
      this.stats.usersConsidered += considered;
      this.stats.proposalsCreated += tickDelta.proposalsCreated;
      this.stats.proposalsBlocked += blockedTotal;
      this.stats.errors += errors;
      this.stats.lastTickAt = new Date();

      console.log(
        `[MatchScheduler] tick: considered=${considered} ` +
          `proposed=${tickDelta.proposalsCreated} notifSent=${tickDelta.notificationsSent} ` +
          `${formatSkipBreakdown(tickDelta)} ` +
          `errors=${errors} queueLeft=${this.pendingQueue.size} duration=${duration}ms`
      );
    } finally {
      this.tickRunning = false;
    }
  }

  private async selectDueUsers(limit: number): Promise<string[]> {
    const result: string[] = [];
    const seen = new Set<string>();

    // 1. Drain explicit queue first
    for (const userId of this.pendingQueue) {
      if (result.length >= limit) break;
      if (seen.has(userId)) continue;
      result.push(userId);
      seen.add(userId);
    }

    if (result.length >= limit) return result;

    // 2. Pull globally least-recently-checked complete profiles. Nulls
    // (never checked) sort first, then oldest matchLastCheckedAt. This
    // guarantees every eligible profile is considered within an SLA
    // bounded by population_size / (chunk_size * tick_frequency).
    const cutoff = new Date(Date.now() - REVISIT_INTERVAL_MS);
    const due = await prisma.profile.findMany({
      where: {
        isComplete: true,
        OR: [
          { matchLastCheckedAt: null },
          { matchLastCheckedAt: { lt: cutoff } },
        ],
      },
      select: { userId: true },
      orderBy: [{ matchLastCheckedAt: { sort: 'asc', nulls: 'first' } }],
      take: limit - result.length,
    });

    for (const p of due) {
      if (result.length >= limit) break;
      if (seen.has(p.userId)) continue;
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
    const metricsBefore = snapshot();

    try {
      console.log('[MatchScheduler] Starting safety-net sweep...');

      const profiles = await prisma.profile.findMany({
        where: { isComplete: true },
        select: { userId: true },
      });

      let embeddingsBackfilled = 0;
      for (const p of profiles) {
        try {
          const created = await vectorMatchingService.ensureEmbedding(p.userId);
          if (created) embeddingsBackfilled++;
        } catch {}
      }
      if (embeddingsBackfilled > 0) {
        console.log(`[MatchScheduler] Backfilled ${embeddingsBackfilled} embeddings`);
      }

      let usersProcessed = 0;
      let totalProposed = 0;
      const errors: string[] = [];

      for (const p of profiles) {
        try {
          const user = await prisma.user.findUnique({
            where: { id: p.userId },
            select: { tier: true, matchesUsed: true, bonusMatches: true },
          });
          if (!user) continue;
          if (
            user.tier === 'FREE' &&
            user.matchesUsed >= FREE_MATCH_LIMIT + (user.bonusMatches || 0)
          ) {
            continue;
          }
          const proposed = await matchingService.findAndAutoPropose(
            p.userId,
            PER_USER_PROPOSE_LIMIT,
          );
          totalProposed += proposed.length;
          usersProcessed++;
          this.lastCheckAt.set(p.userId, Date.now());
          await prisma.profile
            .update({ where: { userId: p.userId }, data: { matchLastCheckedAt: new Date() } })
            .catch(() => null);
        } catch (err: any) {
          errors.push(`${p.userId}: ${err?.message || err}`);
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      const sweepDelta = diffSince(metricsBefore);
      console.log(
        `[MatchScheduler] Safety-net complete in ${duration}s: ` +
          `${usersProcessed}/${profiles.length} processed, ` +
          `${totalProposed} matches proposed, ${errors.length} errors, ` +
          `${formatSkipBreakdown(sweepDelta)}`
      );
      if (errors.length > 0) {
        console.log(`[MatchScheduler] Errors: ${errors.slice(0, 5).join('; ')}`);
      }

      return { usersProcessed, totalProposed, errors: errors.length, duration: `${duration}s` };
    } finally {
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
      const result = await dripCampaignService.processDue();
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(
        `[MatchScheduler] Drip campaign complete in ${duration}s: ` +
          `${result.sent} sent, ${result.skipped} skipped, ${result.failed} failed`
      );
      return result;
    } catch (err) {
      console.error('[MatchScheduler] Drip campaign batch failed:', err);
      throw err;
    }
  }

  async runLinkedinEnrichment() {
    console.log('[MatchScheduler] Starting LinkedIn enrichment batch...');
    const startTime = Date.now();
    try {
      const result = await linkedinEnrichmentService.enrichBatch(15);
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(
        `[MatchScheduler] LinkedIn enrichment complete in ${duration}s: ` +
          `${result.enriched} enriched, ${result.skipped} skipped, ${result.errors} errors`
      );
      return result;
    } catch (err) {
      console.error('[MatchScheduler] LinkedIn enrichment batch failed:', err);
      throw err;
    }
  }
}

export const matchScheduler = new MatchScheduler();
