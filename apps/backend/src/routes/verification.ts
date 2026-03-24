import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';

const prisma = new PrismaClient();
export const verificationRouter = Router();

function validateLinkedinUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?linkedin\.com\/in\/[\w-]+\/?$/i.test(url);
}

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

    const profile = await prisma.profile.upsert({
      where: { userId },
      create: { userId, linkedinUrl },
      update: { linkedinUrl },
    });

    res.json({
      success: true,
      data: {
        linkedinUrl: profile.linkedinUrl,
        verified: true,
        message: 'LinkedIn URL has been verified and saved to your profile',
      },
    });
  } catch (error) {
    next(error);
  }
});
