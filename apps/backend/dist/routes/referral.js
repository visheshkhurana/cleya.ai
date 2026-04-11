"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.referralRouter = void 0;
const express_1 = require("express");
const client_1 = require("@prisma/client");
const auth_1 = require("../middleware/auth");
const prisma = new client_1.PrismaClient();
exports.referralRouter = (0, express_1.Router)();
exports.referralRouter.get('/', auth_1.authenticate, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const inviteCodes = await prisma.inviteCode.findMany({
            where: { createdById: userId },
            orderBy: { createdAt: 'desc' },
            include: {
                usedBy: {
                    select: {
                        id: true,
                        name: true,
                        createdAt: true,
                        profile: {
                            select: {
                                persona: true,
                                headline: true,
                                companyName: true,
                            },
                        },
                    },
                },
            },
        });
        const totalCodes = inviteCodes.length;
        const usedCodes = inviteCodes.filter(c => c.usedById !== null);
        const availableCodes = inviteCodes.filter(c => c.usedById === null && c.isActive);
        res.json({
            success: true,
            data: {
                summary: {
                    totalCodes,
                    used: usedCodes.length,
                    available: availableCodes.length,
                    conversionRate: totalCodes > 0 ? Math.round((usedCodes.length / totalCodes) * 100) : 0,
                },
                invites: inviteCodes.map(c => ({
                    id: c.id,
                    code: c.code,
                    isActive: c.isActive,
                    createdAt: c.createdAt,
                    usedAt: c.usedAt,
                    usedBy: c.usedBy ? {
                        id: c.usedBy.id,
                        name: c.usedBy.name,
                        joinedAt: c.usedBy.createdAt,
                        persona: c.usedBy.profile?.persona,
                        headline: c.usedBy.profile?.headline,
                        companyName: c.usedBy.profile?.companyName,
                    } : null,
                })),
            },
        });
    }
    catch (error) {
        next(error);
    }
});
//# sourceMappingURL=referral.js.map