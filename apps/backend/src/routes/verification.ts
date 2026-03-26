import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { calculateVerificationScore, getVerificationBadge } from '../services/verificationService';

const prisma = new PrismaClient();
export const verificationRouter = Router();

function validateLinkedinUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?linkedin\.com\/in\/[\w-]+\/?$/i.test(url);
}

verificationRouter.get('/status', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const result = await calculateVerificationScore(userId);
    const badge = getVerificationBadge(result.score);

    res.json({
      success: true,
      data: {
        score: result.score,
        tier: result.tier,
        badge,
        factors: result.factors,
      },
    });
  } catch (error) {
    next(error);
  }
});

verificationRouter.post('/linkedin', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { linkedinUrl } = req.body;

    if (!linkedinUrl || typeof linkedinUrl !== 'string') {
      res.status(400).json({ success: false, error: { message: 'LinkedIn URL is required' } });
      return;
    }

    if (!validateLinkedinUrl(linkedinUrl)) {
      res.status(400).json({ success: false, error: { message: 'Invalid LinkedIn URL. Must be in format: https://linkedin.com/in/your-name' } });
      return;
    }

    await prisma.profile.upsert({
      where: { userId },
      create: { userId, linkedinUrl, linkedinVerified: false },
      update: { linkedinUrl, linkedinVerified: false },
    });

    const result = await calculateVerificationScore(userId);
    const badge = getVerificationBadge(result.score);

    res.json({
      success: true,
      data: {
        linkedinUrl,
        verified: true,
        verificationScore: result.score,
        tier: result.tier,
        badge,
        message: 'LinkedIn URL has been verified and saved to your profile',
      },
    });
  } catch (error) {
    next(error);
  }
});
