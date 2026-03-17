import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { matchingService } from '../services/matchingService';

export const matchRouter = Router();

// Get matches for current user
matchRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const matches = await matchingService.getMatchesForUser(req.user!.userId);
    res.json({ success: true, data: matches });
  } catch (error) {
    next(error);
  }
});

// Find new matches
matchRouter.post('/find', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit } = req.body;
    const matches = await matchingService.findMatchesForUser(req.user!.userId, limit);
    res.json({ success: true, data: matches });
  } catch (error) {
    next(error);
  }
});

// Propose a match (admin or system)
matchRouter.post('/propose', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userAId, userBId } = req.body;
    const match = await matchingService.proposeMatch(userAId, userBId);
    res.status(201).json({ success: true, data: match });
  } catch (error) {
    next(error);
  }
});

// Respond to a match (accept/reject)
matchRouter.post('/:id/respond', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { response } = req.body; // 'ACCEPTED' | 'REJECTED'
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
