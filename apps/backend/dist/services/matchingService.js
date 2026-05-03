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
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchingService = exports.MatchingService = void 0;
exports.getProfileNudgeTeasers = getProfileNudgeTeasers;
const db_1 = require("@cleya/db");
const matching_1 = require("@cleya/matching");
const ai_1 = require("@cleya/ai");
const errorHandler_1 = require("../middleware/errorHandler");
const server_1 = require("../websocket/server");
const introductionService_1 = require("./introductionService");
const vectorMatchingService_1 = require("./vectorMatchingService");
const email_1 = require("./email");
const secretaryService_1 = require("./secretaryService");
const whatsappTemplates_1 = require("./whatsappTemplates");
const matchAntiSpam_1 = require("./matchAntiSpam");
const matchMetrics_1 = require("./matchMetrics");
const razorpayService_1 = require("./razorpayService");
const displayName_1 = require("../utils/displayName");
class MatchingService {
    ai = (0, ai_1.createAIService)();
    async findMatchesForUser(userId, limit = 10) {
        const results = await vectorMatchingService_1.vectorMatchingService.findMatches(userId, limit);
        return results.map((r) => ({
            profile: r.profile,
            score: {
                total: r.hybridScore,
                ruleScore: r.ruleScore,
                semanticScore: r.vectorSimilarity,
                breakdown: r.breakdown,
            },
        }));
    }
    async findAndAutoPropose(userId, limit = 5) {
        const matches = await this.findMatchesForUser(userId, limit);
        const proposed = [];
        for (const match of matches) {
            try {
                const proposal = await this.proposeMatch(userId, match.profile.userId);
                proposed.push({
                    matchId: proposal.id,
                    userId: match.profile.userId,
                    score: match.score.total,
                    reason: proposal.reason,
                });
            }
            catch (err) {
                if (err.code === 'PROPOSAL_THROTTLED' && err.message?.includes('DAILY_CAP')) {
                    break;
                }
                if (err.code !== 'MATCH_EXISTS' && err.code !== 'PROPOSAL_THROTTLED') {
                    console.log(`[MatchingService] Auto-propose failed for ${match.profile.userId}:`, err.message);
                }
            }
        }
        console.log(`[MatchingService] Auto-proposed ${proposed.length} matches for user ${userId}`);
        return proposed;
    }
    async proposeMatch(userAId, userBId, eventId) {
        const existing = await db_1.prisma.match.findFirst({
            where: {
                OR: [
                    { userAId, userBId },
                    { userAId: userBId, userBId: userAId },
                ],
            },
        });
        if (existing) {
            (0, matchMetrics_1.recordProposalSkipped)('DUPLICATE');
            throw new errorHandler_1.AppError(409, 'Match already exists', 'MATCH_EXISTS');
        }
        // Block proposals between users where either side has blocked the other.
        const blockedPair = await db_1.prisma.blockedUser.findFirst({
            where: {
                OR: [
                    { blockerId: userAId, blockedId: userBId },
                    { blockerId: userBId, blockedId: userAId },
                ],
            },
            select: { id: true },
        });
        if (blockedPair) {
            (0, matchMetrics_1.recordProposalSkipped)('BLOCKED');
            throw new errorHandler_1.AppError(403, 'Proposal blocked: users have blocked each other', 'PROPOSAL_BLOCKED');
        }
        // Enforce FREE tier monthly cap centrally for all proposal paths.
        for (const id of [userAId, userBId]) {
            const paywall = await razorpayService_1.razorpayService.checkPaywall(id);
            if (paywall.tier === 'FREE' && !paywall.allowed) {
                (0, matchMetrics_1.recordProposalSkipped)('FREE_LIMIT');
                throw new errorHandler_1.AppError(429, `User ${id} exceeded monthly free match limit`, 'FREE_LIMIT_EXCEEDED');
            }
        }
        // Apply per-user daily cap + cooldown to ALL non-admin proposal paths
        // (including eventId-driven matches) so anti-spam guarantees hold.
        const guardrail = await (0, matchAntiSpam_1.checkProposalGuardrails)(userAId, userBId);
        if (!guardrail.allowed) {
            (0, matchMetrics_1.recordProposalSkipped)(guardrail.reason);
            console.log(`[MatchingService] Proposal ${userAId}<->${userBId} blocked: ${guardrail.reason} (user=${guardrail.blockingUserId})${eventId ? ` event=${eventId}` : ''}`);
            throw new errorHandler_1.AppError(429, `Proposal throttled: ${guardrail.reason}`, 'PROPOSAL_THROTTLED');
        }
        const profileA = await vectorMatchingService_1.vectorMatchingService.getProfileForMatching(userAId);
        const profileB = await vectorMatchingService_1.vectorMatchingService.getProfileForMatching(userBId);
        if (!profileA || !profileB)
            throw new errorHandler_1.AppError(404, 'Profile not found');
        if (profileA.persona === profileB.persona) {
            (0, matchMetrics_1.recordProposalSkipped)('SAME_PERSONA');
            throw new errorHandler_1.AppError(400, 'Same-persona matches are not allowed', 'SAME_PERSONA');
        }
        const score = matching_1.matchingEngine.score(profileA, profileB);
        console.log(`[MatchingService] Generating AI reasoning for match: ${userAId} <-> ${userBId}`);
        const userPair = await db_1.prisma.user.findMany({
            where: { id: { in: [userAId, userBId] } },
            select: { id: true, name: true },
        });
        const nameById = new Map(userPair.map((u) => [u.id, u.name || '']));
        const reason = await this.generateMatchReason(profileA, profileB, nameById.get(userAId) || '', nameById.get(userBId) || '');
        console.log(`[MatchingService] Generated reasoning (${reason.length} chars): "${reason.substring(0, 80)}..."`);
        const match = await db_1.prisma.match.create({
            data: {
                userAId,
                userBId,
                status: 'PROPOSED',
                score: score.total,
                scoreBreakdown: score.breakdown,
                reason,
                userAResponse: 'PENDING',
                userBResponse: 'PENDING',
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                ...(eventId && { eventId }),
            },
        });
        (0, matchMetrics_1.recordProposalCreated)();
        (0, server_1.sendToUser)(userAId, 'match:proposed', {
            matchId: match.id,
            reason,
            score: score.total,
        });
        (0, server_1.sendToUser)(userBId, 'match:proposed', {
            matchId: match.id,
            reason,
            score: score.total,
        });
        const [userAData, userBData] = await Promise.all([
            db_1.prisma.user.findUnique({ where: { id: userAId }, include: { profile: true } }),
            db_1.prisma.user.findUnique({ where: { id: userBId }, include: { profile: true } }),
        ]);
        if (userAData && userBData) {
            // CRITICAL: never synthesize a "name" from role/company/email — doing so
            // surfaces the same person under different labels and breaks user trust.
            // Candidates without a real name are filtered out at the matching layer
            // (see TEST_EMAIL_DOMAINS / name-not-null guards in @cleya/api matching);
            // this is defense-in-depth in case a no-name user reaches a manual propose.
            const nameA = (0, displayName_1.safeDisplayName)(userAData);
            const nameB = (0, displayName_1.safeDisplayName)(userBData);
            const personaA = userAData.profile?.persona || 'Professional';
            const personaB = userBData.profile?.persona || 'Professional';
            // Note: matchId + recipientUserId let sendMatchProposed render the
            // one-click Accept/Decline buttons that work without login.
            const detailsB = {
                companyName: userBData.profile?.companyName || undefined,
                headline: userBData.profile?.headline || userBData.profile?.currentRole || undefined,
                raiseAmount: userBData.profile?.raiseAmount || undefined,
                sector: userBData.profile?.industries?.[0] || undefined,
                stage: userBData.profile?.companyStage || undefined,
                traction: userBData.profile?.keyTractionPoints || undefined,
                linkedinUrl: userBData.profile?.linkedinUrl || undefined,
                location: userBData.profile?.location || undefined,
                bio: userBData.profile?.bio || undefined,
                matchReason: reason,
                matchId: match.id,
                recipientUserId: userAId,
            };
            const detailsA = {
                companyName: userAData.profile?.companyName || undefined,
                headline: userAData.profile?.headline || userAData.profile?.currentRole || undefined,
                raiseAmount: userAData.profile?.raiseAmount || undefined,
                sector: userAData.profile?.industries?.[0] || undefined,
                stage: userAData.profile?.companyStage || undefined,
                traction: userAData.profile?.keyTractionPoints || undefined,
                linkedinUrl: userAData.profile?.linkedinUrl || undefined,
                location: userAData.profile?.location || undefined,
                bio: userAData.profile?.bio || undefined,
                matchReason: reason,
                matchId: match.id,
                recipientUserId: userBId,
            };
            const dispatch = async (targetUserId, action, channel, body) => {
                const policy = await (0, matchAntiSpam_1.evaluateNotificationPolicy)(targetUserId);
                if (!policy.shouldSend) {
                    if (policy.reason)
                        (0, matchMetrics_1.recordNotificationSkipped)(policy.reason);
                    console.log(`[MatchingService] Skipping ${channel} for ${targetUserId} — ${policy.reason} ` +
                        `(hour=${policy.hour} ${policy.timezone}); proposal still created`);
                    return;
                }
                try {
                    await action();
                    await (0, matchAntiSpam_1.recordMatchNotification)(targetUserId, channel, match.id, body);
                    (0, matchMetrics_1.recordNotificationSent)();
                }
                catch (e) {
                    console.log(`[MatchingService] ${channel} dispatch failed for ${targetUserId}:`, e);
                }
            };
            const emailBodyA = `New match: ${nameB} (${personaB})`;
            const emailBodyB = `New match: ${nameA} (${personaA})`;
            const waBodyA = `Match found with ${nameB}`;
            const waBodyB = `Match found with ${nameA}`;
            // Serialize per-user dispatch to honor the per-user daily notification
            // cap atomically: each channel send re-checks policy AFTER the
            // previous one has recorded its Notification row.
            const dispatchUserChain = async (targetUserId, steps) => {
                for (const s of steps) {
                    await dispatch(targetUserId, s.action, s.channel, s.body).catch((e) => console.log(`[MatchingService] dispatch ${s.channel} for ${targetUserId} unhandled:`, e));
                }
            };
            void dispatchUserChain(userAId, [
                {
                    action: () => email_1.emailService.sendMatchProposed(userAData.email, nameA, nameB, personaB, score.total, detailsB),
                    channel: 'EMAIL',
                    body: emailBodyA,
                },
                {
                    action: () => whatsappTemplates_1.whatsappTemplates.triggerMatchFound(userAId, userBId, score.total),
                    channel: 'WHATSAPP',
                    body: waBodyA,
                },
            ]);
            void dispatchUserChain(userBId, [
                {
                    action: () => email_1.emailService.sendMatchProposed(userBData.email, nameB, nameA, personaA, score.total, detailsA),
                    channel: 'EMAIL',
                    body: emailBodyB,
                },
                {
                    action: () => whatsappTemplates_1.whatsappTemplates.triggerMatchFound(userBId, userAId, score.total),
                    channel: 'WHATSAPP',
                    body: waBodyB,
                },
            ]);
            // Schedule the 72h non-response feedback nudge for both sides. The
            // shouldSkip() check inside the drip processor will short-circuit
            // for whichever user has already responded by then.
            try {
                const { dripCampaignService } = await Promise.resolve().then(() => __importStar(require('./dripCampaignService')));
                dripCampaignService.enrollNonResponseFeedback(userAId, match.id).catch((e) => console.error('[matchingService] non-response enroll A failed:', e?.message || e));
                dripCampaignService.enrollNonResponseFeedback(userBId, match.id).catch((e) => console.error('[matchingService] non-response enroll B failed:', e?.message || e));
            }
            catch (e) {
                console.error('[matchingService] enrollNonResponseFeedback import failed:', e.message);
            }
        }
        return match;
    }
    async respondToMatch(matchId, userId, response) {
        const match = await db_1.prisma.match.findUnique({ where: { id: matchId } });
        if (!match)
            throw new errorHandler_1.AppError(404, 'Match not found');
        const isUserA = match.userAId === userId;
        const isUserB = match.userBId === userId;
        if (!isUserA && !isUserB) {
            throw new errorHandler_1.AppError(403, 'Not part of this match');
        }
        // RACE-SAFE response recording, done in two atomic steps inside a
        // single transaction so:
        //   (a) two concurrent calls for the SAME user can't both succeed —
        //       updateMany scoped to userXResponse:'PENDING' is the guard.
        //   (b) two concurrent calls for DIFFERENT users (e.g. both parties
        //       accept simultaneously) can't leave a stale PENDING_X status.
        //       We recompute status from the post-update row, not from the
        //       pre-read snapshot.
        const responseFieldUpdate = {};
        if (isUserA) {
            responseFieldUpdate.userAResponse = response;
            responseFieldUpdate.userARespondedAt = new Date();
        }
        else {
            responseFieldUpdate.userBResponse = response;
            responseFieldUpdate.userBRespondedAt = new Date();
        }
        const guardWhere = { id: matchId };
        if (isUserA)
            guardWhere.userAResponse = 'PENDING';
        else
            guardWhere.userBResponse = 'PENDING';
        const { updateResult, updated, justAccepted } = await db_1.prisma.$transaction(async (tx) => {
            const r = await tx.match.updateMany({
                where: guardWhere,
                data: responseFieldUpdate,
            });
            // If the conditional update affected zero rows the caller is a
            // duplicate — return current state, skip the status recompute.
            if (r.count === 0) {
                const cur = await tx.match.findUniqueOrThrow({ where: { id: matchId } });
                return { updateResult: r, updated: cur, justAccepted: false };
            }
            // Re-read the post-update row INSIDE the transaction so we observe
            // the other user's response if it landed concurrently. Recompute
            // status from this fresh state — never from the pre-read snapshot.
            const fresh = await tx.match.findUniqueOrThrow({ where: { id: matchId } });
            const aResp = fresh.userAResponse;
            const bResp = fresh.userBResponse;
            let nextStatus;
            if (aResp === 'REJECTED' || bResp === 'REJECTED') {
                nextStatus = 'REJECTED';
            }
            else if (aResp === 'ACCEPTED' && bResp === 'ACCEPTED') {
                nextStatus = 'ACCEPTED';
            }
            else if (aResp === 'ACCEPTED') {
                nextStatus = 'PENDING_B';
            }
            else if (bResp === 'ACCEPTED') {
                nextStatus = 'PENDING_A';
            }
            else {
                nextStatus = fresh.status;
            }
            // Use a CONDITIONAL update on status so exactly one transaction can
            // win the PENDING_*/REJECTED/whatever -> ACCEPTED transition. This
            // is what we use to gate side-effects: `justAccepted` is true only
            // for the single tx whose status flip succeeded.
            let postRow = fresh;
            let didFlipToAccepted = false;
            if (nextStatus !== fresh.status) {
                const flip = await tx.match.updateMany({
                    where: { id: matchId, status: fresh.status },
                    data: { status: nextStatus },
                });
                postRow = await tx.match.findUniqueOrThrow({ where: { id: matchId } });
                didFlipToAccepted = flip.count > 0 && nextStatus === 'ACCEPTED';
            }
            return { updateResult: r, updated: postRow, justAccepted: didFlipToAccepted };
        });
        if (updateResult.count === 0) {
            console.log(`[MatchingService] respondToMatch noop (already responded) match=${matchId} user=${userId}`);
            return updated;
        }
        // Either user just became "ready" again — re-enqueue so the continuous
        // loop reconsiders them within the next tick instead of waiting for
        // the periodic revisit window.
        Promise.resolve().then(() => __importStar(require('./matchScheduler'))).then(({ matchScheduler }) => {
            matchScheduler.enqueueUserCheck(updated.userAId);
            matchScheduler.enqueueUserCheck(updated.userBId);
        })
            .catch((e) => console.log('[MatchingService] re-enqueue after response failed:', e));
        // Idempotency guard: side-effects (joint email, WhatsApp, deal progression,
        // drip enrollment) fire only for the SINGLE transaction that actually
        // flipped status to ACCEPTED. The conditional status update inside the
        // transaction above is what guarantees this — `justAccepted` here comes
        // straight from that DB-level guard, not from a stale pre-read snapshot.
        if (justAccepted) {
            await this.revealContacts(updated);
            introductionService_1.introductionService.sendIntroduction(matchId).catch((e) => console.log('[MatchingService] Intro send failed:', e));
            this.progressDealOnAcceptance(updated.userAId, updated.userBId).catch((e) => console.log('[MatchingService] Deal progression failed:', e));
            (0, secretaryService_1.onMatchAccepted)(matchId, updated.userAId, updated.userBId).catch((e) => console.log('[MatchingService] Secretary match notification failed:', e));
            whatsappTemplates_1.whatsappTemplates.triggerMatchAccepted(updated.userAId, updated.userBId).catch((e) => console.log('[MatchingService] WhatsApp match accepted (A) failed:', e));
            whatsappTemplates_1.whatsappTemplates.triggerMatchAccepted(updated.userBId, updated.userAId).catch((e) => console.log('[MatchingService] WhatsApp match accepted (B) failed:', e));
            this.scheduleFeedbackPrompt(matchId, updated.userAId, updated.userBId).catch((e) => console.log('[MatchingService] Feedback prompt scheduling failed:', e));
            Promise.resolve().then(() => __importStar(require('./dripCampaignService'))).then(({ dripCampaignService }) => {
                dripCampaignService.enrollMatchFollowUp(updated.userAId, matchId).catch((e) => console.log('[MatchingService] Drip match follow-up enrollment (A) failed:', e));
                dripCampaignService.enrollMatchFollowUp(updated.userBId, matchId).catch((e) => console.log('[MatchingService] Drip match follow-up enrollment (B) failed:', e));
                dripCampaignService.enrollFeedbackRequest(updated.userAId, matchId).catch((e) => console.log('[MatchingService] Drip feedback request enrollment (A) failed:', e));
                dripCampaignService.enrollFeedbackRequest(updated.userBId, matchId).catch((e) => console.log('[MatchingService] Drip feedback request enrollment (B) failed:', e));
            });
        }
        return updated;
    }
    async revealContacts(match) {
        const [userA, userB] = await Promise.all([
            db_1.prisma.user.findUnique({
                where: { id: match.userAId },
                include: { profile: true },
            }),
            db_1.prisma.user.findUnique({
                where: { id: match.userBId },
                include: { profile: true },
            }),
        ]);
        if (!userA || !userB)
            return;
        (0, server_1.sendToUser)(match.userAId, 'match:accepted', {
            matchId: match.id,
            partnerId: userB.id,
            contact: {
                name: (0, displayName_1.safeDisplayName)(userB),
                email: userB.email,
                linkedin: userB.profile?.linkedinUrl,
                headline: userB.profile?.headline,
                companyName: userB.profile?.companyName,
            },
        });
        (0, server_1.sendToUser)(match.userBId, 'match:accepted', {
            matchId: match.id,
            partnerId: userA.id,
            contact: {
                name: (0, displayName_1.safeDisplayName)(userA),
                email: userA.email,
                linkedin: userA.profile?.linkedinUrl,
                headline: userA.profile?.headline,
                companyName: userA.profile?.companyName,
            },
        });
        const nameA = (0, displayName_1.safeDisplayName)(userA);
        const nameB = (0, displayName_1.safeDisplayName)(userB);
        const personaA = userA.profile?.persona || 'Professional';
        const personaB = userB.profile?.persona || 'Professional';
        const matchReason = match.reason || '';
        // CRITICAL: send ONE joint introduction email with both parties on the
        // To: line (joint-intro style). This is what makes the network feel like a
        // real warm introduction instead of two strangers each receiving a
        // private notification. Reply-To is set to both addresses so a Reply
        // goes straight to the OTHER person — no bouncing off hello@cleya.ai.
        //
        // We try to pick up any pre-generated talking points from the
        // IntroductionRecord (created by introductionService.generateIntroduction
        // which fires in parallel). If they aren't ready yet we still send
        // immediately — talking points are a nice-to-have, the joint thread is
        // the must-have.
        let talkingPoints;
        try {
            const introRec = await db_1.prisma.introductionRecord.findUnique({
                where: { matchId: match.id },
                select: { talkingPoints: true },
            });
            if (Array.isArray(introRec?.talkingPoints)) {
                talkingPoints = introRec.talkingPoints.filter((x) => typeof x === 'string');
            }
        }
        catch { }
        email_1.emailService
            .sendMatchIntroJoint({
            emailA: userA.email,
            nameA,
            emailB: userB.email,
            nameB,
            personaA,
            personaB,
            headlineA: userA.profile?.headline || userA.profile?.currentRole || undefined,
            headlineB: userB.profile?.headline || userB.profile?.currentRole || undefined,
            companyA: userA.profile?.companyName || undefined,
            companyB: userB.profile?.companyName || undefined,
            sectorA: userA.profile?.industries?.[0] || undefined,
            sectorB: userB.profile?.industries?.[0] || undefined,
            locationA: userA.profile?.location || undefined,
            locationB: userB.profile?.location || undefined,
            tractionA: userA.profile?.keyTractionPoints || undefined,
            tractionB: userB.profile?.keyTractionPoints || undefined,
            linkedinA: userA.profile?.linkedinUrl || undefined,
            linkedinB: userB.profile?.linkedinUrl || undefined,
            matchReason,
            talkingPoints,
        })
            .catch((e) => console.log('[MatchingService] Joint intro email failed:', e));
        const welcomeContent = `Hey! Cleya just connected us — excited to chat with you! 👋`;
        try {
            await db_1.prisma.directMessage.create({
                data: {
                    senderId: match.userAId,
                    recipientId: match.userBId,
                    matchId: match.id,
                    content: welcomeContent,
                },
            });
        }
        catch (e) {
            console.log('[MatchingService] Auto-welcome DM failed:', e);
        }
    }
    async getMatchesForUser(userId) {
        const profileSelect = {
            persona: true,
            headline: true,
            companyName: true,
            currentRole: true,
            location: true,
            industries: true,
            skills: true,
            linkedinUrl: true,
            bio: true,
            avatarUrl: true,
            verificationScore: true,
            companyStage: true,
            fundName: true,
            raiseAmount: true,
            investmentRange: true,
            keyTractionPoints: true,
            yearsExperience: true,
            businessDescription: true,
            investmentThesis: true,
        };
        const matches = await db_1.prisma.match.findMany({
            where: {
                OR: [{ userAId: userId }, { userBId: userId }],
            },
            include: {
                userA: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        profile: { select: profileSelect },
                    },
                },
                userB: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        profile: { select: profileSelect },
                    },
                },
            },
            orderBy: { score: 'desc' },
        });
        return matches.map((m) => {
            const isAccepted = m.status === 'ACCEPTED';
            const isUserA = m.userAId === userId;
            const other = isUserA ? m.userB : m.userA;
            if (!isAccepted && other?.profile) {
                other.email = undefined;
                if (other.profile) {
                    other.profile.linkedinUrl = undefined;
                }
            }
            return m;
        });
    }
    async markMatchViewed(matchId, userId) {
        const match = await db_1.prisma.match.findUnique({ where: { id: matchId } });
        if (!match)
            throw new errorHandler_1.AppError(404, 'Match not found');
        const isUserA = match.userAId === userId;
        const isUserB = match.userBId === userId;
        if (!isUserA && !isUserB)
            throw new errorHandler_1.AppError(403, 'Not part of this match');
        if (isUserA && !match.userAViewedAt) {
            return db_1.prisma.match.update({ where: { id: matchId }, data: { userAViewedAt: new Date() } });
        }
        if (isUserB && !match.userBViewedAt) {
            return db_1.prisma.match.update({ where: { id: matchId }, data: { userBViewedAt: new Date() } });
        }
        return match;
    }
    async getMatchStats(userId) {
        const [total, pending, accepted] = await Promise.all([
            db_1.prisma.match.count({
                where: { OR: [{ userAId: userId }, { userBId: userId }] },
            }),
            db_1.prisma.match.count({
                where: {
                    OR: [
                        { userAId: userId, status: { in: ['PROPOSED', 'PENDING_A'] } },
                        { userBId: userId, status: { in: ['PROPOSED', 'PENDING_B'] } },
                    ],
                },
            }),
            db_1.prisma.match.count({
                where: {
                    OR: [{ userAId: userId }, { userBId: userId }],
                    status: 'ACCEPTED',
                },
            }),
        ]);
        return { total, pending, accepted };
    }
    async scheduleFeedbackPrompt(matchId, userAId, userBId) {
        const FEEDBACK_DELAY_MS = 24 * 60 * 60 * 1000;
        setTimeout(async () => {
            try {
                const existingFeedbackA = await db_1.prisma.matchFeedback.findUnique({
                    where: { matchId_userId: { matchId, userId: userAId } },
                });
                if (!existingFeedbackA) {
                    (0, server_1.sendToUser)(userAId, 'match:feedback_prompt', {
                        matchId,
                        prompt: 'Was this match useful? Your feedback helps us find better matches for you.',
                    });
                }
                const existingFeedbackB = await db_1.prisma.matchFeedback.findUnique({
                    where: { matchId_userId: { matchId, userId: userBId } },
                });
                if (!existingFeedbackB) {
                    (0, server_1.sendToUser)(userBId, 'match:feedback_prompt', {
                        matchId,
                        prompt: 'Was this match useful? Your feedback helps us find better matches for you.',
                    });
                }
            }
            catch (e) {
                console.log('[MatchingService] Feedback prompt delivery failed:', e);
            }
        }, FEEDBACK_DELAY_MS);
    }
    async progressDealOnAcceptance(userAId, userBId) {
        const [profileA, profileB] = await Promise.all([
            db_1.prisma.profile.findUnique({ where: { userId: userAId }, select: { persona: true } }),
            db_1.prisma.profile.findUnique({ where: { userId: userBId }, select: { persona: true } }),
        ]);
        let dealPartnerId = null;
        let founderId = null;
        if (profileA?.persona === 'DEAL_PARTNER' && profileB?.persona === 'FOUNDER') {
            dealPartnerId = userAId;
            founderId = userBId;
        }
        else if (profileB?.persona === 'DEAL_PARTNER' && profileA?.persona === 'FOUNDER') {
            dealPartnerId = userBId;
            founderId = userAId;
        }
        if (!dealPartnerId || !founderId)
            return;
        const deal = await db_1.prisma.dealTracking.findUnique({
            where: { dealPartnerId_founderId: { dealPartnerId, founderId } },
        });
        if (deal && deal.status === 'OPEN') {
            await db_1.prisma.dealTracking.update({
                where: { id: deal.id },
                data: { status: 'INTRO_MADE', introSent: true, introSentAt: new Date(), introDate: new Date() },
            });
            console.log(`[DealFlow] Deal ${deal.id} progressed OPEN → INTRO_MADE on match acceptance`);
        }
    }
    async autoScoutFounders(dealPartnerId, limit = 5) {
        const matches = await this.findMatchesForUser(dealPartnerId, limit);
        const scouted = [];
        for (const match of matches) {
            const founderProfile = await db_1.prisma.profile.findUnique({
                where: { userId: match.profile.userId },
                select: { persona: true, industries: true, companyStage: true },
            });
            if (founderProfile?.persona !== 'FOUNDER')
                continue;
            try {
                const deal = await db_1.prisma.dealTracking.create({
                    data: {
                        dealPartnerId,
                        founderId: match.profile.userId,
                        industry: founderProfile.industries?.[0] || null,
                        stage: founderProfile.companyStage || null,
                        notes: `Auto-scouted via matching engine (score: ${(match.score.total * 100).toFixed(0)}%)`,
                    },
                    include: {
                        founder: { select: { id: true, email: true, profile: { select: { headline: true, persona: true, companyName: true } } } },
                    },
                });
                scouted.push(deal);
                try {
                    await this.proposeMatch(dealPartnerId, match.profile.userId);
                }
                catch (err) {
                    if (err.code !== 'MATCH_EXISTS') {
                        console.log(`[DealFlow] Match propose failed for ${match.profile.userId}:`, err.message);
                    }
                }
            }
            catch (err) {
                if (err.code === 'P2002') {
                    console.log(`[DealFlow] Deal already tracked for founder ${match.profile.userId}`);
                }
                else {
                    console.log(`[DealFlow] Failed to create deal for ${match.profile.userId}:`, err.message);
                }
            }
        }
        console.log(`[DealFlow] Auto-scouted ${scouted.length} founders for deal partner ${dealPartnerId}`);
        return scouted;
    }
    async findEventMatches(eventId, userId, limit = 5) {
        const participants = await db_1.prisma.eventParticipant.findMany({
            where: {
                eventId,
                userId: { not: userId },
                status: { in: ['REGISTERED', 'CONFIRMED', 'ATTENDED'] },
            },
            select: { userId: true },
        });
        if (participants.length === 0)
            return [];
        const participantIds = participants.map(p => p.userId);
        const allMatches = await this.findMatchesForUser(userId, 50);
        const eventMatches = allMatches
            .filter(m => participantIds.includes(m.profile.userId))
            .slice(0, limit);
        return eventMatches;
    }
    async matchEventParticipants(eventId, limit = 3) {
        const event = await db_1.prisma.event.findUnique({
            where: { id: eventId },
            include: {
                participants: {
                    where: { status: { in: ['REGISTERED', 'CONFIRMED', 'ATTENDED'] } },
                    select: { userId: true },
                },
            },
        });
        if (!event)
            throw new errorHandler_1.AppError(404, 'Event not found');
        const results = [];
        for (const participant of event.participants) {
            const eventMatches = await this.findEventMatches(eventId, participant.userId, limit);
            let proposed = 0;
            for (const match of eventMatches) {
                try {
                    await this.proposeMatch(participant.userId, match.profile.userId, eventId);
                    proposed++;
                }
                catch (err) {
                    if (err.code !== 'MATCH_EXISTS') {
                        console.log(`[EventMatch] Propose failed for ${match.profile.userId}:`, err.message);
                    }
                }
            }
            results.push({ userId: participant.userId, matchesProposed: proposed });
        }
        console.log(`[EventMatch] Matched ${results.length} participants for event ${eventId}`);
        return results;
    }
    async generateMatchReason(a, b, rawNameA = '', rawNameB = '') {
        // Defense against the LLM hallucinating other people's names from bio/business text:
        // we sanitize the inputs and then validate the output. If the model invents a name
        // that isn't one of the two people we're connecting, we fall back to the deterministic
        // template instead of shipping a confusing email.
        const nameA = (rawNameA || '').trim();
        const nameB = (rawNameB || '').trim();
        const firstA = nameA.split(/\s+/)[0] || '';
        const firstB = nameB.split(/\s+/)[0] || '';
        const allowedNameTokens = new Set([nameA, nameB, firstA, firstB]
            .filter(Boolean)
            .flatMap((n) => n.split(/\s+/))
            .map((t) => t.toLowerCase()));
        const describeProfile = (p, label, displayName) => {
            const parts = [];
            parts.push(`Refer to this person ONLY as "${displayName}" (or first name). Do not introduce any other personal name from the text below.`);
            parts.push(`Persona: ${p.persona}`);
            if (p.headline)
                parts.push(`Role: ${p.headline}`);
            if (p.companyName)
                parts.push(`Company: ${p.companyName}`);
            if (p.fundName)
                parts.push(`Fund: ${p.fundName}`);
            if (p.industries.length)
                parts.push(`Industries: ${p.industries.join(', ')}`);
            if (p.skills?.length)
                parts.push(`Skills: ${p.skills.join(', ')}`);
            if (p.lookingFor.length)
                parts.push(`Looking for: ${p.lookingFor.join(', ')}`);
            if (p.companyStage)
                parts.push(`Stage: ${p.companyStage}`);
            if (p.bio)
                parts.push(`Bio: ${p.bio.slice(0, 150)}`);
            if (p.businessDescription)
                parts.push(`Business: ${p.businessDescription.slice(0, 150)}`);
            if (p.investmentThesis)
                parts.push(`Thesis: ${p.investmentThesis.slice(0, 150)}`);
            if (p.raiseAmount)
                parts.push(`Raising: ${p.raiseAmount}`);
            if (p.investmentRange)
                parts.push(`Invests: ${p.investmentRange}`);
            if (p.location)
                parts.push(`Location: ${p.location}`);
            if (p.keyTractionPoints)
                parts.push(`Traction: ${p.keyTractionPoints.slice(0, 150)}`);
            if (p.enrichedData?.domainExpertise?.length)
                parts.push(`Domain expertise: ${p.enrichedData.domainExpertise.join(', ')}`);
            if (p.enrichedData?.notableCompanies?.length)
                parts.push(`Notable companies: ${p.enrichedData.notableCompanies.join(', ')}`);
            if (p.enrichedData?.exits?.length)
                parts.push(`Exits: ${p.enrichedData.exits.join(', ')}`);
            return `[${label}]\n${parts.join('. ')}`;
        };
        const signals = matching_1.matchingEngine.computeCompatibilitySignals(a, b);
        const signalsSummary = this.formatCompatibilitySignals(signals);
        try {
            const response = await this.ai.chat([
                {
                    role: 'system',
                    content: `You are Cleya, an AI superconnector. Write a warm referral — like a mutual friend texting someone about a person they should meet. Start with a phrase like "Thought of someone for you" or "Had to connect you two" or "Okay, so I know someone you'd want to meet".

Write 2-3 sentences max. Casual but proper-cased English (sentences capitalized, names always Title Case, proper nouns capitalized). Make it feel personal and psychological, not algorithmic. Lead with the human angle (the bet they're making, what they're chasing, where they have unusual leverage) — then bridge to the concrete value exchange.

NAME RULES (critical):
- The ONLY people you are allowed to name in this message are: "${nameA}" and "${nameB}".
- If the bio, business description, or any field contains a different person's name, IGNORE it. Never use any other personal name. Use "they", "she", or "he" instead.
- Use first names ("${firstA}", "${firstB}") for warmth, ALWAYS Title Case (e.g. "Vikramaditya", never "vikramaditya").

BANNED filler words (never use these — they are generic and unconvincing):
- "super driven", "passionate", "ambitious", "go-getter", "rockstar", "ninja", "10x", "hustler", "dynamic", "results-oriented".
- "complementary", "synergy", "mutual benefit", "valuable connection", "great fit" (without specifics), "perfect match".

Content rules:
- Lead with one CONCRETE specific about ${firstB || 'this person'}: a stage ("post-Series-A"), a sector ("vertical SaaS for D2C"), a number ("₹4Cr ARR in 18 months"), a notable company ("ex-Razorpay growth"), or a clear bet ("convinced India needs a real X"). Not adjectives.
- Then bridge to why ${firstA || 'the recipient'} specifically should care: the concrete value exchange (deal flow, capital, hiring, domain expertise, market access, intros).
- If traction, raise size, or check-size data exists, weave one in — don't list stats.
- Never start with "Both" — lead with one person, then bridge to the other.`,
                },
                {
                    role: 'user',
                    content: `${describeProfile(a, 'PERSON A — recipient', nameA || 'them')}\n\n${describeProfile(b, 'PERSON B — the match being introduced', nameB || 'them')}\n\n--- COMPATIBILITY SIGNALS ---\n${signalsSummary}\n\nWrite 2-3 sentences. Lead with the human/psychological angle on ${firstB || 'PERSON B'}, then explain why ${firstA || 'PERSON A'} should want to meet them.`,
                },
            ]);
            const reason = (response.content || '').trim();
            // Validate: reject any output that introduces a personal name not in the allowed set.
            // Heuristic: scan for capitalized first-name-like tokens that aren't in our whitelist
            // and aren't common acronyms / company words. If we find one, fall back.
            if (!this.matchReasonNamesAreSafe(reason, allowedNameTokens, a, b)) {
                console.warn(`[MatchingService] Match reason mentioned an unexpected name; using deterministic fallback. text="${reason.slice(0, 200)}"`);
                throw new Error('NAME_LEAK');
            }
            return reason;
        }
        catch (err) {
            console.log(`[MatchingService] AI reasoning failed, using profile-based fallback:`, err);
            const aRole = a.headline || a.persona;
            const bRole = b.headline || b.persona;
            const aCompany = a.fundName || a.companyName || '';
            const bCompany = b.fundName || b.companyName || '';
            const aLoc = a.location || '';
            const bLoc = b.location || '';
            const shared = a.industries.filter(i => b.industries.includes(i));
            const aLabel = aCompany ? `${aRole} at ${aCompany}` : aRole;
            const bLabel = bCompany ? `${bRole} at ${bCompany}` : bRole;
            if (a.persona === 'FOUNDER' && (b.persona === 'INVESTOR' || b.persona === 'VENTURE_PARTNER')) {
                const stage = a.companyStage ? ` (${a.companyStage.replace(/_/g, ' ')})` : '';
                const sector = shared.length > 0 ? ` in ${shared[0].replace(/_/g, ' ')}` : '';
                const tractionNote = signals.tractionHighlights.length > 0 ? ` — ${signals.tractionHighlights[0]}` : '';
                return `thought of someone for you — ${aLabel}${stage} is building${sector}${tractionNote}. ${bLoc && aLoc ? `they're based in ${aLoc} and could be a great fit for your portfolio.` : `worth a conversation for your deal flow.`}`;
            }
            if (b.persona === 'FOUNDER' && (a.persona === 'INVESTOR' || a.persona === 'VENTURE_PARTNER')) {
                const stage = b.companyStage ? ` (${b.companyStage.replace(/_/g, ' ')})` : '';
                const sector = shared.length > 0 ? ` in ${shared[0].replace(/_/g, ' ')}` : '';
                const tractionNote = signals.tractionHighlights.length > 0 ? ` — ${signals.tractionHighlights[0]}` : '';
                return `thought of someone for you — ${bLabel}${stage} is building${sector}${tractionNote}. ${aLoc && bLoc ? `they're based in ${bLoc}, right in your wheelhouse.` : `could be a strong fit for what you're looking for.`}`;
            }
            if (shared.length > 0) {
                return `had to connect you two — ${aLabel} and ${bLabel} are both deep in ${shared.slice(0, 2).join(' and ').replace(/_/g, ' ')}. ${a.lookingFor.length > 0 ? `${aRole} is specifically looking for ${a.lookingFor[0].replace(/_/g, ' ')}.` : 'there\'s a lot to talk about here.'}`;
            }
            return `okay so i know someone you'd want to meet — ${aLabel} from ${(a.industries[0] || 'tech').replace(/_/g, ' ')} and ${bLabel} from ${(b.industries[0] || 'tech').replace(/_/g, ' ')} could spark something interesting together.`;
        }
    }
    // Common words that look like names but aren't — these are safe to appear capitalized.
    static SAFE_CAPITALIZED_TOKENS = new Set([
        'AI', 'ML', 'API', 'B2B', 'B2C', 'D2C', 'SaaS', 'CEO', 'CTO', 'CFO', 'COO', 'VP',
        'India', 'Bangalore', 'Bengaluru', 'Mumbai', 'Delhi', 'Hyderabad', 'Pune', 'Chennai',
        'Kolkata', 'NCR', 'US', 'USA', 'UK', 'EU', 'Series', 'Seed', 'Pre-Seed',
        'LinkedIn', 'Twitter', 'YC', 'Y', 'Combinator', 'Cleya',
        'I', 'They', 'He', 'She', 'We', 'You', 'It', 'This', 'That', 'There', 'Their',
        'Founder', 'Investor', 'Operator', 'Talent', 'Partner', 'Angel',
        'Hi', 'Hey', 'Hello', 'Thanks', 'Thank',
        'M', 'K', 'L', 'Cr', 'Lakh', 'Lakhs', 'Crore', 'Crores', 'INR', 'USD',
        'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun',
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ]);
    matchReasonNamesAreSafe(text, allowed, a, b) {
        if (!text)
            return true;
        // Whitelist: anything from each profile's structured text fields (company, fund, role,
        // skills, industries, etc.) is fair game and shouldn't trigger a name-leak alarm.
        const profileTokens = new Set();
        const collect = (s) => {
            if (!s)
                return;
            for (const token of s.split(/[\s,.:;()/\\\-—_]+/)) {
                const t = token.trim();
                if (t.length > 1)
                    profileTokens.add(t.toLowerCase());
            }
        };
        for (const p of [a, b]) {
            collect(p.companyName);
            collect(p.fundName);
            collect(p.headline);
            collect(p.location);
            collect(p.bio);
            collect(p.businessDescription);
            collect(p.investmentThesis);
            collect(p.keyTractionPoints);
            collect(p.raiseAmount);
            collect(p.investmentRange);
            (p.industries || []).forEach(collect);
            (p.skills || []).forEach(collect);
            (p.lookingFor || []).forEach(collect);
            (p.enrichedData?.domainExpertise || []).forEach(collect);
            (p.enrichedData?.notableCompanies || []).forEach(collect);
        }
        // Find capitalized word sequences that look like personal names (e.g. "Aditi", "Akash Gupta").
        // We only flag tokens that:
        //   - start with a capital letter and are followed by lowercase letters (looks like a first name),
        //   - are not in the SAFE_CAPITALIZED_TOKENS list,
        //   - are not in the allowed name token set,
        //   - and don't appear in any structured profile field.
        const candidateNameRe = /\b([A-Z][a-z]{2,})\b/g;
        let m;
        while ((m = candidateNameRe.exec(text)) !== null) {
            const token = m[1];
            const lower = token.toLowerCase();
            if (allowed.has(lower))
                continue;
            if (MatchingService.SAFE_CAPITALIZED_TOKENS.has(token))
                continue;
            if (profileTokens.has(lower))
                continue;
            // This looks like a personal name we can't account for — reject.
            return false;
        }
        return true;
    }
    formatCompatibilitySignals(signals) {
        const lines = [];
        lines.push(`Sector overlap: ${signals.sectorOverlapPct}%`);
        lines.push(`Stage fit: ${signals.stageFit ? 'yes' : 'no'}`);
        lines.push(`Check size fits raise amount: ${signals.checkSizeAligned ? 'yes' : 'no/unknown'}`);
        lines.push(`Skill complementarity: ${Math.round(signals.skillComplementarity * 100)}%`);
        if (signals.tractionHighlights.length > 0) {
            lines.push(`Traction highlights: ${signals.tractionHighlights.join('; ')}`);
        }
        if (signals.conflictFlags.length > 0) {
            lines.push(`Conflict flags: ${signals.conflictFlags.join('; ')}`);
        }
        return lines.join('\n');
    }
}
exports.MatchingService = MatchingService;
exports.matchingService = new MatchingService();
/**
 * Build 2-3 anonymized teaser strings to embed in profile-nudge emails.
 * The goal is to show the new user that real, relevant people are already
 * here without leaking PII before both sides have opted into the intro.
 *
 * Strategy:
 *   1. Read the user's persona (default OTHER if missing)
 *   2. Pull the persona row from PERSONA_COMPATIBILITY and pick the
 *      personas they'd most plausibly meet (compat >= 0.6)
 *   3. Sample up to 6 verified, complete profiles in those personas
 *   4. Compose anonymized headlines like
 *      "Series-A SaaS founder, Bangalore" — never any name, email or
 *      company
 */
async function getProfileNudgeTeasers(userId, count = 3) {
    try {
        const { PERSONA_COMPATIBILITY: PC } = await Promise.resolve().then(() => __importStar(require('@cleya/matching')));
        const me = await db_1.prisma.user.findUnique({
            where: { id: userId },
            select: { profile: { select: { persona: true } } },
        });
        const persona = me?.profile?.persona || 'OTHER';
        const compatRow = PC[persona] || {};
        const wantedPersonas = Object.entries(compatRow)
            .filter(([, score]) => score >= 0.6)
            .map(([p]) => p);
        if (wantedPersonas.length === 0)
            wantedPersonas.push('FOUNDER', 'INVESTOR', 'OPERATOR');
        const candidates = await db_1.prisma.profile.findMany({
            where: {
                // wantedPersonas is computed from the PERSONA_COMPATIBILITY map which
                // is keyed by PersonaType values, so the cast here is safe.
                persona: { in: wantedPersonas },
                isComplete: true,
                userId: { not: userId },
                user: { isActive: true, emailVerified: true },
            },
            select: {
                persona: true,
                currentRole: true,
                companyStage: true,
                industries: true,
                location: true,
                investorType: true,
            },
            take: count * 4,
            orderBy: { updatedAt: 'desc' },
        });
        const teasers = [];
        const seen = new Set();
        for (const c of candidates) {
            const stage = c.companyStage || c.investorType || '';
            const industry = (c.industries && c.industries[0]) || '';
            const role = c.currentRole || personaToReadable(c.persona ?? 'OTHER');
            const loc = c.location || '';
            const parts = [stage, industry, role].filter(Boolean).join(' ').trim();
            const teaser = loc ? `${parts}, ${loc}` : parts;
            const key = teaser.toLowerCase();
            if (teaser && !seen.has(key)) {
                seen.add(key);
                teasers.push(teaser);
            }
            if (teasers.length >= count)
                break;
        }
        return teasers;
    }
    catch (e) {
        console.warn('[getProfileNudgeTeasers] failed:', e.message);
        return [];
    }
}
function personaToReadable(p) {
    switch (p) {
        case 'FOUNDER': return 'founder';
        case 'INVESTOR': return 'investor';
        case 'VENTURE_PARTNER': return 'venture partner';
        case 'TALENT': return 'operator';
        case 'JOB_SEEKER': return 'job seeker';
        case 'FREELANCER': return 'freelancer';
        case 'OPERATOR': return 'operator';
        case 'DEAL_PARTNER': return 'deal partner';
        default: return 'professional';
    }
}
//# sourceMappingURL=matchingService.js.map