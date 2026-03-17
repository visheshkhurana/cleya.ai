import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { chatWithCleo } from '../services/ai';

export const aiChatRouter = Router();

aiChatRouter.post('/message', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { message, history } = req.body;
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      res.status(400).json({ success: false, error: { message: 'Message is required' } });
      return;
    }
    if (message.length > 2000) {
      res.status(400).json({ success: false, error: { message: 'Message too long (max 2000 characters)' } });
      return;
    }
    const validHistory = Array.isArray(history) ? history.slice(-10).map((h: any) => ({
      role: h.role === 'assistant' ? 'assistant' as const : 'user' as const,
      content: String(h.content || ''),
    })) : [];
    const result = await chatWithCleo(req.user!.userId, message.trim(), validHistory);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});
