import twilio from 'twilio';
import { prisma } from '@cleya/db';
import { env } from '../config/env';
import { gupshupService } from './gupshupService';

export class MessagingService {
  private twilioClient: twilio.Twilio | null = null;

  constructor() {
    if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN) {
      this.twilioClient = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
    }
  }

  private getWhatsAppProvider(): 'gupshup' | 'twilio' | null {
    if (env.MESSAGING_PROVIDER === 'gupshup') {
      return gupshupService.isConfigured() ? 'gupshup' : null;
    }
    if (env.MESSAGING_PROVIDER === 'twilio') {
      return this.twilioClient ? 'twilio' : null;
    }
    if (gupshupService.isConfigured()) return 'gupshup';
    if (this.twilioClient) return 'twilio';
    return null;
  }

  async sendSMS(userId: string, phoneNumber: string, message: string) {
    const record = await prisma.messageRecord.create({
      data: {
        userId,
        recipientPhone: phoneNumber,
        channel: 'SMS',
        content: message,
        status: 'QUEUED',
        provider: 'TWILIO',
      },
    });

    if (!this.twilioClient) {
      console.warn('Twilio not configured, SMS skipped');
      await prisma.messageRecord.update({
        where: { id: record.id },
        data: { status: 'FAILED', errorMessage: 'Twilio not configured' },
      });
      return record;
    }

    try {
      const result = await this.twilioClient.messages.create({
        to: phoneNumber,
        from: env.TWILIO_PHONE_NUMBER!,
        body: message,
      });

      await prisma.messageRecord.update({
        where: { id: record.id },
        data: { status: 'SENT', messageSid: result.sid },
      });

      console.log(`SMS sent to ${phoneNumber} (${result.sid})`);
      return { ...record, status: 'SENT', messageSid: result.sid };
    } catch (error: any) {
      await prisma.messageRecord.update({
        where: { id: record.id },
        data: { status: 'FAILED', errorMessage: error.message },
      });
      console.error(`SMS failed to ${phoneNumber}:`, error.message);
      return { ...record, status: 'FAILED', errorMessage: error.message };
    }
  }

  async sendWhatsApp(userId: string, phoneNumber: string, message: string) {
    const provider = this.getWhatsAppProvider();

    if (provider === 'gupshup') {
      return gupshupService.sendWhatsApp(userId, phoneNumber, message);
    }

    const whatsappNumber = phoneNumber.startsWith('whatsapp:')
      ? phoneNumber
      : `whatsapp:${phoneNumber}`;

    const record = await prisma.messageRecord.create({
      data: {
        userId,
        recipientPhone: phoneNumber,
        channel: 'WHATSAPP',
        content: message,
        status: 'QUEUED',
        provider: 'TWILIO',
      },
    });

    if (!this.twilioClient) {
      console.warn('No WhatsApp provider configured (neither Gupshup nor Twilio)');
      await prisma.messageRecord.update({
        where: { id: record.id },
        data: { status: 'FAILED', errorMessage: 'No WhatsApp provider configured' },
      });
      return record;
    }

    const fromNumber = env.TWILIO_WHATSAPP_NUMBER
      ? (env.TWILIO_WHATSAPP_NUMBER.startsWith('whatsapp:')
        ? env.TWILIO_WHATSAPP_NUMBER
        : `whatsapp:${env.TWILIO_WHATSAPP_NUMBER}`)
      : `whatsapp:${env.TWILIO_PHONE_NUMBER}`;

    try {
      const result = await this.twilioClient.messages.create({
        to: whatsappNumber,
        from: fromNumber,
        body: message,
      });

      await prisma.messageRecord.update({
        where: { id: record.id },
        data: { status: 'SENT', messageSid: result.sid },
      });

      console.log(`WhatsApp sent to ${phoneNumber} via Twilio (${result.sid})`);
      return { ...record, status: 'SENT', messageSid: result.sid };
    } catch (error: any) {
      await prisma.messageRecord.update({
        where: { id: record.id },
        data: { status: 'FAILED', errorMessage: error.message },
      });
      console.error(`WhatsApp failed to ${phoneNumber}:`, error.message);
      return { ...record, status: 'FAILED', errorMessage: error.message };
    }
  }

  async sendWhatsAppTemplate(userId: string, phoneNumber: string, templateId: string, params: string[] = []) {
    const provider = this.getWhatsAppProvider();
    if (provider === 'gupshup') {
      return gupshupService.sendTemplate(userId, phoneNumber, templateId, params);
    }
    return this.sendWhatsApp(userId, phoneNumber, `Template: ${templateId} | ${params.join(', ')}`);
  }

  async sendWhatsAppImage(userId: string, phoneNumber: string, imageUrl: string, caption?: string) {
    const provider = this.getWhatsAppProvider();
    if (provider === 'gupshup') {
      return gupshupService.sendImage(userId, phoneNumber, imageUrl, caption);
    }
    return this.sendWhatsApp(userId, phoneNumber, caption || imageUrl);
  }

  getActiveProvider(): string {
    const provider = this.getWhatsAppProvider();
    if (provider) return provider;
    if (this.twilioClient) return 'twilio (SMS only)';
    return 'none';
  }

  getWelcomeMessage(userName?: string): string {
    const name = userName ? ` ${userName}` : '';
    return `Hey${name}! Welcome to Cleya.ai — your AI Superconnector. We're already finding the best people for you to connect with. Stay tuned for your first match!`;
  }

  getMatchNotificationMessage(matchName: string): string {
    return `Great news! Cleya.ai found a match for you: ${matchName}. Open the app to review and accept the introduction.`;
  }

  getFollowUpMessage(): string {
    return `Hi from Cleya.ai! Just checking in — have you had a chance to review your latest matches? Open the app to see who's waiting to connect with you.`;
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
