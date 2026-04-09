import { supabaseSelect, supabaseUpdate, supabaseInsert } from './supabaseClient';
import { prisma } from '@cleya/db';
import { linkedinPublisher } from './linkedinPublisher';
import { instagramService } from './instagramService';
import { getUncachableResendClient } from './resendClient';
import { logExecution, logAudit, checkGuardrails, DEFAULT_GUARDRAILS, type AutonomyLevel, type AgentGuardrails } from './guardrailsService';
import { getAgentGuardrails } from './agentRunner';

interface ContentQueueItem {
  id: number;
  agent_id: string;
  channel: string;
  content_type: string;
  title: string;
  body: string;
  media_urls: string[];
  scheduled_for: string;
  status: string;
  metadata: Record<string, any>;
}

interface ContentCalendarItem {
  id: number;
  agent_id: string;
  platform: string;
  content_type: string;
  title: string;
  body: string;
  media_urls: string[];
  media_hints: string;
  content_pillar: string;
  scheduled_time: string;
  risk_score: number;
  status: string;
  metadata: Record<string, any>;
}

interface PublishResult {
  success: boolean;
  platform: string;
  postId?: string;
  error?: string;
}

async function publishToLinkedIn(body: string, mediaUrls: string[]): Promise<PublishResult> {
  if (!linkedinPublisher.isConfigured()) {
    return { success: false, platform: 'linkedin', error: 'LinkedIn not configured' };
  }

  let result;
  if (mediaUrls.length > 0) {
    result = await linkedinPublisher.publishImagePost(body, mediaUrls[0]);
  } else {
    result = await linkedinPublisher.publishTextPost(body);
  }

  return { success: result.success, platform: 'linkedin', postId: result.postId, error: result.error };
}

async function publishToInstagram(body: string, mediaUrls: string[]): Promise<PublishResult> {
  if (!instagramService.isConfigured()) {
    return { success: false, platform: 'instagram', error: 'Instagram not configured' };
  }

  if (mediaUrls.length === 0) {
    return { success: false, platform: 'instagram', error: 'Instagram requires at least one image URL' };
  }

  let result;
  if (mediaUrls.length >= 2) {
    result = await instagramService.publishCarousel(mediaUrls, body);
  } else {
    result = await instagramService.publishSingleImage(mediaUrls[0], body);
  }

  return { success: result.success, platform: 'instagram', postId: result.postId, error: result.error };
}

async function publishViaEmail(title: string, body: string, recipients?: string[]): Promise<PublishResult> {
  try {
    const { client, fromEmail } = await getUncachableResendClient();

    const to = recipients && recipients.length > 0 ? recipients : ['hello@cleya.ai'];
    const subject = title || 'Newsletter from Cleya.ai';

    const htmlBody = body
      .split('\n')
      .map(line => `<p>${line}</p>`)
      .join('');

    const result = await client.emails.send({
      from: fromEmail || process.env.FROM_EMAIL || 'hello@cleya.ai',
      to,
      subject,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #1a1a2e; font-size: 24px;">${subject}</h1>
          ${htmlBody}
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
          <p style="color: #999; font-size: 12px;">Sent via Cleya.ai</p>
        </div>
      `,
    });

    return { success: true, platform: 'email', postId: (result as any)?.id || 'sent' };
  } catch (err: any) {
    return { success: false, platform: 'email', error: err.message };
  }
}

function resolvePlatformChannel(platform: string): string {
  const lower = platform.toLowerCase();
  if (['linkedin', 'marketing'].includes(lower)) return 'linkedin';
  if (['instagram', 'social'].includes(lower)) return 'instagram';
  if (['email', 'newsletter'].includes(lower)) return 'email';
  return lower;
}

async function publishByPlatform(platform: string, title: string, body: string, mediaUrls: string[], recipients?: string[]): Promise<PublishResult> {
  const channel = resolvePlatformChannel(platform);

  switch (channel) {
    case 'linkedin':
      return publishToLinkedIn(body, mediaUrls);
    case 'instagram':
      return publishToInstagram(body, mediaUrls);
    case 'email':
      return publishViaEmail(title, body, recipients);
    default:
      return publishToLinkedIn(body, mediaUrls);
  }
}

export async function publishContentItem(itemId: number): Promise<PublishResult> {
  const items = await supabaseSelect<ContentQueueItem>('dm_content_queue', { id: String(itemId) });
  const item = items[0];

  if (!item) {
    return { success: false, platform: 'unknown', error: 'Content item not found' };
  }

  if (item.status !== 'approved') {
    return { success: false, platform: item.channel, error: `Content must be approved first (current status: ${item.status})` };
  }

  const guardrails = getAgentGuardrails(item.agent_id);
  const actionType = `publish_${item.channel.toLowerCase()}`;
  const guardrailCheck = await checkGuardrails(item.agent_id, actionType, guardrails, item.body);

  if (!guardrailCheck.allowed) {
    await logExecution({
      agentId: item.agent_id,
      actionType,
      actionDescription: `Blocked publish of "${item.title}": ${guardrailCheck.reason}`,
      autonomyLevel: (item.metadata?.autonomy_level as AutonomyLevel) || 'manual',
      guardrailsChecked: ['max_actions_per_day', 'max_posts_per_day', 'content_blocklist'],
      guardrailResult: 'blocked',
      executionResult: 'queued',
      details: { itemId, reason: guardrailCheck.reason },
    });
    return { success: false, platform: item.channel, error: `Guardrail blocked: ${guardrailCheck.reason}` };
  }

  const result = await publishByPlatform(item.channel, item.title, item.body, item.media_urls || [], item.metadata?.recipients);

  if (result.success) {
    await supabaseUpdate('dm_content_queue', { id: String(itemId) }, {
      status: 'published',
      published_at: new Date().toISOString(),
      metadata: { ...item.metadata, publish_result: result },
    });
  }

  await logExecution({
    agentId: item.agent_id,
    actionType: `publish_${result.platform}`,
    actionDescription: `Published "${item.title}" to ${result.platform}`,
    autonomyLevel: (item.metadata?.autonomy_level as AutonomyLevel) || 'manual',
    guardrailsChecked: ['max_posts_per_day', 'content_blocklist'],
    guardrailResult: 'passed',
    executionResult: result.success ? 'success' : 'error',
    details: { itemId, channel: item.channel, postId: result.postId, error: result.error },
  });

  return result;
}

export async function publishCalendarItem(calendarId: number): Promise<PublishResult> {
  const claimed = await prisma.$queryRawUnsafe(
    `UPDATE "content_calendar" SET "status" = 'publishing', "updated_at" = now() WHERE "id" = $1 AND "status" IN ('scheduled', 'approved') RETURNING *`,
    calendarId
  ) as any[];

  if (!claimed || claimed.length === 0) {
    const existing = await supabaseSelect<ContentCalendarItem>('content_calendar', { id: String(calendarId) });
    const current = existing[0];
    if (!current) return { success: false, platform: 'unknown', error: 'Calendar item not found' };
    return { success: false, platform: current.platform, error: `Calendar item not publishable (current: ${current.status})` };
  }

  const item = claimed[0] as ContentCalendarItem;

  if (item.platform === 'instagram' && (!item.media_urls || item.media_urls.length === 0)) {
    await supabaseUpdate('content_calendar', { id: String(calendarId) }, {
      status: 'pending_approval',
      updated_at: new Date().toISOString(),
    });
    return { success: false, platform: 'instagram', error: 'Instagram requires media URLs — item moved back to pending_approval' };
  }

  const guardrails = getAgentGuardrails(item.agent_id);
  const actionType = `publish_${item.platform}`;
  const guardrailCheck = await checkGuardrails(item.agent_id, actionType, guardrails, item.body);

  if (!guardrailCheck.allowed) {
    await supabaseUpdate('content_calendar', { id: String(calendarId) }, {
      status: 'blocked',
      updated_at: new Date().toISOString(),
    });
    await logAudit({
      agentId: item.agent_id,
      actionType: `publish_blocked`,
      actionDescription: `Blocked publish of "${item.title}": ${guardrailCheck.reason}`,
      entityType: 'content_calendar',
      entityId: String(calendarId),
      riskScore: item.risk_score,
      status: 'blocked',
    });
    return { success: false, platform: item.platform, error: `Guardrail blocked: ${guardrailCheck.reason}` };
  }

  const result = await publishByPlatform(item.platform, item.title, item.body, item.media_urls || [], item.metadata?.recipients);

  if (result.success) {
    await supabaseUpdate('content_calendar', { id: String(calendarId) }, {
      status: 'published',
      published_at: new Date().toISOString(),
      publish_result: { success: true, postId: result.postId, platform: result.platform },
      updated_at: new Date().toISOString(),
    });
  } else {
    await supabaseUpdate('content_calendar', { id: String(calendarId) }, {
      status: 'failed',
      publish_result: { success: false, error: result.error, platform: result.platform },
      updated_at: new Date().toISOString(),
    });
  }

  const publishCost = result.success ? (result.platform === 'email' ? 0.001 : 0) : 0;

  await logAudit({
    agentId: item.agent_id,
    actionType: `publish_${result.platform}`,
    actionDescription: `Published calendar item "${item.title}" to ${result.platform}`,
    entityType: 'content_calendar',
    entityId: String(calendarId),
    riskScore: item.risk_score,
    costAmount: publishCost,
    costCurrency: 'USD',
    status: result.success ? 'success' : 'error',
    metadata: { postId: result.postId, error: result.error },
  });

  await logExecution({
    agentId: item.agent_id,
    actionType: `publish_${result.platform}`,
    actionDescription: `Published "${item.title}" to ${result.platform}`,
    autonomyLevel: (item.metadata?.autonomy_level as AutonomyLevel) || 'semi_autonomous',
    guardrailsChecked: ['max_posts_per_day', 'content_blocklist', 'risk_scoring'],
    guardrailResult: 'passed',
    executionResult: result.success ? 'success' : 'error',
    details: { calendarId, platform: item.platform, postId: result.postId, error: result.error },
  });

  return result;
}

export async function processContentCalendar(): Promise<{ published: number; failed: number; errors: string[] }> {
  const results = { published: 0, failed: 0, errors: [] as string[] };
  const now = new Date().toISOString();

  try {
    const dueItems = await supabaseSelect<ContentCalendarItem>('content_calendar', { status: 'scheduled' }, {
      order: 'scheduled_time.asc',
      limit: 50,
    });

    const readyItems = dueItems.filter(item => item.scheduled_time && new Date(item.scheduled_time) <= new Date(now));

    console.log(`[PublishProcessor] Found ${readyItems.length} due calendar items out of ${dueItems.length} scheduled`);

    for (const item of readyItems) {
      const result = await publishCalendarItem(item.id);
      if (result.success) {
        results.published++;
      } else {
        results.failed++;
        results.errors.push(`${item.title} (${item.platform}): ${result.error}`);
      }
    }

    const approvedItems = await supabaseSelect<ContentCalendarItem>('content_calendar', { status: 'approved' }, {
      order: 'scheduled_time.asc',
      limit: 50,
    });

    console.log(`[PublishProcessor] Found ${approvedItems.length} approved items for immediate publish`);

    for (const item of approvedItems) {
      const result = await publishCalendarItem(item.id);
      if (result.success) {
        results.published++;
      } else {
        results.failed++;
        results.errors.push(`${item.title} (${item.platform}): ${result.error}`);
      }
    }
  } catch (err: any) {
    results.errors.push(`Calendar processing error: ${err.message}`);
    console.error('[PublishProcessor] Error processing content calendar:', err.message);
  }

  return results;
}

export async function publishApprovedContent(): Promise<{ published: number; failed: number; errors: string[] }> {
  const results = { published: 0, failed: 0, errors: [] as string[] };

  try {
    const approvedItems = await supabaseSelect<ContentQueueItem>('dm_content_queue', { status: 'approved' });

    for (const item of approvedItems) {
      const result = await publishContentItem(item.id);
      if (result.success) {
        results.published++;
      } else {
        results.failed++;
        results.errors.push(`${item.title}: ${result.error}`);
      }
    }
  } catch (err: any) {
    results.errors.push(err.message);
  }

  return results;
}

export async function approveCalendarItem(calendarId: number, founderNotes?: string, publishImmediately?: boolean): Promise<{ success: boolean; error?: string; publishResult?: PublishResult }> {
  try {
    const items = await supabaseSelect<ContentCalendarItem>('content_calendar', { id: String(calendarId) });
    if (items.length === 0) {
      return { success: false, error: 'Calendar item not found' };
    }

    const item = items[0];
    if (item.status !== 'pending_approval') {
      return { success: false, error: `Item is not pending approval (current: ${item.status})` };
    }

    const newStatus = publishImmediately ? 'approved' : 'scheduled';

    await supabaseUpdate('content_calendar', { id: String(calendarId) }, {
      status: newStatus,
      approval_notes: founderNotes || '',
      updated_at: new Date().toISOString(),
    });

    try {
      await supabaseUpdate('founder_approval_queue', { content_calendar_id: String(calendarId) }, {
        status: 'approved',
        founder_notes: founderNotes || '',
        decided_at: new Date().toISOString(),
      });
    } catch {}

    await logAudit({
      agentId: item.agent_id,
      actionType: 'content_approved',
      actionDescription: `Founder approved "${item.title}" — ${publishImmediately ? 'immediate publish' : 'scheduled'}`,
      entityType: 'content_calendar',
      entityId: String(calendarId),
      riskScore: item.risk_score,
      status: 'success',
    });

    if (publishImmediately) {
      const publishResult = await publishCalendarItem(calendarId);
      return { success: true, publishResult };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function rejectCalendarItem(calendarId: number, founderNotes?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const items = await supabaseSelect<ContentCalendarItem>('content_calendar', { id: String(calendarId) });
    if (items.length === 0) {
      return { success: false, error: 'Calendar item not found' };
    }

    const item = items[0];
    const rejectableStatuses = ['pending_approval', 'draft', 'scheduled'];
    if (!rejectableStatuses.includes(item.status)) {
      return { success: false, error: `Cannot reject item with status "${item.status}" — only pending_approval, draft, or scheduled items can be rejected` };
    }

    await supabaseUpdate('content_calendar', { id: String(calendarId) }, {
      status: 'rejected',
      approval_notes: founderNotes || '',
      updated_at: new Date().toISOString(),
    });

    try {
      await supabaseUpdate('founder_approval_queue', { content_calendar_id: String(calendarId) }, {
        status: 'rejected',
        founder_notes: founderNotes || '',
        decided_at: new Date().toISOString(),
      });
    } catch {}

    await logAudit({
      agentId: item.agent_id,
      actionType: 'content_rejected',
      actionDescription: `Founder rejected "${item.title}"`,
      entityType: 'content_calendar',
      entityId: String(calendarId),
      riskScore: item.risk_score,
      status: 'rejected',
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export const publishingService = {
  publishContentItem,
  publishApprovedContent,
  publishCalendarItem,
  processContentCalendar,
  approveCalendarItem,
  rejectCalendarItem,
  publishToLinkedIn: (item: ContentQueueItem) => publishToLinkedIn(item.body, item.media_urls || []),
  publishToInstagram: (item: ContentQueueItem) => publishToInstagram(item.body, item.media_urls || []),
  publishViaEmail: (item: ContentQueueItem) => publishViaEmail(item.title, item.body, item.metadata?.recipients),
};
