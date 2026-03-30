import { Router, Request, Response, NextFunction } from 'express';
import { gupshupService } from '../services/gupshupService';
import { env } from '../config/env';

export const gupshupRouter = Router();

function validateGupshupWebhook(req: Request, res: Response, next: NextFunction) {
  if (!env.GUPSHUP_API_KEY) {
    res.status(403).json({ error: 'Gupshup not configured' });
    return;
  }

  const payload = req.body;
  if (!payload || (!payload.type && !payload.payload)) {
    res.status(400).json({ error: 'Invalid webhook payload' });
    return;
  }

  next();
}

gupshupRouter.post('/webhook', validateGupshupWebhook, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = req.body;
    console.log('Gupshup webhook received:', JSON.stringify(payload).substring(0, 200));
    await gupshupService.handleWebhook(payload);
    res.sendStatus(200);
  } catch (error) {
    console.error('Gupshup webhook error:', error);
    res.sendStatus(200);
  }
});

gupshupRouter.get('/webhook', (_req: Request, res: Response) => {
  res.status(200).send('OK');
});
