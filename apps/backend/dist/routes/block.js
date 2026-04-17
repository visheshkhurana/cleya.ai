"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.blockRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("@cleya/db");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
exports.blockRouter = (0, express_1.Router)();
const blockSchema = zod_1.z.object({
    blockedId: zod_1.z.string().cuid(),
    reason: zod_1.z.string().max(500).optional().nullable(),
});
exports.blockRouter.get('/', auth_1.authenticate, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const blocks = await db_1.prisma.blockedUser.findMany({
            where: { blockerId: userId },
            orderBy: { createdAt: 'desc' },
            include: {
                blocked: {
                    select: { id: true, name: true, email: true, profile: { select: { avatarUrl: true, headline: true } } },
                },
            },
        });
        res.json({ success: true, data: blocks });
    }
    catch (error) {
        next(error);
    }
});
exports.blockRouter.post('/', auth_1.authenticate, (0, validation_1.validate)(blockSchema), async (req, res, next) => {
    try {
        const blockerId = req.user.userId;
        const { blockedId, reason } = req.body;
        if (blockedId === blockerId) {
            return res.status(400).json({ success: false, error: { message: 'You cannot block yourself' } });
        }
        const target = await db_1.prisma.user.findUnique({ where: { id: blockedId }, select: { id: true } });
        if (!target) {
            return res.status(404).json({ success: false, error: { message: 'User not found' } });
        }
        const block = await db_1.prisma.blockedUser.upsert({
            where: { blockerId_blockedId: { blockerId, blockedId } },
            create: { blockerId, blockedId, reason: reason || null },
            update: { reason: reason || null },
        });
        res.json({ success: true, data: block });
    }
    catch (error) {
        next(error);
    }
});
exports.blockRouter.delete('/:blockedId', auth_1.authenticate, async (req, res, next) => {
    try {
        const blockerId = req.user.userId;
        const { blockedId } = req.params;
        await db_1.prisma.blockedUser.deleteMany({ where: { blockerId, blockedId } });
        res.json({ success: true });
    }
    catch (error) {
        next(error);
    }
});
//# sourceMappingURL=block.js.map