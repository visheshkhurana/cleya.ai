import { prisma } from '@cleya/db';
import { getUncachableResendClient } from './resendClient';
import { env } from '../config/env';

const brandColor = '#0D9488';
const MAX_RECIPIENTS_PER_CAMPAIGN = 500;
const MAX_SENDS_PER_DAY = 200;
const SEND_DELAY_MS = 500;

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function campaignEmailLayout(subject: string, body: string, unsubscribeId: string): string {
  const unsubscribeUrl = `${env.FRONTEND_URL || 'https://cleya.ai'}/unsubscribe?id=${unsubscribeId}`;
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
<p style="color:#999;font-size:12px;margin:16px 0 0;">Cleya.ai — AI Superconnector for India's startup ecosystem</p>
<p style="color:#bbb;font-size:11px;margin:8px 0 0;"><a href="${unsubscribeUrl}" style="color:#bbb;text-decoration:underline;">Unsubscribe</a></p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

export async function ensureOutreachTables(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS outreach_campaigns (
        id SERIAL PRIMARY KEY,
        campaign_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        status TEXT DEFAULT 'draft',
        subject_line TEXT NOT NULL DEFAULT '',
        email_body TEXT NOT NULL DEFAULT '',
        target_segment TEXT DEFAULT 'all',
        target_filters JSONB DEFAULT '{}',
        sequence_steps JSONB DEFAULT '[]',
        current_step INTEGER DEFAULT 1,
        total_recipients INTEGER DEFAULT 0,
        sent_count INTEGER DEFAULT 0,
        opened_count INTEGER DEFAULT 0,
        clicked_count INTEGER DEFAULT 0,
        replied_count INTEGER DEFAULT 0,
        bounced_count INTEGER DEFAULT 0,
        unsubscribed_count INTEGER DEFAULT 0,
        scheduled_at TIMESTAMPTZ,
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        created_by TEXT DEFAULT 'outreach',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_outreach_campaigns_status ON outreach_campaigns(status);`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_outreach_campaigns_id ON outreach_campaigns(campaign_id);`);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS outreach_recipients (
        id SERIAL PRIMARY KEY,
        campaign_id TEXT NOT NULL,
        email TEXT NOT NULL,
        first_name TEXT DEFAULT '',
        last_name TEXT DEFAULT '',
        company TEXT DEFAULT '',
        role TEXT DEFAULT '',
        personalization JSONB DEFAULT '{}',
        status TEXT DEFAULT 'pending',
        sent_at TIMESTAMPTZ,
        opened_at TIMESTAMPTZ,
        clicked_at TIMESTAMPTZ,
        replied_at TIMESTAMPTZ,
        bounced_at TIMESTAMPTZ,
        unsubscribed_at TIMESTAMPTZ,
        current_step INTEGER DEFAULT 0,
        last_error TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_outreach_recipients_campaign ON outreach_recipients(campaign_id);`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_outreach_recipients_email ON outreach_recipients(email);`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_outreach_recipients_status ON outreach_recipients(status);`);
    await prisma.$executeRawUnsafe(`ALTER TABLE outreach_recipients ADD COLUMN IF NOT EXISTS resend_email_id TEXT;`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_outreach_recipients_resend_id ON outreach_recipients(resend_email_id);`);

    // Contact list tables
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS contact_lists (
        id SERIAL PRIMARY KEY,
        list_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        tags TEXT[] DEFAULT '{}',
        contact_count INTEGER DEFAULT 0,
        created_by TEXT DEFAULT 'system',
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS contact_list_entries (
        id SERIAL PRIMARY KEY,
        list_id TEXT NOT NULL,
        email TEXT NOT NULL,
        first_name TEXT DEFAULT '',
        last_name TEXT DEFAULT '',
        company TEXT DEFAULT '',
        role TEXT DEFAULT '',
        phone TEXT DEFAULT '',
        linkedin_url TEXT DEFAULT '',
        tags TEXT[] DEFAULT '{}',
        custom_fields JSONB DEFAULT '{}',
        source TEXT DEFAULT 'manual',
        created_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE(list_id, email)
      );
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_contact_list_entries_list ON contact_list_entries(list_id);`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_contact_list_entries_email ON contact_list_entries(email);`);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS outreach_unsubscribes (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        reason TEXT DEFAULT '',
        unsubscribed_at TIMESTAMPTZ DEFAULT now()
      );
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_outreach_unsubscribes_email ON outreach_unsubscribes(email);`);

    console.log('[OutreachCampaign] Tables ensured');
  } catch (err: any) {
    console.log(`[OutreachCampaign] Could not create tables: ${err.message}`);
  }
}

function generateCampaignId(): string {
  return `camp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function createCampaign(params: {
  name: string;
  subjectLine: string;
  emailBody: string;
  targetSegment?: string;
  targetFilters?: Record<string, any>;
  sequenceSteps?: Array<{ delayDays: number; subjectLine: string; emailBody: string }>;
  scheduledAt?: string;
}): Promise<any> {
  const campaignId = generateCampaignId();
  const steps = params.sequenceSteps || [];

  try {
    await prisma.$executeRawUnsafe(`
      INSERT INTO outreach_campaigns (campaign_id, name, subject_line, email_body, target_segment, target_filters, sequence_steps, scheduled_at)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8)
    `,
      campaignId,
      params.name,
      params.subjectLine,
      params.emailBody,
      params.targetSegment || 'all',
      JSON.stringify(params.targetFilters || {}),
      JSON.stringify(steps),
      params.scheduledAt || null,
    );

    return {
      success: true,
      campaignId,
      name: params.name,
      status: 'draft',
      sequenceSteps: steps.length + 1,
      message: `Campaign "${params.name}" created as draft. Add recipients with add_recipients, then launch with launch_campaign.`,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function addRecipients(params: {
  campaignId: string;
  recipients: Array<{ email: string; firstName?: string; lastName?: string; company?: string; role?: string; personalization?: Record<string, any> }>;
}): Promise<any> {
  try {
    const campaigns: any[] = await prisma.$queryRawUnsafe(
      `SELECT campaign_id FROM outreach_campaigns WHERE campaign_id = $1`, params.campaignId,
    );
    if (!campaigns.length) return { success: false, error: 'Campaign not found. Create a campaign first.' };

    const existingCount: any[] = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int as count FROM outreach_recipients WHERE campaign_id = $1`, params.campaignId,
    );
    const currentCount = existingCount[0]?.count || 0;
    if (currentCount + params.recipients.length > MAX_RECIPIENTS_PER_CAMPAIGN) {
      return { success: false, error: `Cannot exceed ${MAX_RECIPIENTS_PER_CAMPAIGN} recipients per campaign. Current: ${currentCount}, trying to add: ${params.recipients.length}.` };
    }

    const unsubs: any[] = await prisma.$queryRawUnsafe(`SELECT email FROM outreach_unsubscribes`);
    const unsubSet = new Set(unsubs.map((u: any) => u.email.toLowerCase()));

    let added = 0;
    let skippedUnsub = 0;
    let skippedInvalid = 0;
    let skippedDupe = 0;

    for (const r of params.recipients) {
      if (!isValidEmail(r.email)) {
        skippedInvalid++;
        continue;
      }

      if (unsubSet.has(r.email.toLowerCase())) {
        skippedUnsub++;
        continue;
      }

      try {
        await prisma.$executeRawUnsafe(`
          INSERT INTO outreach_recipients (campaign_id, email, first_name, last_name, company, role, personalization)
          VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
          ON CONFLICT DO NOTHING
        `,
          params.campaignId,
          r.email.toLowerCase().trim(),
          r.firstName || '',
          r.lastName || '',
          r.company || '',
          r.role || '',
          JSON.stringify(r.personalization || {}),
        );
        added++;
      } catch {
        skippedDupe++;
      }
    }

    await prisma.$executeRawUnsafe(`
      UPDATE outreach_campaigns SET total_recipients = (
        SELECT COUNT(*) FROM outreach_recipients WHERE campaign_id = $1
      ), updated_at = now() WHERE campaign_id = $1
    `, params.campaignId);

    return { success: true, added, skippedUnsub, skippedInvalid, skippedDupe, campaignId: params.campaignId };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function launchCampaign(campaignId: string): Promise<any> {
  try {
    const campaigns: any[] = await prisma.$queryRawUnsafe(
      `SELECT * FROM outreach_campaigns WHERE campaign_id = $1`, campaignId,
    );
    if (!campaigns.length) return { success: false, error: 'Campaign not found' };

    const campaign = campaigns[0];
    if (campaign.status !== 'draft') {
      return { success: false, error: `Campaign is already "${campaign.status}". Only draft campaigns can be launched.` };
    }

    const recipients: any[] = await prisma.$queryRawUnsafe(
      `SELECT * FROM outreach_recipients WHERE campaign_id = $1 AND status = 'pending'`, campaignId,
    );
    if (!recipients.length) return { success: false, error: 'No pending recipients. Add recipients first.' };

    const todaySent: any[] = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int as count FROM outreach_recipients
      WHERE sent_at >= CURRENT_DATE AND status = 'sent'
    `);
    const sentToday = todaySent[0]?.count || 0;
    if (sentToday + recipients.length > MAX_SENDS_PER_DAY) {
      return { success: false, error: `Daily send limit is ${MAX_SENDS_PER_DAY}. Already sent ${sentToday} today. This campaign has ${recipients.length} recipients.` };
    }

    const { client, fromEmail } = await getUncachableResendClient();
    const senderEmail = fromEmail || env.FROM_EMAIL;
    const from = `Cleya <${senderEmail}>`;

    await prisma.$executeRawUnsafe(
      `UPDATE outreach_campaigns SET status = 'sending', started_at = now(), updated_at = now() WHERE campaign_id = $1`,
      campaignId,
    );

    let sentCount = 0;
    let failCount = 0;

    for (const recipient of recipients) {
      const statusCheck: any[] = await prisma.$queryRawUnsafe(
        `SELECT status FROM outreach_campaigns WHERE campaign_id = $1`, campaignId,
      );
      if (statusCheck[0]?.status === 'paused') {
        console.log(`[Outreach] Campaign ${campaignId} paused mid-send after ${sentCount} sent`);
        break;
      }

      try {
        const personalizedBody = personalizeContent(campaign.email_body, recipient);
        const personalizedSubject = personalizeContent(campaign.subject_line, recipient);

        const result = await client.emails.send({
          from,
          to: [recipient.email],
          subject: personalizedSubject,
          html: campaignEmailLayout(personalizedSubject, personalizedBody, `${campaignId}_${recipient.id}`),
        });

        if (result.error) {
          await prisma.$executeRawUnsafe(
            `UPDATE outreach_recipients SET status = 'failed', last_error = $1 WHERE id = $2`,
            result.error.message || 'Unknown error', recipient.id,
          );
          failCount++;
        } else {
          await prisma.$executeRawUnsafe(
            `UPDATE outreach_recipients SET status = 'sent', sent_at = now(), current_step = 1, resend_email_id = $1 WHERE id = $2`,
            result.data?.id || null, recipient.id,
          );
          sentCount++;
        }

        await new Promise(resolve => setTimeout(resolve, SEND_DELAY_MS));
      } catch (err: any) {
        await prisma.$executeRawUnsafe(
          `UPDATE outreach_recipients SET status = 'failed', last_error = $1 WHERE id = $2`,
          err.message, recipient.id,
        );
        failCount++;
      }
    }

    const finalStatusCheck: any[] = await prisma.$queryRawUnsafe(
      `SELECT status FROM outreach_campaigns WHERE campaign_id = $1`, campaignId,
    );
    const wasPaused = finalStatusCheck[0]?.status === 'paused';
    const finalStatus = wasPaused ? 'paused' : (failCount === recipients.length ? 'failed' : 'sent');

    await prisma.$executeRawUnsafe(
      `UPDATE outreach_campaigns SET status = $1, sent_count = $2, completed_at = CASE WHEN $1 = 'paused' THEN NULL ELSE now() END, updated_at = now() WHERE campaign_id = $3`,
      finalStatus, sentCount, campaignId,
    );

    return { success: true, campaignId, status: finalStatus, sent: sentCount, failed: failCount, total: recipients.length };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getCampaignStats(campaignId?: string): Promise<any> {
  try {
    if (campaignId) {
      const campaigns: any[] = await prisma.$queryRawUnsafe(
        `SELECT * FROM outreach_campaigns WHERE campaign_id = $1`, campaignId,
      );
      if (!campaigns.length) return { success: false, error: 'Campaign not found' };

      const recipientStats: any[] = await prisma.$queryRawUnsafe(`
        SELECT
          status,
          COUNT(*)::int as count
        FROM outreach_recipients
        WHERE campaign_id = $1
        GROUP BY status
      `, campaignId);

      return { success: true, campaign: campaigns[0], recipientBreakdown: recipientStats };
    }

    const campaigns: any[] = await prisma.$queryRawUnsafe(`
      SELECT campaign_id, name, status, total_recipients, sent_count, opened_count,
             clicked_count, replied_count, bounced_count, unsubscribed_count,
             created_at, started_at, completed_at
      FROM outreach_campaigns
      ORDER BY created_at DESC
      LIMIT 20
    `);

    return { success: true, campaigns, total: campaigns.length };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getRecipientList(campaignId: string, status?: string): Promise<any> {
  try {
    let query = `SELECT id, email, first_name, last_name, company, role, status, sent_at, opened_at, clicked_at, replied_at FROM outreach_recipients WHERE campaign_id = $1`;
    const queryParams: any[] = [campaignId];

    if (status) {
      query += ` AND status = $2`;
      queryParams.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT 100`;

    const recipients: any[] = await prisma.$queryRawUnsafe(query, ...queryParams);
    return { success: true, recipients, count: recipients.length };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function pauseCampaign(campaignId: string): Promise<any> {
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE outreach_campaigns SET status = 'paused', updated_at = now() WHERE campaign_id = $1 AND status IN ('sending', 'scheduled')`,
      campaignId,
    );
    return { success: true, campaignId, status: 'paused' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

function personalizeContent(template: string, recipient: any): string {
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
