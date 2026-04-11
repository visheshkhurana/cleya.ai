"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.whatsappRouter = void 0;
const express_1 = require("express");
const db_1 = require("@cleya/db");
const auth_1 = require("../middleware/auth");
const gupshupService_1 = require("../services/gupshupService");
exports.whatsappRouter = (0, express_1.Router)();
exports.whatsappRouter.post('/opt-in', auth_1.authenticate, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { phoneNumber } = req.body;
        if (!phoneNumber || typeof phoneNumber !== 'string') {
            res.status(400).json({ success: false, error: { message: 'Phone number is required' } });
            return;
        }
        const cleaned = phoneNumber.replace(/[\s\-()]/g, '');
        if (cleaned.length < 10) {
            res.status(400).json({ success: false, error: { message: 'Invalid phone number' } });
            return;
        }
        const optInResult = await gupshupService_1.gupshupService.optInUser(cleaned);
        await db_1.prisma.user.update({
            where: { id: userId },
            data: {
                whatsappOptedIn: true,
                whatsappPhone: cleaned,
            },
        });
        await db_1.prisma.communicationPreference.upsert({
            where: { userId },
            create: {
                userId,
                whatsappEnabled: true,
                whatsappMatchNotify: true,
                whatsappIntroNotify: true,
                whatsappWeeklyDigest: true,
            },
            update: {
                whatsappEnabled: true,
            },
        });
        console.log(`User ${userId} opted in to WhatsApp with ${cleaned} (Gupshup: ${optInResult.success ? 'ok' : optInResult.error})`);
        res.json({
            success: true,
            data: {
                whatsappOptedIn: true,
                whatsappPhone: cleaned,
                gupshupOptIn: optInResult.success,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.whatsappRouter.post('/opt-out', auth_1.authenticate, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const user = await db_1.prisma.user.findUnique({ where: { id: userId } });
        if (user?.whatsappPhone) {
            await gupshupService_1.gupshupService.optOutUser(user.whatsappPhone);
        }
        await db_1.prisma.user.update({
            where: { id: userId },
            data: {
                whatsappOptedIn: false,
            },
        });
        await db_1.prisma.communicationPreference.upsert({
            where: { userId },
            create: { userId, whatsappEnabled: false },
            update: { whatsappEnabled: false },
        });
        console.log(`User ${userId} opted out of WhatsApp`);
        res.json({
            success: true,
            data: { whatsappOptedIn: false },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.whatsappRouter.get('/status', auth_1.authenticate, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const user = await db_1.prisma.user.findUnique({
            where: { id: userId },
            select: { whatsappOptedIn: true, whatsappPhone: true, phone: true },
        });
        const prefs = await db_1.prisma.communicationPreference.findUnique({
            where: { userId },
            select: { whatsappEnabled: true, whatsappMatchNotify: true, whatsappIntroNotify: true, whatsappWeeklyDigest: true },
        });
        res.json({
            success: true,
            data: {
                whatsappOptedIn: user?.whatsappOptedIn || false,
                whatsappPhone: user?.whatsappPhone || user?.phone || null,
                preferences: prefs || { whatsappEnabled: false, whatsappMatchNotify: true, whatsappIntroNotify: true, whatsappWeeklyDigest: true },
            },
        });
    }
    catch (error) {
        next(error);
    }
});
//# sourceMappingURL=whatsapp.js.map