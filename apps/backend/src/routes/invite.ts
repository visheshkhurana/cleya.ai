import { Router, Request, Response } from 'express';
import { prisma } from '@cleya/db';
import { authenticate } from '../middleware/auth';
import crypto from 'crypto';

export const inviteRouter = Router();

function generateCode(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 8);
}

inviteRouter.get('/my-codes', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    let codes = await prisma.inviteCode.findMany({
      where: { createdById: userId },
      orderBy: { createdAt: 'desc' },
    });

    if (codes.length === 0) {
      const newCodes = [];
      for (let i = 0; i < 3; i++) {
        newCodes.push(
          prisma.inviteCode.create({
            data: { code: generateCode(), createdById: userId },
          })
        );
      }
      codes = await Promise.all(newCodes);
    }

    res.json({
      success: true,
      data: codes.map((c) => ({
        id: c.id,
        code: c.code,
        used: !!c.usedById,
        usedAt: c.usedAt,
        createdAt: c.createdAt,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

inviteRouter.get('/validate/:code', async (req: Request, res: Response) => {
  try {
    const invite = await prisma.inviteCode.findUnique({
      where: { code: req.params.code },
      include: {
        createdBy: {
          include: { profile: { select: { currentRole: true, companyName: true } } },
        },
      },
    });

    if (!invite || invite.usedById || !invite.isActive) {
      res.json({ success: true, data: { valid: false } });
      return;
    }

    const creator = invite.createdBy as any;
    res.json({
      success: true,
      data: {
        valid: true,
        inviterName: creator?.name || creator?.email?.split('@')[0],
        inviterTitle: creator?.profile?.currentRole,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

inviteRouter.post('/use/:code', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const invite = await prisma.inviteCode.findUnique({ where: { code: req.params.code } });

    if (!invite || invite.usedById || !invite.isActive) {
      res.status(400).json({ success: false, error: { message: 'Invalid or already used invite code' } });
      return;
    }

    await prisma.inviteCode.update({
      where: { id: invite.id },
      data: { usedById: userId, usedAt: new Date() },
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});
