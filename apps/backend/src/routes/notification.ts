import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { notificationService } from '../services/notification/notificationService';

export const notificationRouter = Router();

notificationRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawLimit = parseInt(req.query.limit as string) || 20;
    const limit = Math.min(Math.max(rawLimit, 1), 100);
    const notifications = await notificationService.getNotifications(req.user!.userId, limit);
    const unreadCount = await notificationService.getUnreadCount(req.user!.userId);
    res.json({ success: true, data: { notifications, unreadCount } });
  } catch (error) {
    next(error);
  }
});

notificationRouter.post('/read-all', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await notificationService.markAllRead(req.user!.userId);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

notificationRouter.patch('/:id/read', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await notificationService.markRead(req.params.id, req.user!.userId);
    res.json({ success: true });
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
