import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '@boardy/db';

export const dealRouter = Router();

dealRouter.get('/admin/all', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== 'ADMIN') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const deals = await prisma.dealTracking.findMany({
      include: {
        dealPartner: { select: { id: true, email: true, profile: { select: { headline: true, persona: true, companyName: true } } } },
        founder: { select: { id: true, email: true, profile: { select: { headline: true, persona: true, companyName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const stats = {
      total: deals.length,
      byStatus: deals.reduce((acc: Record<string, number>, d) => {
        acc[d.status] = (acc[d.status] || 0) + 1;
        return acc;
      }, {}),
      introsSent: deals.filter(d => d.introSent).length,
    };

    res.json({ success: true, data: { deals, stats } });
  } catch (error) {
    next(error);
  }
});

dealRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deals = await prisma.dealTracking.findMany({
      where: {
        OR: [
          { dealPartnerId: req.user!.userId },
          { founderId: req.user!.userId },
        ],
      },
      include: {
        dealPartner: { select: { id: true, email: true, profile: { select: { headline: true, persona: true, companyName: true } } } },
        founder: { select: { id: true, email: true, profile: { select: { headline: true, persona: true, companyName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: deals });
  } catch (error) {
    next(error);
  }
});

dealRouter.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { founderId, industry, stage, notes } = req.body;

    if (!founderId) {
      return res.status(400).json({ success: false, error: 'founderId is required' });
    }

    const deal = await prisma.dealTracking.create({
      data: {
        dealPartnerId: req.user!.userId,
        founderId,
        industry: industry || null,
        stage: stage || null,
        notes: notes || null,
      },
      include: {
        founder: { select: { id: true, email: true, profile: { select: { headline: true, persona: true, companyName: true } } } },
      },
    });
    res.status(201).json({ success: true, data: deal });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, error: 'Deal already tracked for this founder' });
    }
    next(error);
  }
});

dealRouter.patch('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, notes, introSent, responseStatus } = req.body;

    const deal = await prisma.dealTracking.findUnique({ where: { id: req.params.id } });
    if (!deal) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }
    if (deal.dealPartnerId !== req.user!.userId && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    const updated = await prisma.dealTracking.update({
      where: { id: req.params.id },
      data: {
        ...(status && { status }),
        ...(notes !== undefined && { notes }),
        ...(introSent !== undefined && { introSent, introSentAt: introSent ? new Date() : null }),
        ...(responseStatus && { responseStatus }),
      },
      include: {
        founder: { select: { id: true, email: true, profile: { select: { headline: true, persona: true, companyName: true } } } },
        dealPartner: { select: { id: true, email: true, profile: { select: { headline: true, persona: true, companyName: true } } } },
      },
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

dealRouter.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deal = await prisma.dealTracking.findUnique({ where: { id: req.params.id } });
    if (!deal) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }
    if (deal.dealPartnerId !== req.user!.userId && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    await prisma.dealTracking.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Deal removed' });
  } catch (error) {
    next(error);
  }
});
