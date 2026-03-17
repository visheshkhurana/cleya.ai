import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { matchingService } from '../services/matchingService';

export const matchRouter = Router();

matchRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const matches = await matchingService.getMatchesForUser(req.user!.userId);
    res.json({ success: true, data: matches });
  } catch (error) {
    next(error);
  }
});

matchRouter.get('/stats', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await matchingService.getMatchStats(req.user!.userId);
    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
});

matchRouter.post('/find', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit } = req.body;
    const matches = await matchingService.findMatchesForUser(req.user!.userId, limit);
    res.json({ success: true, data: matches });
  } catch (error) {
    next(error);
  }
});

matchRouter.post('/find-and-propose', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit } = req.body;
    const proposed = await matchingService.findAndAutoPropose(req.user!.userId, limit || 5);
    res.json({ success: true, data: proposed });
  } catch (error) {
    next(error);
  }
});

matchRouter.post('/propose', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userAId, userBId } = req.body;
    const match = await matchingService.proposeMatch(userAId, userBId);
    res.status(201).json({ success: true, data: match });
  } catch (error) {
    next(error);
  }
});

matchRouter.post('/:id/respond', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { response } = req.body;
    const match = await matchingService.respondToMatch(
      req.params.id,
      req.user!.userId,
      response
    );
    res.json({ success: true, data: match });
  } catch (error) {
    next(error);
  }
});
