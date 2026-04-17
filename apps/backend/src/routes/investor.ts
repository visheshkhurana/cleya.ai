import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { investorStatsService } from '../services/investorStatsService';

export const investorRouter = Router();

investorRouter.get('/:id/stats', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const view = await investorStatsService.getView(req.params.id);
    if (!view) return res.json({ success: true, data: null });
    if (view.hidden && req.user!.userId !== req.params.id) {
      return res.json({ success: true, data: { hidden: true } });
    }
    res.json({ success: true, data: view });
  } catch (e) {
    next(e);
  }
});

investorRouter.post('/me/stats/visibility', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { hide } = req.body || {};
    const updated = await investorStatsService.setHideStats(req.user!.userId, !!hide);
    res.json({ success: true, data: { hideStats: updated.hideStats } });
  } catch (e) {
    next(e);
  }
});
