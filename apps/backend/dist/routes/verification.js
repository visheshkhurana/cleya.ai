"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verificationRouter = void 0;
const express_1 = require("express");
const client_1 = require("@prisma/client");
const auth_1 = require("../middleware/auth");
const verificationService_1 = require("../services/verificationService");
const prisma = new client_1.PrismaClient();
exports.verificationRouter = (0, express_1.Router)();
function validateLinkedinUrl(url) {
    return /^https?:\/\/(www\.)?linkedin\.com\/in\/[\w-]+\/?$/i.test(url);
}
exports.verificationRouter.get('/status', auth_1.authenticate, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const result = await (0, verificationService_1.calculateVerificationScore)(userId);
        const badge = (0, verificationService_1.getVerificationBadge)(result.score);
        res.json({
            success: true,
            data: {
                score: result.score,
                tier: result.tier,
                badge,
                factors: result.factors,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.verificationRouter.post('/linkedin', auth_1.authenticate, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { linkedinUrl } = req.body;
        if (!linkedinUrl || typeof linkedinUrl !== 'string') {
            res.status(400).json({ success: false, error: { message: 'LinkedIn URL is required' } });
            return;
        }
        if (!validateLinkedinUrl(linkedinUrl)) {
            res.status(400).json({ success: false, error: { message: 'Invalid LinkedIn URL. Must be in format: https://linkedin.com/in/your-name' } });
            return;
        }
        await prisma.profile.upsert({
            where: { userId },
            create: { userId, linkedinUrl, linkedinVerified: false },
            update: { linkedinUrl, linkedinVerified: false },
        });
        const result = await (0, verificationService_1.calculateVerificationScore)(userId);
        const badge = (0, verificationService_1.getVerificationBadge)(result.score);
        res.json({
            success: true,
            data: {
                linkedinUrl,
                verified: true,
                verificationScore: result.score,
                tier: result.tier,
                badge,
                message: 'LinkedIn URL has been verified and saved to your profile',
            },
        });
    }
    catch (error) {
        next(error);
    }
});
//# sourceMappingURL=verification.js.map