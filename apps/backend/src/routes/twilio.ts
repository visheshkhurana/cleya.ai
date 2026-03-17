import { Router, Request, Response, NextFunction } from 'express';
import { callService } from '../services/voice/callService';
import { env } from '../config/env';

export const twilioRouter = Router();

twilioRouter.post('/voice', (req: Request, res: Response) => {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy">
    Hey! This is Cleo, your AI Superconnector.
    I'm calling to help connect you with the right people based on your profile.
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

twilioRouter.post('/gather', async (req: Request, res: Response, next: NextFunction) => {
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

twilioRouter.post('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { CallSid, CallStatus, CallDuration } = req.body;
    console.log(`Twilio status update: ${CallSid} -> ${CallStatus} (${CallDuration || 0}s)`);

    if (CallSid) {
      const { prisma } = await import('@boardy/db');
      const call = await prisma.call.findFirst({
        where: { twilioCallSid: CallSid },
      });

      if (call) {
        await callService.updateCallStatus(
          call.id,
          CallStatus,
          CallDuration ? parseInt(CallDuration) : undefined
        );
      }
    }

    res.sendStatus(200);
  } catch (error) {
    next(error);
  }
});
