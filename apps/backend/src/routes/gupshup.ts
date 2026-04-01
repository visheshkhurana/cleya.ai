import { Router, Request, Response, NextFunction } from 'express';
import { gupshupService } from '../services/gupshupService';
import { env } from '../config/env';

export const gupshupRouter = Router();

gupshupRouter.post('/webhook', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = req.body;

    console.log('[Gupshup Webhook] Raw payload:', JSON.stringify(payload).substring(0, 2000));

    if (payload?.entry) {
      for (const entry of payload.entry) {
        for (const change of entry.changes || []) {
          const value = change.value;
          if (!value) continue;

          if (value.statuses) {
            for (const s of value.statuses) {
              const errDetail = s.errors?.[0];
              console.log(`[Gupshup Webhook] Status: gs_id=${s.gs_id}, status=${s.status}, recipient=${s.recipient_id}, meta_msg_id=${s.meta_msg_id || 'n/a'}, error_code=${errDetail?.code || 'none'}, error=${errDetail?.error_data?.details || 'none'}`);
            }
          }

          if (value.messages) {
            for (const m of value.messages) {
              console.log(`[Gupshup Webhook] Inbound: from=${m.from}, type=${m.type}, text=${m.text?.body || ''}, msg_id=${m.id}`);
            }
          }
        }
      }
    } else if (payload?.type === 'message-event' && payload.payload) {
      const ep = payload.payload;
      console.log(`[Gupshup Webhook] Delivery event (legacy): type=${ep.type}, gsId=${ep.gsId}, destination=${ep.destination}, errorCode=${ep.errorCode || 'none'}, errorMessage=${ep.reason || ep.errorMessage || 'none'}`);
    } else if (payload?.type === 'message' && payload.payload) {
      const ep = payload.payload;
      console.log(`[Gupshup Webhook] Inbound (legacy): from=${ep.from}, type=${ep.type}, text=${ep.text || ''}`);
    } else {
      console.log('[Gupshup Webhook] Unknown format, ignoring');
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
