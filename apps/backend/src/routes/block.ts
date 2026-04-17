import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '@cleya/db';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validation';

export const blockRouter = Router();

const blockSchema = z.object({
  blockedId: z.string().cuid(),
  reason: z.string().max(500).optional().nullable(),
});

blockRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const blocks = await prisma.blockedUser.findMany({
      where: { blockerId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        blocked: {
          select: { id: true, name: true, email: true, profile: { select: { avatarUrl: true, headline: true } } },
        },
      },
    });
    res.json({ success: true, data: blocks });
  } catch (error) {
    next(error);
  }
});

blockRouter.post('/', authenticate, validate(blockSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const blockerId = req.user!.userId;
    const { blockedId, reason } = req.body;
    if (blockedId === blockerId) {
      return res.status(400).json({ success: false, error: { message: 'You cannot block yourself' } });
    }
    const target = await prisma.user.findUnique({ where: { id: blockedId }, select: { id: true } });
    if (!target) {
      return res.status(404).json({ success: false, error: { message: 'User not found' } });
    }
    const block = await prisma.blockedUser.upsert({
      where: { blockerId_blockedId: { blockerId, blockedId } },
      create: { blockerId, blockedId, reason: reason || null },
      update: { reason: reason || null },
    });
    res.json({ success: true, data: block });
  } catch (error) {
    next(error);
  }
});

blockRouter.delete('/:blockedId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const blockerId = req.user!.userId;
    const { blockedId } = req.params;
    await prisma.blockedUser.deleteMany({ where: { blockerId, blockedId } });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});
