import { prisma } from '@cleya/db';
import { emailService } from './email';

type SequenceDefinition = {
  emailKey: string;
  delayDays: number;
  sequence: 'ONBOARDING' | 'MATCH_FOLLOWUP' | 'FEEDBACK_REQUEST';
};

const ONBOARDING_SEQUENCE: SequenceDefinition[] = [
  { emailKey: 'profile_nudge', delayDays: 1, sequence: 'ONBOARDING' },
  { emailKey: 'how_matching_works', delayDays: 3, sequence: 'ONBOARDING' },
  { emailKey: 'match_check_in', delayDays: 7, sequence: 'ONBOARDING' },
];

const MATCH_FOLLOWUP_SEQUENCE: SequenceDefinition[] = [
  { emailKey: 'post_intro_followup', delayDays: 3, sequence: 'MATCH_FOLLOWUP' },
];

const FEEDBACK_REQUEST_SEQUENCE: SequenceDefinition[] = [
  { emailKey: 'feedback_request', delayDays: 5, sequence: 'FEEDBACK_REQUEST' },
];

class DripCampaignService {
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

    if (drip.emailKey.startsWith('post_intro_followup_') || drip.emailKey.startsWith('feedback_request_')) {
      if (drip.matchId) {
        const feedback = await prisma.matchFeedback.findUnique({
          where: { matchId_userId: { matchId: drip.matchId, userId: user.id } },
        });
        if (feedback) return true;
      }
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

    if (drip.emailKey === 'profile_nudge') {
      return emailService.sendProfileNudge(email, name);
    }

    if (drip.emailKey === 'how_matching_works') {
      return emailService.sendHowMatchingWorks(email, name);
    }

    if (drip.emailKey === 'match_check_in') {
      return emailService.sendMatchCheckIn(email, name);
    }

    if (drip.emailKey.startsWith('post_intro_followup_') && drip.matchId) {
      const matchName = await this.getOtherUserName(drip.matchId, user.id);
      return emailService.sendPostIntroFollowUp(email, name, matchName);
    }

    if (drip.emailKey.startsWith('feedback_request_') && drip.matchId) {
      const matchName = await this.getOtherUserName(drip.matchId, user.id);
      return emailService.sendFeedbackRequest(email, name, matchName);
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
