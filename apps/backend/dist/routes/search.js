"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchRouter = void 0;
const express_1 = require("express");
const client_1 = require("@prisma/client");
const auth_1 = require("../middleware/auth");
const prisma = new client_1.PrismaClient();
exports.searchRouter = (0, express_1.Router)();
exports.searchRouter.get('/', auth_1.authenticate, async (req, res, next) => {
    try {
        const { q, persona, industry, location, limit: limitStr } = req.query;
        const take = Math.min(parseInt(limitStr) || 20, 50);
        if (!q && !persona && !industry && !location) {
            res.status(400).json({ success: false, error: { message: 'At least one search parameter is required (q, persona, industry, location)' } });
            return;
        }
        const where = {
            isActive: true,
            id: { not: req.user.userId },
        };
        if (q) {
            const query = q.toLowerCase();
            where.OR = [
                { name: { contains: query, mode: 'insensitive' } },
                { email: { contains: query, mode: 'insensitive' } },
                { profile: { headline: { contains: query, mode: 'insensitive' } } },
                { profile: { companyName: { contains: query, mode: 'insensitive' } } },
                { profile: { bio: { contains: query, mode: 'insensitive' } } },
            ];
        }
        const profileWhere = {};
        if (persona)
            profileWhere.persona = persona.toUpperCase();
        if (industry)
            profileWhere.industries = { has: industry };
        if (location)
            profileWhere.location = { contains: location, mode: 'insensitive' };
        if (Object.keys(profileWhere).length > 0) {
            where.profile = { ...where.profile, ...profileWhere };
        }
        const users = await prisma.user.findMany({
            where,
            take,
            select: {
                id: true,
                name: true,
                profile: {
                    select: {
                        persona: true,
                        headline: true,
                        companyName: true,
                        location: true,
                        industries: true,
                        bio: true,
                        completenessScore: true,
                    },
                },
            },
            orderBy: { profile: { completenessScore: 'desc' } },
        });
        res.json({
            success: true,
            data: {
                results: users.map(u => ({
                    id: u.id,
                    name: u.name,
                    persona: u.profile?.persona,
                    headline: u.profile?.headline,
                    companyName: u.profile?.companyName,
                    location: u.profile?.location,
                    industries: u.profile?.industries || [],
                    bio: u.profile?.bio?.substring(0, 150),
                })),
                total: users.length,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
//# sourceMappingURL=search.js.map