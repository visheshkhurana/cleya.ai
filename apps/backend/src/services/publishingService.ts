import { supabaseSelect, supabaseUpdate, supabaseInsert } from './supabaseClient';
import { linkedinPublisher } from './linkedinPublisher';
import { instagramService } from './instagramService';
import { getUncachableResendClient } from './resendClient';
import { logExecution, checkGuardrails, DEFAULT_GUARDRAILS, type AutonomyLevel, type AgentGuardrails } from './guardrailsService';
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

interface PublishResult {
  success: boolean;
  platform: string;
  postId?: string;
  error?: string;
}

async function publishToLinkedIn(item: ContentQueueItem): Promise<PublishResult> {
  if (!linkedinPublisher.isConfigured()) {
    return { success: false, platform: 'linkedin', error: 'LinkedIn not configured' };
  }

  const mediaUrls = item.media_urls || [];
  let result;

  if (mediaUrls.length > 0) {
    result = await linkedinPublisher.publishImagePost(item.body, mediaUrls[0]);
  } else {
    result = await linkedinPublisher.publishTextPost(item.body);
  }

  return { success: result.success, platform: 'linkedin', postId: result.postId, error: result.error };
}

async function publishToInstagram(item: ContentQueueItem): Promise<PublishResult> {
  if (!instagramService.isConfigured()) {
    return { success: false, platform: 'instagram', error: 'Instagram not configured' };
  }

  const mediaUrls = item.media_urls || [];

  if (mediaUrls.length === 0) {
    return { success: false, platform: 'instagram', error: 'Instagram requires at least one image URL' };
  }

  let result;
  if (mediaUrls.length >= 2) {
    result = await instagramService.publishCarousel(mediaUrls, item.body);
  } else {
    result = await instagramService.publishSingleImage(mediaUrls[0], item.body);
  }

  return { success: result.success, platform: 'instagram', postId: result.postId, error: result.error };
}

async function publishViaEmail(item: ContentQueueItem): Promise<PublishResult> {
  try {
    const { client, fromEmail } = await getUncachableResendClient();

    const recipients = item.metadata?.recipients as string[] | undefined;
    const to = recipients && recipients.length > 0 ? recipients : ['hello@cleya.ai'];
    const subject = item.title || 'Newsletter from Cleya.ai';

    const htmlBody = item.body
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

  let result: PublishResult;
  const channel = item.channel.toLowerCase();

  if (channel === 'marketing' || channel === 'linkedin') {
    result = await publishToLinkedIn(item);
  } else if (channel === 'instagram' || channel === 'social') {
    result = await publishToInstagram(item);
  } else if (channel === 'email' || channel === 'newsletter') {
    result = await publishViaEmail(item);
  } else {
    result = await publishToLinkedIn(item);
  }

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

export const publishingService = {
  publishContentItem,
  publishApprovedContent,
  publishToLinkedIn,
  publishToInstagram,
  publishViaEmail,
};
