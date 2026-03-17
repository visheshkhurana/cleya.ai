import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { profileService } from '../services/profileService';
import { prisma } from '@boardy/db';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

export const userRouter = Router();

userRouter.get('/profile', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await profileService.getProfile(req.user!.userId);
    res.json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
});

userRouter.put('/profile', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await profileService.updateProfile(req.user!.userId, req.body);
    res.json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
});

userRouter.patch('/profile', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await profileService.updateProfile(req.user!.userId, req.body);
    res.json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
});

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8),
});

userRouter.post('/change-password', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) {
      res.status(404).json({ success: false, error: { message: 'User not found' } });
      return;
    }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      res.status(400).json({ success: false, error: { message: 'Current password is incorrect' } });
      return;
    }
    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashed } });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

userRouter.delete('/account', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.user.update({
      where: { id: req.user!.userId },
      data: { isActive: false },
    });
    res.json({ success: true, message: 'Account deactivated' });
  } catch (error) {
    next(error);
  }
});

userRouter.get('/settings', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { email: true, phone: true, createdAt: true },
    });
    const profile = await prisma.profile.findUnique({
      where: { userId: req.user!.userId },
      select: { persona: true, currentRole: true, isComplete: true },
    });
    res.json({ success: true, data: { ...user, profile } });
  } catch (error) {
    next(error);
  }
});
