"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookRouter = void 0;
const express_1 = require("express");
const db_1 = require("@cleya/db");
const router = (0, express_1.Router)();
router.post('/resend', async (req, res) => {
    try {
        const event = req.body;
        const eventType = event?.type;
        const emailId = event?.data?.email_id;
        if (!eventType || !emailId) {
            return res.status(200).json({ received: true, skipped: 'missing data' });
        }
        // Find recipient by resend_email_id
        const recipients = await db_1.prisma.$queryRawUnsafe(`SELECT id, campaign_id, status FROM outreach_recipients WHERE resend_email_id = $1 LIMIT 1`, emailId);
        if (!recipients.length) {
            return res.status(200).json({ received: true, skipped: 'recipient not found' });
        }
        const recipient = recipients[0];
        const campaignId = recipient.campaign_id;
        switch (eventType) {
            case 'email.opened':
                await db_1.prisma.$executeRawUnsafe(`UPDATE outreach_recipients SET opened_at = COALESCE(opened_at, now()), status = 'opened' WHERE id = $1 AND status NOT IN ('clicked', 'replied')`, recipient.id);
                await db_1.prisma.$executeRawUnsafe(`UPDATE outreach_campaigns SET opened_count = (SELECT COUNT(*) FROM outreach_recipients WHERE campaign_id = $1 AND opened_at IS NOT NULL), updated_at = now() WHERE campaign_id = $1`, campaignId);
                break;
            case 'email.clicked':
                await db_1.prisma.$executeRawUnsafe(`UPDATE outreach_recipients SET clicked_at = COALESCE(clicked_at, now()), opened_at = COALESCE(opened_at, now()), status = 'clicked' WHERE id = $1`, recipient.id);
                await db_1.prisma.$executeRawUnsafe(`UPDATE outreach_campaigns SET clicked_count = (SELECT COUNT(*) FROM outreach_recipients WHERE campaign_id = $1 AND clicked_at IS NOT NULL), opened_count = (SELECT COUNT(*) FROM outreach_recipients WHERE campaign_id = $1 AND opened_at IS NOT NULL), updated_at = now() WHERE campaign_id = $1`, campaignId);
                break;
            case 'email.bounced':
                await db_1.prisma.$executeRawUnsafe(`UPDATE outreach_recipients SET bounced_at = now(), status = 'bounced' WHERE id = $1`, recipient.id);
                await db_1.prisma.$executeRawUnsafe(`UPDATE outreach_campaigns SET bounced_count = (SELECT COUNT(*) FROM outreach_recipients WHERE campaign_id = $1 AND bounced_at IS NOT NULL), updated_at = now() WHERE campaign_id = $1`, campaignId);
                break;
            case 'email.complained': {
                // Add to unsubscribes + update recipient
                const recipientEmails = await db_1.prisma.$queryRawUnsafe(`SELECT email FROM outreach_recipients WHERE id = $1`, recipient.id);
                if (recipientEmails.length) {
                    await db_1.prisma.$executeRawUnsafe(`INSERT INTO outreach_unsubscribes (email, reason) VALUES ($1, 'complaint') ON CONFLICT (email) DO NOTHING`, recipientEmails[0].email);
                }
                await db_1.prisma.$executeRawUnsafe(`UPDATE outreach_recipients SET unsubscribed_at = now(), status = 'unsubscribed' WHERE id = $1`, recipient.id);
                await db_1.prisma.$executeRawUnsafe(`UPDATE outreach_campaigns SET unsubscribed_count = (SELECT COUNT(*) FROM outreach_recipients WHERE campaign_id = $1 AND unsubscribed_at IS NOT NULL), updated_at = now() WHERE campaign_id = $1`, campaignId);
                break;
            }
            default:
                // email.sent, email.delivered, email.delivery_delayed — no action needed
                break;
        }
        return res.status(200).json({ received: true, eventType });
    }
    catch (err) {
        console.error('[ResendWebhook] Error:', err.message);
        return res.status(200).json({ received: true, error: 'internal' });
    }
});
// Unsubscribe endpoint
router.post('/unsubscribe', async (req, res) => {
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
        const recipients = await db_1.prisma.$queryRawUnsafe(`SELECT email FROM outreach_recipients WHERE id = $1 AND campaign_id = $2`, recipientId, campaignId);
        if (!recipients.length) {
            return res.status(404).json({ error: 'Recipient not found' });
        }
        const email = recipients[0].email;
        await db_1.prisma.$executeRawUnsafe(`INSERT INTO outreach_unsubscribes (email, reason) VALUES ($1, 'user_unsubscribe') ON CONFLICT (email) DO NOTHING`, email);
        await db_1.prisma.$executeRawUnsafe(`UPDATE outreach_recipients SET status = 'unsubscribed', unsubscribed_at = now() WHERE id = $1`, recipientId);
        await db_1.prisma.$executeRawUnsafe(`UPDATE outreach_campaigns SET unsubscribed_count = (SELECT COUNT(*) FROM outreach_recipients WHERE campaign_id = $1 AND unsubscribed_at IS NOT NULL), updated_at = now() WHERE campaign_id = $1`, campaignId);
        return res.status(200).json({ success: true, message: 'Unsubscribed successfully' });
    }
    catch (err) {
        console.error('[Unsubscribe] Error:', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
exports.webhookRouter = router;
//# sourceMappingURL=resendWebhook.js.map