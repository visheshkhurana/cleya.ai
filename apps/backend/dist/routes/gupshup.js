"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gupshupRouter = void 0;
const express_1 = require("express");
const gupshupService_1 = require("../services/gupshupService");
const whatsappBotService_1 = require("../services/whatsappBotService");
const env_1 = require("../config/env");
exports.gupshupRouter = (0, express_1.Router)();
exports.gupshupRouter.post('/webhook', async (req, res, next) => {
    try {
        const webhookSecret = process.env.GUPSHUP_WEBHOOK_SECRET;
        if (webhookSecret) {
            const incomingKey = req.query.secret || req.headers['x-gupshup-webhook-secret'];
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
                    if (!value)
                        continue;
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
                                whatsappBotService_1.whatsappBotService.handleInboundMessage(from, text, msgId).catch((err) => {
                                    console.error(`[Gupshup Webhook] Bot handler error:`, err);
                                });
                            }
                        }
                    }
                }
            }
        }
        else if (payload?.type === 'message-event' && payload.payload) {
            const ep = payload.payload;
            console.log(`[Gupshup Webhook] Delivery event (legacy): type=${ep.type}, gsId=${ep.gsId}, destination=${ep.destination}, errorCode=${ep.errorCode || 'none'}, errorMessage=${ep.reason || ep.errorMessage || 'none'}`);
        }
        else if (payload?.type === 'message' && payload.payload) {
            const ep = payload.payload;
            const from = ep.from || '';
            const text = ep.text || '';
            console.log(`[Gupshup Webhook] Inbound (legacy): from=${from}, type=${ep.type}, text=${text}`);
            if (text && from) {
                whatsappBotService_1.whatsappBotService.handleInboundMessage(from, text).catch((err) => {
                    console.error(`[Gupshup Webhook] Bot handler error (legacy):`, err);
                });
            }
        }
        else {
            console.log('[Gupshup Webhook] Unknown format, ignoring');
        }
        if (env_1.env.GUPSHUP_API_KEY) {
            await gupshupService_1.gupshupService.handleWebhook(payload);
        }
        res.sendStatus(200);
    }
    catch (error) {
        console.error('[Gupshup Webhook] Error:', error);
        res.sendStatus(200);
    }
});
exports.gupshupRouter.get('/webhook', (_req, res) => {
    res.status(200).send('OK');
});
exports.gupshupRouter.get('/status', (_req, res) => {
    res.json({
        configured: gupshupService_1.gupshupService.isConfigured(),
        apiKey: !!env_1.env.GUPSHUP_API_KEY,
        appName: !!env_1.env.GUPSHUP_APP_NAME,
        sourceNumber: !!env_1.env.GUPSHUP_SOURCE_NUMBER,
        templateNamespace: !!env_1.env.GUPSHUP_TEMPLATE_NAMESPACE,
        webhookSecret: !!env_1.env.GUPSHUP_WEBHOOK_SECRET,
    });
});
exports.gupshupRouter.post('/test-send', async (req, res) => {
    try {
        const { phone, message } = req.body;
        if (!phone || !message) {
            res.status(400).json({ error: 'phone and message are required' });
            return;
        }
        if (!gupshupService_1.gupshupService.isConfigured()) {
            res.status(503).json({
                error: 'Gupshup is not configured',
                missingVars: {
                    GUPSHUP_API_KEY: !env_1.env.GUPSHUP_API_KEY,
                    GUPSHUP_APP_NAME: !env_1.env.GUPSHUP_APP_NAME,
                    GUPSHUP_SOURCE_NUMBER: !env_1.env.GUPSHUP_SOURCE_NUMBER,
                },
            });
            return;
        }
        const result = await gupshupService_1.gupshupService.sendWhatsAppDirect(phone, message);
        if (result.success) {
            res.json({ success: true, result });
        }
        else {
            res.status(502).json({ success: false, error: result.error, httpStatus: result.httpStatus, gupshupResponse: result.response });
        }
    }
    catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error('[Gupshup Test Send] Error:', errMsg);
        res.status(500).json({ error: errMsg });
    }
});
//# sourceMappingURL=gupshup.js.map