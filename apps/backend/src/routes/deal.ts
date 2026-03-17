import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '@boardy/db';
import { matchingService } from '../services/matchingService';

export const dealRouter = Router();

dealRouter.post('/scout', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await prisma.profile.findUnique({
      where: { userId: req.user!.userId },
      select: { persona: true },
    });

    if (profile?.persona !== 'DEAL_PARTNER') {
      return res.status(403).json({ success: false, error: 'Only deal partners can scout founders' });
    }

    const { limit } = req.body;
    const scouted = await matchingService.autoScoutFounders(req.user!.userId, limit || 5);
    res.json({ success: true, data: scouted });
  } catch (error) {
    next(error);
  }
});

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
    const { founderId, industry, stage, notes, dealValue, carryPercentage } = req.body;

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
        dealValue: dealValue ? parseFloat(dealValue) : null,
        carryPercentage: carryPercentage ? parseFloat(carryPercentage) : null,
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
    const { status, notes, introSent, responseStatus, dealValue, carryPercentage, introDate, closeDate } = req.body;

    const deal = await prisma.dealTracking.findUnique({ where: { id: req.params.id } });
    if (!deal) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }
    if (deal.dealPartnerId !== req.user!.userId && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    const updateData: any = {};
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    if (introSent !== undefined) {
      updateData.introSent = introSent;
      updateData.introSentAt = introSent ? new Date() : null;
    }
    if (responseStatus) updateData.responseStatus = responseStatus;
    if (dealValue !== undefined) updateData.dealValue = dealValue ? parseFloat(dealValue) : null;
    if (carryPercentage !== undefined) updateData.carryPercentage = carryPercentage ? parseFloat(carryPercentage) : null;
    if (introDate !== undefined) updateData.introDate = introDate ? new Date(introDate) : null;
    if (closeDate !== undefined) updateData.closeDate = closeDate ? new Date(closeDate) : null;

    if (status === 'INTRO_MADE' && !deal.introDate) {
      updateData.introDate = new Date();
      updateData.introSent = true;
      updateData.introSentAt = new Date();
    }
    if ((status === 'CLOSED_WON' || status === 'CLOSED_LOST') && !deal.closeDate) {
      updateData.closeDate = new Date();
    }

    const updated = await prisma.dealTracking.update({
      where: { id: req.params.id },
      data: updateData,
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
