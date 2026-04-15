import { prisma } from '@cleya/db';
import { metaWhatsAppService } from './metaWhatsAppService';
import { gupshupService } from './gupshupService';

function getProvider() {
  if (metaWhatsAppService.isConfigured()) return metaWhatsAppService;
  if (gupshupService.isConfigured()) return gupshupService;
  return null;
}

export class MessagingService {
  async sendWhatsApp(userId: string, phoneNumber: string, message: string) {
    const provider = getProvider();
    if (!provider) {
      console.warn('No WhatsApp provider configured, message skipped');
      return null;
    }
    return provider.sendWhatsApp(userId, phoneNumber, message);
  }

  async sendWhatsAppDirect(phoneNumber: string, message: string) {
    const provider = getProvider();
    if (!provider) {
      return { success: false, error: 'No WhatsApp provider configured' };
    }
    return provider.sendWhatsAppDirect(phoneNumber, message);
  }

  async sendWhatsAppTemplate(userId: string, phoneNumber: string, templateId: string, params: string[] = []) {
    const provider = getProvider();
    if (!provider) {
      console.warn('No WhatsApp provider configured, template skipped');
      return null;
    }
    return provider.sendTemplate(userId, phoneNumber, templateId, params);
  }

  async sendWhatsAppImage(userId: string, phoneNumber: string, imageUrl: string, caption?: string) {
    const provider = getProvider();
    if (!provider) {
      console.warn('No WhatsApp provider configured, image skipped');
      return null;
    }
    return provider.sendImage(userId, phoneNumber, imageUrl, caption);
  }

  async sendSMS(userId: string, phoneNumber: string, message: string) {
    const providerName = this.getActiveProvider();
    console.log(`SMS routed to WhatsApp via ${providerName} for ${phoneNumber}`);
    return this.sendWhatsApp(userId, phoneNumber, message);
  }

  getActiveProvider(): string {
    if (metaWhatsAppService.isConfigured()) return 'meta';
    if (gupshupService.isConfigured()) return 'gupshup';
    return 'none';
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
