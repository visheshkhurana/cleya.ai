"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activityRouter = void 0;
const express_1 = require("express");
const db_1 = require("@cleya/db");
const auth_1 = require("../middleware/auth");
exports.activityRouter = (0, express_1.Router)();
exports.activityRouter.get('/', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);
        const offset = parseInt(req.query.offset) || 0;
        const activities = await db_1.prisma.activity.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset,
        });
        res.json({
            success: true,
            data: activities,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: { message: error.message } });
    }
});
//# sourceMappingURL=activity.js.map