import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { emailService } from '../services/email';
import { verifyRecaptcha } from '../middleware/recaptcha';
import { generalLimiter } from '../middleware/rateLimit';
import { env } from '../config/env';

export const contactRouter = Router();

const contactSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  email: z.string().email('Please enter a valid email'),
  subject: z.string().trim().min(1, 'Subject is required').max(200),
  message: z.string().trim().min(10, 'Please enter at least 10 characters').max(5000),
});

contactRouter.post('/', generalLimiter, verifyRecaptcha('contact'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = contactSchema.parse(req.body);
    const inboxAddr = env.SUPPORT_EMAIL || env.SMTP_USER || 'hello@cleya.ai';

    const html = `
      <h2>New contact form submission</h2>
      <p><strong>From:</strong> ${escapeHtml(data.name)} &lt;${escapeHtml(data.email)}&gt;</p>
      <p><strong>Subject:</strong> ${escapeHtml(data.subject)}</p>
      <hr/>
      <pre style="font-family:inherit;white-space:pre-wrap">${escapeHtml(data.message)}</pre>
    `;

    // Best-effort send; if SMTP isn't configured the service no-ops.
    void emailService.sendRaw({
      to: inboxAddr,
      subject: `[Cleya Contact] ${data.subject}`,
      html,
      replyTo: data.email,
    }).catch((e) => console.error('[contact] email send failed', e));

    res.json({ success: true, message: "Thanks — we'll get back to you within 24-48 hours." });
  } catch (error) {
    next(error);
  }
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
