import { Router, Request, Response, NextFunction } from 'express';
import { gupshupService } from '../services/gupshupService';
import { env } from '../config/env';

export const gupshupRouter = Router();

gupshupRouter.post('/webhook', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = req.body;

    console.log('[Gupshup Webhook] Received:', JSON.stringify(payload).substring(0, 1000));

    if (!payload || (!payload.type && !payload.payload)) {
      console.log('[Gupshup Webhook] Empty/invalid payload, ignoring');
      res.sendStatus(200);
      return;
    }

    if (payload.type === 'message-event' && payload.payload) {
      const ep = payload.payload;
      console.log(`[Gupshup Webhook] Delivery event: type=${ep.type}, gsId=${ep.gsId}, destination=${ep.destination}, errorCode=${ep.errorCode || 'none'}, errorMessage=${ep.reason || ep.errorMessage || 'none'}`);
    }

    if (payload.type === 'message' && payload.payload) {
      const ep = payload.payload;
      console.log(`[Gupshup Webhook] Inbound message: from=${ep.from}, type=${ep.type}, text=${ep.text || ''}`);
    }

    if (env.GUPSHUP_API_KEY) {
      await gupshupService.handleWebhook(payload);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('[Gupshup Webhook] Error:', error);
    res.sendStatus(200);
  }
});

gupshupRouter.get('/webhook', (_req: Request, res: Response) => {
  res.status(200).send('OK');
});
