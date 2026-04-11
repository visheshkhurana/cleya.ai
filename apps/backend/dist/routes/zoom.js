"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.zoomRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const zoomService_1 = require("../services/zoomService");
const env_1 = require("../config/env");
exports.zoomRouter = (0, express_1.Router)();
exports.zoomRouter.get('/status', auth_1.authenticate, async (req, res) => {
    try {
        const configured = (0, zoomService_1.isZoomConfigured)();
        const connected = configured ? await (0, zoomService_1.isUserZoomConnected)(req.user.userId) : false;
        res.json({ success: true, data: { configured, connected } });
    }
    catch (err) {
        console.error('Zoom status error:', err);
        res.status(500).json({ success: false, error: 'Failed to check Zoom status' });
    }
});
exports.zoomRouter.get('/connect', auth_1.authenticate, async (req, res) => {
    try {
        if (!(0, zoomService_1.isZoomConfigured)()) {
            return res.status(400).json({ success: false, error: 'Zoom is not configured' });
        }
        const state = await (0, zoomService_1.createZoomOAuthState)(req.user.userId);
        const authUrl = (0, zoomService_1.getZoomAuthUrl)(state);
        res.json({ success: true, data: { authUrl } });
    }
    catch (err) {
        console.error('Zoom connect error:', err);
        res.status(500).json({ success: false, error: 'Failed to generate Zoom auth URL' });
    }
});
exports.zoomRouter.get('/callback', async (req, res) => {
    try {
        const { code, state } = req.query;
        if (!code || !state) {
            return res.redirect(`${env_1.env.FRONTEND_URL}/settings?zoom=error&reason=missing_params`);
        }
        const userId = await (0, zoomService_1.validateZoomState)(state);
        if (!userId) {
            return res.redirect(`${env_1.env.FRONTEND_URL}/settings?zoom=error&reason=invalid_state`);
        }
        await (0, zoomService_1.handleZoomCallback)(userId, code);
        res.redirect(`${env_1.env.FRONTEND_URL}/settings?zoom=connected`);
    }
    catch (err) {
        console.error('Zoom callback error:', err);
        res.redirect(`${env_1.env.FRONTEND_URL}/settings?zoom=error&reason=auth_failed`);
    }
});
exports.zoomRouter.post('/disconnect', auth_1.authenticate, async (req, res) => {
    try {
        await (0, zoomService_1.disconnectZoom)(req.user.userId);
        res.json({ success: true, message: 'Zoom disconnected' });
    }
    catch (err) {
        console.error('Zoom disconnect error:', err);
        res.status(500).json({ success: false, error: 'Failed to disconnect Zoom' });
    }
});
//# sourceMappingURL=zoom.js.map