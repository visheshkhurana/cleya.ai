import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { notificationService } from '../services/notification/notificationService';

export const notificationRouter = Router();

notificationRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const notifications = await notificationService.getNotifications(req.user!.userId, limit);
    res.json({ success: true, data: notifications });
  } catch (error) {
    next(error);
  }
});

notificationRouter.post('/:id/read', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await notificationService.markRead(req.params.id, req.user!.userId);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});
