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
  private templateNamespace: string | null;
  private baseUrl = 'https://api.gupshup.io/wa/api/v1';

  constructor() {
    this.apiKey = env.GUPSHUP_API_KEY || null;
    this.appName = env.GUPSHUP_APP_NAME || null;
    this.sourceNumber = env.GUPSHUP_SOURCE_NUMBER || null;
    this.templateNamespace = env.GUPSHUP_TEMPLATE_NAMESPACE || null;
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

  /**
   * Opt-in a user for WhatsApp messaging by updating the local database.
   *
   * The Gupshup opt-in API (https://api.gupshup.io/sm/api/v1/app/opt/in/{appName})
   * was deprecated as of September 1, 2024. Gupshup no longer manages opt-in/opt-out
   * state and no longer checks it when sending messages.
   * See: https://support.gupshup.io/hc/en-us/articles/35183519921689-Prepare-for-Sunset-of-Optin-Optout-service-by-Gupshup-before-31st-Aug-2024
   */
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

      console.log(`WhatsApp opt-in (local) for ${formattedPhone}${user ? ` (user ${user.id})` : ' (no matching user found)'}`);
      return { success: true };
    } catch (error: any) {
      console.error(`WhatsApp opt-in failed for ${phoneNumber}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Opt-out a user from WhatsApp messaging by updating the local database.
   *
   * The Gupshup opt-out API (https://api.gupshup.io/sm/api/v1/app/opt/out/{appName})
   * was deprecated as of September 1, 2024. Gupshup no longer manages opt-in/opt-out
   * state and no longer checks it when sending messages.
   * See: https://support.gupshup.io/hc/en-us/articles/35183519921689-Prepare-for-Sunset-of-Optin-Optout-service-by-Gupshup-before-31st-Aug-2024
   */
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

      console.log(`WhatsApp opt-out (local) for ${formattedPhone}${user ? ` (user ${user.id})` : ' (no matching user found)'}`);
      return { success: true };
    } catch (error: any) {
      console.error(`WhatsApp opt-out failed for ${phoneNumber}:`, error.message);
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

      let rawBody: string;
      try {
        rawBody = await response.text();
      } catch {
        rawBody = '';
      }
      let result: GupshupResponse;
      try {
        result = JSON.parse(rawBody) as GupshupResponse;
      } catch {
        result = { status: 'error', message: rawBody };
      }

      if (!response.ok) {
        console.error(`Gupshup sendWhatsApp failed: dest=${destination}, HTTP ${response.status}, response=${rawBody}`);
        throw new Error(result.message || `Gupshup HTTP error: ${response.status}`);
      }
      if (result.status !== 'submitted') {
        console.error(`Gupshup sendWhatsApp rejected: dest=${destination}, status=${result.status}, response=${rawBody}`);
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

  async sendWhatsAppDirect(phoneNumber: string, message: string): Promise<{ success: boolean; error?: string; httpStatus?: number; response?: any }> {
    if (!this.isConfigured()) {
      console.warn('Gupshup not configured, WhatsApp direct skipped');
      return { success: false, error: 'Gupshup not configured' };
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

      let rawBody: string;
      try {
        rawBody = await response.text();
      } catch {
        rawBody = '';
      }
      let result: GupshupResponse;
      try {
        result = JSON.parse(rawBody) as GupshupResponse;
      } catch {
        result = { status: 'error', message: rawBody };
      }

      if (!response.ok || result.status !== 'submitted') {
        console.error(`Gupshup direct send failed: dest=${destination}, HTTP ${response.status}, response=${rawBody}`);
        return { success: false, error: result.message || `HTTP ${response.status}`, httpStatus: response.status, response: result };
      }

      console.log(`Gupshup WhatsApp direct sent to ${phoneNumber} (${result.messageId})`);
      return { success: true, httpStatus: response.status, response: result };
    } catch (error: any) {
      console.error(`Gupshup WhatsApp direct failed to ${phoneNumber}:`, error.message);
      return { success: false, error: error.message };
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

      let templateMessage: any;

      if (this.templateNamespace) {
        templateMessage = {
          type: 'template',
          template: {
            namespace: this.templateNamespace,
            name: templateId,
            language: {
              code: 'en',
              policy: 'deterministic',
            },
            components: params.length > 0
              ? [{
                  type: 'body',
                  parameters: params.map(p => ({ type: 'text', text: p })),
                }]
              : [],
          },
        };
      } else {
        templateMessage = {
          id: templateId,
          type: 'template',
        };
        if (params.length > 0) {
          templateMessage.params = params;
        }
      }

      console.log(`Gupshup sendTemplate: dest=${destination}, template=${templateId}, namespace=${this.templateNamespace || 'none'}, params=${JSON.stringify(params)}, payload=${JSON.stringify(templateMessage)}`);

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

      let rawBody: string;
      try {
        rawBody = await response.text();
      } catch {
        rawBody = '';
      }
      let result: GupshupResponse;
      try {
        result = JSON.parse(rawBody) as GupshupResponse;
      } catch {
        result = { status: 'error', message: rawBody };
      }

      if (!response.ok) {
        console.error(`Gupshup sendTemplate failed: dest=${destination}, template=${templateId}, HTTP ${response.status}, response=${rawBody}`);
        throw new Error(result.message || `Gupshup HTTP error: ${response.status}`);
      }
      if (result.status !== 'submitted') {
        console.error(`Gupshup sendTemplate rejected: dest=${destination}, template=${templateId}, status=${result.status}, response=${rawBody}`);
        throw new Error(result.message || `Gupshup template rejected: status=${result.status}`);
      }

      await prisma.messageRecord.update({
        where: { id: record.id },
        data: { status: 'SENT', messageSid: result.messageId || '' },
      });
      return { ...record, status: 'SENT', messageSid: result.messageId };
    } catch (error: any) {
      console.error(`Gupshup sendTemplate error: dest=${phoneNumber}, template=${templateId}, error=${error.message}`);
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

      let rawBody: string;
      try {
        rawBody = await response.text();
      } catch {
        rawBody = '';
      }
      let result: GupshupResponse;
      try {
        result = JSON.parse(rawBody) as GupshupResponse;
      } catch {
        result = { status: 'error', message: rawBody };
      }

      if (!response.ok) {
        console.error(`Gupshup sendImage failed: dest=${destination}, HTTP ${response.status}, response=${rawBody}`);
        throw new Error(result.message || `Gupshup HTTP error: ${response.status}`);
      }
      if (result.status !== 'submitted') {
        console.error(`Gupshup sendImage rejected: dest=${destination}, status=${result.status}, response=${rawBody}`);
        throw new Error(result.message || `Gupshup image rejected: status=${result.status}`);
      }

      await prisma.messageRecord.update({
        where: { id: record.id },
        data: { status: 'SENT', messageSid: result.messageId || '' },
      });
      return { ...record, status: 'SENT', messageSid: result.messageId };
    } catch (error: any) {
      console.error(`Gupshup sendImage error: dest=${phoneNumber}, error=${error.message}`);
      await prisma.messageRecord.update({
        where: { id: record.id },
        data: { status: 'FAILED', errorMessage: error.message },
      });
      return { ...record, status: 'FAILED', errorMessage: error.message };
    }
  }

  async handleWebhook(payload: any) {
    if (payload?.entry) {
      await this.handleMetaWebhook(payload);
      return;
    }

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

      const errorDetails = eventType === 'failed'
        ? { code: eventPayload.errorCode, message: eventPayload.reason || eventPayload.errorMessage }
        : undefined;

      if (gsId) {
        await this.updateMessageStatus(gsId, newStatus, errorDetails);
      }
    }

    if (type === 'message') {
      const { from, text, type: msgType } = eventPayload;
      console.log(`Gupshup inbound from ${from}: [${msgType}] ${text || ''}`);
      await this.handleInboundFrom(from);
    }
  }

  private async handleMetaWebhook(payload: any) {
    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value;
        if (!value) continue;

        if (value.statuses) {
          for (const s of value.statuses) {
            const statusMap: Record<string, string> = {
              'sent': 'SENT',
              'delivered': 'DELIVERED',
              'read': 'READ',
              'failed': 'FAILED',
              'enqueued': 'QUEUED',
            };
            const newStatus = statusMap[s.status] || (s.status || '').toUpperCase();

            const errorDetails = s.status === 'failed' && s.errors?.[0]
              ? { code: s.errors[0].code, message: s.errors[0].error_data?.details || s.errors[0].message }
              : undefined;

            if (s.gs_id) {
              await this.updateMessageStatus(s.gs_id, newStatus, errorDetails);
            }

            if (s.status === 'failed' && s.errors?.[0]) {
              const err = s.errors[0];
              console.log(`Gupshup webhook: message ${s.gs_id} FAILED - code=${err.code}, details=${err.error_data?.details || err.message}`);
            }
          }
        }

        if (value.messages) {
          for (const m of value.messages) {
            console.log(`Gupshup inbound (Meta): from=${m.from}, type=${m.type}, text=${m.text?.body || ''}`);
            await this.handleInboundFrom(m.from);
          }
        }
      }
    }
  }

  async updateMessageStatus(gsId: string, newStatus: string, errorDetails?: { code?: string | number; message?: string }) {
    const validStatuses = ['QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'READ'] as const;
    const status = validStatuses.find(s => s === newStatus);
    if (!status) {
      console.log(`Gupshup webhook: unknown status "${newStatus}" for ${gsId}, skipping DB update`);
      return;
    }

    const record = await prisma.messageRecord.findFirst({
      where: { messageSid: gsId },
    });
    if (record) {
      let errorMessage: string | undefined;
      if (status === 'FAILED' && errorDetails) {
        errorMessage = [
          errorDetails.code ? `code=${errorDetails.code}` : '',
          errorDetails.message || '',
        ].filter(Boolean).join(': ') || 'Unknown error';
        console.log(`Gupshup webhook: message ${gsId} FAILED — ${errorMessage}`);
      }
      await prisma.messageRecord.update({
        where: { id: record.id },
        data: errorMessage ? { status, errorMessage } : { status },
      });
      console.log(`Gupshup webhook: message ${gsId} -> ${status}`);
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
        console.log(`Auto opted-in user ${user.id} from inbound WhatsApp`);
      }

      if (!user) {
        console.log(`Inbound WhatsApp from unknown number ${from}`);
      }
    } catch (e: any) {
      console.error(`Auto opt-in error:`, e.message);
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

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        return { success: false, error: `Gupshup API returned HTTP ${response.status}: ${errorText.substring(0, 200)}` };
      }

      const result = await response.json() as any;
      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}

export const gupshupService = new GupshupService();
