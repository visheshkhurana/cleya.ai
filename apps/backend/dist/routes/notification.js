"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const notificationService_1 = require("../services/notification/notificationService");
exports.notificationRouter = (0, express_1.Router)();
exports.notificationRouter.get('/', auth_1.authenticate, async (req, res, next) => {
    try {
        const rawLimit = parseInt(req.query.limit) || 20;
        const limit = Math.min(Math.max(rawLimit, 1), 100);
        const notifications = await notificationService_1.notificationService.getNotifications(req.user.userId, limit);
        const unreadCount = await notificationService_1.notificationService.getUnreadCount(req.user.userId);
        res.json({ success: true, data: { notifications, unreadCount } });
    }
    catch (error) {
        next(error);
    }
});
exports.notificationRouter.post('/read-all', auth_1.authenticate, async (req, res, next) => {
    try {
        await notificationService_1.notificationService.markAllRead(req.user.userId);
        res.json({ success: true });
    }
    catch (error) {
        next(error);
    }
});
exports.notificationRouter.patch('/:id/read', auth_1.authenticate, async (req, res, next) => {
    try {
        await notificationService_1.notificationService.markRead(req.params.id, req.user.userId);
        res.json({ success: true });
    }
    catch (error) {
        next(error);
    }
});
exports.notificationRouter.post('/:id/read', auth_1.authenticate, async (req, res, next) => {
    try {
        await notificationService_1.notificationService.markRead(req.params.id, req.user.userId);
        res.json({ success: true });
    }
    catch (error) {
        next(error);
    }
});
//# sourceMappingURL=notification.js.map