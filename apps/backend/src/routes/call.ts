import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { callService } from '../services/voice/callService';

export const callRouter = Router();

callRouter.post('/initiate', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phoneNumber } = req.body;
    const result = await callService.initiateCall(req.user!.userId, phoneNumber);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

callRouter.get('/history', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const calls = await callService.getCallHistory(req.user!.userId);
    res.json({ success: true, data: calls });
  } catch (error) {
    next(error);
  }
});
