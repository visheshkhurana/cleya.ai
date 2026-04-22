import { Router, Request, Response, NextFunction } from 'express';
import twilio from 'twilio';
import { callService } from '../services/voice/callService';
import { env } from '../config/env';
import { prisma } from '@cleya/db';
import { webhookPayloadSizeLimit } from '../middleware/webhookSecurity';

export const twilioRouter = Router();

const TWILIO_TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;
const recentTwilioCallSids = new Map<string, number>();
setInterval(() => {
  const cutoff = Date.now() - TWILIO_TIMESTAMP_TOLERANCE_MS;
  for (const [key, ts] of recentTwilioCallSids) {
    if (ts < cutoff) recentTwilioCallSids.delete(key);
  }
}, 60 * 1000);

function twilioWebhookAuth(req: Request, res: Response, next: NextFunction) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    if (env.NODE_ENV === 'production') {
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

  const twilioSignature = req.headers['x-twilio-signature'] as string || '';
  const isValid = twilio.validateRequest(
    authToken,
    twilioSignature,
    fullUrl,
    req.body || {}
  );

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

twilioRouter.post('/voice', webhookPayloadSizeLimit(256 * 1024), twilioWebhookAuth, (req: Request, res: Response) => {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy">
    Hey! This is Cleya, your AI Networker.
    I'm calling so I can meet you on behalf of the rest of the network and start introducing you to the right people.
    Tell me a bit about what you're working on and who you'd love to meet.
  </Say>
  <Gather input="speech" timeout="5" speechTimeout="auto"
    action="${env.BACKEND_URL}/api/twilio/gather" method="POST">
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

twilioRouter.post('/gather', webhookPayloadSizeLimit(256 * 1024), twilioWebhookAuth, async (req: Request, res: Response, next: NextFunction) => {
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
  } catch (error) {
    next(error);
  }
});

twilioRouter.post('/status', webhookPayloadSizeLimit(256 * 1024), twilioWebhookAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { CallSid, CallStatus, CallDuration } = req.body;
    console.log(`Twilio status update: ${CallSid} -> ${CallStatus} (${CallDuration || 0}s)`);

    if (CallSid) {
      const call = await prisma.call.findFirst({
        where: { twilioCallSid: CallSid },
      });
      if (call) {
        await callService.updateCallStatus(call.id, CallStatus, CallDuration ? parseInt(CallDuration) : undefined);
      }
    }

    res.sendStatus(200);
  } catch (error) {
    next(error);
  }
});
