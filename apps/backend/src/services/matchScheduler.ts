import cron, { ScheduledTask } from 'node-cron';
import { prisma } from '@cleya/db';
import { matchingService } from './matchingService';
import { vectorMatchingService } from './vectorMatchingService';
import { slackService } from './slackService';
import { linkedinEnrichmentService } from './linkedinEnrichmentService';

class MatchScheduler {
  private tasks: ScheduledTask[] = [];
  private running = false;
  private started = false;

  start() {
    if (this.started) {
      console.log('[MatchScheduler] Already started, skipping');
      return;
    }

    const matchJob = cron.schedule('0 8,14,20 * * *', () => {
      this.runBatchMatching().catch(err =>
        console.error('[MatchScheduler] Batch matching failed:', err)
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

    const selfPingJob = cron.schedule('*/5 * * * *', () => {
      this.runSelfPing().catch(err =>
        console.error('[MatchScheduler] Self-ping failed:', err)
      );
    });

    const weeklyAnalyticsJob = cron.schedule('0 10 * * 1', () => {
      this.runWeeklyAnalyticsSummary().catch(err =>
        console.error('[MatchScheduler] Weekly analytics summary failed:', err)
      );
    }, { timezone: 'Asia/Kolkata' });

    const dataCleanupJob = cron.schedule('0 2 * * *', () => {
      this.runOldDataCleanup().catch(err =>
        console.error('[MatchScheduler] Old data cleanup failed:', err)
      );
    }, { timezone: 'Asia/Kolkata' });

    this.tasks.push(matchJob, dailyReportJob, enrichmentJob, selfPingJob, weeklyAnalyticsJob, dataCleanupJob);
    this.started = true;
    console.log('[MatchScheduler] Scheduled batch matching at 8:00, 14:00, 20:00 IST');
    console.log('[MatchScheduler] Scheduled daily Slack report at 21:00 IST');
    console.log('[MatchScheduler] Scheduled LinkedIn enrichment at 3:00 IST');
    console.log('[MatchScheduler] Scheduled self-ping health check every 5 minutes');
    console.log('[MatchScheduler] Scheduled weekly analytics summary Monday 10:00 IST');
    console.log('[MatchScheduler] Scheduled old data cleanup daily at 2:00 AM IST');
  }

  stop() {
    this.tasks.forEach(t => t.stop());
    this.tasks = [];
    this.started = false;
    console.log('[MatchScheduler] All scheduled tasks stopped');
  }

  isRunning(): boolean {
    return this.started;
  }

  async runBatchMatching() {
    if (this.running) {
      console.log('[MatchScheduler] Batch already in progress, skipping');
      return { usersProcessed: 0, totalProposed: 0, errors: 0, duration: '0s', skipped: true };
    }

    this.running = true;
    const startTime = Date.now();

    try {
      console.log('[MatchScheduler] Starting batch matching run...');

      const profiles = await prisma.profile.findMany({
        where: { isComplete: true },
        select: { userId: true, persona: true },
      });

      console.log(`[MatchScheduler] Found ${profiles.length} complete profiles`);

      let embeddingsBackfilled = 0;
      for (const profile of profiles) {
        try {
          const created = await vectorMatchingService.ensureEmbedding(profile.userId);
          if (created) embeddingsBackfilled++;
        } catch (err: any) {
          console.log(`[MatchScheduler] Embedding failed for ${profile.userId}: ${err.message}`);
        }
      }

      if (embeddingsBackfilled > 0) {
        console.log(`[MatchScheduler] Backfilled ${embeddingsBackfilled} embeddings`);
      }

      let totalProposed = 0;
      let usersProcessed = 0;
      const errors: string[] = [];

      for (const profile of profiles) {
        try {
          const proposed = await matchingService.findAndAutoPropose(profile.userId, 3);
          totalProposed += proposed.length;
          usersProcessed++;
        } catch (err: any) {
          errors.push(`${profile.userId}: ${err.message}`);
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(
        `[MatchScheduler] Batch complete in ${duration}s: ` +
        `${usersProcessed}/${profiles.length} users processed, ` +
        `${totalProposed} matches proposed, ` +
        `${errors.length} errors`
      );

      if (errors.length > 0) {
        console.log(`[MatchScheduler] Errors: ${errors.slice(0, 5).join('; ')}`);
      }

      return { usersProcessed, totalProposed, errors: errors.length, duration: `${duration}s` };
    } finally {
      this.running = false;
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

  private async runSelfPing() {
    const port = process.env.PORT || 3001;
    const url = `http://localhost:${port}/api/health`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`[MatchScheduler] Self-ping health check returned ${response.status}`);
      } else {
        const data = await response.json() as { status: string; database: string };
        if (data.status !== 'ok') {
          console.warn(`[MatchScheduler] Self-ping: service degraded — db=${data.database}`);
        }
      }
    } catch (err) {
      console.warn(`[MatchScheduler] Self-ping failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async runWeeklyAnalyticsSummary() {
    console.log('[MatchScheduler] Generating weekly analytics summary...');
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    try {
      const [
        newUsers,
        completedProfiles,
        totalMatches,
        acceptedMatches,
        totalCalls,
        totalMessages,
      ] = await Promise.all([
        prisma.user.count({ where: { createdAt: { gte: weekAgo }, role: 'USER' } }),
        prisma.profile.count({ where: { isComplete: true, updatedAt: { gte: weekAgo } } }),
        prisma.match.count({ where: { createdAt: { gte: weekAgo } } }),
        prisma.match.count({ where: { status: 'ACCEPTED', createdAt: { gte: weekAgo } } }),
        prisma.call.count({ where: { createdAt: { gte: weekAgo } } }),
        prisma.messageRecord.count({ where: { createdAt: { gte: weekAgo } } }),
      ]);

      const acceptRate = totalMatches > 0 ? Math.round((acceptedMatches / totalMatches) * 100) : 0;

      console.log('[MatchScheduler] === Weekly Analytics Summary ===');
      console.log(`  New users:          ${newUsers}`);
      console.log(`  Completed profiles: ${completedProfiles}`);
      console.log(`  Matches proposed:   ${totalMatches}`);
      console.log(`  Matches accepted:   ${acceptedMatches} (${acceptRate}%)`);
      console.log(`  Calls made:         ${totalCalls}`);
      console.log(`  Messages sent:      ${totalMessages}`);
      console.log('[MatchScheduler] === End Summary ===');

      try {
        await slackService.sendDailyReport();
      } catch {
      }

      return { newUsers, completedProfiles, totalMatches, acceptedMatches, acceptRate, totalCalls, totalMessages };
    } catch (err) {
      console.error('[MatchScheduler] Weekly analytics summary failed:', err);
      throw err;
    }
  }

  private async runOldDataCleanup() {
    console.log('[MatchScheduler] Starting old data cleanup...');
    const startTime = Date.now();

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    try {
      const expiredNotifications = await prisma.notification.deleteMany({
        where: {
          readAt: { not: null },
          createdAt: { lt: thirtyDaysAgo },
        },
      });

      const oldActivities = await prisma.activity.deleteMany({
        where: {
          createdAt: { lt: ninetyDaysAgo },
        },
      });

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(
        `[MatchScheduler] Cleanup complete in ${duration}s: ` +
        `${expiredNotifications.count} old notifications, ` +
        `${oldActivities.count} old activity records removed`
      );

      return {
        expiredNotifications: expiredNotifications.count,
        oldActivities: oldActivities.count,
        duration: `${duration}s`,
      };
    } catch (err) {
      console.error('[MatchScheduler] Old data cleanup failed:', err);
      throw err;
    }
  }
}

export const matchScheduler = new MatchScheduler();
