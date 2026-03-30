import { prisma } from '@cleya/db';
import { env } from '../config/env';

interface GupshupResponse {
  status: string;
  messageId?: string;
  message?: string;
}

export class GupshupService {
  private apiKey: string | null;
  private appName: string | null;
  private sourceNumber: string | null;
  private baseUrl = 'https://api.gupshup.io/wa/api/v1';

  constructor() {
    this.apiKey = env.GUPSHUP_API_KEY || null;
    this.appName = env.GUPSHUP_APP_NAME || null;
    this.sourceNumber = env.GUPSHUP_SOURCE_NUMBER || null;
  }

  isConfigured(): boolean {
    return !!(this.apiKey && this.appName && this.sourceNumber);
  }

  private formatPhone(phone: string): string {
    let cleaned = phone.replace(/[\s\-()whatsapp:+]/g, '');
    if (cleaned.length === 10) {
      cleaned = '91' + cleaned;
    }
    if (cleaned.startsWith('910') && cleaned.length === 13) {
      cleaned = '91' + cleaned.substring(3);
    }
    if (cleaned.startsWith('9710') && cleaned.length === 14) {
      cleaned = '971' + cleaned.substring(4);
    }
    if (cleaned.startsWith('00')) {
      cleaned = cleaned.substring(2);
    }
    return cleaned;
  }

  async optInUser(phoneNumber: string): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Gupshup not configured' };
    }

    try {
      const formattedPhone = this.formatPhone(phoneNumber);

      const body = new URLSearchParams({
        user: formattedPhone,
      });

      const response = await fetch(`https://api.gupshup.io/sm/api/v1/app/opt/in/${this.appName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'apikey': this.apiKey!,
        },
        body: body.toString(),
      });

      const result = await response.json() as any;

      if (response.ok && result.status === 'success') {
        console.log(`Gupshup opt-in success for ${formattedPhone}`);
        return { success: true };
      }

      const msg = typeof result === 'string' ? result : result?.message || JSON.stringify(result);
      console.warn(`Gupshup opt-in response for ${formattedPhone}:`, msg);
      return { success: true };
    } catch (error: any) {
      console.error(`Gupshup opt-in failed for ${phoneNumber}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  async optOutUser(phoneNumber: string): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Gupshup not configured' };
    }

    try {
      const formattedPhone = this.formatPhone(phoneNumber);

      const body = new URLSearchParams({
        user: formattedPhone,
      });

      const response = await fetch(`https://api.gupshup.io/sm/api/v1/app/opt/out/${this.appName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'apikey': this.apiKey!,
        },
        body: body.toString(),
      });

      const result = await response.json() as any;
      console.log(`Gupshup opt-out for ${formattedPhone}:`, result);
      return { success: true };
    } catch (error: any) {
      console.error(`Gupshup opt-out failed for ${phoneNumber}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  async sendWhatsApp(userId: string, phoneNumber: string, message: string) {
    const record = await prisma.messageRecord.create({
      data: {
        userId,
        recipientPhone: phoneNumber,
        channel: 'WHATSAPP',
        content: message,
        status: 'QUEUED',
        provider: 'GUPSHUP',
      },
    });

    if (!this.isConfigured()) {
      console.warn('Gupshup not configured, WhatsApp skipped');
      await prisma.messageRecord.update({
        where: { id: record.id },
        data: { status: 'FAILED', errorMessage: 'Gupshup not configured' },
      });
      return record;
    }

    try {
      const destination = this.formatPhone(phoneNumber);
      const source = this.formatPhone(this.sourceNumber!);

      const body = new URLSearchParams({
        channel: 'whatsapp',
        source,
        destination,
        'src.name': this.appName!,
        message: JSON.stringify({
          type: 'text',
          text: message,
        }),
      });

      const response = await fetch(`${this.baseUrl}/msg`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'apikey': this.apiKey!,
        },
        body: body.toString(),
      });

      const result = (await response.json()) as GupshupResponse;

      if (!response.ok) {
        throw new Error(result.message || `Gupshup HTTP error: ${response.status}`);
      }
      if (result.status !== 'submitted') {
        throw new Error(result.message || `Gupshup rejected: status=${result.status}`);
      }

      await prisma.messageRecord.update({
        where: { id: record.id },
        data: { status: 'SENT', messageSid: result.messageId || '' },
      });
      console.log(`Gupshup WhatsApp sent to ${phoneNumber} (${result.messageId})`);
      return { ...record, status: 'SENT', messageSid: result.messageId };
    } catch (error: any) {
      await prisma.messageRecord.update({
        where: { id: record.id },
        data: { status: 'FAILED', errorMessage: error.message },
      });
      console.error(`Gupshup WhatsApp failed to ${phoneNumber}:`, error.message);
      return { ...record, status: 'FAILED', errorMessage: error.message };
    }
  }

  async sendTemplate(userId: string, phoneNumber: string, templateId: string, params: string[] = []) {
    const record = await prisma.messageRecord.create({
      data: {
        userId,
        recipientPhone: phoneNumber,
        channel: 'WHATSAPP',
        content: `Template: ${templateId}`,
        status: 'QUEUED',
        provider: 'GUPSHUP',
      },
    });

    if (!this.isConfigured()) {
      await prisma.messageRecord.update({
        where: { id: record.id },
        data: { status: 'FAILED', errorMessage: 'Gupshup not configured' },
      });
      return record;
    }

    try {
      const destination = this.formatPhone(phoneNumber);
      const source = this.formatPhone(this.sourceNumber!);

      const templateMessage: any = {
        id: templateId,
        type: 'template',
      };
      if (params.length > 0) {
        templateMessage.params = params;
      }

      const body = new URLSearchParams({
        channel: 'whatsapp',
        source,
        destination,
        'src.name': this.appName!,
        message: JSON.stringify(templateMessage),
      });

      const response = await fetch(`${this.baseUrl}/msg`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'apikey': this.apiKey!,
        },
        body: body.toString(),
      });

      const result = (await response.json()) as GupshupResponse;

      if (!response.ok) {
        throw new Error(result.message || `Gupshup HTTP error: ${response.status}`);
      }
      if (result.status !== 'submitted') {
        throw new Error(result.message || `Gupshup template rejected: status=${result.status}`);
      }

      await prisma.messageRecord.update({
        where: { id: record.id },
        data: { status: 'SENT', messageSid: result.messageId || '' },
      });
      return { ...record, status: 'SENT', messageSid: result.messageId };
    } catch (error: any) {
      await prisma.messageRecord.update({
        where: { id: record.id },
        data: { status: 'FAILED', errorMessage: error.message },
      });
      return { ...record, status: 'FAILED', errorMessage: error.message };
    }
  }

  async sendImage(userId: string, phoneNumber: string, imageUrl: string, caption?: string) {
    const record = await prisma.messageRecord.create({
      data: {
        userId,
        recipientPhone: phoneNumber,
        channel: 'WHATSAPP',
        content: caption || 'Image',
        status: 'QUEUED',
        provider: 'GUPSHUP',
      },
    });

    if (!this.isConfigured()) {
      await prisma.messageRecord.update({
        where: { id: record.id },
        data: { status: 'FAILED', errorMessage: 'Gupshup not configured' },
      });
      return record;
    }

    try {
      const destination = this.formatPhone(phoneNumber);
      const source = this.formatPhone(this.sourceNumber!);

      const message: any = {
        type: 'image',
        originalUrl: imageUrl,
        previewUrl: imageUrl,
      };
      if (caption) message.caption = caption;

      const body = new URLSearchParams({
        channel: 'whatsapp',
        source,
        destination,
        'src.name': this.appName!,
        message: JSON.stringify(message),
      });

      const response = await fetch(`${this.baseUrl}/msg`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'apikey': this.apiKey!,
        },
        body: body.toString(),
      });

      const result = (await response.json()) as GupshupResponse;

      if (!response.ok) {
        throw new Error(result.message || `Gupshup HTTP error: ${response.status}`);
      }
      if (result.status !== 'submitted') {
        throw new Error(result.message || `Gupshup image rejected: status=${result.status}`);
      }

      await prisma.messageRecord.update({
        where: { id: record.id },
        data: { status: 'SENT', messageSid: result.messageId || '' },
      });
      return { ...record, status: 'SENT', messageSid: result.messageId };
    } catch (error: any) {
      await prisma.messageRecord.update({
        where: { id: record.id },
        data: { status: 'FAILED', errorMessage: error.message },
      });
      return { ...record, status: 'FAILED', errorMessage: error.message };
    }
  }

  async handleWebhook(payload: any) {
    const { type, payload: eventPayload } = payload;

    if (type === 'message-event') {
      const { gsId, type: eventType, destination } = eventPayload;
      const statusMap: Record<string, string> = {
        'sent': 'SENT',
        'delivered': 'DELIVERED',
        'read': 'READ',
        'failed': 'FAILED',
        'enqueued': 'QUEUED',
      };

      const newStatus = statusMap[eventType] || eventType.toUpperCase();

      if (gsId) {
        const record = await prisma.messageRecord.findFirst({
          where: { messageSid: gsId },
        });
        if (record) {
          await prisma.messageRecord.update({
            where: { id: record.id },
            data: { status: newStatus },
          });
          console.log(`Gupshup webhook: message ${gsId} -> ${newStatus}`);
        }
      }
    }

    if (type === 'message') {
      const { from, text, type: msgType } = eventPayload;
      console.log(`Gupshup inbound from ${from}: [${msgType}] ${text || ''}`);

      if (from) {
        try {
          const formattedFrom = this.formatPhone(from);
          const user = await prisma.user.findFirst({
            where: {
              OR: [
                { phone: { contains: formattedFrom.slice(-10) } },
                { whatsappPhone: { contains: formattedFrom.slice(-10) } },
              ],
            },
          });

          if (user && !user.whatsappOptedIn) {
            await prisma.user.update({
              where: { id: user.id },
              data: { whatsappOptedIn: true, whatsappPhone: from },
            });
            console.log(`Auto opted-in user ${user.id} from inbound WhatsApp`);
          }

          if (!user) {
            console.log(`Inbound WhatsApp from unknown number ${from}`);
          }
        } catch (e: any) {
          console.error(`Auto opt-in error:`, e.message);
        }
      }
    }
  }

  async registerTemplate(
    elementName: string,
    languageCode: string,
    category: string,
    templateType: string,
    content: string,
    example?: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Gupshup not configured' };
    }

    try {
      const body = new URLSearchParams({
        elementName,
        languageCode,
        category,
        templateType,
        content,
        vertical: 'Networking',
      });
      if (example) {
        body.append('example', example);
      }

      const response = await fetch(`https://api.gupshup.io/sm/api/v2/template/${this.appName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'apikey': this.apiKey!,
        },
        body: body.toString(),
      });

      const result = await response.json() as any;
      console.log(`Template registration [${elementName}]:`, JSON.stringify(result));

      if (result.status === 'success' || result.status === 'submitted') {
        return { success: true, data: result };
      }
      return { success: false, data: result, error: result.message || JSON.stringify(result) };
    } catch (error: any) {
      console.error(`Template registration failed [${elementName}]:`, error.message);
      return { success: false, error: error.message };
    }
  }

  async listTemplates(): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Gupshup not configured' };
    }

    try {
      const response = await fetch(`https://api.gupshup.io/sm/api/v1/template/list/${this.appName}`, {
        method: 'GET',
        headers: {
          'apikey': this.apiKey!,
        },
      });

      const result = await response.json() as any;
      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}

export const gupshupService = new GupshupService();
