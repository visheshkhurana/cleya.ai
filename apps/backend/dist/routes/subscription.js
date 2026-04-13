"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscriptionRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const razorpayService_1 = require("../services/razorpayService");
exports.subscriptionRouter = (0, express_1.Router)();
exports.subscriptionRouter.post('/create', auth_1.authenticate, async (req, res, next) => {
    try {
        const result = await razorpayService_1.razorpayService.createSubscription(req.user.userId, req.user.email);
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
});
exports.subscriptionRouter.get('/status', auth_1.authenticate, async (req, res, next) => {
    try {
        const status = await razorpayService_1.razorpayService.getSubscriptionStatus(req.user.userId);
        res.json({ success: true, data: status });
    }
    catch (error) {
        next(error);
    }
});
exports.subscriptionRouter.post('/webhook', async (req, res, next) => {
    try {
        const signature = req.headers['x-razorpay-signature'];
        if (!signature) {
            return res.status(400).json({ success: false, error: { message: 'Missing signature' } });
        }
        const rawBody = req.rawBody || JSON.stringify(req.body);
        let isValid = false;
        try {
            isValid = razorpayService_1.razorpayService.verifyWebhookSignature(rawBody, signature);
        }
        catch {
            // timingSafeEqual throws if buffer lengths differ — treat as invalid
            isValid = false;
        }
        if (!isValid) {
            console.log('[Subscription Webhook] Invalid signature');
            return res.status(400).json({ success: false, error: { message: 'Invalid signature' } });
        }
        const { event, payload } = req.body;
        await razorpayService_1.razorpayService.handleWebhookEvent(event, payload);
        res.json({ success: true });
    }
    catch (error) {
        console.error('[Subscription Webhook] Error:', error);
        // Return 200 to prevent Razorpay from retrying on internal errors
        // Signature was already verified at this point
        res.status(200).json({ success: true });
    }
});
//# sourceMappingURL=subscription.js.map