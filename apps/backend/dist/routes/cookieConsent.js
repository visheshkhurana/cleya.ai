"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cookieConsentRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("@cleya/db");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
exports.cookieConsentRouter = (0, express_1.Router)();
const consentSchema = zod_1.z.object({
    analytics: zod_1.z.boolean(),
    marketing: zod_1.z.boolean(),
});
exports.cookieConsentRouter.get('/', auth_1.authenticate, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const consent = await db_1.prisma.cookieConsent.findUnique({ where: { userId } });
        res.json({ success: true, data: consent });
    }
    catch (error) {
        next(error);
    }
});
exports.cookieConsentRouter.put('/', auth_1.authenticate, (0, validation_1.validate)(consentSchema), async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { analytics, marketing } = req.body;
        const consent = await db_1.prisma.cookieConsent.upsert({
            where: { userId },
            create: { userId, essential: true, analytics, marketing, version: 'v2' },
            update: { analytics, marketing, version: 'v2' },
        });
        res.json({ success: true, data: consent });
    }
    catch (error) {
        next(error);
    }
});
//# sourceMappingURL=cookieConsent.js.map