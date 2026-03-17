import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { messagingService } from '../services/messagingService';

export const messagingRouter = Router();

messagingRouter.post('/whatsapp/send', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phoneNumber, message } = req.body;
    if (!phoneNumber || !message) {
      return res.status(400).json({
        success: false,
        error: { message: 'phoneNumber and message are required', code: 'MISSING_FIELDS' },
      });
    }

    const result = await messagingService.sendWhatsApp(req.user!.userId, phoneNumber, message);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

messagingRouter.post('/sms/send', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phoneNumber, message } = req.body;
    if (!phoneNumber || !message) {
      return res.status(400).json({
        success: false,
        error: { message: 'phoneNumber and message are required', code: 'MISSING_FIELDS' },
      });
    }

    const result = await messagingService.sendSMS(req.user!.userId, phoneNumber, message);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

messagingRouter.get('/history', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const messages = await messagingService.getMessageHistory(req.user!.userId);
    res.json({ success: true, data: messages });
  } catch (error) {
    next(error);
  }
});
