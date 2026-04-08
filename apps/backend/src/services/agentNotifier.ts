import { slackService } from './slackService';
import { getUncachableResendClient } from './resendClient';

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
