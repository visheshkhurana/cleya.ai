import { Router, Request, Response } from 'express';
import { prisma } from '@boardy/db';
import { authenticate } from '../middleware/auth';

export const activityRouter = Router();

activityRouter.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = parseInt(req.query.offset as string) || 0;

    const activities = await prisma.activity.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    res.json({
      success: true,
      data: activities,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});
