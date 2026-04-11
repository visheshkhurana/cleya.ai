"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.conversationRouter = void 0;
const express_1 = require("express");
const client_1 = require("@prisma/client");
const auth_1 = require("../middleware/auth");
const conversationService_1 = require("../services/conversationService");
const prisma = new client_1.PrismaClient();
exports.conversationRouter = (0, express_1.Router)();
exports.conversationRouter.get('/', auth_1.authenticate, async (req, res, next) => {
    try {
        const conversations = await prisma.conversation.findMany({
            where: { userId: req.user.userId },
            orderBy: { startedAt: 'desc' },
            include: {
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                },
            },
        });
        res.json({
            success: true,
            data: conversations.map((c) => ({
                id: c.id,
                flowId: c.flowId,
                status: c.status,
                startedAt: c.startedAt,
                completedAt: c.completedAt,
                lastMessage: c.messages[0] || null,
            })),
        });
    }
    catch (error) {
        next(error);
    }
});
exports.conversationRouter.post('/start', auth_1.authenticate, async (req, res, next) => {
    try {
        const { flowId } = req.body;
        const result = await conversationService_1.conversationService.startConversation(req.user.userId, flowId);
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
});
// Resume an existing conversation
exports.conversationRouter.get('/:id', auth_1.authenticate, async (req, res, next) => {
    try {
        const conv = await prisma.conversation.findUnique({ where: { id: req.params.id }, select: { userId: true } });
        if (!conv || conv.userId !== req.user.userId) {
            res.status(404).json({ success: false, error: { message: 'Conversation not found' } });
            return;
        }
        const result = await conversationService_1.conversationService.resumeConversation(req.params.id);
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
});
const messageHandler = async (req, res, next) => {
    try {
        const conv = await prisma.conversation.findUnique({ where: { id: req.params.id }, select: { userId: true } });
        if (!conv || conv.userId !== req.user.userId) {
            res.status(404).json({ success: false, error: { message: 'Conversation not found' } });
            return;
        }
        const { choiceValue, formData, textInput } = req.body;
        const result = await conversationService_1.conversationService.processInput(req.params.id, {
            choiceValue,
            formData,
            textInput,
        });
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
};
exports.conversationRouter.post('/:id/message', auth_1.authenticate, messageHandler);
exports.conversationRouter.post('/:id/messages', auth_1.authenticate, messageHandler);
//# sourceMappingURL=conversation.js.map