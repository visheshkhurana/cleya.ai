import { Router, Request, Response } from 'express';
import { prisma } from '@cleya/db';
import crypto from 'crypto';
import { env } from '../config/env';

const router = Router();

/**
 * Verify a Resend (Svix) webhook signature.
 * Resend sends three headers: svix-id, svix-timestamp, svix-signature.
 * Signature scheme: base64(HMAC-SHA256(secret_bytes, `${id}.${timestamp}.${rawBody}`)).
 * The header may contain multiple space-separated `v1,<sig>` entries — match any.
 * Secret is stored as `whsec_<base64>` and must be base64-decoded before HMAC.
 */
function verifyResendSignature(
  secret: string,
  svixId: string,
  svixTimestamp: string,
  svixSignature: string,
  rawBody: string,
): boolean {
  try {
    const secretBase64 = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret;
    const secretBytes = Buffer.from(secretBase64, 'base64');
    const signedPayload = `${svixId}.${svixTimestamp}.${rawBody}`;
    const expected = crypto
      .createHmac('sha256', secretBytes)
      .update(signedPayload, 'utf8')
      .digest('base64');

    const provided = svixSignature
      .split(' ')
      .map((entry) => entry.trim())
      .filter((entry) => entry.startsWith('v1,'))
      .map((entry) => entry.slice('v1,'.length));

    return provided.some((sig) => {
      const sigBuf = Buffer.from(sig, 'base64');
      const expBuf = Buffer.from(expected, 'base64');
      return sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);
    });
  } catch {
    return false;
  }
}

router.post('/resend', async (req: Request, res: Response) => {
  try {
    // === SIGNATURE VERIFICATION ===
    // When RESEND_WEBHOOK_SECRET is configured, signature is enforced strictly.
    // When unset, we log a loud warning and accept (so live webhook ingestion
    // is not broken). Set RESEND_WEBHOOK_SECRET in Replit secrets + the Resend
    // dashboard to activate enforcement.
    if (env.RESEND_WEBHOOK_SECRET) {
      const svixId = req.headers['svix-id'] as string | undefined;
      const svixTimestamp = req.headers['svix-timestamp'] as string | undefined;
      const svixSignature = req.headers['svix-signature'] as string | undefined;
      const rawBody = (req as any).rawBody as string | undefined;

      if (!svixId || !svixTimestamp || !svixSignature || !rawBody) {
        console.warn('[ResendWebhook] Rejected: missing svix headers or raw body');
        return res.status(403).json({ error: 'Invalid signature' });
      }

      const ok = verifyResendSignature(
        env.RESEND_WEBHOOK_SECRET,
        svixId,
        svixTimestamp,
        svixSignature,
        rawBody,
      );
      if (!ok) {
        console.warn('[ResendWebhook] Rejected: signature mismatch');
        return res.status(403).json({ error: 'Invalid signature' });
      }
    } else {
      console.warn(
        '[ResendWebhook] RESEND_WEBHOOK_SECRET not configured — accepting webhook without verification. ' +
          'Set this secret to enforce signature verification in production.',
      );
    }

    const event = req.body;
    const eventType = event?.type;
    const emailId = event?.data?.email_id;

    if (!eventType || !emailId) {
      return res.status(200).json({ received: true, skipped: 'missing data' });
    }

    // === Universal email_events log ===
    // Persist *every* Resend webhook into email_events (regardless of whether
    // the message belongs to an outreach campaign). This gives us a single
    // queryable funnel: sent / delivered / opened / clicked / bounced /
    // complained — across drip emails, transactional sends, and outreach.
    try {
      const toAddrRaw = event?.data?.to;
      const toEmail = Array.isArray(toAddrRaw) ? toAddrRaw[0] : (toAddrRaw || 'unknown');
      const subject = event?.data?.subject || null;
      const fromUser = await prisma.user.findFirst({
        where: { email: toEmail },
        select: { id: true },
      });
      await prisma.emailEvent.create({
        data: {
          userId: fromUser?.id ?? null,
          resendId: emailId,
          toEmail,
          event: eventType,
          subject,
          metadata: event?.data ?? {},
        },
      });
    } catch (logErr: any) {
      console.warn('[ResendWebhook] email_events log failed:', logErr?.message || logErr);
    }

    // Find recipient by resend_email_id
    const recipients: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, campaign_id, status FROM outreach_recipients WHERE resend_email_id = $1 LIMIT 1`,
      emailId,
    );

    if (!recipients.length) {
      return res.status(200).json({ received: true, skipped: 'recipient not found' });
    }

    const recipient = recipients[0];
    const campaignId = recipient.campaign_id;

    switch (eventType) {
      case 'email.opened':
        await prisma.$executeRawUnsafe(
          `UPDATE outreach_recipients SET opened_at = COALESCE(opened_at, now()), status = 'opened' WHERE id = $1 AND status NOT IN ('clicked', 'replied')`,
          recipient.id,
        );
        await prisma.$executeRawUnsafe(
          `UPDATE outreach_campaigns SET opened_count = (SELECT COUNT(*) FROM outreach_recipients WHERE campaign_id = $1 AND opened_at IS NOT NULL), updated_at = now() WHERE campaign_id = $1`,
          campaignId,
        );
        break;

      case 'email.clicked':
        await prisma.$executeRawUnsafe(
          `UPDATE outreach_recipients SET clicked_at = COALESCE(clicked_at, now()), opened_at = COALESCE(opened_at, now()), status = 'clicked' WHERE id = $1`,
          recipient.id,
        );
        await prisma.$executeRawUnsafe(
          `UPDATE outreach_campaigns SET clicked_count = (SELECT COUNT(*) FROM outreach_recipients WHERE campaign_id = $1 AND clicked_at IS NOT NULL), opened_count = (SELECT COUNT(*) FROM outreach_recipients WHERE campaign_id = $1 AND opened_at IS NOT NULL), updated_at = now() WHERE campaign_id = $1`,
          campaignId,
        );
        break;

      case 'email.bounced':
        await prisma.$executeRawUnsafe(
          `UPDATE outreach_recipients SET bounced_at = now(), status = 'bounced' WHERE id = $1`,
          recipient.id,
        );
        await prisma.$executeRawUnsafe(
          `UPDATE outreach_campaigns SET bounced_count = (SELECT COUNT(*) FROM outreach_recipients WHERE campaign_id = $1 AND bounced_at IS NOT NULL), updated_at = now() WHERE campaign_id = $1`,
          campaignId,
        );
        break;

      case 'email.complained': {
        // Add to unsubscribes + update recipient
        const recipientEmails: any[] = await prisma.$queryRawUnsafe(
          `SELECT email FROM outreach_recipients WHERE id = $1`, recipient.id,
        );
        if (recipientEmails.length) {
          await prisma.$executeRawUnsafe(
            `INSERT INTO outreach_unsubscribes (email, reason) VALUES ($1, 'complaint') ON CONFLICT (email) DO NOTHING`,
            recipientEmails[0].email,
          );
        }
        await prisma.$executeRawUnsafe(
          `UPDATE outreach_recipients SET unsubscribed_at = now(), status = 'unsubscribed' WHERE id = $1`,
          recipient.id,
        );
        await prisma.$executeRawUnsafe(
          `UPDATE outreach_campaigns SET unsubscribed_count = (SELECT COUNT(*) FROM outreach_recipients WHERE campaign_id = $1 AND unsubscribed_at IS NOT NULL), updated_at = now() WHERE campaign_id = $1`,
          campaignId,
        );
        break;
      }

      default:
        // email.sent, email.delivered, email.delivery_delayed — no action needed
        break;
    }

    return res.status(200).json({ received: true, eventType });
  } catch (err: any) {
    console.error('[ResendWebhook] Error:', err.message);
    return res.status(200).json({ received: true, error: 'internal' });
  }
});

// Unsubscribe endpoint
router.post('/unsubscribe', async (req: Request, res: Response) => {
  try {
    const { id } = req.body;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Missing id parameter' });
    }

    const parts = id.split('_');
    // id format: camp_timestamp_hash_recipientId
    if (parts.length < 4) {
      return res.status(400).json({ error: 'Invalid id format' });
    }

    const recipientId = parseInt(parts[parts.length - 1], 10);
    const campaignId = parts.slice(0, -1).join('_');

    if (isNaN(recipientId)) {
      return res.status(400).json({ error: 'Invalid recipient ID' });
    }

    const recipients: any[] = await prisma.$queryRawUnsafe(
      `SELECT email FROM outreach_recipients WHERE id = $1 AND campaign_id = $2`,
      recipientId, campaignId,
    );

    if (!recipients.length) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    const email = recipients[0].email;

    await prisma.$executeRawUnsafe(
      `INSERT INTO outreach_unsubscribes (email, reason) VALUES ($1, 'user_unsubscribe') ON CONFLICT (email) DO NOTHING`,
      email,
    );
    await prisma.$executeRawUnsafe(
      `UPDATE outreach_recipients SET status = 'unsubscribed', unsubscribed_at = now() WHERE id = $1`,
      recipientId,
    );
    await prisma.$executeRawUnsafe(
      `UPDATE outreach_campaigns SET unsubscribed_count = (SELECT COUNT(*) FROM outreach_recipients WHERE campaign_id = $1 AND unsubscribed_at IS NOT NULL), updated_at = now() WHERE campaign_id = $1`,
      campaignId,
    );

    return res.status(200).json({ success: true, message: 'Unsubscribed successfully' });
  } catch (err: any) {
    console.error('[Unsubscribe] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export const webhookRouter = router;
