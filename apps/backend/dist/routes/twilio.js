"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.twilioRouter = void 0;
const express_1 = require("express");
const twilio_1 = __importDefault(require("twilio"));
const callService_1 = require("../services/voice/callService");
const env_1 = require("../config/env");
const db_1 = require("@cleya/db");
const webhookSecurity_1 = require("../middleware/webhookSecurity");
exports.twilioRouter = (0, express_1.Router)();
const TWILIO_TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;
const recentTwilioCallSids = new Map();
setInterval(() => {
    const cutoff = Date.now() - TWILIO_TIMESTAMP_TOLERANCE_MS;
    for (const [key, ts] of recentTwilioCallSids) {
        if (ts < cutoff)
            recentTwilioCallSids.delete(key);
    }
}, 60 * 1000);
function twilioWebhookAuth(req, res, next) {
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!authToken) {
        if (env_1.env.NODE_ENV === 'production') {
            console.warn('[Twilio Webhook] Rejected: TWILIO_AUTH_TOKEN not configured in production');
            res.sendStatus(403);
            return;
        }
        next();
        return;
    }
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.headers['host'] || '';
    const fullUrl = `${protocol}://${host}${req.originalUrl}`;
    const twilioSignature = req.headers['x-twilio-signature'] || '';
    const isValid = twilio_1.default.validateRequest(authToken, twilioSignature, fullUrl, req.body || {});
    if (!isValid) {
        console.warn('[Twilio Webhook] Rejected: invalid signature');
        res.sendStatus(403);
        return;
    }
    const callSid = req.body?.CallSid;
    if (callSid) {
        const now = Date.now();
        const lastSeen = recentTwilioCallSids.get(callSid);
        if (lastSeen && (now - lastSeen) < 1000) {
            console.warn(`[Twilio Webhook] Rejected: duplicate CallSid ${callSid}`);
            res.sendStatus(200);
            return;
        }
        recentTwilioCallSids.set(callSid, now);
    }
    next();
}
exports.twilioRouter.post('/voice', (0, webhookSecurity_1.webhookPayloadSizeLimit)(256 * 1024), twilioWebhookAuth, (req, res) => {
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy">
    Hey! This is Cleya, your AI Superconnector.
    I'm calling to help connect you with the right people based on your profile.
    Tell me a bit about what you're working on and who you'd love to meet.
  </Say>
  <Gather input="speech" timeout="5" speechTimeout="auto"
    action="${env_1.env.BACKEND_URL}/api/twilio/gather" method="POST">
    <Say voice="Polly.Amy">
      I'm listening — go ahead!
    </Say>
  </Gather>
  <Say voice="Polly.Amy">
    No worries if you're not ready to chat now.
    You can always update your profile in the app. Talk soon!
  </Say>
</Response>`;
    res.type('text/xml').send(twiml);
});
exports.twilioRouter.post('/gather', (0, webhookSecurity_1.webhookPayloadSizeLimit)(256 * 1024), twilioWebhookAuth, async (req, res, next) => {
    try {
        const speechResult = req.body.SpeechResult || '';
        const callSid = req.body.CallSid || '';
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy">
    That's great to hear! I'll use that to find you amazing connections.
    Keep an eye on the app for your matches. Thanks for chatting with me!
  </Say>
  <Hangup/>
</Response>`;
        res.type('text/xml').send(twiml);
    }
    catch (error) {
        next(error);
    }
});
exports.twilioRouter.post('/status', (0, webhookSecurity_1.webhookPayloadSizeLimit)(256 * 1024), twilioWebhookAuth, async (req, res, next) => {
    try {
        const { CallSid, CallStatus, CallDuration } = req.body;
        console.log(`Twilio status update: ${CallSid} -> ${CallStatus} (${CallDuration || 0}s)`);
        if (CallSid) {
            const call = await db_1.prisma.call.findFirst({
                where: { twilioCallSid: CallSid },
            });
            if (call) {
                await callService_1.callService.updateCallStatus(call.id, CallStatus, CallDuration ? parseInt(CallDuration) : undefined);
            }
        }
        res.sendStatus(200);
    }
    catch (error) {
        next(error);
    }
});
//# sourceMappingURL=twilio.js.map