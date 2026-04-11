"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.messagingRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const messagingService_1 = require("../services/messagingService");
exports.messagingRouter = (0, express_1.Router)();
exports.messagingRouter.post('/whatsapp/send', auth_1.authenticate, async (req, res, next) => {
    try {
        const { phoneNumber, message } = req.body;
        if (!phoneNumber || !message) {
            return res.status(400).json({
                success: false,
                error: { message: 'phoneNumber and message are required', code: 'MISSING_FIELDS' },
            });
        }
        const result = await messagingService_1.messagingService.sendWhatsApp(req.user.userId, phoneNumber, message);
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
});
exports.messagingRouter.post('/sms/send', auth_1.authenticate, async (req, res, next) => {
    try {
        const { phoneNumber, message } = req.body;
        if (!phoneNumber || !message) {
            return res.status(400).json({
                success: false,
                error: { message: 'phoneNumber and message are required', code: 'MISSING_FIELDS' },
            });
        }
        const result = await messagingService_1.messagingService.sendSMS(req.user.userId, phoneNumber, message);
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
});
exports.messagingRouter.get('/history', auth_1.authenticate, async (req, res, next) => {
    try {
        const messages = await messagingService_1.messagingService.getMessageHistory(req.user.userId);
        res.json({ success: true, data: messages });
    }
    catch (error) {
        next(error);
    }
});
//# sourceMappingURL=messaging.js.map