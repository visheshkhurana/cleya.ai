"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.metaWhatsAppService = exports.MetaWhatsAppService = void 0;
const db_1 = require("@cleya/db");
const env_1 = require("../config/env");
const crypto_1 = __importDefault(require("crypto"));
const META_API_BASE = 'https://graph.facebook.com/v21.0';
class MetaWhatsAppService {
    token;
    phoneId;
    wabaId;
    appSecret;
    verifyToken;
    constructor() {
        this.token = env_1.env.META_WHATSAPP_TOKEN || null;
        this.phoneId = env_1.env.META_WHATSAPP_PHONE_ID || null;
        this.wabaId = env_1.env.META_WHATSAPP_WABA_ID || null;
        this.appSecret = env_1.env.META_WHATSAPP_APP_SECRET || null;
        this.verifyToken = env_1.env.META_WHATSAPP_VERIFY_TOKEN || null;
    }
    isConfigured() {
        return !!(this.token && this.phoneId);
    }
    getVerifyToken() {
        return this.verifyToken;
    }
    formatPhone(phone) {
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
    async callApi(endpoint, method, body) {
        const url = `${META_API_BASE}${endpoint}`;
        const headers = {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json',
        };
        const response = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        });
        const text = await response.text();
        let result;
        try {
            result = JSON.parse(text);
        }
        catch {
            result = { error: { message: text } };
        }
        if (!response.ok) {
            const errMsg = result?.error?.message || `Meta API HTTP ${response.status}`;
            throw new Error(errMsg);
        }
        return result;
    }
    verifyWebhookSignature(rawBody, signature) {
        if (!this.appSecret)
            return false;
        const expectedSig = crypto_1.default
            .createHmac('sha256', this.appSecret)
            .update(rawBody)
            .digest('hex');
        return signature === `sha256=${expectedSig}`;
    }
    async optInUser(phoneNumber) {
        try {
            const formattedPhone = this.formatPhone(phoneNumber);
            const user = await db_1.prisma.user.findFirst({
                where: {
                    OR: [
                        { phone: { contains: formattedPhone.slice(-10) } },
                        { whatsappPhone: { contains: formattedPhone.slice(-10) } },
                    ],
                },
            });
            if (user) {
                await db_1.prisma.user.update({
                    where: { id: user.id },
                    data: { whatsappOptedIn: true, whatsappPhone: formattedPhone },
                });
            }
            console.log(`[Meta WA] Opt-in (local) for ${formattedPhone}${user ? ` (user ${user.id})` : ' (no matching user)'}`);
            return { success: true };
        }
        catch (error) {
            console.error(`[Meta WA] Opt-in failed for ${phoneNumber}:`, error.message);
            return { success: false, error: error.message };
        }
    }
    async optOutUser(phoneNumber) {
        try {
            const formattedPhone = this.formatPhone(phoneNumber);
            const user = await db_1.prisma.user.findFirst({
                where: {
                    OR: [
                        { phone: { contains: formattedPhone.slice(-10) } },
                        { whatsappPhone: { contains: formattedPhone.slice(-10) } },
                    ],
                },
            });
            if (user) {
                await db_1.prisma.user.update({
                    where: { id: user.id },
                    data: { whatsappOptedIn: false },
                });
            }
            console.log(`[Meta WA] Opt-out (local) for ${formattedPhone}${user ? ` (user ${user.id})` : ' (no matching user)'}`);
            return { success: true };
        }
        catch (error) {
            console.error(`[Meta WA] Opt-out failed for ${phoneNumber}:`, error.message);
            return { success: false, error: error.message };
        }
    }
    async sendWhatsApp(userId, phoneNumber, message) {
        const record = await db_1.prisma.messageRecord.create({
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
            await db_1.prisma.messageRecord.update({
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
            await db_1.prisma.messageRecord.update({
                where: { id: record.id },
                data: { status: 'SENT', messageSid: wamid },
            });
            console.log(`[Meta WA] Sent to ${phoneNumber} (${wamid})`);
            return { ...record, status: 'SENT', messageSid: wamid };
        }
        catch (error) {
            await db_1.prisma.messageRecord.update({
                where: { id: record.id },
                data: { status: 'FAILED', errorMessage: error.message },
            });
            console.error(`[Meta WA] Send failed to ${phoneNumber}:`, error.message);
            return { ...record, status: 'FAILED', errorMessage: error.message };
        }
    }
    async sendWhatsAppDirect(phoneNumber, message) {
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
        }
        catch (error) {
            console.error(`[Meta WA] Direct send failed to ${phoneNumber}:`, error.message);
            return { success: false, error: error.message };
        }
    }
    async sendTemplate(userId, phoneNumber, templateName, params = []) {
        const record = await db_1.prisma.messageRecord.create({
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
            await db_1.prisma.messageRecord.update({
                where: { id: record.id },
                data: { status: 'FAILED', errorMessage: 'Meta WhatsApp not configured' },
            });
            return record;
        }
        try {
            const destination = this.formatPhone(phoneNumber);
            const templatePayload = {
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
            await db_1.prisma.messageRecord.update({
                where: { id: record.id },
                data: { status: 'SENT', messageSid: wamid },
            });
            console.log(`[Meta WA] Template "${templateName}" sent to ${phoneNumber} (${wamid})`);
            return { ...record, status: 'SENT', messageSid: wamid };
        }
        catch (error) {
            console.error(`[Meta WA] Template "${templateName}" failed to ${phoneNumber}:`, error.message);
            await db_1.prisma.messageRecord.update({
                where: { id: record.id },
                data: { status: 'FAILED', errorMessage: error.message },
            });
            return { ...record, status: 'FAILED', errorMessage: error.message };
        }
    }
    async sendImage(userId, phoneNumber, imageUrl, caption) {
        const record = await db_1.prisma.messageRecord.create({
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
            await db_1.prisma.messageRecord.update({
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
            await db_1.prisma.messageRecord.update({
                where: { id: record.id },
                data: { status: 'SENT', messageSid: wamid },
            });
            console.log(`[Meta WA] Image sent to ${phoneNumber} (${wamid})`);
            return { ...record, status: 'SENT', messageSid: wamid };
        }
        catch (error) {
            console.error(`[Meta WA] Image send failed to ${phoneNumber}:`, error.message);
            await db_1.prisma.messageRecord.update({
                where: { id: record.id },
                data: { status: 'FAILED', errorMessage: error.message },
            });
            return { ...record, status: 'FAILED', errorMessage: error.message };
        }
    }
    async sendWhatsAppButton(userId, phoneNumber, bodyText, buttons) {
        const record = await db_1.prisma.messageRecord.create({
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
            await db_1.prisma.messageRecord.update({
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
            await db_1.prisma.messageRecord.update({
                where: { id: record.id },
                data: { status: 'SENT', messageSid: wamid },
            });
            return { ...record, status: 'SENT', messageSid: wamid };
        }
        catch (error) {
            await db_1.prisma.messageRecord.update({
                where: { id: record.id },
                data: { status: 'FAILED', errorMessage: error.message },
            });
            return { ...record, status: 'FAILED', errorMessage: error.message };
        }
    }
    async listTemplates() {
        if (!this.isConfigured() || !this.wabaId) {
            return { success: false, error: 'Meta WhatsApp not configured (missing WABA_ID)' };
        }
        try {
            const result = await this.callApi(`/${this.wabaId}/message_templates`, 'GET');
            return { success: true, data: result };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    }
    async registerTemplate(name, category, language, components) {
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
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    }
    async handleWebhook(payload) {
        if (payload?.object !== 'whatsapp_business_account')
            return;
        for (const entry of payload.entry || []) {
            for (const change of entry.changes || []) {
                const value = change.value;
                if (!value || change.field !== 'messages')
                    continue;
                if (value.statuses) {
                    for (const s of value.statuses) {
                        const statusMap = {
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
                            const { whatsappBotService } = await Promise.resolve().then(() => __importStar(require('./whatsappBotService')));
                            whatsappBotService.handleInboundMessage(from, text, msgId).catch((err) => {
                                console.error(`[Meta WA] Bot handler error:`, err);
                            });
                        }
                    }
                }
            }
        }
    }
    async updateMessageStatus(wamid, newStatus, errorDetails) {
        const validStatuses = ['QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'READ'];
        const status = validStatuses.find(s => s === newStatus);
        if (!status) {
            console.log(`[Meta WA] Unknown status "${newStatus}" for ${wamid}, skipping`);
            return;
        }
        const record = await db_1.prisma.messageRecord.findFirst({
            where: { messageSid: wamid },
        });
        if (record) {
            let errorMessage;
            if (status === 'FAILED' && errorDetails) {
                errorMessage = [
                    errorDetails.code ? `code=${errorDetails.code}` : '',
                    errorDetails.message || '',
                ].filter(Boolean).join(': ') || 'Unknown error';
                console.log(`[Meta WA] Message ${wamid} FAILED — ${errorMessage}`);
            }
            await db_1.prisma.messageRecord.update({
                where: { id: record.id },
                data: errorMessage ? { status, errorMessage } : { status },
            });
            console.log(`[Meta WA] Message ${wamid} -> ${status}`);
        }
    }
    async handleInboundFrom(from) {
        if (!from)
            return;
        try {
            const formattedFrom = this.formatPhone(from);
            const user = await db_1.prisma.user.findFirst({
                where: {
                    OR: [
                        { phone: { contains: formattedFrom.slice(-10) } },
                        { whatsappPhone: { contains: formattedFrom.slice(-10) } },
                    ],
                },
            });
            if (user && !user.whatsappOptedIn) {
                await db_1.prisma.user.update({
                    where: { id: user.id },
                    data: { whatsappOptedIn: true, whatsappPhone: from },
                });
                console.log(`[Meta WA] Auto opted-in user ${user.id} from inbound`);
            }
            if (!user) {
                console.log(`[Meta WA] Inbound from unknown number ${from}`);
            }
        }
        catch (e) {
            console.error(`[Meta WA] Auto opt-in error:`, e.message);
        }
    }
}
exports.MetaWhatsAppService = MetaWhatsAppService;
exports.metaWhatsAppService = new MetaWhatsAppService();
//# sourceMappingURL=metaWhatsAppService.js.map