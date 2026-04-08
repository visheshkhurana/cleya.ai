import { Router } from 'express';
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

export const zoomRouter = Router();

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
