"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.introductionRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const db_1 = require("@cleya/db");
const validation_1 = require("../middleware/validation");
const introductionService_1 = require("../services/introductionService");
exports.introductionRouter = (0, express_1.Router)();
exports.introductionRouter.get('/', auth_1.authenticate, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const introductions = await db_1.prisma.introductionRecord.findMany({
            where: {
                OR: [{ userAId: userId }, { userBId: userId }],
            },
            include: {
                match: true,
                userA: { include: { profile: true } },
                userB: { include: { profile: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json({ success: true, data: introductions });
    }
    catch (error) {
        next(error);
    }
});
exports.introductionRouter.get('/:id', auth_1.authenticate, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const intro = await db_1.prisma.introductionRecord.findFirst({
            where: {
                id: req.params.id,
                OR: [{ userAId: userId }, { userBId: userId }],
            },
            include: {
                match: true,
                userA: { include: { profile: true } },
                userB: { include: { profile: true } },
            },
        });
        if (!intro) {
            return res.status(404).json({ success: false, error: { message: 'Introduction not found' } });
        }
        res.json({ success: true, data: intro });
    }
    catch (error) {
        next(error);
    }
});
exports.introductionRouter.patch('/:id/status', auth_1.authenticate, (0, validation_1.validate)(validation_1.introductionStatusSchema), async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { status, scheduledAt, notes } = req.body;
        const allowedTransitions = {
            PENDING_APPROVAL: [],
            APPROVED: [],
            SENT: [],
            VIEWED: ['RESPONDED'],
            RESPONDED: ['MEETING_SCHEDULED'],
            FOLLOWED_UP: ['RESPONDED'],
        };
        const intro = await db_1.prisma.introductionRecord.findFirst({
            where: {
                id: req.params.id,
                OR: [{ userAId: userId }, { userBId: userId }],
            },
        });
        if (!intro) {
            return res.status(404).json({ success: false, error: { message: 'Introduction not found' } });
        }
        const allowed = allowedTransitions[intro.status] || [];
        if (!allowed.includes(status)) {
            return res.status(400).json({
                success: false,
                error: { message: `Cannot transition from ${intro.status} to ${status}. Use the approve, cancel, or outcome endpoints instead.` },
            });
        }
        const updated = await db_1.prisma.introductionRecord.update({
            where: { id: intro.id },
            data: {
                status,
                ...(scheduledAt ? { scheduledAt: new Date(scheduledAt) } : {}),
                ...(notes !== undefined ? { notes } : {}),
            },
            include: {
                match: true,
                userA: { include: { profile: true } },
                userB: { include: { profile: true } },
            },
        });
        res.json({ success: true, data: updated });
    }
    catch (error) {
        next(error);
    }
});
exports.introductionRouter.post('/:id/approve', auth_1.authenticate, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const intro = await db_1.prisma.introductionRecord.findFirst({
            where: {
                id: req.params.id,
                OR: [{ userAId: userId }, { userBId: userId }],
            },
        });
        if (!intro) {
            return res.status(404).json({ success: false, error: { message: 'Introduction not found' } });
        }
        if (intro.status !== 'PENDING_APPROVAL') {
            return res.status(400).json({ success: false, error: { message: 'Introduction is not pending approval' } });
        }
        const result = await introductionService_1.introductionService.approveAndSend(intro.id);
        if (!result) {
            return res.status(500).json({ success: false, error: { message: 'Failed to approve introduction' } });
        }
        const updated = await db_1.prisma.introductionRecord.findUnique({
            where: { id: intro.id },
            include: {
                match: true,
                userA: { include: { profile: true } },
                userB: { include: { profile: true } },
            },
        });
        res.json({ success: true, data: updated });
    }
    catch (error) {
        next(error);
    }
});
exports.introductionRouter.patch('/:id/edit', auth_1.authenticate, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { introText } = req.body;
        if (!introText || typeof introText !== 'string' || introText.trim().length < 10) {
            return res.status(400).json({ success: false, error: { message: 'Introduction text must be at least 10 characters' } });
        }
        const intro = await db_1.prisma.introductionRecord.findFirst({
            where: {
                id: req.params.id,
                OR: [{ userAId: userId }, { userBId: userId }],
            },
        });
        if (!intro) {
            return res.status(404).json({ success: false, error: { message: 'Introduction not found' } });
        }
        if (intro.status !== 'PENDING_APPROVAL') {
            return res.status(400).json({ success: false, error: { message: 'Can only edit introductions pending approval' } });
        }
        const updated = await db_1.prisma.introductionRecord.update({
            where: { id: intro.id },
            data: { introText: introText.trim() },
            include: {
                match: true,
                userA: { include: { profile: true } },
                userB: { include: { profile: true } },
            },
        });
        res.json({ success: true, data: updated });
    }
    catch (error) {
        next(error);
    }
});
exports.introductionRouter.post('/:id/cancel', auth_1.authenticate, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const intro = await db_1.prisma.introductionRecord.findFirst({
            where: {
                id: req.params.id,
                OR: [{ userAId: userId }, { userBId: userId }],
            },
        });
        if (!intro) {
            return res.status(404).json({ success: false, error: { message: 'Introduction not found' } });
        }
        if (intro.status === 'COMPLETED' || intro.status === 'CANCELLED') {
            return res.status(400).json({ success: false, error: { message: 'Cannot cancel this introduction' } });
        }
        const updated = await db_1.prisma.introductionRecord.update({
            where: { id: intro.id },
            data: { status: 'CANCELLED' },
            include: {
                match: true,
                userA: { include: { profile: true } },
                userB: { include: { profile: true } },
            },
        });
        res.json({ success: true, data: updated });
    }
    catch (error) {
        next(error);
    }
});
exports.introductionRouter.post('/:id/outcome', auth_1.authenticate, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { outcome, outcomeNotes } = req.body;
        const validOutcomes = ['GREAT_MEETING', 'GOOD_CHAT', 'DIDNT_MEET', 'NOT_A_FIT'];
        if (!outcome || !validOutcomes.includes(outcome)) {
            return res.status(400).json({ success: false, error: { message: 'Invalid outcome. Must be one of: ' + validOutcomes.join(', ') } });
        }
        const intro = await db_1.prisma.introductionRecord.findFirst({
            where: {
                id: req.params.id,
                OR: [{ userAId: userId }, { userBId: userId }],
            },
        });
        if (!intro) {
            return res.status(404).json({ success: false, error: { message: 'Introduction not found' } });
        }
        if (!['SENT', 'VIEWED', 'FOLLOWED_UP'].includes(intro.status)) {
            return res.status(400).json({ success: false, error: { message: 'Can only record outcome for sent introductions' } });
        }
        const updated = await introductionService_1.introductionService.recordOutcome(intro.id, outcome, outcomeNotes);
        const full = await db_1.prisma.introductionRecord.findUnique({
            where: { id: intro.id },
            include: {
                match: true,
                userA: { include: { profile: true } },
                userB: { include: { profile: true } },
            },
        });
        res.json({ success: true, data: full });
    }
    catch (error) {
        next(error);
    }
});
//# sourceMappingURL=introduction.js.map