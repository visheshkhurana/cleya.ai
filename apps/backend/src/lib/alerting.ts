import { logger } from './logger';
import { slackService } from '../services/slackService';
import { getUncachableResendClient } from '../services/resendClient';

export enum AlertSeverity {
  P1_CRITICAL = 'P1',
  P2_HIGH = 'P2',
  P3_MEDIUM = 'P3',
  P4_LOW = 'P4',
}

export interface AlertPayload {
  severity: AlertSeverity;
  title: string;
  service: string;
  message: string;
  error?: string;
  errorRate?: number;
  duration?: number;
  status?: string;
  metadata?: Record<string, unknown>;
}

const SEVERITY_CONFIG: Record<AlertSeverity, { color: string; emoji: string; label: string; responseTime: string }> = {
  [AlertSeverity.P1_CRITICAL]: { color: '#FF0000', emoji: '🚨', label: 'CRITICAL', responseTime: '< 15 min' },
  [AlertSeverity.P2_HIGH]: { color: '#FF8C00', emoji: '🔴', label: 'HIGH', responseTime: '< 1 hour' },
  [AlertSeverity.P3_MEDIUM]: { color: '#FFD700', emoji: '🟡', label: 'MEDIUM', responseTime: '< 4 hours' },
  [AlertSeverity.P4_LOW]: { color: '#36A64F', emoji: '🟢', label: 'LOW', responseTime: 'Next business day' },
};

function buildSlackBlocks(alert: AlertPayload) {
  const config = SEVERITY_CONFIG[alert.severity];

  const blocks: any[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${config.emoji} [${config.label}] ${alert.title}`,
      },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Service:*\n${alert.service}` },
        { type: 'mrkdwn', text: `*Severity:*\n${alert.severity} — ${config.label}` },
      ],
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Message:*\n${alert.message}`,
      },
    },
  ];

  const fields: any[] = [];
  if (alert.status) fields.push({ type: 'mrkdwn', text: `*Status:*\n${alert.status}` });
  if (alert.errorRate !== undefined) fields.push({ type: 'mrkdwn', text: `*Error Rate:*\n${alert.errorRate}%` });
  if (alert.duration !== undefined) fields.push({ type: 'mrkdwn', text: `*Duration:*\n${alert.duration}ms` });

  if (fields.length > 0) {
    blocks.push({ type: 'section', fields });
  }

  if (alert.error) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Error Details:*\n\`\`\`${alert.error.substring(0, 500)}\`\`\``,
      },
    });
  }

  blocks.push(
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `⏰ Expected response: ${config.responseTime} | 📅 ${new Date().toISOString()}`,
        },
      ],
    },
    { type: 'divider' }
  );

  return blocks;
}

function buildAlertText(alert: AlertPayload): string {
  const config = SEVERITY_CONFIG[alert.severity];
  return `${config.emoji} [${config.label}] ${alert.title} — ${alert.service}: ${alert.message}`;
}

async function sendSlackAlert(alert: AlertPayload) {
  try {
    const blocks = buildSlackBlocks(alert);
    const text = buildAlertText(alert);
    await slackService.postAlert(text, blocks);
  } catch (err: any) {
    logger.error('Failed to send Slack alert', {
      alertTitle: alert.title,
      error: err.message,
    });
  }
}

async function sendEmailAlert(alert: AlertPayload) {
  const recipients = process.env.ALERT_EMAIL_RECIPIENTS;
  if (!recipients) return;

  try {
    const { client, fromEmail } = await getUncachableResendClient();
    const config = SEVERITY_CONFIG[alert.severity];

    await client.emails.send({
      from: fromEmail || 'alerts@cleya.ai',
      to: recipients.split(',').map(e => e.trim()),
      subject: `[${config.label}] ${alert.title} — ${alert.service}`,
      html: `
        <h2 style="color: ${config.color}">${config.emoji} ${config.label}: ${alert.title}</h2>
        <p><strong>Service:</strong> ${alert.service}</p>
        <p><strong>Message:</strong> ${alert.message}</p>
        ${alert.error ? `<p><strong>Error:</strong></p><pre>${alert.error.substring(0, 1000)}</pre>` : ''}
        ${alert.errorRate !== undefined ? `<p><strong>Error Rate:</strong> ${alert.errorRate}%</p>` : ''}
        ${alert.duration !== undefined ? `<p><strong>Duration:</strong> ${alert.duration}ms</p>` : ''}
        <hr>
        <p><small>Expected response time: ${config.responseTime} | ${new Date().toISOString()}</small></p>
      `,
    });
  } catch (err: any) {
    logger.error('Failed to send email alert', {
      alertTitle: alert.title,
      error: err.message,
    });
  }
}

function sanitizeAlertText(text: string): string {
  return text
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[REDACTED_EMAIL]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED_TOKEN]')
    .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[REDACTED]');
}

export async function sendAlert(alert: AlertPayload): Promise<void> {
  const sanitized = {
    ...alert,
    message: sanitizeAlertText(alert.message),
    error: alert.error ? sanitizeAlertText(alert.error) : undefined,
  };

  logger.warn(`Alert triggered: [${sanitized.severity}] ${sanitized.title}`, {
    severity: sanitized.severity,
    service: sanitized.service,
    message: sanitized.message,
  });

  await sendSlackAlert(sanitized);

  if (sanitized.severity === AlertSeverity.P1_CRITICAL || sanitized.severity === AlertSeverity.P2_HIGH) {
    await sendEmailAlert(sanitized);
  }
}
