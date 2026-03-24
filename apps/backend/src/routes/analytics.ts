import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';

const prisma = new PrismaClient();
export const analyticsRouter = Router();

analyticsRouter.get('/overview', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;

    const [
      totalMatches,
      acceptedMatches,
      pendingMatches,
      totalIntros,
      totalConversations,
      profile,
    ] = await Promise.all([
      prisma.match.count({
        where: { OR: [{ userAId: userId }, { userBId: userId }] },
      }),
      prisma.match.count({
        where: {
          OR: [{ userAId: userId }, { userBId: userId }],
          status: 'ACCEPTED',
        },
      }),
      prisma.match.count({
        where: {
          OR: [{ userAId: userId }, { userBId: userId }],
          status: 'PROPOSED',
        },
      }),
      prisma.introductionRecord.count({
        where: { OR: [{ userAId: userId }, { userBId: userId }] },
      }).catch(() => 0),
      prisma.conversation.count({ where: { userId } }),
      prisma.profile.findUnique({
        where: { userId },
        select: { completenessScore: true, isComplete: true, persona: true },
      }),
    ]);

    const recentMatches = await prisma.match.findMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        status: true,
        score: true,
        reason: true,
        createdAt: true,
        userA: { select: { id: true, name: true } },
        userB: { select: { id: true, name: true } },
      },
    });

    res.json({
      success: true,
      data: {
        profile: {
          completenessScore: profile?.completenessScore || 0,
          isComplete: profile?.isComplete || false,
          persona: profile?.persona,
        },
        matches: {
          total: totalMatches,
          accepted: acceptedMatches,
          pending: pendingMatches,
          acceptRate: totalMatches > 0 ? Math.round((acceptedMatches / totalMatches) * 100) : 0,
        },
        introductions: totalIntros,
        conversations: totalConversations,
        recentMatches: recentMatches.map(m => ({
          id: m.id,
          status: m.status,
          score: m.score,
          reason: m.reason,
          createdAt: m.createdAt,
          otherUser: m.userA.id === userId ? m.userB : m.userA,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});
