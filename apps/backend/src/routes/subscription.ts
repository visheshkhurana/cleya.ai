import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { razorpayService } from '../services/razorpayService';

export const subscriptionRouter = Router();

subscriptionRouter.post('/create', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await razorpayService.createSubscription(
      req.user!.userId,
      req.user!.email
    );
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

subscriptionRouter.get('/status', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = await razorpayService.getSubscriptionStatus(req.user!.userId);
    res.json({ success: true, data: status });
  } catch (error) {
    next(error);
  }
});

subscriptionRouter.post('/webhook', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;

    if (!signature) {
      return res.status(400).json({ success: false, error: { message: 'Missing signature' } });
    }

    const rawBody = (req as any).rawBody || JSON.stringify(req.body);
    const isValid = razorpayService.verifyWebhookSignature(rawBody, signature);

    if (!isValid) {
      console.log('[Subscription Webhook] Invalid signature');
      return res.status(400).json({ success: false, error: { message: 'Invalid signature' } });
    }

    const { event, payload } = req.body;
    await razorpayService.handleWebhookEvent(event, payload);

    res.json({ success: true });
  } catch (error) {
    console.error('[Subscription Webhook] Error:', error);
    res.status(200).json({ success: true });
  }
});
