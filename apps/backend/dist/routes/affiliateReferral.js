"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.affiliateReferralRouter = void 0;
const crypto_1 = __importDefault(require("crypto"));
const express_1 = require("express");
const db_1 = require("@cleya/db");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const env_1 = require("../config/env");
exports.affiliateReferralRouter = (0, express_1.Router)();
function generateReferralCode() {
    return crypto_1.default.randomBytes(4).toString('hex');
}
// GET /api/referral/info — returns referral code, link, stats
exports.affiliateReferralRouter.get('/info', auth_1.authenticate, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        let user = await db_1.prisma.user.findUnique({
            where: { id: userId },
            select: { referralCode: true, bonusMatches: true },
        });
        if (!user) {
            throw new errorHandler_1.AppError(404, 'User not found');
        }
        // Generate referral code on first access if not set
        if (!user.referralCode) {
            const code = generateReferralCode();
            user = await db_1.prisma.user.update({
                where: { id: userId },
                data: { referralCode: code },
                select: { referralCode: true, bonusMatches: true },
            });
        }
        const totalReferrals = await db_1.prisma.referral.count({
            where: { referrerId: userId },
        });
        const frontendUrl = env_1.env.FRONTEND_URL || 'https://cleya.ai';
        const referralLink = `${frontendUrl}/?ref=${user.referralCode}`;
        res.json({
            success: true,
            data: {
                referralCode: user.referralCode,
                referralLink,
                totalReferrals,
                bonusMatches: user.bonusMatches,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/referral/history — returns list of referrals
exports.affiliateReferralRouter.get('/history', auth_1.authenticate, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const referrals = await db_1.prisma.referral.findMany({
            where: { referrerId: userId },
            orderBy: { createdAt: 'desc' },
            include: {
                referee: {
                    select: {
                        name: true,
                        createdAt: true,
                    },
                },
            },
        });
        res.json({
            success: true,
            data: referrals.map(r => ({
                id: r.id,
                refereeName: r.referee.name?.split(' ')[0] || 'User',
                refereeJoinedAt: r.createdAt,
                rewardGranted: r.rewardGranted,
            })),
        });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/referral/apply — apply a referral code after signup
exports.affiliateReferralRouter.post('/apply', auth_1.authenticate, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { referralCode } = req.body;
        if (!referralCode || typeof referralCode !== 'string') {
            throw new errorHandler_1.AppError(400, 'Referral code is required');
        }
        // Check if user already has a referrer
        const user = await db_1.prisma.user.findUnique({
            where: { id: userId },
            select: { referredBy: true, referralCode: true },
        });
        if (!user) {
            throw new errorHandler_1.AppError(404, 'User not found');
        }
        if (user.referredBy) {
            return res.json({ success: true, data: { alreadyReferred: true } });
        }
        // Find the referrer by code
        const referrer = await db_1.prisma.user.findUnique({
            where: { referralCode },
            select: { id: true },
        });
        if (!referrer) {
            throw new errorHandler_1.AppError(404, 'Invalid referral code', 'INVALID_REFERRAL_CODE');
        }
        // Prevent self-referral
        if (referrer.id === userId) {
            throw new errorHandler_1.AppError(400, 'You cannot refer yourself', 'SELF_REFERRAL');
        }
        // Check if referral record already exists
        const existing = await db_1.prisma.referral.findUnique({
            where: { refereeId: userId },
        });
        if (existing) {
            return res.json({ success: true, data: { alreadyReferred: true } });
        }
        // Apply referral in a transaction
        await db_1.prisma.$transaction([
            db_1.prisma.user.update({
                where: { id: userId },
                data: { referredBy: referrer.id },
            }),
            db_1.prisma.referral.create({
                data: {
                    referrerId: referrer.id,
                    refereeId: userId,
                    rewardGranted: true,
                },
            }),
            db_1.prisma.user.update({
                where: { id: referrer.id },
                data: { bonusMatches: { increment: 5 } },
            }),
        ]);
        res.json({
            success: true,
            data: { applied: true },
        });
    }
    catch (error) {
        next(error);
    }
});
//# sourceMappingURL=affiliateReferral.js.map