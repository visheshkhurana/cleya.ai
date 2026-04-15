import { prisma } from '@cleya/db';
import { env } from '../config/env';
import crypto from 'crypto';

const META_API_BASE = 'https://graph.facebook.com/v21.0';

export class MetaWhatsAppService {
  private token: string | null;
  private phoneId: string | null;
  private wabaId: string | null;
  private appSecret: string | null;
  private verifyToken: string | null;

  constructor() {
    this.token = env.META_WHATSAPP_TOKEN || null;
    this.phoneId = env.META_WHATSAPP_PHONE_ID || null;
    this.wabaId = env.META_WHATSAPP_WABA_ID || null;
    this.appSecret = env.META_WHATSAPP_APP_SECRET || null;
    this.verifyToken = env.META_WHATSAPP_VERIFY_TOKEN || null;
  }

  isConfigured(): boolean {
    return !!(this.token && this.phoneId);
  }

  getVerifyToken(): string | null {
    return this.verifyToken;
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

  private async callApi(endpoint: string, method: string, body?: any): Promise<any> {
    const url = `${META_API_BASE}${endpoint}`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    let result: any;
    try {
      result = JSON.parse(text);
    } catch {
      result = { error: { message: text } };
    }

    if (!response.ok) {
      const errMsg = result?.error?.message || `Meta API HTTP ${response.status}`;
      throw new Error(errMsg);
    }

    return result;
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    if (!this.appSecret) return false;
    const expectedSig = crypto
      .createHmac('sha256', this.appSecret)
      .update(rawBody)
      .digest('hex');
    return signature === `sha256=${expectedSig}`;
  }

  async optInUser(phoneNumber: string): Promise<{ success: boolean; error?: string }> {
    try {
      const formattedPhone = this.formatPhone(phoneNumber);
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { phone: { contains: formattedPhone.slice(-10) } },
            { whatsappPhone: { contains: formattedPhone.slice(-10) } },
          ],
        },
      });

      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: { whatsappOptedIn: true, whatsappPhone: formattedPhone },
        });
      }

      console.log(`[Meta WA] Opt-in (local) for ${formattedPhone}${user ? ` (user ${user.id})` : ' (no matching user)'}`);
      return { success: true };
    } catch (error: any) {
      console.error(`[Meta WA] Opt-in failed for ${phoneNumber}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  async optOutUser(phoneNumber: string): Promise<{ success: boolean; error?: string }> {
    try {
      const formattedPhone = this.formatPhone(phoneNumber);
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { phone: { contains: formattedPhone.slice(-10) } },
            { whatsappPhone: { contains: formattedPhone.slice(-10) } },
          ],
        },
      });

      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: { whatsappOptedIn: false },
        });
      }

      console.log(`[Meta WA] Opt-out (local) for ${formattedPhone}${user ? ` (user ${user.id})` : ' (no matching user)'}`);
      return { success: true };
    } catch (error: any) {
      console.error(`[Meta WA] Opt-out failed for ${phoneNumber}:`, error.message);
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
        provider: 'META',
      },
    });

    if (!this.isConfigured()) {
      console.warn('[Meta WA] Not configured, WhatsApp skipped');
      await prisma.messageRecord.update({
        where: { id: record.id },
        data: { status: 'FAILED', errorMessage: 'Meta WhatsApp not configured' },
      });
      return record;
    }

    try {
      const destination = this.formatPhone(phoneNumber);

      const result = await this.callApi(`/${this.phoneId}/messages`, 'POST', {
        messaging_product: 'whatsapp',
        to: destination,
        type: 'text',
        text: { body: message },
      });

      const wamid = result?.messages?.[0]?.id || '';
      await prisma.messageRecord.update({
        where: { id: record.id },
        data: { status: 'SENT', messageSid: wamid },
      });
      console.log(`[Meta WA] Sent to ${phoneNumber} (${wamid})`);
      return { ...record, status: 'SENT', messageSid: wamid };
    } catch (error: any) {
      await prisma.messageRecord.update({
        where: { id: record.id },
        data: { status: 'FAILED', errorMessage: error.message },
      });
      console.error(`[Meta WA] Send failed to ${phoneNumber}:`, error.message);
      return { ...record, status: 'FAILED', errorMessage: error.message };
    }
  }

  async sendWhatsAppDirect(phoneNumber: string, message: string): Promise<{ success: boolean; error?: string; httpStatus?: number; response?: any }> {
    if (!this.isConfigured()) {
      console.warn('[Meta WA] Not configured, direct send skipped');
      return { success: false, error: 'Meta WhatsApp not configured' };
    }

    try {
      const destination = this.formatPhone(phoneNumber);

      const result = await this.callApi(`/${this.phoneId}/messages`, 'POST', {
        messaging_product: 'whatsapp',
        to: destination,
        type: 'text',
        text: { body: message },
      });

      console.log(`[Meta WA] Direct sent to ${phoneNumber} (${result?.messages?.[0]?.id || ''})`);
      return { success: true, httpStatus: 200, response: result };
    } catch (error: any) {
      console.error(`[Meta WA] Direct send failed to ${phoneNumber}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  async sendTemplate(userId: string, phoneNumber: string, templateName: string, params: string[] = []) {
    const record = await prisma.messageRecord.create({
      data: {
        userId,
        recipientPhone: phoneNumber,
        channel: 'WHATSAPP',
        content: `Template: ${templateName}`,
        status: 'QUEUED',
        provider: 'META',
      },
    });

    if (!this.isConfigured()) {
      await prisma.messageRecord.update({
        where: { id: record.id },
        data: { status: 'FAILED', errorMessage: 'Meta WhatsApp not configured' },
      });
      return record;
    }

    try {
      const destination = this.formatPhone(phoneNumber);

      const templatePayload: any = {
        name: templateName,
        language: { code: 'en' },
      };
      if (params.length > 0) {
        templatePayload.components = [{
          type: 'body',
          parameters: params.map(p => ({ type: 'text', text: p })),
        }];
      }

      const result = await this.callApi(`/${this.phoneId}/messages`, 'POST', {
        messaging_product: 'whatsapp',
        to: destination,
        type: 'template',
        template: templatePayload,
      });

      const wamid = result?.messages?.[0]?.id || '';
      await prisma.messageRecord.update({
        where: { id: record.id },
        data: { status: 'SENT', messageSid: wamid },
      });
      console.log(`[Meta WA] Template "${templateName}" sent to ${phoneNumber} (${wamid})`);
      return { ...record, status: 'SENT', messageSid: wamid };
    } catch (error: any) {
      console.error(`[Meta WA] Template "${templateName}" failed to ${phoneNumber}:`, error.message);
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
        provider: 'META',
      },
    });

    if (!this.isConfigured()) {
      await prisma.messageRecord.update({
        where: { id: record.id },
        data: { status: 'FAILED', errorMessage: 'Meta WhatsApp not configured' },
      });
      return record;
    }

    try {
      const destination = this.formatPhone(phoneNumber);

      const result = await this.callApi(`/${this.phoneId}/messages`, 'POST', {
        messaging_product: 'whatsapp',
        to: destination,
        type: 'image',
        image: { link: imageUrl, caption: caption || '' },
      });

      const wamid = result?.messages?.[0]?.id || '';
      await prisma.messageRecord.update({
        where: { id: record.id },
        data: { status: 'SENT', messageSid: wamid },
      });
      console.log(`[Meta WA] Image sent to ${phoneNumber} (${wamid})`);
      return { ...record, status: 'SENT', messageSid: wamid };
    } catch (error: any) {
      console.error(`[Meta WA] Image send failed to ${phoneNumber}:`, error.message);
      await prisma.messageRecord.update({
        where: { id: record.id },
        data: { status: 'FAILED', errorMessage: error.message },
      });
      return { ...record, status: 'FAILED', errorMessage: error.message };
    }
  }

  async sendWhatsAppButton(userId: string, phoneNumber: string, bodyText: string, buttons: Array<{ id: string; title: string }>) {
    const record = await prisma.messageRecord.create({
      data: {
        userId,
        recipientPhone: phoneNumber,
        channel: 'WHATSAPP',
        content: bodyText,
        status: 'QUEUED',
        provider: 'META',
      },
    });

    if (!this.isConfigured()) {
      await prisma.messageRecord.update({
        where: { id: record.id },
        data: { status: 'FAILED', errorMessage: 'Meta WhatsApp not configured' },
      });
      return record;
    }

    try {
      const destination = this.formatPhone(phoneNumber);

      const result = await this.callApi(`/${this.phoneId}/messages`, 'POST', {
        messaging_product: 'whatsapp',
        to: destination,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: bodyText },
          action: {
            buttons: buttons.map(b => ({
              type: 'reply',
              reply: { id: b.id, title: b.title },
            })),
          },
        },
      });

      const wamid = result?.messages?.[0]?.id || '';
      await prisma.messageRecord.update({
        where: { id: record.id },
        data: { status: 'SENT', messageSid: wamid },
      });
      return { ...record, status: 'SENT', messageSid: wamid };
    } catch (error: any) {
      await prisma.messageRecord.update({
        where: { id: record.id },
        data: { status: 'FAILED', errorMessage: error.message },
      });
      return { ...record, status: 'FAILED', errorMessage: error.message };
    }
  }

  async listTemplates(): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!this.isConfigured() || !this.wabaId) {
      return { success: false, error: 'Meta WhatsApp not configured (missing WABA_ID)' };
    }

    try {
      const result = await this.callApi(`/${this.wabaId}/message_templates`, 'GET');
      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async registerTemplate(
    name: string,
    category: string,
    language: string,
    components: any[]
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!this.isConfigured() || !this.wabaId) {
      return { success: false, error: 'Meta WhatsApp not configured (missing WABA_ID)' };
    }

    try {
      const result = await this.callApi(`/${this.wabaId}/message_templates`, 'POST', {
        name,
        category,
        language,
        components,
      });
      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async handleWebhook(payload: any): Promise<void> {
    if (payload?.object !== 'whatsapp_business_account') return;

    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value;
        if (!value || change.field !== 'messages') continue;

        if (value.statuses) {
          for (const s of value.statuses) {
            const statusMap: Record<string, string> = {
              'sent': 'SENT',
              'delivered': 'DELIVERED',
              'read': 'READ',
              'failed': 'FAILED',
            };
            const newStatus = statusMap[s.status] || (s.status || '').toUpperCase();

            const errorDetails = s.status === 'failed' && s.errors?.[0]
              ? { code: s.errors[0].code, message: s.errors[0].title || s.errors[0].message }
              : undefined;

            if (s.id) {
              await this.updateMessageStatus(s.id, newStatus, errorDetails);
            }

            if (s.status === 'failed' && s.errors?.[0]) {
              const err = s.errors[0];
              console.log(`[Meta WA] Message ${s.id} FAILED - code=${err.code}, title=${err.title || err.message}`);
            }
          }
        }

        if (value.messages) {
          for (const m of value.messages) {
            const from = m.from || '';
            const text = m.text?.body || '';
            const msgId = m.id || '';
            console.log(`[Meta WA] Inbound: from=${from}, type=${m.type}, text=${text}, msg_id=${msgId}`);

            await this.handleInboundFrom(from);

            if (text && from) {
              const { whatsappBotService } = await import('./whatsappBotService');
              whatsappBotService.handleInboundMessage(from, text, msgId).catch((err) => {
                console.error(`[Meta WA] Bot handler error:`, err);
              });
            }
          }
        }
      }
    }
  }

  private async updateMessageStatus(wamid: string, newStatus: string, errorDetails?: { code?: string | number; message?: string }) {
    const validStatuses = ['QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'READ'] as const;
    const status = validStatuses.find(s => s === newStatus);
    if (!status) {
      console.log(`[Meta WA] Unknown status "${newStatus}" for ${wamid}, skipping`);
      return;
    }

    const record = await prisma.messageRecord.findFirst({
      where: { messageSid: wamid },
    });

    if (record) {
      let errorMessage: string | undefined;
      if (status === 'FAILED' && errorDetails) {
        errorMessage = [
          errorDetails.code ? `code=${errorDetails.code}` : '',
          errorDetails.message || '',
        ].filter(Boolean).join(': ') || 'Unknown error';
        console.log(`[Meta WA] Message ${wamid} FAILED — ${errorMessage}`);
      }
      await prisma.messageRecord.update({
        where: { id: record.id },
        data: errorMessage ? { status, errorMessage } : { status },
      });
      console.log(`[Meta WA] Message ${wamid} -> ${status}`);
    }
  }

  private async handleInboundFrom(from: string) {
    if (!from) return;
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
        console.log(`[Meta WA] Auto opted-in user ${user.id} from inbound`);
      }

      if (!user) {
        console.log(`[Meta WA] Inbound from unknown number ${from}`);
      }
    } catch (e: any) {
      console.error(`[Meta WA] Auto opt-in error:`, e.message);
    }
  }
}

export const metaWhatsAppService = new MetaWhatsAppService();
