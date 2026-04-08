import cron, { ScheduledTask } from 'node-cron';
import { prisma } from '@cleya/db';
import { matchingService } from './matchingService';
import { vectorMatchingService } from './vectorMatchingService';
import { slackService } from './slackService';
import { linkedinEnrichmentService } from './linkedinEnrichmentService';
import { logger } from '../lib/logger';
import { agentMonitor } from '../lib/agentMonitor';
import { PipelineMonitor } from '../lib/pipelineMonitor';

class MatchScheduler {
  private tasks: ScheduledTask[] = [];
  private running = false;
  private started = false;

  start() {
    if (this.started) {
      logger.info('MatchScheduler already started, skipping');
      return;
    }

    const matchJob = cron.schedule('0 8,14,20 * * *', () => {
      this.runBatchMatching().catch(err =>
        logger.error('Batch matching failed', { error: err.message })
      );
    }, { timezone: 'Asia/Kolkata' });

    const dailyReportJob = cron.schedule('0 21 * * *', () => {
      slackService.sendDailyReport().catch(err =>
        logger.error('Daily report failed', { error: err.message })
      );
    }, { timezone: 'Asia/Kolkata' });

    const enrichmentJob = cron.schedule('0 3 * * *', () => {
      this.runLinkedinEnrichment().catch(err =>
        logger.error('LinkedIn enrichment failed', { error: err.message })
      );
    }, { timezone: 'Asia/Kolkata' });

    const selfPingJob = cron.schedule('*/5 * * * *', () => {
      this.runSelfPing().catch(err =>
        logger.error('Self-ping failed', { error: err instanceof Error ? err.message : String(err) })
      );
    });

    const weeklyAnalyticsJob = cron.schedule('0 10 * * 1', () => {
      this.runWeeklyAnalyticsSummary().catch(err =>
        logger.error('Weekly analytics summary failed', { error: err instanceof Error ? err.message : String(err) })
      );
    }, { timezone: 'Asia/Kolkata' });

    const dataCleanupJob = cron.schedule('0 2 * * *', () => {
      this.runOldDataCleanup().catch(err =>
        logger.error('Old data cleanup failed', { error: err instanceof Error ? err.message : String(err) })
      );
    }, { timezone: 'Asia/Kolkata' });

    this.tasks.push(matchJob, dailyReportJob, enrichmentJob, selfPingJob, weeklyAnalyticsJob, dataCleanupJob);
    this.started = true;
    logger.info('MatchScheduler started', {
      jobs: [
        'batch-matching@8:00,14:00,20:00',
        'daily-report@21:00',
        'linkedin-enrichment@3:00',
        'self-ping@every-5min',
        'weekly-analytics@Monday-10:00',
        'data-cleanup@2:00',
      ],
      timezone: 'Asia/Kolkata',
    });
  }

  stop() {
    this.tasks.forEach(t => t.stop());
    this.tasks = [];
    this.started = false;
    logger.info('MatchScheduler stopped');
  }

  isRunning(): boolean {
    return this.started;
  }

  async runBatchMatching() {
    if (this.running) {
      logger.info('Batch matching already in progress, skipping');
      return { usersProcessed: 0, totalProposed: 0, errors: 0, duration: '0s', skipped: true };
    }

    this.running = true;
    const startTime = Date.now();
    const pipeline = new PipelineMonitor('batch-matching', { maxDurationMs: 600000 });
    pipeline.startPipeline();

    try {
      logger.info('Starting batch matching run');

      const profiles = await prisma.profile.findMany({
        where: { isComplete: true },
        select: { userId: true, persona: true },
      });

      logger.info('Found complete profiles for matching', { count: profiles.length });

      pipeline.startStage('embedding-backfill', profiles.length);
      let embeddingsBackfilled = 0;
      for (const profile of profiles) {
        try {
          const created = await vectorMatchingService.ensureEmbedding(profile.userId);
          if (created) embeddingsBackfilled++;
        } catch (err: any) {
          logger.warn('Embedding failed', { userId: profile.userId, error: err.message });
        }
      }
      pipeline.completeStage(embeddingsBackfilled, 0);

      if (embeddingsBackfilled > 0) {
        logger.info('Backfilled embeddings', { count: embeddingsBackfilled });
      }

      pipeline.startStage('auto-propose', profiles.length);
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
      pipeline.completeStage(usersProcessed, errors.length);

      const durationMs = Date.now() - startTime;
      const duration = (durationMs / 1000).toFixed(1);

      await agentMonitor.logRun({
        agentName: 'batch-matching',
        success: errors.length === 0,
        durationMs,
        recordsProcessed: usersProcessed,
        errorMessage: errors.length > 0 ? errors.slice(0, 3).join('; ') : undefined,
      });

      logger.info('Batch matching complete', {
        durationSec: duration,
        usersProcessed,
        totalProfiles: profiles.length,
        totalProposed,
        errorCount: errors.length,
      });

      pipeline.completePipeline();
      return { usersProcessed, totalProposed, errors: errors.length, duration: `${duration}s` };
    } catch (err: any) {
      pipeline.failPipeline(err.message);
      await agentMonitor.logRun({
        agentName: 'batch-matching',
        success: false,
        durationMs: Date.now() - startTime,
        errorMessage: err.message,
      });
      throw err;
    } finally {
      this.running = false;
    }
  }

  async runLinkedinEnrichment() {
    logger.info('Starting LinkedIn enrichment batch');
    const startTime = Date.now();

    try {
      const result = await linkedinEnrichmentService.enrichBatch(15);
      const durationMs = Date.now() - startTime;

      await agentMonitor.logRun({
        agentName: 'linkedin-enrichment',
        success: true,
        durationMs,
        recordsProcessed: result.enriched,
      });

      logger.info('LinkedIn enrichment complete', {
        durationSec: (durationMs / 1000).toFixed(1),
        enriched: result.enriched,
        skipped: result.skipped,
        errors: result.errors,
      });
      return result;
    } catch (err: any) {
      await agentMonitor.logRun({
        agentName: 'linkedin-enrichment',
        success: false,
        durationMs: Date.now() - startTime,
        errorMessage: err.message,
      });
      logger.error('LinkedIn enrichment batch failed', { error: err.message });
      throw err;
    }
  }

  private async runSelfPing() {
    const port = process.env.PORT || 3001;
    const url = `http://localhost:${port}/api/health`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        logger.warn('Self-ping health check returned non-OK', { status: response.status });
      } else {
        const data = await response.json() as { status: string };
        if (data.status !== 'healthy') {
          logger.warn('Self-ping: service degraded', { healthStatus: data.status });
        }
      }
    } catch (err) {
      logger.warn('Self-ping failed', { error: err instanceof Error ? err.message : String(err) });
    }
  }

  private async runWeeklyAnalyticsSummary() {
    logger.info('Generating weekly analytics summary');
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

      logger.info('Weekly analytics summary', {
        newUsers,
        completedProfiles,
        totalMatches,
        acceptedMatches,
        acceptRate,
        totalCalls,
        totalMessages,
      });

      try {
        await slackService.sendDailyReport();
      } catch {
      }

      return { newUsers, completedProfiles, totalMatches, acceptedMatches, acceptRate, totalCalls, totalMessages };
    } catch (err) {
      logger.error('Weekly analytics summary failed', { error: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  }

  private async runOldDataCleanup() {
    logger.info('Starting old data cleanup');
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

      const durationMs = Date.now() - startTime;
      logger.info('Old data cleanup complete', {
        durationSec: (durationMs / 1000).toFixed(1),
        expiredNotifications: expiredNotifications.count,
        oldActivities: oldActivities.count,
      });

      return {
        expiredNotifications: expiredNotifications.count,
        oldActivities: oldActivities.count,
        duration: `${(durationMs / 1000).toFixed(1)}s`,
      };
    } catch (err) {
      logger.error('Old data cleanup failed', { error: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  }
}

export const matchScheduler = new MatchScheduler();
