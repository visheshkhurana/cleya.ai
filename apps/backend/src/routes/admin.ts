import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@boardy/db';
import { authenticate, requireAdmin } from '../middleware/auth';
import { matchingService } from '../services/matchingService';
import { messagingService } from '../services/messagingService';
import { automationService } from '../services/automationService';

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
