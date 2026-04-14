import crypto from 'crypto';
import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@cleya/db';
import { authenticate } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { env } from '../config/env';

export const affiliateReferralRouter = Router();

function generateReferralCode(): string {
  return crypto.randomBytes(4).toString('hex');
}

// GET /api/referral/info — returns referral code, link, stats
affiliateReferralRouter.get('/info', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;

    let user = await prisma.user.findUnique({
      where: { id: userId },
      select: { referralCode: true, bonusMatches: true },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    // Generate referral code on first access if not set
    if (!user.referralCode) {
      const code = generateReferralCode();
      user = await prisma.user.update({
        where: { id: userId },
        data: { referralCode: code },
        select: { referralCode: true, bonusMatches: true },
      });
    }

    const totalReferrals = await prisma.referral.count({
      where: { referrerId: userId },
    });

    const frontendUrl = env.FRONTEND_URL || 'https://cleya.ai';
    const referralLink = `${frontendUrl}/?ref=${user.referralCode}`;

    res.json({
      success: true,
      data: {
        referralCode: user.referralCode,
        referralLink,
        totalReferrals,
        bonusMatches: user.bonusMatches,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/referral/history — returns list of referrals
affiliateReferralRouter.get('/history', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;

    const referrals = await prisma.referral.findMany({
      where: { referrerId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        referee: {
          select: {
            name: true,
            createdAt: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: referrals.map(r => ({
        id: r.id,
        refereeName: r.referee.name?.split(' ')[0] || 'User',
        refereeJoinedAt: r.createdAt,
        rewardGranted: r.rewardGranted,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/referral/apply — apply a referral code after signup
affiliateReferralRouter.post('/apply', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { referralCode } = req.body;

    if (!referralCode || typeof referralCode !== 'string') {
      throw new AppError(400, 'Referral code is required');
    }

    // Check if user already has a referrer
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { referredBy: true, referralCode: true },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    if (user.referredBy) {
      return res.json({ success: true, data: { alreadyReferred: true } });
    }

    // Find the referrer by code
    const referrer = await prisma.user.findUnique({
      where: { referralCode },
      select: { id: true },
    });

    if (!referrer) {
      throw new AppError(404, 'Invalid referral code', 'INVALID_REFERRAL_CODE');
    }

    // Prevent self-referral
    if (referrer.id === userId) {
      throw new AppError(400, 'You cannot refer yourself', 'SELF_REFERRAL');
    }

    // Check if referral record already exists
    const existing = await prisma.referral.findUnique({
      where: { refereeId: userId },
    });

    if (existing) {
      return res.json({ success: true, data: { alreadyReferred: true } });
    }

    // Apply referral in a transaction
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { referredBy: referrer.id },
      }),
      prisma.referral.create({
        data: {
          referrerId: referrer.id,
          refereeId: userId,
          rewardGranted: true,
        },
      }),
      prisma.user.update({
        where: { id: referrer.id },
        data: { bonusMatches: { increment: 5 } },
      }),
    ]);

    res.json({
      success: true,
      data: { applied: true },
    });
  } catch (error) {
    next(error);
  }
});
