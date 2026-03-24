import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';

const prisma = new PrismaClient();
export const referralRouter = Router();

referralRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;

    const inviteCodes = await prisma.inviteCode.findMany({
      where: { createdById: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        usedBy: {
          select: {
            id: true,
            name: true,
            createdAt: true,
            profile: {
              select: {
                persona: true,
                headline: true,
                companyName: true,
              },
            },
          },
        },
      },
    });

    const totalCodes = inviteCodes.length;
    const usedCodes = inviteCodes.filter(c => c.usedById !== null);
    const availableCodes = inviteCodes.filter(c => c.usedById === null && c.isActive);

    res.json({
      success: true,
      data: {
        summary: {
          totalCodes,
          used: usedCodes.length,
          available: availableCodes.length,
          conversionRate: totalCodes > 0 ? Math.round((usedCodes.length / totalCodes) * 100) : 0,
        },
        invites: inviteCodes.map(c => ({
          id: c.id,
          code: c.code,
          isActive: c.isActive,
          createdAt: c.createdAt,
          usedAt: c.usedAt,
          usedBy: c.usedBy ? {
            id: c.usedBy.id,
            name: c.usedBy.name,
            joinedAt: c.usedBy.createdAt,
            persona: c.usedBy.profile?.persona,
            headline: c.usedBy.profile?.headline,
            companyName: c.usedBy.profile?.companyName,
          } : null,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});
