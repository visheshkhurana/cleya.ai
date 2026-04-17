"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.twilioWhatsAppService = void 0;
const twilio_1 = __importDefault(require("twilio"));
const env_1 = require("../config/env");
const TEMPLATE_CONTENT_SIDS = {
    cleya_welcome_message: 'HX247a078a6699a55d88481161a076ca83',
    cleya_networking_intro: 'HXa44d4a7d23ce01c47d9c477e714b2f97',
    cleya_general_update: 'HXb313fddcb0d8450b4bdc4255f5871e8a',
};
const FALLBACK_TEMPLATE = 'cleya_general_update';
const OUTSIDE_WINDOW_ERROR_CODE = 63016;
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
    resolveTemplateSid(templateName) {
        return TEMPLATE_CONTENT_SIDS[templateName] || null;
    }
    extractRecipientName(recipientName) {
        const trimmed = (recipientName || '').trim();
        if (trimmed)
            return trimmed.split(/\s+/)[0];
        return 'there';
    }
    async sendWhatsApp(userId, phoneNumber, message, recipientName) {
        const client = this.getClient();
        if (!client)
            throw new Error('Twilio not configured');
        const to = this.formatPhone(phoneNumber);
        try {
            const result = await client.messages.create({
                from: env_1.env.TWILIO_WHATSAPP_FROM,
                to,
                body: message,
            });
            console.log(`[TwilioWA] Sent to ${phoneNumber}: ${result.sid} status=${result.status}`);
            return { success: true, messageId: result.sid, status: result.status };
        }
        catch (error) {
            if (error?.code === OUTSIDE_WINDOW_ERROR_CODE) {
                console.warn(`[TwilioWA] Outside 24h messaging window for ${phoneNumber}, falling back to template '${FALLBACK_TEMPLATE}'`);
                return this.sendTemplate(userId, phoneNumber, FALLBACK_TEMPLATE, [
                    this.extractRecipientName(recipientName),
                ]);
            }
            console.error(`[TwilioWA] Send failed to ${phoneNumber}: ${error?.code || ''} ${error?.message || error}`);
            throw error;
        }
    }
    async sendWhatsAppDirect(phoneNumber, message, recipientName) {
        return this.sendWhatsApp('direct', phoneNumber, message, recipientName);
    }
    async sendTemplate(userId, phoneNumber, templateName, params = []) {
        const client = this.getClient();
        if (!client)
            throw new Error('Twilio not configured');
        const contentSid = this.resolveTemplateSid(templateName);
        if (!contentSid) {
            console.warn(`[TwilioWA] Unknown template '${templateName}', cannot send`);
            return null;
        }
        const contentVariables = {};
        params.forEach((value, idx) => {
            contentVariables[String(idx + 1)] = value ?? '';
        });
        if (!contentVariables['1']) {
            contentVariables['1'] = 'there';
        }
        try {
            const result = await client.messages.create({
                from: env_1.env.TWILIO_WHATSAPP_FROM,
                to: this.formatPhone(phoneNumber),
                contentSid,
                contentVariables: JSON.stringify(contentVariables),
            });
            console.log(`[TwilioWA] Template '${templateName}' sent to ${phoneNumber}: ${result.sid} status=${result.status}`);
            return { success: true, messageId: result.sid, status: result.status };
        }
        catch (error) {
            console.error(`[TwilioWA] Template '${templateName}' failed to ${phoneNumber}: ${error?.code || ''} ${error?.message || error}`);
            throw error;
        }
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