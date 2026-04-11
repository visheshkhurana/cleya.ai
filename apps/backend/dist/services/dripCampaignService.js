"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dripCampaignService = void 0;
const db_1 = require("@cleya/db");
const email_1 = require("./email");
const ONBOARDING_SEQUENCE = [
    { emailKey: 'profile_nudge', delayDays: 1, sequence: 'ONBOARDING' },
    { emailKey: 'how_matching_works', delayDays: 3, sequence: 'ONBOARDING' },
    { emailKey: 'match_check_in', delayDays: 7, sequence: 'ONBOARDING' },
];
const MATCH_FOLLOWUP_SEQUENCE = [
    { emailKey: 'post_intro_followup', delayDays: 3, sequence: 'MATCH_FOLLOWUP' },
];
const FEEDBACK_REQUEST_SEQUENCE = [
    { emailKey: 'feedback_request', delayDays: 5, sequence: 'FEEDBACK_REQUEST' },
];
class DripCampaignService {
    async enrollOnboarding(userId) {
        const user = await db_1.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            return;
        const now = new Date();
        for (const step of ONBOARDING_SEQUENCE) {
            const scheduledFor = new Date(now.getTime() + step.delayDays * 24 * 60 * 60 * 1000);
            try {
                await db_1.prisma.dripEmail.create({
                    data: {
                        userId,
                        sequence: step.sequence,
                        emailKey: step.emailKey,
                        scheduledFor,
                    },
                });
            }
            catch (err) {
                if (err.code === 'P2002') {
                    console.log(`[DripCampaign] ${step.emailKey} already scheduled for user ${userId}`);
                }
                else {
                    throw err;
                }
            }
        }
        console.log(`[DripCampaign] Enrolled user ${userId} in onboarding sequence`);
    }
    async enrollMatchFollowUp(userId, matchId) {
        const now = new Date();
        for (const step of MATCH_FOLLOWUP_SEQUENCE) {
            const scheduledFor = new Date(now.getTime() + step.delayDays * 24 * 60 * 60 * 1000);
            try {
                await db_1.prisma.dripEmail.create({
                    data: {
                        userId,
                        sequence: step.sequence,
                        emailKey: `${step.emailKey}_${matchId}`,
                        scheduledFor,
                        matchId,
                    },
                });
            }
            catch (err) {
                if (err.code === 'P2002') {
                    console.log(`[DripCampaign] Match follow-up already scheduled for user ${userId}, match ${matchId}`);
                }
                else {
                    throw err;
                }
            }
        }
        console.log(`[DripCampaign] Enrolled user ${userId} in match follow-up for match ${matchId}`);
    }
    async enrollFeedbackRequest(userId, matchId) {
        const now = new Date();
        for (const step of FEEDBACK_REQUEST_SEQUENCE) {
            const scheduledFor = new Date(now.getTime() + step.delayDays * 24 * 60 * 60 * 1000);
            try {
                await db_1.prisma.dripEmail.create({
                    data: {
                        userId,
                        sequence: step.sequence,
                        emailKey: `${step.emailKey}_${matchId}`,
                        scheduledFor,
                        matchId,
                    },
                });
            }
            catch (err) {
                if (err.code === 'P2002') {
                    console.log(`[DripCampaign] Feedback request already scheduled for user ${userId}, match ${matchId}`);
                }
                else {
                    throw err;
                }
            }
        }
        console.log(`[DripCampaign] Enrolled user ${userId} in feedback request for match ${matchId}`);
    }
    async processDue() {
        const BATCH_SIZE = 100;
        const MAX_RETRIES = 3;
        let sent = 0;
        let skipped = 0;
        let failed = 0;
        let processed = 0;
        while (true) {
            const now = new Date();
            const claimedIds = await db_1.prisma.$queryRaw `
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
            if (claimedIds.length === 0)
                break;
            const ids = claimedIds.map(r => r.id);
            const dueEmails = await db_1.prisma.dripEmail.findMany({
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
                        await db_1.prisma.dripEmail.update({
                            where: { id: drip.id },
                            data: { status: 'SKIPPED' },
                        });
                        skipped++;
                        continue;
                    }
                    let success = false;
                    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                        success = await this.sendDripEmail(drip);
                        if (success)
                            break;
                        if (attempt < MAX_RETRIES) {
                            await new Promise(r => setTimeout(r, 1000 * attempt));
                        }
                    }
                    if (success) {
                        await db_1.prisma.dripEmail.update({
                            where: { id: drip.id },
                            data: { status: 'SENT', sentAt: new Date() },
                        });
                        sent++;
                    }
                    else {
                        await db_1.prisma.dripEmail.update({
                            where: { id: drip.id },
                            data: { status: 'FAILED' },
                        });
                        failed++;
                    }
                }
                catch (err) {
                    console.error(`[DripCampaign] Error processing drip ${drip.id}:`, err);
                    await db_1.prisma.dripEmail.update({
                        where: { id: drip.id },
                        data: { status: 'FAILED' },
                    });
                    failed++;
                }
            }
            processed += dueEmails.length;
            if (claimedIds.length < BATCH_SIZE)
                break;
        }
        console.log(`[DripCampaign] Processed ${processed} emails: ${sent} sent, ${skipped} skipped, ${failed} failed`);
        return { sent, skipped, failed };
    }
    async shouldSkip(drip) {
        const user = drip.user;
        const profile = user.profile;
        if (!user.isActive)
            return true;
        if (drip.emailKey === 'profile_nudge') {
            return profile?.isComplete === true;
        }
        if (drip.emailKey === 'how_matching_works') {
            return profile?.isComplete === true && await this.hasMatches(user.id);
        }
        if (drip.emailKey.startsWith('post_intro_followup_') || drip.emailKey.startsWith('feedback_request_')) {
            if (drip.matchId) {
                const feedback = await db_1.prisma.matchFeedback.findUnique({
                    where: { matchId_userId: { matchId: drip.matchId, userId: user.id } },
                });
                if (feedback)
                    return true;
            }
        }
        return false;
    }
    async hasMatches(userId) {
        const count = await db_1.prisma.match.count({
            where: {
                OR: [{ userAId: userId }, { userBId: userId }],
            },
        });
        return count > 0;
    }
    async sendDripEmail(drip) {
        const user = drip.user;
        const email = user.email;
        const name = user.name || user.profile?.currentRole;
        if (drip.emailKey === 'profile_nudge') {
            return email_1.emailService.sendProfileNudge(email, name);
        }
        if (drip.emailKey === 'how_matching_works') {
            return email_1.emailService.sendHowMatchingWorks(email, name);
        }
        if (drip.emailKey === 'match_check_in') {
            return email_1.emailService.sendMatchCheckIn(email, name);
        }
        if (drip.emailKey.startsWith('post_intro_followup_') && drip.matchId) {
            const matchName = await this.getOtherUserName(drip.matchId, user.id);
            return email_1.emailService.sendPostIntroFollowUp(email, name, matchName);
        }
        if (drip.emailKey.startsWith('feedback_request_') && drip.matchId) {
            const matchName = await this.getOtherUserName(drip.matchId, user.id);
            return email_1.emailService.sendFeedbackRequest(email, name, matchName);
        }
        console.warn(`[DripCampaign] Unknown email key: ${drip.emailKey}`);
        return false;
    }
    async getOtherUserName(matchId, userId) {
        const match = await db_1.prisma.match.findUnique({
            where: { id: matchId },
            include: {
                userA: { select: { name: true, profile: { select: { currentRole: true } } } },
                userB: { select: { name: true, profile: { select: { currentRole: true } } } },
            },
        });
        if (!match)
            return undefined;
        const other = match.userAId === userId ? match.userB : match.userA;
        return other.name || other.profile?.currentRole || undefined;
    }
}
exports.dripCampaignService = new DripCampaignService();
//# sourceMappingURL=dripCampaignService.js.map