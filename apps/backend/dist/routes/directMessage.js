"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.directMessageRouter = void 0;
const express_1 = require("express");
const client_1 = require("@prisma/client");
const auth_1 = require("../middleware/auth");
const server_1 = require("../websocket/server");
const prisma = new client_1.PrismaClient();
exports.directMessageRouter = (0, express_1.Router)();
exports.directMessageRouter.get('/conversations', auth_1.authenticate, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const messages = await prisma.directMessage.findMany({
            where: {
                OR: [{ senderId: userId }, { recipientId: userId }],
            },
            orderBy: { createdAt: 'desc' },
            include: {
                sender: { select: { id: true, email: true, name: true, profile: { select: { persona: true, headline: true, companyName: true, currentRole: true, location: true } } } },
                recipient: { select: { id: true, email: true, name: true, profile: { select: { persona: true, headline: true, companyName: true, currentRole: true, location: true } } } },
            },
        });
        const conversationMap = new Map();
        for (const msg of messages) {
            const otherId = msg.senderId === userId ? msg.recipientId : msg.senderId;
            if (!conversationMap.has(otherId)) {
                const other = msg.senderId === userId ? msg.recipient : msg.sender;
                const unreadCount = await prisma.directMessage.count({
                    where: { senderId: otherId, recipientId: userId, readAt: null },
                });
                conversationMap.set(otherId, {
                    partnerId: otherId,
                    partner: other,
                    lastMessage: msg.content,
                    lastMessageAt: msg.createdAt,
                    unreadCount,
                });
            }
        }
        const conversations = Array.from(conversationMap.values()).sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
        res.json({ success: true, data: conversations });
    }
    catch (error) {
        next(error);
    }
});
exports.directMessageRouter.get('/:partnerId', auth_1.authenticate, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { partnerId } = req.params;
        const limit = parseInt(req.query.limit) || 50;
        const before = req.query.before;
        const hasAcceptedMatch = await prisma.match.findFirst({
            where: {
                status: 'ACCEPTED',
                OR: [
                    { userAId: userId, userBId: partnerId },
                    { userAId: partnerId, userBId: userId },
                ],
            },
        });
        if (!hasAcceptedMatch) {
            res.status(403).json({ success: false, error: { message: 'You can only message accepted matches' } });
            return;
        }
        const whereClause = {
            OR: [
                { senderId: userId, recipientId: partnerId },
                { senderId: partnerId, recipientId: userId },
            ],
        };
        if (before) {
            whereClause.createdAt = { lt: new Date(before) };
        }
        const messages = await prisma.directMessage.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: {
                sender: { select: { id: true, name: true, email: true } },
            },
        });
        await prisma.directMessage.updateMany({
            where: { senderId: partnerId, recipientId: userId, readAt: null },
            data: { readAt: new Date() },
        });
        res.json({ success: true, data: messages.reverse() });
    }
    catch (error) {
        next(error);
    }
});
exports.directMessageRouter.post('/:partnerId', auth_1.authenticate, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { partnerId } = req.params;
        const { content } = req.body;
        if (!content || typeof content !== 'string' || content.trim().length === 0) {
            res.status(400).json({ success: false, error: { message: 'Message content is required' } });
            return;
        }
        if (content.length > 2000) {
            res.status(400).json({ success: false, error: { message: 'Message too long (max 2000 characters)' } });
            return;
        }
        const hasAcceptedMatch = await prisma.match.findFirst({
            where: {
                status: 'ACCEPTED',
                OR: [
                    { userAId: userId, userBId: partnerId },
                    { userAId: partnerId, userBId: userId },
                ],
            },
        });
        if (!hasAcceptedMatch) {
            res.status(403).json({ success: false, error: { message: 'You can only message accepted matches' } });
            return;
        }
        const message = await prisma.directMessage.create({
            data: {
                senderId: userId,
                recipientId: partnerId,
                matchId: hasAcceptedMatch.id,
                content: content.trim(),
            },
            include: {
                sender: { select: { id: true, name: true, email: true } },
            },
        });
        (0, server_1.sendToUser)(partnerId, 'dm:new', {
            message: {
                id: message.id,
                senderId: message.senderId,
                content: message.content,
                createdAt: message.createdAt,
                sender: message.sender,
            },
        });
        res.json({ success: true, data: message });
    }
    catch (error) {
        next(error);
    }
});
exports.directMessageRouter.post('/:partnerId/read', auth_1.authenticate, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { partnerId } = req.params;
        await prisma.directMessage.updateMany({
            where: { senderId: partnerId, recipientId: userId, readAt: null },
            data: { readAt: new Date() },
        });
        (0, server_1.sendToUser)(partnerId, 'dm:read', { readBy: userId });
        res.json({ success: true });
    }
    catch (error) {
        next(error);
    }
});
//# sourceMappingURL=directMessage.js.map