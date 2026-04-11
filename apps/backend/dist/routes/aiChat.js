"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiChatRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const ai_1 = require("../services/ai");
const db_1 = require("@cleya/db");
exports.aiChatRouter = (0, express_1.Router)();
const AI_CHAT_FLOW_ID = 'ai_chat_freeform';
async function getOrCreateAIChatConversation(userId) {
    let conversation = await db_1.prisma.conversation.findFirst({
        where: { userId, flowId: AI_CHAT_FLOW_ID, status: 'ACTIVE' },
    });
    if (!conversation) {
        conversation = await db_1.prisma.conversation.create({
            data: {
                userId,
                flowId: AI_CHAT_FLOW_ID,
                status: 'ACTIVE',
                currentNode: 'ai_chat',
                context: {},
            },
        });
    }
    return conversation;
}
exports.aiChatRouter.get('/history', auth_1.authenticate, async (req, res, next) => {
    try {
        const conversation = await db_1.prisma.conversation.findFirst({
            where: { userId: req.user.userId, flowId: AI_CHAT_FLOW_ID, status: 'ACTIVE' },
        });
        if (!conversation) {
            res.json({ success: true, data: { messages: [] } });
            return;
        }
        const messagesDesc = await db_1.prisma.message.findMany({
            where: { conversationId: conversation.id },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
        if (messagesDesc.length === 0) {
            res.json({ success: true, data: { messages: [] } });
            return;
        }
        const messages = messagesDesc.reverse();
        res.json({
            success: true,
            data: {
                messages: messages.map((m) => ({
                    sender: m.sender,
                    content: m.content,
                    createdAt: m.createdAt,
                })),
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.aiChatRouter.post('/message', auth_1.authenticate, async (req, res, next) => {
    try {
        const { message, history } = req.body;
        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            res.status(400).json({ success: false, error: { message: 'Message is required' } });
            return;
        }
        if (message.length > 2000) {
            res.status(400).json({ success: false, error: { message: 'Message too long (max 2000 characters)' } });
            return;
        }
        const conversation = await getOrCreateAIChatConversation(req.user.userId);
        await db_1.prisma.message.create({
            data: {
                conversationId: conversation.id,
                sender: 'USER',
                content: message.trim(),
            },
        });
        const dbHistoryDesc = await db_1.prisma.message.findMany({
            where: { conversationId: conversation.id },
            orderBy: { createdAt: 'desc' },
            take: 20,
        });
        const validHistory = dbHistoryDesc.reverse().map((m) => ({
            role: m.sender === 'AI' ? 'assistant' : 'user',
            content: m.content,
        }));
        const result = await (0, ai_1.chatWithCleo)(req.user.userId, message.trim(), validHistory);
        await db_1.prisma.message.create({
            data: {
                conversationId: conversation.id,
                sender: 'AI',
                content: result.content,
            },
        });
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
});
//# sourceMappingURL=aiChat.js.map