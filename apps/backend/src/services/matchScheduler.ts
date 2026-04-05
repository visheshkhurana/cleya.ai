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

    this.tasks.push(matchJob, dailyReportJob, enrichmentJob);
    this.started = true;
    console.log('[MatchScheduler] Scheduled batch matching at 8:00, 14:00, 20:00 IST');
    console.log('[MatchScheduler] Scheduled daily Slack report at 21:00 IST');
    console.log('[MatchScheduler] Scheduled LinkedIn enrichment at 3:00 IST');
  }

  stop() {
    this.tasks.forEach(t => t.stop());
    this.tasks = [];
    this.started = false;
    console.log('[MatchScheduler] All scheduled tasks stopped');
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
}

export const matchScheduler = new MatchScheduler();
