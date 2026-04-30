"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const matchingService_1 = require("../services/matchingService");
const vectorMatchingService_1 = require("../services/vectorMatchingService");
const db_1 = require("@cleya/db");
const rateLimit_1 = require("../middleware/rateLimit");
const validation_1 = require("../middleware/validation");
const razorpayService_1 = require("../services/razorpayService");
const matchExplanationService_1 = require("../services/matchExplanationService");
exports.matchRouter = (0, express_1.Router)();
exports.matchRouter.get('/:id/explanation', auth_1.authenticate, async (req, res, next) => {
    try {
        const explanation = await matchExplanationService_1.matchExplanationService.getForUser(req.params.id, req.user.userId);
        if (!explanation) {
            return res.status(404).json({ success: false, error: { message: 'Match not found' } });
        }
        res.json({ success: true, data: explanation });
    }
    catch (error) {
        next(error);
    }
});
exports.matchRouter.post('/:id/quick-feedback', auth_1.authenticate, async (req, res, next) => {
    try {
        const { action, reasonCode } = req.body;
        const allowed = ['INTERESTED', 'NOT_INTERESTED', 'SKIP'];
        if (!action || !allowed.includes(action)) {
            return res.status(400).json({ success: false, error: { message: 'action must be INTERESTED|NOT_INTERESTED|SKIP' } });
        }
        const match = await db_1.prisma.match.findFirst({
            where: { id: req.params.id, OR: [{ userAId: req.user.userId }, { userBId: req.user.userId }] },
        });
        if (!match)
            return res.status(404).json({ success: false, error: { message: 'Match not found' } });
        const ratingMap = { INTERESTED: 5, SKIP: 3, NOT_INTERESTED: 1 };
        const rating = ratingMap[action];
        const result = await db_1.prisma.matchFeedback.upsert({
            where: { matchId_userId: { matchId: req.params.id, userId: req.user.userId } },
            update: { action: action, reasonCode: reasonCode || null, rating },
            create: {
                matchId: req.params.id,
                userId: req.user.userId,
                action: action,
                reasonCode: reasonCode || null,
                rating,
            },
        });
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
});
exports.matchRouter.post('/:id/intro-response', auth_1.authenticate, async (req, res, next) => {
    try {
        const { responded, quality } = req.body;
        if (typeof responded !== 'boolean') {
            return res.status(400).json({ success: false, error: { message: 'responded boolean required' } });
        }
        const q = quality && [1, 2, 3, 4, 5].includes(quality) ? quality : null;
        const match = await db_1.prisma.match.findFirst({
            where: { id: req.params.id, OR: [{ userAId: req.user.userId }, { userBId: req.user.userId }] },
        });
        if (!match)
            return res.status(404).json({ success: false, error: { message: 'Match not found' } });
        const result = await db_1.prisma.matchFeedback.upsert({
            where: { matchId_userId: { matchId: req.params.id, userId: req.user.userId } },
            update: { introResponded: responded, introQuality: q ?? undefined },
            create: {
                matchId: req.params.id,
                userId: req.user.userId,
                rating: q ?? (responded ? 4 : 2),
                introResponded: responded,
                introQuality: q,
            },
        });
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
});
exports.matchRouter.get('/', auth_1.authenticate, async (req, res, next) => {
    try {
        const matches = await matchingService_1.matchingService.getMatchesForUser(req.user.userId);
        res.json({ success: true, data: matches });
    }
    catch (error) {
        next(error);
    }
});
exports.matchRouter.get('/stats', auth_1.authenticate, async (req, res, next) => {
    try {
        const [stats, paywall] = await Promise.all([
            matchingService_1.matchingService.getMatchStats(req.user.userId),
            razorpayService_1.razorpayService.checkPaywall(req.user.userId),
        ]);
        res.json({
            success: true,
            data: {
                ...stats,
                tier: paywall.tier,
                matchesUsed: paywall.matchesUsed,
                matchesRemaining: paywall.matchesRemaining,
                freeMatchLimit: paywall.freeMatchLimit,
                bonusMatches: paywall.bonusMatches,
                paywallActive: !paywall.allowed,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.matchRouter.post('/find', auth_1.authenticate, async (req, res, next) => {
    try {
        const { limit } = req.body;
        const matches = await matchingService_1.matchingService.findMatchesForUser(req.user.userId, limit);
        res.json({ success: true, data: matches });
    }
    catch (error) {
        next(error);
    }
});
exports.matchRouter.post('/find-and-propose', auth_1.authenticate, auth_1.requireEmailVerified, rateLimit_1.matchProposalLimiter, async (req, res, next) => {
    try {
        const { limit } = req.body;
        const proposed = await matchingService_1.matchingService.findAndAutoPropose(req.user.userId, limit || 5);
        res.json({ success: true, data: proposed });
    }
    catch (error) {
        next(error);
    }
});
exports.matchRouter.post('/propose', auth_1.authenticate, auth_1.requireEmailVerified, (0, validation_1.validate)(validation_1.matchProposeSchema), async (req, res, next) => {
    try {
        const { userAId, userBId } = req.body;
        // Access control: only an admin (MANAGER+) may propose a match between
        // two arbitrary users. A regular user may only propose matches that
        // include themselves on one side. Without this guard any verified user
        // can force-create proposals between strangers — bypassing the candidate
        // pool's no-name / test-domain filter and spamming real users.
        const callerId = req.user.userId;
        const callerRole = req.user?.role;
        const isAdmin = callerRole === 'MANAGER' || callerRole === 'ADMIN' || callerRole === 'OWNER';
        if (!isAdmin && callerId !== userAId && callerId !== userBId) {
            return res.status(403).json({
                success: false,
                error: { message: 'You can only propose matches that include yourself.' },
            });
        }
        const match = await matchingService_1.matchingService.proposeMatch(userAId, userBId);
        res.status(201).json({ success: true, data: match });
    }
    catch (error) {
        next(error);
    }
});
exports.matchRouter.post('/:id/feedback', auth_1.authenticate, (0, validation_1.validate)(validation_1.matchFeedbackSchema), async (req, res, next) => {
    try {
        const { rating, feedback } = req.body;
        const match = await db_1.prisma.match.findFirst({
            where: {
                id: req.params.id,
                OR: [{ userAId: req.user.userId }, { userBId: req.user.userId }],
            },
        });
        if (!match) {
            return res.status(404).json({ success: false, error: { message: 'Match not found' } });
        }
        const result = await db_1.prisma.matchFeedback.upsert({
            where: { matchId_userId: { matchId: req.params.id, userId: req.user.userId } },
            update: { rating: parseInt(rating), feedback: feedback || null },
            create: { matchId: req.params.id, userId: req.user.userId, rating: parseInt(rating), feedback: feedback || null },
        });
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
});
exports.matchRouter.get('/:id/feedback-prompt', auth_1.authenticate, async (req, res, next) => {
    try {
        const match = await db_1.prisma.match.findFirst({
            where: {
                id: req.params.id,
                status: 'ACCEPTED',
                OR: [{ userAId: req.user.userId }, { userBId: req.user.userId }],
            },
            include: {
                feedbacks: { where: { userId: req.user.userId } },
            },
        });
        if (!match) {
            return res.status(404).json({ success: false, error: { message: 'Match not found' } });
        }
        const hasFeedback = match.feedbacks.length > 0;
        const daysSinceAccepted = Math.floor((Date.now() - new Date(match.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
        const shouldPrompt = !hasFeedback && daysSinceAccepted >= 1;
        res.json({
            success: true,
            data: {
                matchId: match.id,
                shouldPrompt,
                hasFeedback,
                daysSinceAccepted,
                prompt: shouldPrompt ? 'Was this match useful? Your feedback helps us find better matches for you.' : null,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.matchRouter.get('/pending-feedback', auth_1.authenticate, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const acceptedMatches = await db_1.prisma.match.findMany({
            where: {
                status: 'ACCEPTED',
                updatedAt: { lte: oneDayAgo },
                OR: [{ userAId: userId }, { userBId: userId }],
                feedbacks: { none: { userId } },
            },
            include: {
                userA: { select: { id: true, profile: { select: { headline: true, companyName: true, persona: true } } } },
                userB: { select: { id: true, profile: { select: { headline: true, companyName: true, persona: true } } } },
            },
            orderBy: { updatedAt: 'desc' },
            take: 5,
        });
        const pendingFeedback = acceptedMatches.map(m => {
            const isUserA = m.userAId === userId;
            const other = isUserA ? m.userB : m.userA;
            return {
                matchId: m.id,
                otherUser: {
                    headline: other?.profile?.headline,
                    companyName: other?.profile?.companyName,
                    persona: other?.profile?.persona,
                },
                acceptedAt: m.updatedAt,
            };
        });
        res.json({ success: true, data: pendingFeedback });
    }
    catch (error) {
        next(error);
    }
});
exports.matchRouter.post('/:id/respond', auth_1.authenticate, (0, validation_1.validate)(validation_1.matchResponseSchema), async (req, res, next) => {
    try {
        const { response } = req.body;
        if (response === 'ACCEPTED') {
            const paywall = await razorpayService_1.razorpayService.checkPaywall(req.user.userId);
            if (!paywall.allowed) {
                return res.status(402).json({
                    success: false,
                    error: {
                        message: 'Free match limit reached. Subscribe to accept more matches.',
                        code: 'PAYWALL_LIMIT_REACHED',
                        matchesUsed: paywall.matchesUsed,
                        matchesRemaining: 0,
                        freeMatchLimit: paywall.freeMatchLimit,
                    },
                });
            }
        }
        const match = await matchingService_1.matchingService.respondToMatch(req.params.id, req.user.userId, response);
        if (response === 'ACCEPTED') {
            await razorpayService_1.razorpayService.incrementMatchesUsed(req.user.userId);
        }
        res.json({ success: true, data: match });
    }
    catch (error) {
        next(error);
    }
});
exports.matchRouter.post('/:id/view', auth_1.authenticate, async (req, res, next) => {
    try {
        const match = await matchingService_1.matchingService.markMatchViewed(req.params.id, req.user.userId);
        res.json({ success: true, data: match });
    }
    catch (error) {
        next(error);
    }
});
exports.matchRouter.post('/similar', auth_1.authenticate, async (req, res, next) => {
    try {
        const { limit, minSimilarity } = req.body;
        const results = await vectorMatchingService_1.vectorMatchingService.findSimilarByVector(req.user.userId, { limit: limit || 10, minSimilarity: minSimilarity || 0.3 });
        res.json({ success: true, data: results });
    }
    catch (error) {
        next(error);
    }
});
exports.matchRouter.post('/search', auth_1.authenticate, async (req, res, next) => {
    try {
        const { query, limit } = req.body;
        if (!query) {
            return res.status(400).json({ success: false, error: 'Query text required' });
        }
        const results = await vectorMatchingService_1.vectorMatchingService.findSimilarByText(query, { limit: limit || 10, excludeUserIds: [req.user.userId] });
        res.json({ success: true, data: results });
    }
    catch (error) {
        next(error);
    }
});
exports.matchRouter.get('/embeddings/stats', auth_1.authenticate, async (req, res, next) => {
    try {
        const stats = await vectorMatchingService_1.vectorMatchingService.getEmbeddingStats();
        res.json({ success: true, data: stats });
    }
    catch (error) {
        next(error);
    }
});
exports.matchRouter.post('/embeddings/backfill', auth_1.authenticate, (0, auth_1.requireRole)('ADMIN'), async (req, res, next) => {
    try {
        const batchSize = Math.min(Math.max(parseInt(req.body.batchSize) || 10, 1), 50);
        const result = await vectorMatchingService_1.vectorMatchingService.backfillEmbeddings(batchSize);
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
});
//# sourceMappingURL=match.js.map