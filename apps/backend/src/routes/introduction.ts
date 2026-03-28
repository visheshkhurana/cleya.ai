import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '@cleya/db';
import { validate, introductionStatusSchema } from '../middleware/validation';
import { introductionService } from '../services/introductionService';

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
    res.json({ success: true, data: intro });
  } catch (error) {
    next(error);
  }
});

introductionRouter.patch('/:id/status', authenticate, validate(introductionStatusSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { status, scheduledAt, notes } = req.body;

    const allowedTransitions: Record<string, string[]> = {
      PENDING_APPROVAL: [],
      APPROVED: [],
      SENT: [],
      VIEWED: ['RESPONDED'],
      RESPONDED: ['MEETING_SCHEDULED'],
      FOLLOWED_UP: ['RESPONDED'],
    };

    const intro = await prisma.introductionRecord.findFirst({
      where: {
        id: req.params.id,
        OR: [{ userAId: userId }, { userBId: userId }],
      },
    });
    if (!intro) {
      return res.status(404).json({ success: false, error: { message: 'Introduction not found' } });
    }

    const allowed = allowedTransitions[intro.status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        error: { message: `Cannot transition from ${intro.status} to ${status}. Use the approve, cancel, or outcome endpoints instead.` },
      });
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

introductionRouter.post('/:id/approve', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const intro = await prisma.introductionRecord.findFirst({
      where: {
        id: req.params.id,
        OR: [{ userAId: userId }, { userBId: userId }],
      },
    });
    if (!intro) {
      return res.status(404).json({ success: false, error: { message: 'Introduction not found' } });
    }
    if (intro.status !== 'PENDING_APPROVAL') {
      return res.status(400).json({ success: false, error: { message: 'Introduction is not pending approval' } });
    }

    const result = await introductionService.approveAndSend(intro.id);
    if (!result) {
      return res.status(500).json({ success: false, error: { message: 'Failed to approve introduction' } });
    }

    const updated = await prisma.introductionRecord.findUnique({
      where: { id: intro.id },
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

introductionRouter.patch('/:id/edit', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { introText } = req.body;
    if (!introText || typeof introText !== 'string' || introText.trim().length < 10) {
      return res.status(400).json({ success: false, error: { message: 'Introduction text must be at least 10 characters' } });
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
    if (intro.status !== 'PENDING_APPROVAL') {
      return res.status(400).json({ success: false, error: { message: 'Can only edit introductions pending approval' } });
    }

    const updated = await prisma.introductionRecord.update({
      where: { id: intro.id },
      data: { introText: introText.trim() },
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

introductionRouter.post('/:id/cancel', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const intro = await prisma.introductionRecord.findFirst({
      where: {
        id: req.params.id,
        OR: [{ userAId: userId }, { userBId: userId }],
      },
    });
    if (!intro) {
      return res.status(404).json({ success: false, error: { message: 'Introduction not found' } });
    }
    if (intro.status === 'COMPLETED' || intro.status === 'CANCELLED') {
      return res.status(400).json({ success: false, error: { message: 'Cannot cancel this introduction' } });
    }

    const updated = await prisma.introductionRecord.update({
      where: { id: intro.id },
      data: { status: 'CANCELLED' },
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

introductionRouter.post('/:id/outcome', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { outcome, outcomeNotes } = req.body;

    const validOutcomes = ['GREAT_MEETING', 'GOOD_CHAT', 'DIDNT_MEET', 'NOT_A_FIT'];
    if (!outcome || !validOutcomes.includes(outcome)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid outcome. Must be one of: ' + validOutcomes.join(', ') } });
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
    if (!['SENT', 'VIEWED', 'FOLLOWED_UP'].includes(intro.status)) {
      return res.status(400).json({ success: false, error: { message: 'Can only record outcome for sent introductions' } });
    }

    const updated = await introductionService.recordOutcome(intro.id, outcome, outcomeNotes);
    const full = await prisma.introductionRecord.findUnique({
      where: { id: intro.id },
      include: {
        match: true,
        userA: { include: { profile: true } },
        userB: { include: { profile: true } },
      },
    });

    res.json({ success: true, data: full });
  } catch (error) {
    next(error);
  }
});
