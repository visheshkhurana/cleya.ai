"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.messagingService = exports.MessagingService = void 0;
const db_1 = require("@cleya/db");
const twilioWhatsAppService_1 = require("./twilioWhatsAppService");
const metaWhatsAppService_1 = require("./metaWhatsAppService");
const gupshupService_1 = require("./gupshupService");
function getProvider() {
    if (twilioWhatsAppService_1.twilioWhatsAppService.isConfigured())
        return twilioWhatsAppService_1.twilioWhatsAppService;
    if (metaWhatsAppService_1.metaWhatsAppService.isConfigured())
        return metaWhatsAppService_1.metaWhatsAppService;
    if (gupshupService_1.gupshupService.isConfigured())
        return gupshupService_1.gupshupService;
    return null;
}
async function resolveRecipientName(userId, recipientName) {
    if (recipientName)
        return recipientName;
    if (!userId || userId === 'direct')
        return undefined;
    try {
        const user = await db_1.prisma.user.findUnique({
            where: { id: userId },
            select: { name: true },
        });
        return user?.name || undefined;
    }
    catch {
        return undefined;
    }
}
class MessagingService {
    async sendWhatsApp(userId, phoneNumber, message, recipientName) {
        const provider = getProvider();
        if (!provider) {
            console.warn('No WhatsApp provider configured, message skipped');
            return null;
        }
        if (provider === twilioWhatsAppService_1.twilioWhatsAppService) {
            const name = await resolveRecipientName(userId, recipientName);
            return provider.sendWhatsApp(userId, phoneNumber, message, name);
        }
        return provider.sendWhatsApp(userId, phoneNumber, message);
    }
    async sendWhatsAppDirect(phoneNumber, message, recipientName) {
        const provider = getProvider();
        if (!provider) {
            return { success: false, error: 'No WhatsApp provider configured' };
        }
        if (provider === twilioWhatsAppService_1.twilioWhatsAppService) {
            return provider.sendWhatsAppDirect(phoneNumber, message, recipientName);
        }
        return provider.sendWhatsAppDirect(phoneNumber, message);
    }
    async sendWhatsAppTemplate(userId, phoneNumber, templateId, params = []) {
        const provider = getProvider();
        if (!provider) {
            console.warn('No WhatsApp provider configured, template skipped');
            return null;
        }
        return provider.sendTemplate(userId, phoneNumber, templateId, params);
    }
    async sendWhatsAppImage(userId, phoneNumber, imageUrl, caption) {
        const provider = getProvider();
        if (!provider) {
            console.warn('No WhatsApp provider configured, image skipped');
            return null;
        }
        return provider.sendImage(userId, phoneNumber, imageUrl, caption);
    }
    async sendSMS(userId, phoneNumber, message, recipientName) {
        const providerName = this.getActiveProvider();
        console.log(`SMS routed to WhatsApp via ${providerName} for ${phoneNumber}`);
        return this.sendWhatsApp(userId, phoneNumber, message, recipientName);
    }
    getActiveProvider() {
        if (twilioWhatsAppService_1.twilioWhatsAppService.isConfigured())
            return 'twilio';
        if (metaWhatsAppService_1.metaWhatsAppService.isConfigured())
            return 'meta';
        if (gupshupService_1.gupshupService.isConfigured())
            return 'gupshup';
        return 'none';
    }
    getWelcomeMessage(userName) {
        const name = userName ? ` ${userName}` : '';
        return `Hey${name}! Welcome to Cleya 👋 I'm your AI Networker. I quietly meet thousands of people across the network on your behalf and only introduce you to the few worth your time. Let's get started — tell me about yourself so I can curate the right introductions for you.`;
    }
    getMatchNotificationMessage(matchName) {
        return `Hey! I just met ${matchName} on your behalf and think you two should connect. Check your introductions to see why I curated this one for you.`;
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