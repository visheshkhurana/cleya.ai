"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationService = exports.NotificationService = void 0;
const db_1 = require("@cleya/db");
const server_1 = require("../../websocket/server");
class NotificationService {
    async send(payload) {
        const notification = await db_1.prisma.notification.create({
            data: {
                userId: payload.userId,
                channel: payload.channel,
                event: payload.event,
                title: payload.title,
                body: payload.body,
                metadata: payload.metadata || {},
            },
        });
        try {
            switch (payload.channel) {
                case 'IN_APP':
                    this.sendInApp(payload);
                    break;
                case 'WHATSAPP':
                    await this.sendWhatsApp(payload);
                    break;
                case 'SMS':
                    await this.sendSMS(payload);
                    break;
                case 'EMAIL':
                    await this.sendEmail(payload);
                    break;
            }
            await db_1.prisma.notification.update({
                where: { id: notification.id },
                data: { sentAt: new Date() },
            });
        }
        catch (error) {
            console.error(`Notification dispatch failed for ${payload.channel}:`, error);
        }
        return notification;
    }
    async sendMultiChannel(userId, event, title, body, metadata) {
        const channels = ['IN_APP'];
        const user = await db_1.prisma.user.findUnique({ where: { id: userId } });
        if (user?.phone)
            channels.push('WHATSAPP');
        const results = await Promise.allSettled(channels.map((channel) => this.send({ userId, channel, event, title, body, metadata })));
        return results;
    }
    sendInApp(payload) {
        (0, server_1.sendToUser)(payload.userId, 'notification', {
            title: payload.title,
            body: payload.body,
            event: payload.event,
            metadata: payload.metadata,
        });
    }
    async sendWhatsApp(payload) {
        const { messagingService } = await Promise.resolve().then(() => __importStar(require('../messagingService')));
        const provider = messagingService.getActiveProvider();
        if (provider === 'none') {
            console.warn('Gupshup not configured, WhatsApp notification skipped');
            return;
        }
        const user = await db_1.prisma.user.findUnique({ where: { id: payload.userId } });
        if (!user?.phone)
            return;
        try {
            await messagingService.sendWhatsApp(payload.userId, user.phone, `*${payload.title}*\n\n${payload.body}`);
        }
        catch (error) {
            console.error('WhatsApp notification failed:', error);
        }
    }
    async sendSMS(payload) {
        const { messagingService } = await Promise.resolve().then(() => __importStar(require('../messagingService')));
        const provider = messagingService.getActiveProvider();
        if (provider === 'none') {
            console.warn('Gupshup not configured, SMS notification skipped (would send via WhatsApp)');
            return;
        }
        const user = await db_1.prisma.user.findUnique({ where: { id: payload.userId } });
        if (!user?.phone)
            return;
        try {
            await messagingService.sendWhatsApp(payload.userId, user.phone, `${payload.title}: ${payload.body}`);
        }
        catch (error) {
            console.error('SMS (via WhatsApp) notification failed:', error);
        }
    }
    async sendEmail(payload) {
        console.log(`Email would be sent to user ${payload.userId}: ${payload.title}`);
    }
    async getNotifications(userId, limit = 20) {
        return db_1.prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
    }
    async markRead(notificationId, userId) {
        return db_1.prisma.notification.updateMany({
            where: { id: notificationId, userId },
            data: { readAt: new Date() },
        });
    }
    async markAllRead(userId) {
        return db_1.prisma.notification.updateMany({
            where: { userId, readAt: null },
            data: { readAt: new Date() },
        });
    }
    async getUnreadCount(userId) {
        return db_1.prisma.notification.count({
            where: { userId, readAt: null },
        });
    }
}
exports.NotificationService = NotificationService;
exports.notificationService = new NotificationService();
//# sourceMappingURL=notificationService.js.map