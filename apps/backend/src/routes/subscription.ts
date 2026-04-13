import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { razorpayService } from '../services/razorpayService';

export const subscriptionRouter = Router();

subscriptionRouter.post('/create', (req: Request, _res: Response, next: NextFunction) => {
  console.log('[Subscription] POST /create - cookies:', JSON.stringify(req.cookies));
  console.log('[Subscription] POST /create - auth header:', req.headers.authorization);
  console.log('[Subscription] POST /create - origin:', req.headers.origin);
  next();
}, authenticate, async (req: Request, res: Response, next: NextFunction) => {
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
    let isValid = false;
    try {
      isValid = razorpayService.verifyWebhookSignature(rawBody, signature);
    } catch {
      // timingSafeEqual throws if buffer lengths differ — treat as invalid
      isValid = false;
    }

    if (!isValid) {
      console.log('[Subscription Webhook] Invalid signature');
      return res.status(400).json({ success: false, error: { message: 'Invalid signature' } });
    }

    const { event, payload } = req.body;
    await razorpayService.handleWebhookEvent(event, payload);

    res.json({ success: true });
  } catch (error) {
    console.error('[Subscription Webhook] Error:', error);
    // Return 200 to prevent Razorpay from retrying on internal errors
    // Signature was already verified at this point
    res.status(200).json({ success: true });
  }
});
