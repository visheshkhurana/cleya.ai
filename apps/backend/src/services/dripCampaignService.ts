import { prisma } from '@cleya/db';
import { emailService } from './email';
import { getProfileNudgeTeasers } from './matchingService';
import { recordEmailSent } from './notificationMirror';

type SequenceDefinition = {
  emailKey: string;
  delayDays: number;
  sequence: 'ONBOARDING' | 'MATCH_FOLLOWUP' | 'FEEDBACK_REQUEST';
};

const ONBOARDING_SEQUENCE: SequenceDefinition[] = [
  { emailKey: 'profile_nudge', delayDays: 1, sequence: 'ONBOARDING' },
  // Day-2 partial-onboarding rescue: skipped automatically if the user
  // completes their profile in the meantime. Different copy + intent
  // from the day-1 profile_nudge — this one assumes they already saw
  // the first nudge and still drifted off.
  { emailKey: 'partial_onboarding_2d', delayDays: 2, sequence: 'ONBOARDING' },
  { emailKey: 'how_matching_works', delayDays: 3, sequence: 'ONBOARDING' },
  { emailKey: 'match_check_in', delayDays: 7, sequence: 'ONBOARDING' },
  // Day-10 social-proof pull. Skipped if the user has logged in since
  // signup OR if there are no new candidates we could surface.
  { emailKey: 'new_founders_10d', delayDays: 10, sequence: 'ONBOARDING' },
  // Dormant comeback: 30d after signup, send a magic-login email
  // (no password required) — the cheapest possible path back to active.
  // shouldSkip() will fast-path this if the user has logged in since.
  { emailKey: 'dormant_magic_30d', delayDays: 30, sequence: 'ONBOARDING' },
];

const MATCH_FOLLOWUP_SEQUENCE: SequenceDefinition[] = [
  { emailKey: 'post_intro_followup', delayDays: 3, sequence: 'MATCH_FOLLOWUP' },
];

const FEEDBACK_REQUEST_SEQUENCE: SequenceDefinition[] = [
  { emailKey: 'feedback_request', delayDays: 5, sequence: 'FEEDBACK_REQUEST' },
];

// Non-response feedback: 72h after a match is proposed, if the recipient
// hasn't accepted or declined, ask "why didn't this land?" with 4 quick-
// tap reasons. Re-uses the FEEDBACK_REQUEST sequence bucket so we don't
// need a schema migration; the emailKey prefix is what disambiguates.
const NON_RESPONSE_DELAY_HOURS = 72;

class DripCampaignService {
  /**
   * Backfill: enroll all existing users (created within the last `lookbackDays`)
   * who have *no* drip rows yet. Anchors the schedule on the user's
   * `createdAt` so a user who signed up 5 days ago will have profile_nudge
   * sent immediately on the next drip tick.
   *
   * Idempotent thanks to the unique (userId, sequence, emailKey) constraint.
   * Run this once at boot to recover the cohort that pre-dated drip enrollment.
   */
  async backfillOnboarding(lookbackDays = 60): Promise<{ enrolled: number; skipped: number; rowsCreated: number }> {
    const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
    const candidates = await prisma.user.findMany({
      where: { createdAt: { gte: since }, isActive: true },
      select: { id: true, createdAt: true },
    });
    if (candidates.length === 0) {
      console.log(`[DripCampaign] Backfill: 0 candidates`);
      return { enrolled: 0, skipped: 0, rowsCreated: 0 };
    }

    // Bulk-fetch existing onboarding rows in one query, group by userId.
    const existingRows = await prisma.dripEmail.findMany({
      where: { sequence: 'ONBOARDING', userId: { in: candidates.map(c => c.id) } },
      select: { userId: true, emailKey: true },
    });
    const existingByUser = new Map<string, Set<string>>();
    for (const r of existingRows) {
      let set = existingByUser.get(r.userId);
      if (!set) { set = new Set(); existingByUser.set(r.userId, set); }
      set.add(r.emailKey);
    }

    const toCreate: Array<{ userId: string; sequence: 'ONBOARDING'; emailKey: string; scheduledFor: Date }> = [];
    let enrolled = 0;
    let skipped = 0;
    for (const u of candidates) {
      const existingKeys = existingByUser.get(u.id);
      let added = 0;
      for (const step of ONBOARDING_SEQUENCE) {
        if (existingKeys?.has(step.emailKey)) continue;
        toCreate.push({
          userId: u.id,
          sequence: 'ONBOARDING',
          emailKey: step.emailKey,
          scheduledFor: new Date(u.createdAt.getTime() + step.delayDays * 24 * 60 * 60 * 1000),
        });
        added++;
      }
      if (added > 0) enrolled++; else skipped++;
    }

    let rowsCreated = 0;
    if (toCreate.length > 0) {
      const result = await prisma.dripEmail.createMany({
        data: toCreate,
        skipDuplicates: true,
      });
      rowsCreated = result.count;
    }

    console.log(`[DripCampaign] Backfill complete — ${enrolled} users newly enrolled (${rowsCreated} rows), ${skipped} fully enrolled already`);
    return { enrolled, skipped, rowsCreated };
  }

  async enrollOnboarding(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;

    const now = new Date();

    for (const step of ONBOARDING_SEQUENCE) {
      const scheduledFor = new Date(now.getTime() + step.delayDays * 24 * 60 * 60 * 1000);
      try {
        await prisma.dripEmail.create({
          data: {
            userId,
            sequence: step.sequence,
            emailKey: step.emailKey,
            scheduledFor,
          },
        });
      } catch (err: any) {
        if (err.code === 'P2002') {
          console.log(`[DripCampaign] ${step.emailKey} already scheduled for user ${userId}`);
        } else {
          throw err;
        }
      }
    }

    console.log(`[DripCampaign] Enrolled user ${userId} in onboarding sequence`);
  }

  async enrollMatchFollowUp(userId: string, matchId: string) {
    const now = new Date();

    for (const step of MATCH_FOLLOWUP_SEQUENCE) {
      const scheduledFor = new Date(now.getTime() + step.delayDays * 24 * 60 * 60 * 1000);
      try {
        await prisma.dripEmail.create({
          data: {
            userId,
            sequence: step.sequence,
            emailKey: `${step.emailKey}_${matchId}`,
            scheduledFor,
            matchId,
          },
        });
      } catch (err: any) {
        if (err.code === 'P2002') {
          console.log(`[DripCampaign] Match follow-up already scheduled for user ${userId}, match ${matchId}`);
        } else {
          throw err;
        }
      }
    }

    console.log(`[DripCampaign] Enrolled user ${userId} in match follow-up for match ${matchId}`);
  }

  /**
   * Schedule a one-shot non-response feedback email 72h after a match is
   * proposed. Idempotent per (userId, matchId) thanks to the unique
   * (userId, sequence, emailKey) constraint plus our matchId-suffixed key.
   * The shouldSkip() check will short-circuit if the user has since
   * responded or already left feedback.
   */
  async enrollNonResponseFeedback(userId: string, matchId: string) {
    const scheduledFor = new Date(Date.now() + NON_RESPONSE_DELAY_HOURS * 60 * 60 * 1000);
    try {
      await prisma.dripEmail.create({
        data: {
          userId,
          sequence: 'FEEDBACK_REQUEST',
          emailKey: `non_response_feedback_${matchId}`,
          scheduledFor,
          matchId,
        },
      });
      console.log(`[DripCampaign] Scheduled 72h non-response feedback for user ${userId}, match ${matchId}`);
    } catch (err: any) {
      if (err.code === 'P2002') {
        // Already scheduled — no-op.
      } else {
        console.error(`[DripCampaign] enrollNonResponseFeedback failed for user ${userId}:`, err?.message || err);
      }
    }
  }

  async enrollFeedbackRequest(userId: string, matchId: string) {
    const now = new Date();

    for (const step of FEEDBACK_REQUEST_SEQUENCE) {
      const scheduledFor = new Date(now.getTime() + step.delayDays * 24 * 60 * 60 * 1000);
      try {
        await prisma.dripEmail.create({
          data: {
            userId,
            sequence: step.sequence,
            emailKey: `${step.emailKey}_${matchId}`,
            scheduledFor,
            matchId,
          },
        });
      } catch (err: any) {
        if (err.code === 'P2002') {
          console.log(`[DripCampaign] Feedback request already scheduled for user ${userId}, match ${matchId}`);
        } else {
          throw err;
        }
      }
    }

    console.log(`[DripCampaign] Enrolled user ${userId} in feedback request for match ${matchId}`);
  }

  async processDue(): Promise<{ sent: number; skipped: number; failed: number }> {
    const BATCH_SIZE = 100;
    const MAX_RETRIES = 3;
    let sent = 0;
    let skipped = 0;
    let failed = 0;
    let processed = 0;

    while (true) {
      const now = new Date();

      const claimedIds: { id: string }[] = await prisma.$queryRaw`
        UPDATE "drip_emails"
        SET "status" = 'SENT', "updatedAt" = NOW()
        WHERE "id" IN (
          SELECT "id" FROM "drip_emails"
          WHERE "status" = 'PENDING' AND "scheduledFor" <= ${now}
          ORDER BY "scheduledFor" ASC
          LIMIT ${BATCH_SIZE}
          FOR UPDATE SKIP LOCKED
        )
        RETURNING "id"
      `;

      if (claimedIds.length === 0) break;

      const ids = claimedIds.map(r => r.id);
      const dueEmails = await prisma.dripEmail.findMany({
        where: { id: { in: ids } },
        include: {
          user: {
            include: { profile: true },
          },
        },
        orderBy: { scheduledFor: 'asc' },
      });

      for (const drip of dueEmails) {
        try {
          const shouldSkip = await this.shouldSkip(drip);
          if (shouldSkip) {
            await prisma.dripEmail.update({
              where: { id: drip.id },
              data: { status: 'SKIPPED' },
            });
            skipped++;
            continue;
          }

          let success = false;
          for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            success = await this.sendDripEmail(drip);
            if (success) break;
            if (attempt < MAX_RETRIES) {
              await new Promise(r => setTimeout(r, 1000 * attempt));
            }
          }

          if (success) {
            await prisma.dripEmail.update({
              where: { id: drip.id },
              data: { status: 'SENT', sentAt: new Date() },
            });
            sent++;
          } else {
            await prisma.dripEmail.update({
              where: { id: drip.id },
              data: { status: 'FAILED' },
            });
            failed++;
          }
        } catch (err) {
          console.error(`[DripCampaign] Error processing drip ${drip.id}:`, err);
          await prisma.dripEmail.update({
            where: { id: drip.id },
            data: { status: 'FAILED' },
          });
          failed++;
        }
      }

      processed += dueEmails.length;
      if (claimedIds.length < BATCH_SIZE) break;
    }

    console.log(`[DripCampaign] Processed ${processed} emails: ${sent} sent, ${skipped} skipped, ${failed} failed`);
    return { sent, skipped, failed };
  }

  private async shouldSkip(drip: any): Promise<boolean> {
    const user = drip.user;
    const profile = user.profile;

    if (!user.isActive) return true;

    if (drip.emailKey === 'profile_nudge') {
      return profile?.isComplete === true;
    }

    if (drip.emailKey === 'how_matching_works') {
      return profile?.isComplete === true && await this.hasMatches(user.id);
    }

    if (drip.emailKey === 'partial_onboarding_2d') {
      // Pure profile-completion check. If they finished it after the
      // day-1 profile_nudge, we have nothing to nudge them about.
      return profile?.isComplete === true;
    }

    if (drip.emailKey === 'new_founders_10d') {
      // Skip if the user has already logged in since signing up
      // (re-engaged on their own — leave them alone for now).
      const recentLogin = await prisma.securityLog.findFirst({
        where: { userId: user.id, action: 'LOGIN_SUCCESS', timestamp: { gte: user.createdAt } },
        select: { id: true },
      });
      if (recentLogin) return true;
      // Skip if there's nothing fresh to actually show them — the
      // email's whole pitch is "new people joined", so silently dropping
      // it when there *aren't* any beats sending a hollow nudge.
      const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const newJoiners = await prisma.user.count({
        where: { createdAt: { gte: since }, isActive: true, NOT: { id: user.id } },
      });
      return newJoiners === 0;
    }

    if (drip.emailKey === 'dormant_magic_30d') {
      // Skip if the user has logged in any time after they signed up
      // (i.e. they're not actually dormant). Anchor on user.createdAt
      // rather than drip.createdAt — for backfilled rows the drip
      // record was inserted at boot time, so using drip.createdAt would
      // ignore every legitimate prior login and false-positive everyone.
      const recentLogin = await prisma.securityLog.findFirst({
        where: {
          userId: user.id,
          action: 'LOGIN_SUCCESS',
          timestamp: { gte: user.createdAt },
        },
        select: { id: true },
      });
      return !!recentLogin;
    }

    if (drip.emailKey.startsWith('post_intro_followup_') || drip.emailKey.startsWith('feedback_request_')) {
      if (drip.matchId) {
        const feedback = await prisma.matchFeedback.findUnique({
          where: { matchId_userId: { matchId: drip.matchId, userId: user.id } },
        });
        if (feedback) return true;
      }
    }

    if (drip.emailKey.startsWith('non_response_feedback_')) {
      if (!drip.matchId) return true;
      // Skip if this user has already responded or already left feedback
      // for the match — the whole point of this nudge is to surface
      // *unanswered* introductions.
      const [feedback, match] = await Promise.all([
        prisma.matchFeedback.findUnique({
          where: { matchId_userId: { matchId: drip.matchId, userId: user.id } },
        }),
        prisma.match.findUnique({ where: { id: drip.matchId } }),
      ]);
      if (feedback) return true;
      if (!match) return true;
      const myResponse = match.userAId === user.id ? match.userAResponse : match.userBResponse;
      if (myResponse !== 'PENDING') return true;
    }

    return false;
  }

  private async hasMatches(userId: string): Promise<boolean> {
    const count = await prisma.match.count({
      where: {
        OR: [{ userAId: userId }, { userBId: userId }],
      },
    });
    return count > 0;
  }

  private async sendDripEmail(drip: any): Promise<boolean> {
    const user = drip.user;
    const email = user.email;
    const name = user.name || user.profile?.currentRole;

    const mirror = (subject: string) =>
      recordEmailSent({ userId: user.id, emailKey: drip.emailKey, subject, metadata: { matchId: drip.matchId ?? undefined } }).catch(() => {});

    if (drip.emailKey === 'profile_nudge') {
      const teasers = await getProfileNudgeTeasers(user.id, 3).catch(() => []);
      const ok = await emailService.sendProfileNudge(email, name, teasers);
      if (ok) mirror(`${(name?.split(' ')[0]) || 'You'} — finish setting up Cleya`);
      return ok;
    }

    if (drip.emailKey === 'how_matching_works') {
      const ok = await emailService.sendHowMatchingWorks(email, name);
      if (ok) mirror('How your AI Networker works');
      return ok;
    }

    if (drip.emailKey === 'match_check_in') {
      const ok = await emailService.sendMatchCheckIn(email, name);
      if (ok) mirror('Your introductions are waiting');
      return ok;
    }

    if (drip.emailKey === 'partial_onboarding_2d') {
      const ok = await emailService.sendPartialOnboardingNudge(user.id, email, name);
      if (ok) mirror('Two questions away from your first introductions');
      return ok;
    }

    if (drip.emailKey === 'new_founders_10d') {
      const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const joinedCount = await prisma.user.count({
        where: { createdAt: { gte: since }, isActive: true, NOT: { id: user.id } },
      });
      const ok = await emailService.sendNewFoundersNudge(user.id, email, name, joinedCount);
      if (ok) mirror('New people in your network worth a look');
      return ok;
    }

    if (drip.emailKey === 'dormant_magic_30d') {
      const ok = await emailService.sendDormantMagicLink(user.id, email, name);
      if (ok) mirror('Your network grew while you were away');
      return ok;
    }

    if (drip.emailKey.startsWith('post_intro_followup_') && drip.matchId) {
      const matchName = await this.getOtherUserName(drip.matchId, user.id);
      return emailService.sendPostIntroFollowUp(email, name, matchName);
    }

    if (drip.emailKey.startsWith('feedback_request_') && drip.matchId) {
      const matchName = await this.getOtherUserName(drip.matchId, user.id);
      return emailService.sendFeedbackRequest(email, name, matchName);
    }

    if (drip.emailKey.startsWith('non_response_feedback_') && drip.matchId) {
      const partnerName = await this.getOtherUserName(drip.matchId, user.id);
      if (!partnerName) return false;
      return emailService.sendNonResponseFeedback({
        to: email,
        recipientName: name || 'there',
        partnerName,
        matchId: drip.matchId,
        recipientUserId: user.id,
      });
    }

    console.warn(`[DripCampaign] Unknown email key: ${drip.emailKey}`);
    return false;
  }

  private async getOtherUserName(matchId: string, userId: string): Promise<string | undefined> {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        userA: { select: { name: true, profile: { select: { currentRole: true } } } },
        userB: { select: { name: true, profile: { select: { currentRole: true } } } },
      },
    });

    if (!match) return undefined;

    const other = match.userAId === userId ? match.userB : match.userA;
    return other.name || other.profile?.currentRole || undefined;
  }
}

export const dripCampaignService = new DripCampaignService();
