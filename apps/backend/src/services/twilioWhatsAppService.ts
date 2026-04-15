import twilio from 'twilio';
import { env } from '../config/env';

class TwilioWhatsAppService {
  private client: twilio.Twilio | null = null;

  private getClient() {
    if (!this.client && this.isConfigured()) {
      this.client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
    }
    return this.client;
  }

  isConfigured(): boolean {
    return !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_WHATSAPP_FROM);
  }

  // Format phone for Twilio WhatsApp: "whatsapp:+918826432266"
  private formatPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    const withPlus = digits.startsWith('+') ? digits : `+${digits}`;
    return `whatsapp:${withPlus}`;
  }

  async sendWhatsApp(userId: string, phoneNumber: string, message: string) {
    const client = this.getClient();
    if (!client) throw new Error('Twilio not configured');

    const result = await client.messages.create({
      from: env.TWILIO_WHATSAPP_FROM,
      to: this.formatPhone(phoneNumber),
      body: message,
    });

    console.log(`[TwilioWA] Sent to ${phoneNumber}: ${result.sid} status=${result.status}`);
    return { success: true, messageId: result.sid, status: result.status };
  }

  async sendWhatsAppDirect(phoneNumber: string, message: string) {
    return this.sendWhatsApp('direct', phoneNumber, message);
  }

  async sendTemplate(userId: string, phoneNumber: string, templateName: string, params: string[] = []) {
    // Twilio uses Content Templates (ContentSid) for WhatsApp templates
    // For now, fall back to sending as regular text with the template content
    // In production, you'd use Twilio Content API: client.content.v1.contentAndApprovals.list()
    console.log(`[TwilioWA] Template '${templateName}' not natively supported, falling back to text`);
    return null; // Return null to let the next provider try
  }

  async sendImage(userId: string, phoneNumber: string, imageUrl: string, caption?: string) {
    const client = this.getClient();
    if (!client) throw new Error('Twilio not configured');

    const result = await client.messages.create({
      from: env.TWILIO_WHATSAPP_FROM,
      to: this.formatPhone(phoneNumber),
      body: caption || '',
      mediaUrl: [imageUrl],
    });

    return { success: true, messageId: result.sid };
  }

  async sendWhatsAppButton(userId: string, phoneNumber: string, bodyText: string, buttons: Array<{id: string, title: string}>) {
    // Twilio doesn't support interactive buttons via basic API
    // Send as text with numbered options
    const buttonText = buttons.map((b, i) => `${i + 1}. ${b.title}`).join('\n');
    return this.sendWhatsApp(userId, phoneNumber, `${bodyText}\n\n${buttonText}`);
  }

  async optInUser(phoneNumber: string) {
    return { success: true }; // No opt-in needed for Twilio
  }

  async optOutUser(phoneNumber: string) {
    return { success: true };
  }

  // Handle Twilio status webhook callbacks
  async handleStatusCallback(body: any) {
    const { MessageSid, MessageStatus, To, ErrorCode, ErrorMessage } = body;
    console.log(`[TwilioWA] Status: ${MessageSid} -> ${MessageStatus} ${ErrorCode ? `(Error: ${ErrorCode} ${ErrorMessage})` : ''}`);
    return { messageId: MessageSid, status: MessageStatus };
  }

  // Handle inbound WhatsApp messages from Twilio
  async handleInbound(body: any) {
    const { From, Body, MessageSid, NumMedia } = body;
    const phone = From?.replace('whatsapp:', '').replace('+', '');
    console.log(`[TwilioWA] Inbound from ${phone}: ${Body}`);
    return { phone, message: Body, messageId: MessageSid, numMedia: NumMedia };
  }
}

export const twilioWhatsAppService = new TwilioWhatsAppService();
