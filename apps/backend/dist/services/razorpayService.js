"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FREE_MATCH_LIMIT = exports.razorpayService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const db_1 = require("@cleya/db");
const env_1 = require("../config/env");
const errorHandler_1 = require("../middleware/errorHandler");
const FREE_MATCH_LIMIT = 10;
exports.FREE_MATCH_LIMIT = FREE_MATCH_LIMIT;
const FREE_MATCH_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
/**
 * Returns the current monthly counter, rolling it over if the 30-day window
 * has elapsed since the user's last reset. Returns the values to use when
 * computing remaining matches, but does NOT persist a rollover unless one
 * is needed (caller persists when needed).
 */
async function getMonthlyMatchUsage(userId) {
    const user = await db_1.prisma.user.findUnique({
        where: { id: userId },
        select: { monthlyMatchesUsed: true, monthlyResetAt: true, createdAt: true },
    });
    if (!user)
        throw new errorHandler_1.AppError(404, 'User not found');
    const now = new Date();
    const anchor = user.monthlyResetAt ?? user.createdAt;
    const windowStart = new Date(anchor.getTime());
    if (now.getTime() - windowStart.getTime() >= FREE_MATCH_WINDOW_MS) {
        // Roll over: reset counter and anchor to now.
        await db_1.prisma.user.update({
            where: { id: userId },
            data: { monthlyMatchesUsed: 0, monthlyResetAt: now },
        });
        return { used: 0, resetAt: now };
    }
    return { used: user.monthlyMatchesUsed, resetAt: anchor };
}
class RazorpayService {
    keyId;
    keySecret;
    planId;
    webhookSecret;
    baseUrl = 'https://api.razorpay.com/v1';
    constructor() {
        this.keyId = env_1.env.RAZORPAY_KEY_ID || '';
        this.keySecret = env_1.env.RAZORPAY_KEY_SECRET || '';
        this.planId = env_1.env.RAZORPAY_PLAN_ID || '';
        this.webhookSecret = env_1.env.RAZORPAY_WEBHOOK_SECRET || '';
    }
    isConfigured() {
        return !!(this.keyId && this.keySecret && this.planId);
    }
    getAuthHeader() {
        return 'Basic ' + Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
    }
    async apiRequest(method, path, body) {
        const res = await fetch(`${this.baseUrl}${path}`, {
            method,
            headers: {
                'Authorization': this.getAuthHeader(),
                'Content-Type': 'application/json',
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
        });
        const data = await res.json();
        if (!res.ok) {
            console.error('[RazorpayService] API error:', data);
            throw new errorHandler_1.AppError(502, data.error?.description || 'Razorpay API error', 'RAZORPAY_ERROR');
        }
        return data;
    }
    async createSubscription(userId, email) {
        if (!this.isConfigured()) {
            throw new errorHandler_1.AppError(503, 'Payment service not configured', 'PAYMENT_NOT_CONFIGURED');
        }
        const existingSub = await db_1.prisma.subscription.findUnique({ where: { userId } });
        if (existingSub?.status === 'ACTIVE') {
            throw new errorHandler_1.AppError(400, 'You already have an active subscription', 'ALREADY_SUBSCRIBED');
        }
        const rzpSub = await this.apiRequest('POST', '/subscriptions', {
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
        await db_1.prisma.subscription.upsert({
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
    async getSubscriptionStatus(userId) {
        const user = await db_1.prisma.user.findUnique({
            where: { id: userId },
            select: { tier: true, matchesUsed: true, bonusMatches: true },
        });
        const subscription = await db_1.prisma.subscription.findUnique({
            where: { userId },
        });
        const bonusMatches = user?.bonusMatches || 0;
        const effectiveLimit = FREE_MATCH_LIMIT + bonusMatches;
        let monthlyUsed = 0;
        let resetAt = null;
        if (user?.tier === 'FREE') {
            const usage = await getMonthlyMatchUsage(userId);
            monthlyUsed = usage.used;
            resetAt = new Date(usage.resetAt.getTime() + FREE_MATCH_WINDOW_MS);
        }
        const matchesRemaining = user?.tier === 'FREE'
            ? Math.max(0, effectiveLimit - monthlyUsed)
            : -1;
        return {
            tier: user?.tier || 'FREE',
            matchesUsed: user?.matchesUsed || 0,
            monthlyMatchesUsed: monthlyUsed,
            matchesResetAt: resetAt,
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
    verifyWebhookSignature(body, signature) {
        if (!this.webhookSecret)
            return false;
        const expectedSignature = crypto_1.default
            .createHmac('sha256', this.webhookSecret)
            .update(body)
            .digest('hex');
        return crypto_1.default.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    }
    async handleWebhookEvent(event, payload) {
        console.log(`[RazorpayService] Webhook event: ${event}`);
        const subscriptionEntity = payload.subscription?.entity;
        const paymentEntity = payload.payment?.entity;
        switch (event) {
            case 'subscription.activated':
            case 'subscription.charged': {
                if (!subscriptionEntity)
                    return;
                const sub = await db_1.prisma.subscription.findUnique({
                    where: { razorpaySubscriptionId: subscriptionEntity.id },
                });
                if (!sub) {
                    console.log(`[RazorpayService] No subscription found for ${subscriptionEntity.id}`);
                    return;
                }
                await db_1.prisma.subscription.update({
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
                await db_1.prisma.user.update({
                    where: { id: sub.userId },
                    data: { tier: 'PRO' },
                });
                console.log(`[RazorpayService] User ${sub.userId} upgraded to PRO`);
                break;
            }
            case 'subscription.cancelled':
            case 'subscription.completed':
            case 'subscription.expired': {
                if (!subscriptionEntity)
                    return;
                const sub = await db_1.prisma.subscription.findUnique({
                    where: { razorpaySubscriptionId: subscriptionEntity.id },
                });
                if (!sub)
                    return;
                const statusMap = {
                    'subscription.cancelled': 'CANCELLED',
                    'subscription.completed': 'COMPLETED',
                    'subscription.expired': 'EXPIRED',
                };
                await db_1.prisma.subscription.update({
                    where: { id: sub.id },
                    data: {
                        status: statusMap[event],
                        cancelledAt: event === 'subscription.cancelled' ? new Date() : undefined,
                    },
                });
                await db_1.prisma.user.update({
                    where: { id: sub.userId },
                    data: { tier: 'FREE' },
                });
                console.log(`[RazorpayService] User ${sub.userId} reverted to FREE (${event})`);
                break;
            }
            case 'subscription.halted': {
                if (!subscriptionEntity)
                    return;
                const sub = await db_1.prisma.subscription.findUnique({
                    where: { razorpaySubscriptionId: subscriptionEntity.id },
                });
                if (!sub)
                    return;
                await db_1.prisma.subscription.update({
                    where: { id: sub.id },
                    data: { status: 'HALTED' },
                });
                await db_1.prisma.user.update({
                    where: { id: sub.userId },
                    data: { tier: 'FREE' },
                });
                console.log(`[RazorpayService] User ${sub.userId} subscription halted`);
                break;
            }
            case 'payment.failed': {
                if (!paymentEntity?.notes?.userId)
                    return;
                console.log(`[RazorpayService] Payment failed for user ${paymentEntity.notes.userId}`);
                break;
            }
            default:
                console.log(`[RazorpayService] Unhandled event: ${event}`);
        }
    }
    async checkPaywall(userId) {
        const user = await db_1.prisma.user.findUnique({
            where: { id: userId },
            select: { tier: true, matchesUsed: true, bonusMatches: true },
        });
        if (!user) {
            throw new errorHandler_1.AppError(404, 'User not found');
        }
        if (user.tier === 'PRO' || user.tier === 'ENTERPRISE') {
            return { allowed: true, matchesUsed: user.matchesUsed, matchesRemaining: -1, tier: user.tier, freeMatchLimit: -1, bonusMatches: user.bonusMatches };
        }
        const usage = await getMonthlyMatchUsage(userId);
        const effectiveLimit = FREE_MATCH_LIMIT + user.bonusMatches;
        const allowed = usage.used < effectiveLimit;
        return {
            allowed,
            matchesUsed: usage.used,
            matchesRemaining: Math.max(0, effectiveLimit - usage.used),
            tier: user.tier,
            freeMatchLimit: effectiveLimit,
            bonusMatches: user.bonusMatches,
        };
    }
    async incrementMatchesUsed(userId) {
        // Roll the monthly window first if it's elapsed, then increment both
        // counters atomically.
        await getMonthlyMatchUsage(userId);
        await db_1.prisma.user.update({
            where: { id: userId },
            data: {
                matchesUsed: { increment: 1 },
                monthlyMatchesUsed: { increment: 1 },
            },
        });
    }
}
exports.razorpayService = new RazorpayService();
//# sourceMappingURL=razorpayService.js.map