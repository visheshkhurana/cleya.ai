import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '@cleya/db';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { notifyAdminsOfReport } from '../services/moderation';

export const reportRouter = Router();

const createReportSchema = z.object({
  targetUserId: z.string().cuid(),
  targetType: z.enum(['PROFILE', 'MESSAGE', 'MATCH', 'INTRODUCTION']),
  targetRefId: z.string().max(200).optional().nullable(),
  category: z.enum(['FAKE', 'SPAM', 'SCAM', 'HARASSMENT', 'INAPPROPRIATE', 'OTHER']),
  details: z.string().max(2000).optional().nullable(),
});

reportRouter.post('/', authenticate, validate(createReportSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reporterId = req.user!.userId;
    const { targetUserId, targetType, targetRefId, category, details } = req.body;

    if (targetUserId === reporterId) {
      return res.status(400).json({ success: false, error: { message: 'You cannot report yourself' } });
    }

    const targetExists = await prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true } });
    if (!targetExists) {
      return res.status(404).json({ success: false, error: { message: 'Target user not found' } });
    }

    const recentDuplicate = await prisma.report.findFirst({
      where: {
        reporterId,
        targetUserId,
        category,
        createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      select: { id: true },
    });
    if (recentDuplicate) {
      return res.status(429).json({ success: false, error: { message: 'You have already reported this user recently' } });
    }

    const report = await prisma.report.create({
      data: {
        reporterId,
        targetUserId,
        targetType,
        targetRefId: targetRefId || null,
        category,
        details: details || null,
      },
    });

    notifyAdminsOfReport(report.id).catch(() => {});

    res.json({ success: true, data: { id: report.id, status: report.status, createdAt: report.createdAt } });
  } catch (error) {
    next(error);
  }
});

reportRouter.get('/mine', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reporterId = req.user!.userId;
    const reports = await prisma.report.findMany({
      where: { reporterId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true, targetUserId: true, targetType: true, category: true,
        status: true, createdAt: true, resolvedAt: true,
      },
    });
    res.json({ success: true, data: reports });
  } catch (error) {
    next(error);
  }
});
