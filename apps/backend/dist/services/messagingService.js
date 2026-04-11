"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.messagingService = exports.MessagingService = void 0;
const db_1 = require("@cleya/db");
const gupshupService_1 = require("./gupshupService");
class MessagingService {
    async sendWhatsApp(userId, phoneNumber, message) {
        return gupshupService_1.gupshupService.sendWhatsApp(userId, phoneNumber, message);
    }
    async sendWhatsAppTemplate(userId, phoneNumber, templateId, params = []) {
        return gupshupService_1.gupshupService.sendTemplate(userId, phoneNumber, templateId, params);
    }
    async sendWhatsAppImage(userId, phoneNumber, imageUrl, caption) {
        return gupshupService_1.gupshupService.sendImage(userId, phoneNumber, imageUrl, caption);
    }
    async sendSMS(userId, phoneNumber, message) {
        console.log(`SMS routed to WhatsApp via Gupshup for ${phoneNumber}`);
        return gupshupService_1.gupshupService.sendWhatsApp(userId, phoneNumber, message);
    }
    getActiveProvider() {
        return gupshupService_1.gupshupService.isConfigured() ? 'gupshup' : 'none';
    }
    getWelcomeMessage(userName) {
        const name = userName ? ` ${userName}` : '';
        return `Hey${name}! Welcome to Cleya 👋 I'm your AI superconnector. I personally talk to everyone in the network, learn their story, and make warm introductions where there's a genuine fit. Let's get started — tell me about yourself so I can find the right people for you.`;
    }
    getMatchNotificationMessage(matchName) {
        return `Hey! I found someone great for you — ${matchName}. I think you two should connect. Check your matches to see why I paired you up.`;
    }
    getFollowUpMessage() {
        return `Hey! Just checking in — you have matches waiting for your review. Don't leave them hanging! Open the app to see who's ready to connect.`;
    }
    async getMessageHistory(userId) {
        return db_1.prisma.messageRecord.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
    }
    async getAllMessages(limit = 50) {
        return db_1.prisma.messageRecord.findMany({
            include: { user: { select: { email: true, phone: true } } },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
    }
    async getMessageStats() {
        const [totalSMS, totalWhatsApp, delivered, failed] = await Promise.all([
            db_1.prisma.messageRecord.count({ where: { channel: 'SMS' } }),
            db_1.prisma.messageRecord.count({ where: { channel: 'WHATSAPP' } }),
            db_1.prisma.messageRecord.count({ where: { status: 'DELIVERED' } }),
            db_1.prisma.messageRecord.count({ where: { status: 'FAILED' } }),
        ]);
        return { totalSMS, totalWhatsApp, delivered, failed, total: totalSMS + totalWhatsApp };
    }
}
exports.MessagingService = MessagingService;
exports.messagingService = new MessagingService();
//# sourceMappingURL=messagingService.js.map