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

      let result: any;
      const rawText = await response.text();
      try { result = JSON.parse(rawText); } catch { result = rawText; }

      if (response.ok && (result?.status === 'success' || result?.status === 'true')) {
        console.log(`Gupshup opt-in success for ${formattedPhone}`);
        return { success: true };
      }

      const msg = typeof result === 'string' ? result : result?.message || JSON.stringify(result);
      console.warn(`Gupshup opt-in failed for ${formattedPhone}: HTTP ${response.status} — ${msg}`);
      return { success: false, error: msg };
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

  private isTransientError(error: any): boolean {
    if (error?.httpStatus) {
      return error.httpStatus >= 500 || error.httpStatus === 429;
    }
    const message = (error?.message || '').toLowerCase();
    return message.includes('timeout') || message.includes('econnrefused') || message.includes('econnreset') || message.includes('fetch failed') || message.includes('network') || message.includes('abort');
  }

  private async retryWithBackoff<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
    const delays = [1000, 2000, 4000];
    let lastError: any;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        if (attempt < maxRetries && this.isTransientError(error)) {
          const delay = delays[attempt] || 4000;
          console.warn(`Gupshup retry ${attempt + 1}/${maxRetries} after ${delay}ms: ${error.message}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else if (!this.isTransientError(error)) {
          throw error;
        }
      }
    }
    throw lastError;
  }

  private async attemptSendMessage(destination: string, source: string, messagePayload: any): Promise<GupshupResponse> {
    const body = new URLSearchParams({
      channel: 'whatsapp',
      source,
      destination,
      'src.name': this.appName!,
      message: JSON.stringify(messagePayload),
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
      const err = new Error(result.message || `Gupshup HTTP error: ${response.status}`);
      (err as any).httpStatus = response.status;
      throw err;
    }
    if (result.status !== 'submitted') {
      throw new Error(result.message || `Gupshup rejected: status=${result.status}`);
    }

    return result;
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

      const result = await this.retryWithBackoff(() =>
        this.attemptSendMessage(destination, source, { type: 'text', text: message })
      );

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
      console.error(`Gupshup WhatsApp failed to ${phoneNumber} after retries:`, error.message);
      return { ...record, status: 'FAILED', errorMessage: error.message };
    }
  }

  async sendWhatsAppDirect(phoneNumber: string, message: string) {
    if (!this.isConfigured()) {
      console.warn('Gupshup not configured, WhatsApp direct skipped');
      return;
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
      if (!response.ok || result.status !== 'submitted') {
        console.error(`Gupshup direct send failed to ${phoneNumber}: ${result.message}`);
      } else {
        console.log(`Gupshup WhatsApp direct sent to ${phoneNumber} (${result.messageId})`);
      }
    } catch (error: any) {
      console.error(`Gupshup WhatsApp direct failed to ${phoneNumber}:`, error.message);
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

      console.log(`Gupshup sendTemplate: dest=${destination}, template=${templateId}, namespace=${this.templateNamespace || 'none'}, payload=${JSON.stringify(templateMessage)}`);

      const result = await this.retryWithBackoff(() =>
        this.attemptSendMessage(destination, source, templateMessage)
      );

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

      if (gsId) {
        await this.updateMessageStatus(gsId, newStatus);
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

            if (s.gs_id) {
              await this.updateMessageStatus(s.gs_id, newStatus);
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

  private async updateMessageStatus(gsId: string, newStatus: string) {
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
      await prisma.messageRecord.update({
        where: { id: record.id },
        data: { status },
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

  async pingApi(): Promise<{ success: boolean; latencyMs: number; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, latencyMs: 0, error: 'Gupshup not configured' };
    }

    try {
      const start = Date.now();
      const response = await fetch(`https://api.gupshup.io/sm/api/v1/template/list/${this.appName}`, {
        method: 'GET',
        headers: { 'apikey': this.apiKey! },
        signal: AbortSignal.timeout(10000),
      });
      const latencyMs = Date.now() - start;

      if (response.ok) {
        return { success: true, latencyMs };
      }
      return { success: false, latencyMs, error: `HTTP ${response.status}: ${response.statusText}` };
    } catch (error: any) {
      return { success: false, latencyMs: 0, error: error.message };
    }
  }

  getConfigStatus(): { apiKey: boolean; appName: boolean; sourceNumber: boolean; templateNamespace: boolean } {
    return {
      apiKey: !!this.apiKey,
      appName: !!this.appName,
      sourceNumber: !!this.sourceNumber,
      templateNamespace: !!this.templateNamespace,
    };
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
