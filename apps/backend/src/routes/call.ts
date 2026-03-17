import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { callService } from '../services/voice/callService';

export const callRouter = Router();

// Initiate a call
callRouter.post('/initiate', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phoneNumber } = req.body;
    const result = await callService.initiateCall(req.user!.userId, phoneNumber);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// Twilio TwiML webhook
callRouter.post('/twiml/:callId', (req: Request, res: Response) => {
  const twiml = callService.generateTwiML(req.params.callId);
  res.type('text/xml').send(twiml);
});

// Twilio Gather (speech input) webhook
callRouter.post('/gather/:callId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const speechResult = req.body.SpeechResult || '';
    const confidence = parseFloat(req.body.Confidence || '0');
    const result = await callService.processGatherInput(
      req.params.callId,
      speechResult,
      confidence
    );
    if (result) {
      res.type('text/xml').send(result.twiml);
    } else {
      res.type('text/xml').send('<Response><Hangup/></Response>');
    }
  } catch (error) {
    next(error);
  }
});

// Twilio status callback
callRouter.post('/status/:callId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { CallStatus, CallDuration } = req.body;
    await callService.updateCallStatus(
      req.params.callId,
      CallStatus,
      CallDuration ? parseInt(CallDuration) : undefined
    );
    res.sendStatus(200);
  } catch (error) {
    next(error);
  }
});

// Get call history
callRouter.get('/history', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const calls = await callService.getCallHistory(req.user!.userId);
    res.json({ success: true, data: calls });
  } catch (error) {
    next(error);
  }
});
