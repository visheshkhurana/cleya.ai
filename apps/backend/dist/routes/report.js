"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("@cleya/db");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const moderation_1 = require("../services/moderation");
exports.reportRouter = (0, express_1.Router)();
const createReportSchema = zod_1.z.object({
    targetUserId: zod_1.z.string().cuid(),
    targetType: zod_1.z.enum(['PROFILE', 'MESSAGE', 'MATCH', 'INTRODUCTION']),
    targetRefId: zod_1.z.string().max(200).optional().nullable(),
    category: zod_1.z.enum(['FAKE', 'SPAM', 'SCAM', 'HARASSMENT', 'INAPPROPRIATE', 'OTHER']),
    details: zod_1.z.string().max(2000).optional().nullable(),
});
exports.reportRouter.post('/', auth_1.authenticate, (0, validation_1.validate)(createReportSchema), async (req, res, next) => {
    try {
        const reporterId = req.user.userId;
        const { targetUserId, targetType, targetRefId, category, details } = req.body;
        if (targetUserId === reporterId) {
            return res.status(400).json({ success: false, error: { message: 'You cannot report yourself' } });
        }
        const targetExists = await db_1.prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true } });
        if (!targetExists) {
            return res.status(404).json({ success: false, error: { message: 'Target user not found' } });
        }
        const recentDuplicate = await db_1.prisma.report.findFirst({
            where: {
                reporterId,
                targetUserId,
                category,
                createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
            },
            select: { id: true },
        });
        if (recentDuplicate) {
            return res.status(429).json({ success: false, error: { message: 'You have already reported this user recently' } });
        }
        const report = await db_1.prisma.report.create({
            data: {
                reporterId,
                targetUserId,
                targetType,
                targetRefId: targetRefId || null,
                category,
                details: details || null,
            },
        });
        (0, moderation_1.notifyAdminsOfReport)(report.id).catch(() => { });
        res.json({ success: true, data: { id: report.id, status: report.status, createdAt: report.createdAt } });
    }
    catch (error) {
        next(error);
    }
});
exports.reportRouter.get('/mine', auth_1.authenticate, async (req, res, next) => {
    try {
        const reporterId = req.user.userId;
        const reports = await db_1.prisma.report.findMany({
            where: { reporterId },
            orderBy: { createdAt: 'desc' },
            take: 50,
            select: {
                id: true, targetUserId: true, targetType: true, category: true,
                status: true, createdAt: true, resolvedAt: true,
            },
        });
        res.json({ success: true, data: reports });
    }
    catch (error) {
        next(error);
    }
});
//# sourceMappingURL=report.js.map