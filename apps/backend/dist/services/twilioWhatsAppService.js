"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.twilioWhatsAppService = void 0;
const twilio_1 = __importDefault(require("twilio"));
const env_1 = require("../config/env");
class TwilioWhatsAppService {
    client = null;
    getClient() {
        if (!this.client && this.isConfigured()) {
            this.client = (0, twilio_1.default)(env_1.env.TWILIO_ACCOUNT_SID, env_1.env.TWILIO_AUTH_TOKEN);
        }
        return this.client;
    }
    isConfigured() {
        return !!(env_1.env.TWILIO_ACCOUNT_SID && env_1.env.TWILIO_AUTH_TOKEN && env_1.env.TWILIO_WHATSAPP_FROM);
    }
    // Format phone for Twilio WhatsApp: "whatsapp:+918826432266"
    formatPhone(phone) {
        const digits = phone.replace(/\D/g, '');
        const withPlus = digits.startsWith('+') ? digits : `+${digits}`;
        return `whatsapp:${withPlus}`;
    }
    async sendWhatsApp(userId, phoneNumber, message) {
        const client = this.getClient();
        if (!client)
            throw new Error('Twilio not configured');
        const result = await client.messages.create({
            from: env_1.env.TWILIO_WHATSAPP_FROM,
            to: this.formatPhone(phoneNumber),
            body: message,
        });
        console.log(`[TwilioWA] Sent to ${phoneNumber}: ${result.sid} status=${result.status}`);
        return { success: true, messageId: result.sid, status: result.status };
    }
    async sendWhatsAppDirect(phoneNumber, message) {
        return this.sendWhatsApp('direct', phoneNumber, message);
    }
    async sendTemplate(userId, phoneNumber, templateName, params = []) {
        // Twilio uses Content Templates (ContentSid) for WhatsApp templates
        // For now, fall back to sending as regular text with the template content
        // In production, you'd use Twilio Content API: client.content.v1.contentAndApprovals.list()
        console.log(`[TwilioWA] Template '${templateName}' not natively supported, falling back to text`);
        return null; // Return null to let the next provider try
    }
    async sendImage(userId, phoneNumber, imageUrl, caption) {
        const client = this.getClient();
        if (!client)
            throw new Error('Twilio not configured');
        const result = await client.messages.create({
            from: env_1.env.TWILIO_WHATSAPP_FROM,
            to: this.formatPhone(phoneNumber),
            body: caption || '',
            mediaUrl: [imageUrl],
        });
        return { success: true, messageId: result.sid };
    }
    async sendWhatsAppButton(userId, phoneNumber, bodyText, buttons) {
        // Twilio doesn't support interactive buttons via basic API
        // Send as text with numbered options
        const buttonText = buttons.map((b, i) => `${i + 1}. ${b.title}`).join('\n');
        return this.sendWhatsApp(userId, phoneNumber, `${bodyText}\n\n${buttonText}`);
    }
    async optInUser(phoneNumber) {
        return { success: true }; // No opt-in needed for Twilio
    }
    async optOutUser(phoneNumber) {
        return { success: true };
    }
    // Handle Twilio status webhook callbacks
    async handleStatusCallback(body) {
        const { MessageSid, MessageStatus, To, ErrorCode, ErrorMessage } = body;
        console.log(`[TwilioWA] Status: ${MessageSid} -> ${MessageStatus} ${ErrorCode ? `(Error: ${ErrorCode} ${ErrorMessage})` : ''}`);
        return { messageId: MessageSid, status: MessageStatus };
    }
    // Handle inbound WhatsApp messages from Twilio
    async handleInbound(body) {
        const { From, Body, MessageSid, NumMedia } = body;
        const phone = From?.replace('whatsapp:', '').replace('+', '');
        console.log(`[TwilioWA] Inbound from ${phone}: ${Body}`);
        return { phone, message: Body, messageId: MessageSid, numMedia: NumMedia };
    }
}
exports.twilioWhatsAppService = new TwilioWhatsAppService();
//# sourceMappingURL=twilioWhatsAppService.js.map