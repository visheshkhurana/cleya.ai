"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processDripSequences = processDripSequences;
const db_1 = require("@cleya/db");
const resendClient_1 = require("./resendClient");
const env_1 = require("../config/env");
const SEND_DELAY_MS = 500;
function personalizeContent(template, recipient) {
    const personalization = recipient.personalization || {};
    let content = template;
    content = content.replace(/\{\{first_name\}\}/gi, recipient.first_name || 'there');
    content = content.replace(/\{\{last_name\}\}/gi, recipient.last_name || '');
    content = content.replace(/\{\{company\}\}/gi, recipient.company || 'your company');
    content = content.replace(/\{\{role\}\}/gi, recipient.role || 'professional');
    content = content.replace(/\{\{full_name\}\}/gi, `${recipient.first_name || ''} ${recipient.last_name || ''}`.trim() || 'there');
    for (const [key, value] of Object.entries(personalization)) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'gi');
        content = content.replace(regex, String(value));
    }
    return content;
}
function campaignEmailLayout(subject, body, unsubscribeId) {
    const unsubscribeUrl = `${env_1.env.FRONTEND_URL || 'https://cleya.ai'}/unsubscribe?id=${unsubscribeId}`;
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;padding:40px 20px;">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;text-align:left;">
<tr><td style="padding-bottom:24px;">
<span style="color:#111;font-size:16px;font-weight:600;">Cleya.ai</span>
</td></tr>
<tr><td style="color:#1a1a1a;font-size:15px;line-height:1.7;">
${body}
</td></tr>
<tr><td style="padding-top:32px;border-top:1px solid #eee;margin-top:32px;">
<p style="color:#999;font-size:12px;margin:16px 0 0;">Cleya.ai — Your AI Networker for India's startup ecosystem</p>
<p style="color:#bbb;font-size:11px;margin:8px 0 0;"><a href="${unsubscribeUrl}" style="color:#bbb;text-decoration:underline;">Unsubscribe</a></p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}
async function processDripSequences() {
    try {
        const campaigns = await db_1.prisma.$queryRawUnsafe(`
      SELECT * FROM outreach_campaigns
      WHERE status IN ('sent', 'active')
        AND sequence_steps IS NOT NULL
        AND jsonb_array_length(sequence_steps) > 0
    `);
        if (!campaigns.length) {
            console.log('[Drip] No active campaigns with sequences');
            return;
        }
        const { client, fromEmail } = await (0, resendClient_1.getUncachableResendClient)();
        const senderEmail = fromEmail || env_1.env.FROM_EMAIL;
        const from = `Cleya <${senderEmail}>`;
        let totalSent = 0;
        let totalFailed = 0;
        for (const campaign of campaigns) {
            const steps = campaign.sequence_steps;
            if (!steps || steps.length === 0)
                continue;
            const totalSteps = steps.length;
            // Find recipients eligible for next step
            const recipients = await db_1.prisma.$queryRawUnsafe(`
        SELECT * FROM outreach_recipients
        WHERE campaign_id = $1
          AND status = 'sent'
          AND current_step < $2
          AND opened_at IS NULL
          AND clicked_at IS NULL
          AND replied_at IS NULL
          AND unsubscribed_at IS NULL
          AND bounced_at IS NULL
          AND sent_at IS NOT NULL
      `, campaign.campaign_id, totalSteps + 1);
            for (const recipient of recipients) {
                const nextStepIndex = (recipient.current_step || 1) - 1;
                if (nextStepIndex >= steps.length)
                    continue;
                const step = steps[nextStepIndex];
                const sentAt = new Date(recipient.sent_at);
                const delayMs = step.delayDays * 24 * 60 * 60 * 1000;
                const eligibleAt = new Date(sentAt.getTime() + delayMs);
                if (new Date() < eligibleAt)
                    continue;
                try {
                    const personalizedBody = personalizeContent(step.emailBody, recipient);
                    const personalizedSubject = personalizeContent(step.subjectLine, recipient);
                    const result = await client.emails.send({
                        from,
                        to: [recipient.email],
                        subject: personalizedSubject,
                        html: campaignEmailLayout(personalizedSubject, personalizedBody, `${campaign.campaign_id}_${recipient.id}`),
                    });
                    if (result.error) {
                        await db_1.prisma.$executeRawUnsafe(`UPDATE outreach_recipients SET last_error = $1 WHERE id = $2`, result.error.message || 'Drip send error', recipient.id);
                        totalFailed++;
                    }
                    else {
                        await db_1.prisma.$executeRawUnsafe(`UPDATE outreach_recipients SET current_step = $1, sent_at = now(), resend_email_id = $2 WHERE id = $3`, (recipient.current_step || 1) + 1, result.data?.id || null, recipient.id);
                        totalSent++;
                    }
                    await new Promise(resolve => setTimeout(resolve, SEND_DELAY_MS));
                }
                catch (err) {
                    await db_1.prisma.$executeRawUnsafe(`UPDATE outreach_recipients SET last_error = $1 WHERE id = $2`, err.message, recipient.id);
                    totalFailed++;
                }
            }
            // Update campaign sent count
            if (totalSent > 0) {
                await db_1.prisma.$executeRawUnsafe(`UPDATE outreach_campaigns SET sent_count = sent_count + $1, updated_at = now() WHERE campaign_id = $2`, totalSent, campaign.campaign_id);
            }
        }
        console.log(`[Drip] Processed: ${totalSent} sent, ${totalFailed} failed`);
    }
    catch (err) {
        console.error('[Drip] Error processing sequences:', err.message);
    }
}
//# sourceMappingURL=dripSequenceProcessor.js.map