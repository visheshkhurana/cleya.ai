import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@cleya/db';
import { authenticate } from '../middleware/auth';
import { gupshupService } from '../services/gupshupService';

export const whatsappRouter = Router();

whatsappRouter.post('/opt-in', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { phoneNumber } = req.body;

    if (!phoneNumber || typeof phoneNumber !== 'string') {
      res.status(400).json({ success: false, error: { message: 'Phone number is required' } });
      return;
    }

    const cleaned = phoneNumber.replace(/[\s\-()]/g, '');
    if (cleaned.length < 10) {
      res.status(400).json({ success: false, error: { message: 'Invalid phone number' } });
      return;
    }

    const optInResult = await gupshupService.optInUser(cleaned);

    await prisma.user.update({
      where: { id: userId },
      data: {
        whatsappOptedIn: true,
        whatsappPhone: cleaned,
      },
    });

    await prisma.communicationPreference.upsert({
      where: { userId },
      create: {
        userId,
        whatsappEnabled: true,
        whatsappMatchNotify: true,
        whatsappIntroNotify: true,
        whatsappWeeklyDigest: true,
      },
      update: {
        whatsappEnabled: true,
      },
    });

    console.log(`User ${userId} opted in to WhatsApp with ${cleaned} (Gupshup: ${optInResult.success ? 'ok' : optInResult.error})`);

    res.json({
      success: true,
      data: {
        whatsappOptedIn: true,
        whatsappPhone: cleaned,
        gupshupOptIn: optInResult.success,
      },
    });
  } catch (error) {
    next(error);
  }
});

whatsappRouter.post('/opt-out', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.whatsappPhone) {
      await gupshupService.optOutUser(user.whatsappPhone);
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        whatsappOptedIn: false,
      },
    });

    await prisma.communicationPreference.upsert({
      where: { userId },
      create: { userId, whatsappEnabled: false },
      update: { whatsappEnabled: false },
    });

    console.log(`User ${userId} opted out of WhatsApp`);

    res.json({
      success: true,
      data: { whatsappOptedIn: false },
    });
  } catch (error) {
    next(error);
  }
});

whatsappRouter.get('/status', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { whatsappOptedIn: true, whatsappPhone: true, phone: true },
    });

    const prefs = await prisma.communicationPreference.findUnique({
      where: { userId },
      select: { whatsappEnabled: true, whatsappMatchNotify: true, whatsappIntroNotify: true, whatsappWeeklyDigest: true },
    });

    res.json({
      success: true,
      data: {
        whatsappOptedIn: user?.whatsappOptedIn || false,
        whatsappPhone: user?.whatsappPhone || user?.phone || null,
        preferences: prefs || { whatsappEnabled: false, whatsappMatchNotify: true, whatsappIntroNotify: true, whatsappWeeklyDigest: true },
      },
    });
  } catch (error) {
    next(error);
  }
});
