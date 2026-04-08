import { prisma } from '@cleya/db';
import { gupshupService } from './gupshupService';

export class MessagingService {
  async sendWhatsApp(userId: string, phoneNumber: string, message: string) {
    return gupshupService.sendWhatsApp(userId, phoneNumber, message);
  }

  async sendWhatsAppTemplate(userId: string, phoneNumber: string, templateId: string, params: string[] = []) {
    return gupshupService.sendTemplate(userId, phoneNumber, templateId, params);
  }

  async sendWhatsAppImage(userId: string, phoneNumber: string, imageUrl: string, caption?: string) {
    return gupshupService.sendImage(userId, phoneNumber, imageUrl, caption);
  }

  // NOTE: SMS is NOT an independent channel. It routes through WhatsApp via Gupshup.
  // This means if WhatsApp/Gupshup is down, SMS will also fail.
  // For true SMS delivery, a separate SMS provider (e.g. Twilio) with TRAI DLT
  // registration would be needed — that is out of scope for now.
  async sendSMS(userId: string, phoneNumber: string, message: string) {
    console.log(`SMS routed to WhatsApp via Gupshup for ${phoneNumber} (not an independent channel)`);
    return gupshupService.sendWhatsApp(userId, phoneNumber, message);
  }

  getActiveProvider(): string {
    return gupshupService.isConfigured() ? 'gupshup' : 'none';
  }

  getWelcomeMessage(userName?: string): string {
    const name = userName ? ` ${userName}` : '';
    return `Hey${name}! Welcome to Cleya 👋 I'm your AI superconnector. I personally talk to everyone in the network, learn their story, and make warm introductions where there's a genuine fit. Let's get started — tell me about yourself so I can find the right people for you.`;
  }

  getMatchNotificationMessage(matchName: string): string {
    return `Hey! I found someone great for you — ${matchName}. I think you two should connect. Check your matches to see why I paired you up.`;
  }

  getFollowUpMessage(): string {
    return `Hey! Just checking in — you have matches waiting for your review. Don't leave them hanging! Open the app to see who's ready to connect.`;
  }

  async getMessageHistory(userId: string) {
    return prisma.messageRecord.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAllMessages(limit: number = 50) {
    return prisma.messageRecord.findMany({
      include: { user: { select: { email: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getMessageStats() {
    const [totalSMS, totalWhatsApp, delivered, failed] = await Promise.all([
      prisma.messageRecord.count({ where: { channel: 'SMS' } }),
      prisma.messageRecord.count({ where: { channel: 'WHATSAPP' } }),
      prisma.messageRecord.count({ where: { status: 'DELIVERED' } }),
      prisma.messageRecord.count({ where: { status: 'FAILED' } }),
    ]);

    return { totalSMS, totalWhatsApp, delivered, failed, total: totalSMS + totalWhatsApp };
  }
}

export const messagingService = new MessagingService();
