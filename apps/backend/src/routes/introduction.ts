import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '@boardy/db';

export const introductionRouter = Router();

introductionRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const introductions = await prisma.introductionRecord.findMany({
      where: {
        OR: [{ userAId: userId }, { userBId: userId }],
      },
      include: {
        match: true,
        userA: { include: { profile: true } },
        userB: { include: { profile: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: introductions });
  } catch (error) {
    next(error);
  }
});

introductionRouter.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const intro = await prisma.introductionRecord.findFirst({
      where: {
        id: req.params.id,
        OR: [{ userAId: userId }, { userBId: userId }],
      },
      include: {
        match: true,
        userA: { include: { profile: true } },
        userB: { include: { profile: true } },
      },
    });
    if (!intro) {
      return res.status(404).json({ success: false, error: { message: 'Introduction not found' } });
    }
    if (intro.status === 'SENT' && intro.userAId !== userId && intro.userBId !== userId) {
      return res.status(403).json({ success: false, error: { message: 'Not authorized' } });
    }
    if (intro.status === 'SENT') {
      await prisma.introductionRecord.update({
        where: { id: intro.id },
        data: { status: 'VIEWED' },
      });
      intro.status = 'VIEWED';
    }
    res.json({ success: true, data: intro });
  } catch (error) {
    next(error);
  }
});

introductionRouter.patch('/:id/status', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { status, scheduledAt, notes } = req.body;
    const validStatuses = ['VIEWED', 'RESPONDED', 'MEETING_SCHEDULED'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid status' } });
    }
    const intro = await prisma.introductionRecord.findFirst({
      where: {
        id: req.params.id,
        OR: [{ userAId: userId }, { userBId: userId }],
      },
    });
    if (!intro) {
      return res.status(404).json({ success: false, error: { message: 'Introduction not found' } });
    }
    const updated = await prisma.introductionRecord.update({
      where: { id: intro.id },
      data: {
        status,
        ...(scheduledAt ? { scheduledAt: new Date(scheduledAt) } : {}),
        ...(notes !== undefined ? { notes } : {}),
      },
      include: {
        match: true,
        userA: { include: { profile: true } },
        userB: { include: { profile: true } },
      },
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});
