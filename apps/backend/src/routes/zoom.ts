import crypto from 'crypto';
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import {
  isZoomConfigured,
  getZoomAuthUrl,
  createZoomOAuthState,
  validateZoomState,
  handleZoomCallback,
  isUserZoomConnected,
  disconnectZoom,
} from '../services/zoomService';
import { env } from '../config/env';
import { verifyWebhookTimestamp, webhookPayloadSizeLimit, getRawBody } from '../middleware/webhookSecurity';

export const zoomRouter = Router();

function verifyZoomWebhookSignature(req: Request): boolean {
  const zoomSecret = process.env.ZOOM_WEBHOOK_SECRET;
  if (!zoomSecret) {
    return env.NODE_ENV !== 'production';
  }

  const signature = req.headers['x-zm-signature'] as string | undefined;
  const timestamp = req.headers['x-zm-request-timestamp'] as string | undefined;

  if (!signature || !timestamp) return false;

  if (!verifyWebhookTimestamp(timestamp)) return false;

  const rawBody = getRawBody(req);
  const bodyStr = rawBody ? rawBody.toString('utf8') : JSON.stringify(req.body);
  const message = `v0:${timestamp}:${bodyStr}`;
  const hash = crypto
    .createHmac('sha256', zoomSecret)
    .update(message)
    .digest('hex');
  const expected = `v0=${hash}`;

  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

zoomRouter.post('/webhook', webhookPayloadSizeLimit(512 * 1024), (req: Request, res: Response) => {
  if (req.body?.event === 'endpoint.url_validation') {
    const zoomSecret = process.env.ZOOM_WEBHOOK_SECRET;
    if (!zoomSecret) {
      if (env.NODE_ENV === 'production') {
        console.warn('[Zoom Webhook] Rejected: ZOOM_WEBHOOK_SECRET not configured in production');
        res.sendStatus(403);
        return;
      }
    }
    if (zoomSecret && req.body.payload?.plainToken) {
      const hashForValidation = crypto
        .createHmac('sha256', zoomSecret)
        .update(req.body.payload.plainToken)
        .digest('hex');
      res.json({
        plainToken: req.body.payload.plainToken,
        encryptedToken: hashForValidation,
      });
      return;
    }
  }

  if (!verifyZoomWebhookSignature(req)) {
    console.warn('[Zoom Webhook] Rejected: invalid signature or stale timestamp');
    res.sendStatus(403);
    return;
  }

  console.log(`[Zoom Webhook] Event: ${req.body?.event}`);
  res.sendStatus(200);
});

zoomRouter.get('/status', authenticate, async (req, res) => {
  try {
    const configured = isZoomConfigured();
    const connected = configured ? await isUserZoomConnected(req.user!.userId) : false;
    res.json({ success: true, data: { configured, connected } });
  } catch (err: any) {
    console.error('Zoom status error:', err);
    res.status(500).json({ success: false, error: 'Failed to check Zoom status' });
  }
});

zoomRouter.get('/connect', authenticate, async (req, res) => {
  try {
    if (!isZoomConfigured()) {
      return res.status(400).json({ success: false, error: 'Zoom is not configured' });
    }

    const state = await createZoomOAuthState(req.user!.userId);
    const authUrl = getZoomAuthUrl(state);
    res.json({ success: true, data: { authUrl } });
  } catch (err: any) {
    console.error('Zoom connect error:', err);
    res.status(500).json({ success: false, error: 'Failed to generate Zoom auth URL' });
  }
});

zoomRouter.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) {
      return res.redirect(`${env.FRONTEND_URL}/settings?zoom=error&reason=missing_params`);
    }

    const userId = await validateZoomState(state as string);
    if (!userId) {
      return res.redirect(`${env.FRONTEND_URL}/settings?zoom=error&reason=invalid_state`);
    }

    await handleZoomCallback(userId, code as string);
    res.redirect(`${env.FRONTEND_URL}/settings?zoom=connected`);
  } catch (err: any) {
    console.error('Zoom callback error:', err);
    res.redirect(`${env.FRONTEND_URL}/settings?zoom=error&reason=auth_failed`);
  }
});

zoomRouter.post('/disconnect', authenticate, async (req, res) => {
  try {
    await disconnectZoom(req.user!.userId);
    res.json({ success: true, message: 'Zoom disconnected' });
  } catch (err: any) {
    console.error('Zoom disconnect error:', err);
    res.status(500).json({ success: false, error: 'Failed to disconnect Zoom' });
  }
});
