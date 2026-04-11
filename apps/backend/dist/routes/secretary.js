"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.secretaryRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const secretaryService_1 = require("../services/secretaryService");
const email_1 = require("../services/email");
const db_1 = require("@cleya/db");
exports.secretaryRouter = (0, express_1.Router)();
exports.secretaryRouter.use(auth_1.authenticate);
exports.secretaryRouter.post('/chat', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return res.status(400).json({ success: false, error: 'Message is required' });
        }
        const result = await (0, secretaryService_1.chatWithSecretary)(req.user.userId, message.trim());
        res.json({ success: true, data: result });
    }
    catch (err) {
        console.error('Secretary chat error:', err);
        res.status(500).json({ success: false, error: 'Failed to process message' });
    }
});
exports.secretaryRouter.post('/action', async (req, res) => {
    try {
        const { action } = req.body;
        if (!action || !action.type) {
            return res.status(400).json({ success: false, error: 'Action is required' });
        }
        const result = await (0, secretaryService_1.executeSecretaryAction)(req.user.userId, action);
        res.json({ success: true, data: result });
    }
    catch (err) {
        console.error('Secretary action error:', err);
        res.status(500).json({ success: false, error: 'Failed to execute action' });
    }
});
exports.secretaryRouter.get('/digest', async (req, res) => {
    try {
        const digest = await (0, secretaryService_1.generateDailyDigest)(req.user.userId);
        res.json({ success: true, data: { digest } });
    }
    catch (err) {
        console.error('Digest generation error:', err);
        res.status(500).json({ success: false, error: 'Failed to generate digest' });
    }
});
exports.secretaryRouter.post('/digest/send', async (req, res) => {
    try {
        const user = await db_1.prisma.user.findUnique({ where: { id: req.user.userId } });
        if (!user)
            return res.status(404).json({ success: false, error: 'User not found' });
        const digest = await (0, secretaryService_1.generateDailyDigest)(req.user.userId);
        await email_1.emailService.sendDailyDigest(user.email, digest);
        res.json({ success: true, message: 'Daily digest sent to your email' });
    }
    catch (err) {
        console.error('Digest send error:', err);
        res.status(500).json({ success: false, error: 'Failed to send digest' });
    }
});
exports.secretaryRouter.get('/history', async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const history = await (0, secretaryService_1.getConversationHistory)(req.user.userId, limit);
        res.json({ success: true, data: history });
    }
    catch (err) {
        console.error('History fetch error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch history' });
    }
});
exports.secretaryRouter.delete('/history', async (req, res) => {
    try {
        await (0, secretaryService_1.clearConversationHistory)(req.user.userId);
        res.json({ success: true, message: 'Conversation history cleared' });
    }
    catch (err) {
        console.error('History clear error:', err);
        res.status(500).json({ success: false, error: 'Failed to clear history' });
    }
});
//# sourceMappingURL=secretary.js.map