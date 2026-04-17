import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireRole, requireEmailVerified } from '../middleware/auth';
import { matchingService } from '../services/matchingService';
import { vectorMatchingService } from '../services/vectorMatchingService';
import { prisma } from '@cleya/db';
import { matchProposalLimiter } from '../middleware/rateLimit';
import { validate, matchResponseSchema, matchFeedbackSchema, matchProposeSchema } from '../middleware/validation';
import { razorpayService } from '../services/razorpayService';
import { matchExplanationService } from '../services/matchExplanationService';

export const matchRouter = Router();

matchRouter.get('/:id/explanation', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const explanation = await matchExplanationService.getForUser(req.params.id, req.user!.userId);
    if (!explanation) {
      return res.status(404).json({ success: false, error: { message: 'Match not found' } });
    }
    res.json({ success: true, data: explanation });
  } catch (error) {
    next(error);
  }
});

matchRouter.post('/:id/quick-feedback', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { action, reasonCode } = req.body as { action?: string; reasonCode?: string };
    const allowed = ['INTERESTED', 'NOT_INTERESTED', 'SKIP'];
    if (!action || !allowed.includes(action)) {
      return res.status(400).json({ success: false, error: { message: 'action must be INTERESTED|NOT_INTERESTED|SKIP' } });
    }
    const match = await prisma.match.findFirst({
      where: { id: req.params.id, OR: [{ userAId: req.user!.userId }, { userBId: req.user!.userId }] },
    });
    if (!match) return res.status(404).json({ success: false, error: { message: 'Match not found' } });

    const ratingMap: Record<string, number> = { INTERESTED: 5, SKIP: 3, NOT_INTERESTED: 1 };
    const rating = ratingMap[action];

    const result = await prisma.matchFeedback.upsert({
      where: { matchId_userId: { matchId: req.params.id, userId: req.user!.userId } },
      update: { action: action as any, reasonCode: reasonCode || null, rating },
      create: {
        matchId: req.params.id,
        userId: req.user!.userId,
        action: action as any,
        reasonCode: reasonCode || null,
        rating,
      },
    });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

matchRouter.post('/:id/intro-response', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { responded, quality } = req.body as { responded?: boolean; quality?: number };
    if (typeof responded !== 'boolean') {
      return res.status(400).json({ success: false, error: { message: 'responded boolean required' } });
    }
    const q = quality && [1, 2, 3, 4, 5].includes(quality) ? quality : null;
    const match = await prisma.match.findFirst({
      where: { id: req.params.id, OR: [{ userAId: req.user!.userId }, { userBId: req.user!.userId }] },
    });
    if (!match) return res.status(404).json({ success: false, error: { message: 'Match not found' } });

    const result = await prisma.matchFeedback.upsert({
      where: { matchId_userId: { matchId: req.params.id, userId: req.user!.userId } },
      update: { introResponded: responded, introQuality: q ?? undefined },
      create: {
        matchId: req.params.id,
        userId: req.user!.userId,
        rating: q ?? (responded ? 4 : 2),
        introResponded: responded,
        introQuality: q,
      },
    });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

matchRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const matches = await matchingService.getMatchesForUser(req.user!.userId);
    res.json({ success: true, data: matches });
  } catch (error) {
    next(error);
  }
});

matchRouter.get('/stats', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [stats, paywall] = await Promise.all([
      matchingService.getMatchStats(req.user!.userId),
      razorpayService.checkPaywall(req.user!.userId),
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
  } catch (error) {
    next(error);
  }
});

matchRouter.post('/find', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit } = req.body;
    const matches = await matchingService.findMatchesForUser(req.user!.userId, limit);
    res.json({ success: true, data: matches });
  } catch (error) {
    next(error);
  }
});

matchRouter.post('/find-and-propose', authenticate, requireEmailVerified, matchProposalLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit } = req.body;
    const proposed = await matchingService.findAndAutoPropose(req.user!.userId, limit || 5);
    res.json({ success: true, data: proposed });
  } catch (error) {
    next(error);
  }
});

matchRouter.post('/propose', authenticate, requireEmailVerified, validate(matchProposeSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userAId, userBId } = req.body;
    const match = await matchingService.proposeMatch(userAId, userBId);
    res.status(201).json({ success: true, data: match });
  } catch (error) {
    next(error);
  }
});

matchRouter.post('/:id/feedback', authenticate, validate(matchFeedbackSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rating, feedback } = req.body;
    const match = await prisma.match.findFirst({
      where: {
        id: req.params.id,
        OR: [{ userAId: req.user!.userId }, { userBId: req.user!.userId }],
      },
    });
    if (!match) {
      return res.status(404).json({ success: false, error: { message: 'Match not found' } });
    }
    const result = await prisma.matchFeedback.upsert({
      where: { matchId_userId: { matchId: req.params.id, userId: req.user!.userId } },
      update: { rating: parseInt(rating), feedback: feedback || null },
      create: { matchId: req.params.id, userId: req.user!.userId, rating: parseInt(rating), feedback: feedback || null },
    });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

matchRouter.get('/:id/feedback-prompt', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const match = await prisma.match.findFirst({
      where: {
        id: req.params.id,
        status: 'ACCEPTED',
        OR: [{ userAId: req.user!.userId }, { userBId: req.user!.userId }],
      },
      include: {
        feedbacks: { where: { userId: req.user!.userId } },
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
  } catch (error) {
    next(error);
  }
});

matchRouter.get('/pending-feedback', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const acceptedMatches = await prisma.match.findMany({
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
  } catch (error) {
    next(error);
  }
});

matchRouter.post('/:id/respond', authenticate, validate(matchResponseSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { response } = req.body;

    if (response === 'ACCEPTED') {
      const paywall = await razorpayService.checkPaywall(req.user!.userId);
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

    const match = await matchingService.respondToMatch(
      req.params.id,
      req.user!.userId,
      response
    );

    if (response === 'ACCEPTED') {
      await razorpayService.incrementMatchesUsed(req.user!.userId);
    }

    res.json({ success: true, data: match });
  } catch (error) {
    next(error);
  }
});

matchRouter.post('/:id/view', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const match = await matchingService.markMatchViewed(req.params.id, req.user!.userId);
    res.json({ success: true, data: match });
  } catch (error) {
    next(error);
  }
});

matchRouter.post('/similar', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit, minSimilarity } = req.body;
    const results = await vectorMatchingService.findSimilarByVector(
      req.user!.userId,
      { limit: limit || 10, minSimilarity: minSimilarity || 0.3 }
    );
    res.json({ success: true, data: results });
  } catch (error) {
    next(error);
  }
});

matchRouter.post('/search', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query, limit } = req.body;
    if (!query) {
      return res.status(400).json({ success: false, error: 'Query text required' });
    }
    const results = await vectorMatchingService.findSimilarByText(
      query,
      { limit: limit || 10, excludeUserIds: [req.user!.userId] }
    );
    res.json({ success: true, data: results });
  } catch (error) {
    next(error);
  }
});

matchRouter.get('/embeddings/stats', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await vectorMatchingService.getEmbeddingStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
});

matchRouter.post('/embeddings/backfill', authenticate, requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const batchSize = Math.min(Math.max(parseInt(req.body.batchSize) || 10, 1), 50);
    const result = await vectorMatchingService.backfillEmbeddings(batchSize);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});
