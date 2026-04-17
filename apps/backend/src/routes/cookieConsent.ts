import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '@cleya/db';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validation';

export const cookieConsentRouter = Router();

const consentSchema = z.object({
  analytics: z.boolean(),
  marketing: z.boolean(),
});

cookieConsentRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const consent = await prisma.cookieConsent.findUnique({ where: { userId } });
    res.json({ success: true, data: consent });
  } catch (error) {
    next(error);
  }
});

cookieConsentRouter.put('/', authenticate, validate(consentSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { analytics, marketing } = req.body;
    const consent = await prisma.cookieConsent.upsert({
      where: { userId },
      create: { userId, essential: true, analytics, marketing, version: 'v2' },
      update: { analytics, marketing, version: 'v2' },
    });
    res.json({ success: true, data: consent });
  } catch (error) {
    next(error);
  }
});
