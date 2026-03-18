import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@boardy/db';
import { authenticate, requireAdmin } from '../middleware/auth';
import { matchingService } from '../services/matchingService';
import { messagingService } from '../services/messagingService';
import { automationService } from '../services/automationService';
import { emailService } from '../services/email';

export const adminRouter = Router();

adminRouter.use(authenticate, requireAdmin);

adminRouter.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [totalUsers, activeConversations, completedProfiles, totalMatches, acceptedMatches, totalCalls, totalMessages] = await Promise.all([
      prisma.user.count(),
      prisma.conversation.count({ where: { status: 'ACTIVE' } }),
      prisma.profile.count({ where: { isComplete: true } }),
      prisma.match.count(),
      prisma.match.count({ where: { status: 'ACCEPTED' } }),
      prisma.call.count(),
      prisma.messageRecord.count(),
    ]);

    res.json({
      success: true,
      data: {
        totalUsers,
        activeConversations,
        completedProfiles,
        totalMatches,
        acceptedMatches,
        matchAcceptRate: totalMatches > 0 ? Math.round((acceptedMatches / totalMatches) * 100) : 0,
        totalCalls,
        totalMessages,
      },
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        include: { profile: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count(),
    ]);

    res.json({
      success: true,
      data: users.map((u) => ({
        id: u.id,
        email: u.email,
        phone: u.phone,
        role: u.role,
        isActive: u.isActive,
        createdAt: u.createdAt,
        profile: u.profile,
      })),
      meta: { page, limit, total },
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/matches', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const matches = await prisma.match.findMany({
      include: {
        userA: { include: { profile: true } },
        userB: { include: { profile: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({ success: true, data: matches });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/funnel', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [signups, startedOnboarding, completedOnboarding, profilesComplete, firstMatch, acceptedMatch] = await Promise.all([
      prisma.user.count(),
      prisma.conversation.count({ where: { flowId: 'onboarding_v1' } }),
      prisma.conversation.count({ where: { flowId: 'onboarding_v1', status: 'COMPLETED' } }),
      prisma.profile.count({ where: { isComplete: true } }),
      prisma.match.count(),
      prisma.match.count({ where: { status: 'ACCEPTED' } }),
    ]);

    res.json({
      success: true,
      data: {
        funnel: [
          { stage: 'Signed Up', count: signups },
          { stage: 'Started Onboarding', count: startedOnboarding },
          { stage: 'Completed Onboarding', count: completedOnboarding },
          { stage: 'Profile Complete', count: profilesComplete },
          { stage: 'Got First Match', count: firstMatch },
          { stage: 'Accepted Match', count: acceptedMatch },
        ],
      },
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/calls', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const calls = await prisma.call.findMany({
      include: { user: { select: { email: true, phone: true, profile: { select: { currentRole: true, companyName: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({ success: true, data: calls });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/messages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const messages = await messagingService.getAllMessages(50);
    const stats = await messagingService.getMessageStats();
    res.json({ success: true, data: { messages, stats } });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/communications', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [calls, messages, messageStats] = await Promise.all([
      prisma.call.findMany({
        include: { user: { select: { email: true, phone: true, profile: { select: { currentRole: true, companyName: true } } } } },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      prisma.messageRecord.findMany({
        include: { user: { select: { email: true, phone: true } } },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      messagingService.getMessageStats(),
    ]);

    const callStats = {
      total: await prisma.call.count(),
      completed: await prisma.call.count({ where: { status: 'COMPLETED' } }),
      failed: await prisma.call.count({ where: { status: 'FAILED' } }),
      inProgress: await prisma.call.count({ where: { status: 'IN_PROGRESS' } }),
    };

    res.json({
      success: true,
      data: { calls, messages, callStats, messageStats },
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/trigger/call/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        error: { message: 'phoneNumber is required', code: 'MISSING_PHONE' },
      });
    }
    const result = await automationService.triggerCallForUser(req.params.userId, phoneNumber);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/trigger/message/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phoneNumber, channel, message } = req.body;
    if (!phoneNumber || !channel || !message) {
      return res.status(400).json({
        success: false,
        error: { message: 'phoneNumber, channel, and message are required', code: 'MISSING_FIELDS' },
      });
    }
    const result = await automationService.triggerMessageForUser(req.params.userId, phoneNumber, channel, message);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/match/run/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const matches = await matchingService.findMatchesForUser(req.params.userId);
    res.json({ success: true, data: matches });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/analytics', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [
      totalUsers, completedProfiles, totalMatches, acceptedMatches,
      rejectedMatches, totalCalls, totalMessages, totalFeedbacks,
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'USER' } }),
      prisma.profile.count({ where: { isComplete: true, user: { role: 'USER' } } }),
      prisma.match.count(),
      prisma.match.count({ where: { status: 'ACCEPTED' } }),
      prisma.match.count({ where: { status: 'REJECTED' } }),
      prisma.call.count(),
      prisma.messageRecord.count(),
      prisma.matchFeedback.count(),
    ]);

    const personaBreakdown = await prisma.profile.groupBy({
      by: ['persona'],
      _count: { persona: true },
      where: { persona: { not: null } },
    });

    const avgScore = await prisma.match.aggregate({ _avg: { score: true } });

    const avgRating = await prisma.matchFeedback.aggregate({ _avg: { rating: true } });

    const ratingDist = await prisma.matchFeedback.groupBy({
      by: ['rating'],
      _count: { rating: true },
    });

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentSignups = await prisma.user.count({
      where: { createdAt: { gte: sevenDaysAgo }, role: 'USER' },
    });

    const dailySignups: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const start = new Date();
      start.setDate(start.getDate() - i);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      const count = await prisma.user.count({
        where: { createdAt: { gte: start, lt: end }, role: 'USER' },
      });
      dailySignups.push({ date: start.toISOString().split('T')[0], count });
    }

    const channelBreakdown = await prisma.messageRecord.groupBy({
      by: ['channel'],
      _count: { channel: true },
    });

    const attributionBreakdown = await prisma.profile.groupBy({
      by: ['channelSource'],
      _count: { channelSource: true },
      where: { channelSource: { not: null } },
    });

    const topMatchedPersonas = await prisma.$queryRaw`
      SELECT p.persona, COUNT(*)::int as match_count
      FROM matches m
      JOIN profiles p ON (p."userId" = m."userAId" OR p."userId" = m."userBId")
      WHERE p.persona IS NOT NULL
      GROUP BY p.persona
      ORDER BY match_count DESC
      LIMIT 10
    ` as any[];

    const recentActivity = await prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { user: { select: { email: true } } },
    });

    const startedOnboarding = await prisma.conversation.count({ where: { flowId: 'onboarding_v1' } });

    res.json({
      success: true,
      data: {
        totalUsers,
        completedProfiles,
        onboardingRate: totalUsers > 0 ? Math.round((completedProfiles / totalUsers) * 100) : 0,
        startedOnboarding,
        totalMatches,
        acceptedMatches,
        rejectedMatches,
        matchAcceptRate: totalMatches > 0 ? Math.round((acceptedMatches / totalMatches) * 100) : 0,
        avgMatchScore: Math.round((avgScore._avg.score || 0) * 100),
        totalCalls,
        totalMessages,
        recentSignups,
        dailySignups,
        personaBreakdown: personaBreakdown.map((p) => ({
          persona: p.persona,
          count: p._count.persona,
        })),
        channelBreakdown: channelBreakdown.map((c) => ({
          channel: c.channel,
          count: c._count.channel,
        })),
        topMatchedPersonas,
        attributionBreakdown: attributionBreakdown.map((a) => ({
          source: a.channelSource,
          count: a._count.channelSource,
        })),
        feedbackStats: {
          total: totalFeedbacks,
          avgRating: Math.round((avgRating._avg.rating || 0) * 10) / 10,
          distribution: ratingDist.map((r) => ({ rating: r.rating, count: r._count.rating })),
        },
        recentActivity: recentActivity.map((n) => ({
          id: n.id,
          type: n.event,
          title: n.title,
          body: n.body,
          email: (n as any).user?.email,
          createdAt: n.createdAt,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/send-digest', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await emailService.sendDigestToAll();
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});
