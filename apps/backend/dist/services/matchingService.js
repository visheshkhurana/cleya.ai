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
        const reason = await this.generateMatchReason(profileA, profileB);
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
            const nameA = userAData.name || userAData.profile?.currentRole || userAData.email.split('@')[0];
            const nameB = userBData.name || userBData.profile?.currentRole || userBData.email.split('@')[0];
            const personaA = userAData.profile?.persona || 'Professional';
            const personaB = userBData.profile?.persona || 'Professional';
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
        const updateData = {};
        if (isUserA) {
            updateData.userAResponse = response;
            updateData.userARespondedAt = new Date();
        }
        else {
            updateData.userBResponse = response;
            updateData.userBRespondedAt = new Date();
        }
        const otherResponse = isUserA ? match.userBResponse : match.userAResponse;
        if (response === 'REJECTED') {
            updateData.status = 'REJECTED';
        }
        else if (otherResponse === 'ACCEPTED') {
            updateData.status = 'ACCEPTED';
        }
        else if (otherResponse === 'REJECTED') {
            updateData.status = 'REJECTED';
        }
        else {
            updateData.status = isUserA ? 'PENDING_B' : 'PENDING_A';
        }
        const updated = await db_1.prisma.match.update({
            where: { id: matchId },
            data: updateData,
        });
        // Either user just became "ready" again — re-enqueue so the continuous
        // loop reconsiders them within the next tick instead of waiting for
        // the periodic revisit window.
        Promise.resolve().then(() => __importStar(require('./matchScheduler'))).then(({ matchScheduler }) => {
            matchScheduler.enqueueUserCheck(updated.userAId);
            matchScheduler.enqueueUserCheck(updated.userBId);
        })
            .catch((e) => console.log('[MatchingService] re-enqueue after response failed:', e));
        if (updated.status === 'ACCEPTED') {
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
                name: userB.name || `${userB.profile?.currentRole} at ${userB.profile?.companyName}`,
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
                name: userA.name || `${userA.profile?.currentRole} at ${userA.profile?.companyName}`,
                email: userA.email,
                linkedin: userA.profile?.linkedinUrl,
                headline: userA.profile?.headline,
                companyName: userA.profile?.companyName,
            },
        });
        const nameA = userA.name || userA.profile?.currentRole || userA.email.split('@')[0];
        const nameB = userB.name || userB.profile?.currentRole || userB.email.split('@')[0];
        const personaA = userA.profile?.persona || 'Professional';
        const personaB = userB.profile?.persona || 'Professional';
        const matchReason = match.reason || '';
        email_1.emailService.sendMatchAccepted(userA.email, nameA, nameB, personaB, userB.email, userB.profile?.linkedinUrl || undefined, {
            headline: userB.profile?.headline || userB.profile?.currentRole || undefined,
            companyName: userB.profile?.companyName || undefined,
            sector: userB.profile?.industries?.[0] || undefined,
            location: userB.profile?.location || undefined,
            traction: userB.profile?.keyTractionPoints || undefined,
            matchReason: matchReason,
            matchUserId: userB.id,
        }).catch(() => { });
        email_1.emailService.sendMatchAccepted(userB.email, nameB, nameA, personaA, userA.email, userA.profile?.linkedinUrl || undefined, {
            headline: userA.profile?.headline || userA.profile?.currentRole || undefined,
            companyName: userA.profile?.companyName || undefined,
            sector: userA.profile?.industries?.[0] || undefined,
            location: userA.profile?.location || undefined,
            traction: userA.profile?.keyTractionPoints || undefined,
            matchReason: matchReason,
            matchUserId: userA.id,
        }).catch(() => { });
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
    async generateMatchReason(a, b) {
        const describeProfile = (p) => {
            const parts = [];
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
            return parts.join('. ');
        };
        const signals = matching_1.matchingEngine.computeCompatibilitySignals(a, b);
        const signalsSummary = this.formatCompatibilitySignals(signals);
        try {
            const response = await this.ai.chat([
                {
                    role: 'system',
                    content: `You are Cleya, an AI superconnector. Write a warm referral — like a mutual friend texting someone about a person they should meet. Start with a phrase like "thought of someone for you" or "okay so i know someone you'd want to meet" or "had to connect you two."

Write 2-3 sentences max. Use casual, lowercase tone. Make it feel personal, not algorithmic.

Rules:
- Reference SPECIFIC details: actual role titles, company names, traction numbers, fund names, check sizes, sectors, and locations.
- Explain the concrete value exchange: what each person gets from the connection (deal flow, fundraising, hiring, domain expertise, market access).
- If traction data exists, mention it ("they're at $X MRR", "growing Y% MoM", "raised $Z").
- Never use generic phrases like "complementary backgrounds", "synergy", "mutual benefit", or "valuable connection".
- Never start with "Both" — lead with the most compelling detail about one person, then bridge to the other.

You have structured compatibility data — weave in specific details (sector overlap, check size fit, traction numbers, shared geography) naturally.`,
                },
                {
                    role: 'user',
                    content: `Person A: ${describeProfile(a)}\n\nPerson B: ${describeProfile(b)}\n\n--- COMPATIBILITY SIGNALS ---\n${signalsSummary}\n\nWrite 2-3 specific, data-backed sentences about why they should connect.`,
                },
            ]);
            return response.content;
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
//# sourceMappingURL=matchingService.js.map