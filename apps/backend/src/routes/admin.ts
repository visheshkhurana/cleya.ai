import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@boardy/db';
import { authenticate, requireAdmin } from '../middleware/auth';
import { matchingService } from '../services/matchingService';

export const adminRouter = Router();

// All admin routes require auth + admin role
adminRouter.use(authenticate, requireAdmin);

// Dashboard stats
adminRouter.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [totalUsers, activeConversations, completedProfiles, totalMatches, acceptedMatches, totalCalls] = await Promise.all([
      prisma.user.count(),
      prisma.conversation.count({ where: { status: 'ACTIVE' } }),
      prisma.profile.count({ where: { isComplete: true } }),
      prisma.match.count(),
      prisma.match.count({ where: { status: 'ACCEPTED' } }),
      prisma.call.count(),
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
      },
    });
  } catch (error) {
    next(error);
  }
});

// User list with profiles
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

// Match analytics
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

// Funnel metrics
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

// Call logs
adminRouter.get('/calls', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const calls = await prisma.call.findMany({
      include: { user: { include: { profile: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({ success: true, data: calls });
  } catch (error) {
    next(error);
  }
});

// Trigger matching for a user
adminRouter.post('/match/run/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const matches = await matchingService.findMatchesForUser(req.params.userId);
    res.json({ success: true, data: matches });
  } catch (error) {
    next(error);
  }
});
