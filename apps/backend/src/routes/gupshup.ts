import crypto from 'crypto';
import { Router, Request, Response, NextFunction } from 'express';
import { gupshupService } from '../services/gupshupService';
import { whatsappBotService } from '../services/whatsappBotService';
import { env } from '../config/env';
import { verifyHmacSignature, verifyWebhookTimestamp, webhookPayloadSizeLimit, getRawBody } from '../middleware/webhookSecurity';

export const gupshupRouter = Router();

gupshupRouter.post('/webhook', webhookPayloadSizeLimit(512 * 1024), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const webhookSecret = process.env.GUPSHUP_WEBHOOK_SECRET;
    if (!webhookSecret) {
      if (env.NODE_ENV === 'production') {
        console.warn('[Gupshup Webhook] Rejected: GUPSHUP_WEBHOOK_SECRET not configured in production');
        res.sendStatus(403);
        return;
      }
    } else {
      const hmacSignature = req.headers['x-gupshup-signature'] as string | undefined;
      if (hmacSignature) {
        const rawBody = getRawBody(req) || Buffer.from(JSON.stringify(req.body));
        if (!verifyHmacSignature(rawBody, hmacSignature, webhookSecret)) {
          console.warn('[Gupshup Webhook] Rejected: invalid HMAC signature');
          res.sendStatus(403);
          return;
        }
      } else {
        const incomingKey = (req.query.secret as string) || req.headers['x-gupshup-webhook-secret'] as string;
        if (!incomingKey || incomingKey !== webhookSecret) {
          console.warn('[Gupshup Webhook] Rejected: invalid or missing webhook secret');
          res.sendStatus(403);
          return;
        }
      }

      const timestamp = req.headers['x-gupshup-timestamp'] as string | undefined;
      if (!verifyWebhookTimestamp(timestamp)) {
        console.warn('[Gupshup Webhook] Rejected: missing or stale timestamp');
        res.sendStatus(403);
        return;
      }
    }

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
              const from = m.from || '';
              const text = m.text?.body || '';
              const msgId = m.id || '';
              console.log(`[Gupshup Webhook] Inbound: from=${from}, type=${m.type}, text=${text}, msg_id=${msgId}`);

              if (text && from) {
                whatsappBotService.handleInboundMessage(from, text, msgId).catch((err) => {
                  console.error(`[Gupshup Webhook] Bot handler error:`, err);
                });
              }
            }
          }
        }
      }
    } else if (payload?.type === 'message-event' && payload.payload) {
      const ep = payload.payload;
      console.log(`[Gupshup Webhook] Delivery event (legacy): type=${ep.type}, gsId=${ep.gsId}, destination=${ep.destination}, errorCode=${ep.errorCode || 'none'}, errorMessage=${ep.reason || ep.errorMessage || 'none'}`);
    } else if (payload?.type === 'message' && payload.payload) {
      const ep = payload.payload;
      const from = ep.from || '';
      const text = ep.text || '';
      console.log(`[Gupshup Webhook] Inbound (legacy): from=${from}, type=${ep.type}, text=${text}`);

      if (text && from) {
        whatsappBotService.handleInboundMessage(from, text).catch((err) => {
          console.error(`[Gupshup Webhook] Bot handler error (legacy):`, err);
        });
      }
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

gupshupRouter.get('/status', (_req: Request, res: Response) => {
  res.json({
    configured: gupshupService.isConfigured(),
    apiKey: !!env.GUPSHUP_API_KEY,
    appName: !!env.GUPSHUP_APP_NAME,
    sourceNumber: !!env.GUPSHUP_SOURCE_NUMBER,
  });
});

gupshupRouter.post('/test-send', async (req: Request, res: Response) => {
  try {
    const { phone, message } = req.body;
    if (!phone || !message) {
      res.status(400).json({ error: 'phone and message are required' });
      return;
    }
    if (!gupshupService.isConfigured()) {
      res.status(503).json({ error: 'Gupshup is not configured' });
      return;
    }
    const result = await gupshupService.sendWhatsAppDirect(phone, message);
    res.json({ success: true, result });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[Gupshup Test Send] Error:', errMsg);
    res.status(500).json({ error: errMsg });
  }
});
