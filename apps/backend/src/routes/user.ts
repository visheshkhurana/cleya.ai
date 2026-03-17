import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { profileService } from '../services/profileService';

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
