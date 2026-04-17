"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contactRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const email_1 = require("../services/email");
const recaptcha_1 = require("../middleware/recaptcha");
const rateLimit_1 = require("../middleware/rateLimit");
const env_1 = require("../config/env");
exports.contactRouter = (0, express_1.Router)();
const contactSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1, 'Name is required').max(120),
    email: zod_1.z.string().email('Please enter a valid email'),
    subject: zod_1.z.string().trim().min(1, 'Subject is required').max(200),
    message: zod_1.z.string().trim().min(10, 'Please enter at least 10 characters').max(5000),
});
exports.contactRouter.post('/', rateLimit_1.generalLimiter, (0, recaptcha_1.verifyRecaptcha)('contact'), async (req, res, next) => {
    try {
        const data = contactSchema.parse(req.body);
        const inboxAddr = env_1.env.SUPPORT_EMAIL || env_1.env.SMTP_USER || 'hello@cleya.ai';
        const html = `
      <h2>New contact form submission</h2>
      <p><strong>From:</strong> ${escapeHtml(data.name)} &lt;${escapeHtml(data.email)}&gt;</p>
      <p><strong>Subject:</strong> ${escapeHtml(data.subject)}</p>
      <hr/>
      <pre style="font-family:inherit;white-space:pre-wrap">${escapeHtml(data.message)}</pre>
    `;
        // Best-effort send; if SMTP isn't configured the service no-ops.
        void email_1.emailService.sendRaw({
            to: inboxAddr,
            subject: `[Cleya Contact] ${data.subject}`,
            html,
            replyTo: data.email,
        }).catch((e) => console.error('[contact] email send failed', e));
        res.json({ success: true, message: "Thanks — we'll get back to you within 24-48 hours." });
    }
    catch (error) {
        next(error);
    }
});
function escapeHtml(s) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
//# sourceMappingURL=contact.js.map