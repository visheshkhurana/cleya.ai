import { Router, Request, Response, NextFunction } from 'express';
import { gupshupService } from '../services/gupshupService';
import { env } from '../config/env';

export const gupshupRouter = Router();

gupshupRouter.post('/webhook', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = req.body;

    if (!payload || (!payload.type && !payload.payload)) {
      res.sendStatus(200);
      return;
    }

    if (env.GUPSHUP_API_KEY) {
      await gupshupService.handleWebhook(payload);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Gupshup webhook error:', error);
    res.sendStatus(200);
  }
});

gupshupRouter.get('/webhook', (_req: Request, res: Response) => {
  res.status(200).send('OK');
});
