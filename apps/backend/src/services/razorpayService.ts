import crypto from 'crypto';
import { prisma } from '@cleya/db';
import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler';

const FREE_MATCH_LIMIT = 5;

interface RazorpaySubscription {
  id: string;
  plan_id: string;
  customer_id?: string;
  status: string;
  current_start?: number;
  current_end?: number;
  short_url?: string;
}

class RazorpayService {
  private keyId: string;
  private keySecret: string;
  private planId: string;
  private webhookSecret: string;
  private baseUrl = 'https://api.razorpay.com/v1';

  constructor() {
    this.keyId = env.RAZORPAY_KEY_ID || '';
    this.keySecret = env.RAZORPAY_KEY_SECRET || '';
    this.planId = env.RAZORPAY_PLAN_ID || '';
    this.webhookSecret = env.RAZORPAY_WEBHOOK_SECRET || '';
  }

  isConfigured(): boolean {
    return !!(this.keyId && this.keySecret && this.planId);
  }

  private getAuthHeader(): string {
    return 'Basic ' + Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
  }

  private async apiRequest(method: string, path: string, body?: any): Promise<any> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Authorization': this.getAuthHeader(),
        'Content-Type': 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const data: any = await res.json();
    if (!res.ok) {
      console.error('[RazorpayService] API error:', data);
      throw new AppError(502, data.error?.description || 'Razorpay API error', 'RAZORPAY_ERROR');
    }
    return data;
  }

  async createSubscription(userId: string, email: string): Promise<{ subscriptionId: string; keyId: string; shortUrl?: string }> {
    if (!this.isConfigured()) {
      throw new AppError(503, 'Payment service not configured', 'PAYMENT_NOT_CONFIGURED');
    }

    const existingSub = await prisma.subscription.findUnique({ where: { userId } });
    if (existingSub?.status === 'ACTIVE') {
      throw new AppError(400, 'You already have an active subscription', 'ALREADY_SUBSCRIBED');
    }

    const rzpSub: RazorpaySubscription = await this.apiRequest('POST', '/subscriptions', {
      plan_id: this.planId,
      total_count: 120,
      quantity: 1,
      notify_info: {
        notify_email: email,
      },
      notes: {
        userId,
        email,
      },
    });

    await prisma.subscription.upsert({
      where: { userId },
      update: {
        razorpaySubscriptionId: rzpSub.id,
        razorpayPlanId: this.planId,
        status: 'CREATED',
      },
      create: {
        userId,
        razorpaySubscriptionId: rzpSub.id,
        razorpayPlanId: this.planId,
        status: 'CREATED',
      },
    });

    return {
      subscriptionId: rzpSub.id,
      keyId: this.keyId,
      shortUrl: rzpSub.short_url,
    };
  }

  async getSubscriptionStatus(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tier: true, matchesUsed: true, bonusMatches: true },
    });

    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    const bonusMatches = user?.bonusMatches || 0;
    const effectiveLimit = FREE_MATCH_LIMIT + bonusMatches;
    const matchesRemaining = user?.tier === 'FREE'
      ? Math.max(0, effectiveLimit - (user?.matchesUsed || 0))
      : -1;

    return {
      tier: user?.tier || 'FREE',
      matchesUsed: user?.matchesUsed || 0,
      matchesRemaining,
      freeMatchLimit: effectiveLimit,
      bonusMatches,
      subscription: subscription ? {
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelledAt: subscription.cancelledAt,
      } : null,
    };
  }

  verifyWebhookSignature(body: string, signature: string): boolean {
    if (!this.webhookSecret) return false;
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(body)
      .digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  async handleWebhookEvent(event: string, payload: any): Promise<void> {
    console.log(`[RazorpayService] Webhook event: ${event}`);

    const subscriptionEntity = payload.subscription?.entity;
    const paymentEntity = payload.payment?.entity;

    switch (event) {
      case 'subscription.activated':
      case 'subscription.charged': {
        if (!subscriptionEntity) return;
        const sub = await prisma.subscription.findUnique({
          where: { razorpaySubscriptionId: subscriptionEntity.id },
        });
        if (!sub) {
          console.log(`[RazorpayService] No subscription found for ${subscriptionEntity.id}`);
          return;
        }

        await prisma.subscription.update({
          where: { id: sub.id },
          data: {
            status: 'ACTIVE',
            currentPeriodStart: subscriptionEntity.current_start
              ? new Date(subscriptionEntity.current_start * 1000)
              : new Date(),
            currentPeriodEnd: subscriptionEntity.current_end
              ? new Date(subscriptionEntity.current_end * 1000)
              : null,
          },
        });

        await prisma.user.update({
          where: { id: sub.userId },
          data: { tier: 'PRO' },
        });

        console.log(`[RazorpayService] User ${sub.userId} upgraded to PRO`);
        break;
      }

      case 'subscription.cancelled':
      case 'subscription.completed':
      case 'subscription.expired': {
        if (!subscriptionEntity) return;
        const sub = await prisma.subscription.findUnique({
          where: { razorpaySubscriptionId: subscriptionEntity.id },
        });
        if (!sub) return;

        const statusMap: Record<string, string> = {
          'subscription.cancelled': 'CANCELLED',
          'subscription.completed': 'COMPLETED',
          'subscription.expired': 'EXPIRED',
        };

        await prisma.subscription.update({
          where: { id: sub.id },
          data: {
            status: statusMap[event] as any,
            cancelledAt: event === 'subscription.cancelled' ? new Date() : undefined,
          },
        });

        await prisma.user.update({
          where: { id: sub.userId },
          data: { tier: 'FREE' },
        });

        console.log(`[RazorpayService] User ${sub.userId} reverted to FREE (${event})`);
        break;
      }

      case 'subscription.halted': {
        if (!subscriptionEntity) return;
        const sub = await prisma.subscription.findUnique({
          where: { razorpaySubscriptionId: subscriptionEntity.id },
        });
        if (!sub) return;

        await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: 'HALTED' },
        });

        await prisma.user.update({
          where: { id: sub.userId },
          data: { tier: 'FREE' },
        });

        console.log(`[RazorpayService] User ${sub.userId} subscription halted`);
        break;
      }

      case 'payment.failed': {
        if (!paymentEntity?.notes?.userId) return;
        console.log(`[RazorpayService] Payment failed for user ${paymentEntity.notes.userId}`);
        break;
      }

      default:
        console.log(`[RazorpayService] Unhandled event: ${event}`);
    }
  }

  async checkPaywall(userId: string): Promise<{ allowed: boolean; matchesUsed: number; matchesRemaining: number; tier: string; freeMatchLimit: number; bonusMatches: number }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tier: true, matchesUsed: true, bonusMatches: true },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    if (user.tier === 'PRO' || user.tier === 'ENTERPRISE') {
      return { allowed: true, matchesUsed: user.matchesUsed, matchesRemaining: -1, tier: user.tier, freeMatchLimit: -1, bonusMatches: user.bonusMatches };
    }

    const effectiveLimit = FREE_MATCH_LIMIT + user.bonusMatches;
    const allowed = user.matchesUsed < effectiveLimit;
    return {
      allowed,
      matchesUsed: user.matchesUsed,
      matchesRemaining: Math.max(0, effectiveLimit - user.matchesUsed),
      tier: user.tier,
      freeMatchLimit: effectiveLimit,
      bonusMatches: user.bonusMatches,
    };
  }

  async incrementMatchesUsed(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { matchesUsed: { increment: 1 } },
    });
  }
}

export const razorpayService = new RazorpayService();
export { FREE_MATCH_LIMIT };
