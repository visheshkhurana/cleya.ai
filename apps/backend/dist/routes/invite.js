"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.inviteRouter = void 0;
const express_1 = require("express");
const db_1 = require("@cleya/db");
const auth_1 = require("../middleware/auth");
const crypto_1 = __importDefault(require("crypto"));
exports.inviteRouter = (0, express_1.Router)();
function generateCode() {
    return crypto_1.default.randomBytes(4).toString('hex').toUpperCase().slice(0, 8);
}
exports.inviteRouter.get('/my-codes', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        let codes = await db_1.prisma.inviteCode.findMany({
            where: { createdById: userId },
            orderBy: { createdAt: 'desc' },
        });
        if (codes.length === 0) {
            const newCodes = [];
            for (let i = 0; i < 3; i++) {
                newCodes.push(db_1.prisma.inviteCode.create({
                    data: { code: generateCode(), createdById: userId },
                }));
            }
            codes = await Promise.all(newCodes);
        }
        res.json({
            success: true,
            data: codes.map((c) => ({
                id: c.id,
                code: c.code,
                used: !!c.usedById,
                usedAt: c.usedAt,
                createdAt: c.createdAt,
            })),
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: { message: error.message } });
    }
});
exports.inviteRouter.get('/validate/:code', async (req, res) => {
    try {
        const invite = await db_1.prisma.inviteCode.findUnique({
            where: { code: req.params.code },
            include: {
                createdBy: {
                    include: { profile: { select: { currentRole: true, companyName: true } } },
                },
            },
        });
        if (!invite || invite.usedById || !invite.isActive) {
            res.json({ success: true, data: { valid: false } });
            return;
        }
        const creator = invite.createdBy;
        res.json({
            success: true,
            data: {
                valid: true,
                inviterName: creator?.name || creator?.email?.split('@')[0],
                inviterTitle: creator?.profile?.currentRole,
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: { message: error.message } });
    }
});
exports.inviteRouter.post('/use/:code', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const invite = await db_1.prisma.inviteCode.findUnique({ where: { code: req.params.code } });
        if (!invite || invite.usedById || !invite.isActive) {
            res.status(400).json({ success: false, error: { message: 'Invalid or already used invite code' } });
            return;
        }
        await db_1.prisma.inviteCode.update({
            where: { id: invite.id },
            data: { usedById: userId, usedAt: new Date() },
        });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ success: false, error: { message: error.message } });
    }
});
//# sourceMappingURL=invite.js.map