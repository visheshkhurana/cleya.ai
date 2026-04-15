import { Router, Request, Response, NextFunction } from 'express';
import { gupshupService } from '../services/gupshupService';
import { metaWhatsAppService } from '../services/metaWhatsAppService';
import { twilioWhatsAppService } from '../services/twilioWhatsAppService';
import { messagingService } from '../services/messagingService';
import { whatsappBotService } from '../services/whatsappBotService';
import { env } from '../config/env';

export const gupshupRouter = Router();

gupshupRouter.post('/webhook', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const webhookSecret = process.env.GUPSHUP_WEBHOOK_SECRET;
    if (webhookSecret) {
      const incomingKey = (req.query.secret as string) || req.headers['x-gupshup-webhook-secret'] as string;
      if (incomingKey !== webhookSecret) {
        console.warn('[Gupshup Webhook] Rejected: invalid or missing webhook secret');
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
    activeProvider: messagingService.getActiveProvider(),
    gupshup: {
      configured: gupshupService.isConfigured(),
      apiKey: !!env.GUPSHUP_API_KEY,
      appName: !!env.GUPSHUP_APP_NAME,
      sourceNumber: !!env.GUPSHUP_SOURCE_NUMBER,
      templateNamespace: !!env.GUPSHUP_TEMPLATE_NAMESPACE,
      webhookSecret: !!env.GUPSHUP_WEBHOOK_SECRET,
    },
    meta: {
      configured: metaWhatsAppService.isConfigured(),
      token: !!env.META_WHATSAPP_TOKEN,
      phoneId: !!env.META_WHATSAPP_PHONE_ID,
      wabaId: !!env.META_WHATSAPP_WABA_ID,
      appSecret: !!env.META_WHATSAPP_APP_SECRET,
      verifyToken: !!env.META_WHATSAPP_VERIFY_TOKEN,
    },
    twilio: {
      configured: twilioWhatsAppService.isConfigured(),
      accountSid: !!env.TWILIO_ACCOUNT_SID,
      authToken: !!env.TWILIO_AUTH_TOKEN,
      whatsappFrom: !!env.TWILIO_WHATSAPP_FROM,
    },
    // Backwards compat
    configured: gupshupService.isConfigured() || metaWhatsAppService.isConfigured() || twilioWhatsAppService.isConfigured(),
    apiKey: !!env.GUPSHUP_API_KEY,
    appName: !!env.GUPSHUP_APP_NAME,
    sourceNumber: !!env.GUPSHUP_SOURCE_NUMBER,
    templateNamespace: !!env.GUPSHUP_TEMPLATE_NAMESPACE,
    webhookSecret: !!env.GUPSHUP_WEBHOOK_SECRET,
  });
});

gupshupRouter.post('/test-send', async (req: Request, res: Response) => {
  try {
    const { phone, message } = req.body;
    if (!phone || !message) {
      res.status(400).json({ error: 'phone and message are required' });
      return;
    }
    const provider = messagingService.getActiveProvider();
    if (provider === 'none') {
      res.status(503).json({
        error: 'No WhatsApp provider configured',
        missingVars: {
          GUPSHUP_API_KEY: !env.GUPSHUP_API_KEY,
          GUPSHUP_APP_NAME: !env.GUPSHUP_APP_NAME,
          GUPSHUP_SOURCE_NUMBER: !env.GUPSHUP_SOURCE_NUMBER,
          META_WHATSAPP_TOKEN: !env.META_WHATSAPP_TOKEN,
          META_WHATSAPP_PHONE_ID: !env.META_WHATSAPP_PHONE_ID,
        },
      });
      return;
    }
    const result = await messagingService.sendWhatsAppDirect(phone, message);
    if (result && 'success' in result && result.success) {
      res.json({ success: true, provider, result });
    } else {
      const error = result && 'error' in result ? result.error : 'Send failed';
      res.status(502).json({ success: false, provider, error, response: result });
    }
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[Test Send] Error:', errMsg);
    res.status(500).json({ error: errMsg });
  }
});

// Meta Cloud API webhook verification (GET)
gupshupRouter.get('/meta-webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'] as string;
  const token = req.query['hub.verify_token'] as string;
  const challenge = req.query['hub.challenge'] as string;

  if (mode === 'subscribe' && token === env.META_WHATSAPP_VERIFY_TOKEN) {
    console.log('[Meta Webhook] Verification successful');
    res.status(200).send(challenge);
    return;
  }
  console.warn('[Meta Webhook] Verification failed: invalid token or mode');
  res.sendStatus(403);
});

// Meta Cloud API webhook events (POST)
gupshupRouter.post('/meta-webhook', async (req: Request, res: Response) => {
  // Verify signature if app secret is configured
  if (env.META_WHATSAPP_APP_SECRET && req.headers['x-hub-signature-256']) {
    const signature = req.headers['x-hub-signature-256'] as string;
    const rawBody = typeof req.body === 'string' ? Buffer.from(req.body) : Buffer.from(JSON.stringify(req.body));
    if (!metaWhatsAppService.verifyWebhookSignature(rawBody, signature)) {
      console.warn('[Meta Webhook] Invalid signature, rejecting');
      res.sendStatus(403);
      return;
    }
  }

  // Always return 200 immediately per Meta requirements
  res.sendStatus(200);

  // Process async
  try {
    await metaWhatsAppService.handleWebhook(req.body);
  } catch (err) {
    console.error('[Meta Webhook] Processing error:', err);
  }
});

// POST /api/gupshup/twilio-webhook — Twilio inbound WhatsApp messages
gupshupRouter.post('/twilio-webhook', async (req: Request, res: Response) => {
  res.sendStatus(200); // Respond immediately
  try {
    const inbound = await twilioWhatsAppService.handleInbound(req.body);
    if (inbound.phone && inbound.message) {
      await whatsappBotService.handleInboundMessage(inbound.phone, inbound.message);
    }
  } catch (err) {
    console.error('[TwilioWA Webhook] Error:', err);
  }
});

// POST /api/gupshup/twilio-status — Twilio delivery status callbacks
gupshupRouter.post('/twilio-status', async (req: Request, res: Response) => {
  res.sendStatus(200);
  try {
    await twilioWhatsAppService.handleStatusCallback(req.body);
  } catch (err) {
    console.error('[TwilioWA Status] Error:', err);
  }
});
