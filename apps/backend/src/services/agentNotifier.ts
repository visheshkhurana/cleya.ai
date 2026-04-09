import { slackService } from './slackService';
import { getUncachableResendClient } from './resendClient';
import type { DailyBriefing } from './founderModeService';

interface AgentNotification {
  agentId: string;
  agentName: string;
  status: 'success' | 'error';
  duration: number;
  outputSummary: string;
  error?: string;
  retryCount?: number;
}

const ADMIN_PANEL_URL = process.env.FRONTEND_URL || 'https://cleya.ai';

export async function notifyAgentCompletion(notification: AgentNotification): Promise<void> {
  const promises: Promise<void>[] = [];

  promises.push(notifyViaSlack(notification));
  if (notification.status === 'error') {
    promises.push(notifyViaEmail(notification));
  }

  await Promise.allSettled(promises);
}

async function notifyViaSlack(notification: AgentNotification): Promise<void> {
  try {
    const emoji = notification.status === 'success' ? ':white_check_mark:' : ':x:';
    const statusText = notification.status === 'success' ? 'completed successfully' : 'failed';
    const durationSec = (notification.duration / 1000).toFixed(1);

    const blocks: any[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${emoji} *Agent ${notification.agentName}* ${statusText} in ${durationSec}s`,
        },
      },
    ];

    if (notification.status === 'success' && notification.outputSummary) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `> ${notification.outputSummary.substring(0, 300)}`,
        },
      });
    }

    if (notification.status === 'error' && notification.error) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:warning: *Error:* ${notification.error}${notification.retryCount ? `\n_Failed after ${notification.retryCount} retries_` : ''}`,
        },
      });
    }

    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `<${ADMIN_PANEL_URL}/controltower|View in Control Tower>`,
        },
      ],
    });

    const text = `Agent ${notification.agentName} ${statusText} in ${durationSec}s`;
    await slackService.postAlert(text, blocks);
  } catch (err: any) {
    console.log(`[AgentNotifier] Slack notification failed: ${err.message}`);
  }
}

async function notifyViaEmail(notification: AgentNotification): Promise<void> {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
      console.log('[AgentNotifier] No ADMIN_EMAIL configured, skipping email notification');
      return;
    }

    const durationSec = (notification.duration / 1000).toFixed(1);

    await client.emails.send({
      from: fromEmail || 'Cleya AI Agents <hello@cleya.ai>',
      to: adminEmail,
      subject: `[Cleya] Agent ${notification.agentName} Failed`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #ef4444;">Agent ${notification.agentName} Failed</h2>
          <p><strong>Agent:</strong> ${notification.agentName} (${notification.agentId})</p>
          <p><strong>Duration:</strong> ${durationSec}s</p>
          <p><strong>Error:</strong> ${notification.error || 'Unknown error'}</p>
          ${notification.retryCount ? `<p><strong>Retries:</strong> ${notification.retryCount}</p>` : ''}
          <p style="margin-top: 20px;">
            <a href="${ADMIN_PANEL_URL}/controltower" style="background: #6366f1; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px;">View in Control Tower</a>
          </p>
        </div>
      `,
    });
  } catch (err: any) {
    console.log(`[AgentNotifier] Email notification failed: ${err.message}`);
  }
}

export async function sendBriefingNotifications(briefing: DailyBriefing): Promise<void> {
  const promises: Promise<void>[] = [];
  promises.push(sendBriefingSlack(briefing));
  promises.push(sendBriefingEmail(briefing));
  await Promise.allSettled(promises);
}

async function sendBriefingSlack(briefing: DailyBriefing): Promise<void> {
  try {
    const pendingApprovals = briefing.pendingContent?.length || 0;
    const pendingDecisions = briefing.pendingDecisions?.length || 0;
    const priorityCount = briefing.priorityItems?.length || 0;

    const blocks: any[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `Daily Nexus Briefing — ${briefing.date}`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: [
            `*Platform Metrics*`,
            `• Total Users: ${briefing.metrics.totalUsers}`,
            `• New Signups (24h): ${briefing.metrics.recentSignups}`,
            `• Match Accept Rate: ${briefing.metrics.matchAcceptRate}%`,
            `• Completed Profiles: ${briefing.metrics.completedProfiles}`,
            ...(briefing.metrics.contentCalendar ? [
              `• Content: ${briefing.metrics.contentCalendar.pendingApproval} pending | ${briefing.metrics.contentCalendar.scheduled} scheduled | ${briefing.metrics.contentCalendar.publishedLast24h} published (24h)`,
            ] : []),
            ...(briefing.metrics.adSpend?.totalSpend > 0 ? [
              `• Ad Spend (24h): $${briefing.metrics.adSpend.totalSpend.toFixed(2)} (${briefing.metrics.adSpend.campaigns} campaigns)`,
            ] : []),
            ...(briefing.metrics.auditCosts?.totalCost > 0 ? [
              `• Agent Costs (24h): $${briefing.metrics.auditCosts.totalCost.toFixed(2)} (${briefing.metrics.auditCosts.actionCount} actions)`,
            ] : []),
          ].join('\n'),
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: [
            `*Action Items*`,
            ...briefing.actionList.map(a => `• ${a}`),
          ].join('\n'),
        },
      },
    ];

    if (priorityCount > 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:rotating_light: *${priorityCount} priority item(s)* | ${pendingApprovals} content approval(s) | ${pendingDecisions} decision(s) pending`,
        },
      });
    }

    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `<${ADMIN_PANEL_URL}/controltower|Open Control Tower> | <${ADMIN_PANEL_URL}/founder|Founder Mode>`,
        },
      ],
    });

    await slackService.postAlert(`Daily Nexus Briefing — ${briefing.date}`, blocks);
  } catch (err: any) {
    console.log(`[AgentNotifier] Briefing Slack notification failed: ${err.message}`);
  }
}

async function sendBriefingEmail(briefing: DailyBriefing): Promise<void> {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
      console.log('[AgentNotifier] No ADMIN_EMAIL, skipping briefing email');
      return;
    }

    const actionListHtml = briefing.actionList
      .map(a => `<li style="margin-bottom: 6px;">${a}</li>`)
      .join('');

    const priorityHtml = briefing.priorityItems
      .map(p => `<li style="margin-bottom: 4px;"><strong>[${p.urgency}]</strong> ${p.title} (${p.type})</li>`)
      .join('');

    await client.emails.send({
      from: fromEmail || 'Cleya AI Agents <hello@cleya.ai>',
      to: adminEmail,
      subject: `[Cleya] Daily Briefing — ${briefing.date}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #1a1a2e; font-size: 22px;">Daily Nexus Briefing</h1>
          <p style="color: #666;">${briefing.date}</p>

          <h2 style="font-size: 16px; color: #333; margin-top: 24px;">Platform Metrics</h2>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr><td style="padding: 6px 0; border-bottom: 1px solid #eee;">Total Users</td><td style="text-align: right; padding: 6px 0; border-bottom: 1px solid #eee; font-weight: bold;">${briefing.metrics.totalUsers}</td></tr>
            <tr><td style="padding: 6px 0; border-bottom: 1px solid #eee;">New Signups (24h)</td><td style="text-align: right; padding: 6px 0; border-bottom: 1px solid #eee; font-weight: bold;">${briefing.metrics.recentSignups}</td></tr>
            <tr><td style="padding: 6px 0; border-bottom: 1px solid #eee;">Match Accept Rate</td><td style="text-align: right; padding: 6px 0; border-bottom: 1px solid #eee; font-weight: bold;">${briefing.metrics.matchAcceptRate}%</td></tr>
            <tr><td style="padding: 6px 0;">Completed Profiles</td><td style="text-align: right; padding: 6px 0; font-weight: bold;">${briefing.metrics.completedProfiles}</td></tr>
          </table>

          <h2 style="font-size: 16px; color: #333;">Action Items</h2>
          <ul style="padding-left: 20px; color: #444;">${actionListHtml}</ul>

          ${priorityHtml ? `<h2 style="font-size: 16px; color: #ef4444;">Priority Items</h2><ul style="padding-left: 20px; color: #444;">${priorityHtml}</ul>` : ''}

          <p style="margin-top: 30px;">
            <a href="${ADMIN_PANEL_URL}/controltower" style="background: #6366f1; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; margin-right: 10px;">Control Tower</a>
            <a href="${ADMIN_PANEL_URL}/founder" style="background: #1a1a2e; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px;">Founder Mode</a>
          </p>

          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
          <p style="color: #999; font-size: 12px;">Sent via Cleya.ai Nexus Agent</p>
        </div>
      `,
    });
  } catch (err: any) {
    console.log(`[AgentNotifier] Briefing email failed: ${err.message}`);
  }
}
