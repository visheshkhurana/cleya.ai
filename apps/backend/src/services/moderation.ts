import { prisma } from '@cleya/db';
import { slackService } from './slackService';
import { emailService } from './email';
import { env } from '../config/env';

export async function getBlockedUserIds(userId: string): Promise<string[]> {
  const rows = await prisma.blockedUser.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  });
  const ids = new Set<string>();
  for (const r of rows) {
    if (r.blockerId === userId) ids.add(r.blockedId);
    else ids.add(r.blockerId);
  }
  return Array.from(ids);
}

export async function isBlockedBetween(a: string, b: string): Promise<boolean> {
  if (!a || !b || a === b) return false;
  const row = await prisma.blockedUser.findFirst({
    where: {
      OR: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    },
    select: { id: true },
  });
  return !!row;
}

export async function notifyAdminsOfReport(reportId: string) {
  try {
    const report = await prisma.report.findUnique({
      where: { id: reportId },
      include: {
        reporter: { select: { email: true, name: true } },
        target: { select: { email: true, name: true, id: true } },
      },
    });
    if (!report) return;

    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || env.FROM_EMAIL || 'admin@cleya.ai';
    const reporterName = report.reporter.name || report.reporter.email;
    const targetName = report.target.name || report.target.email;

    const slackText = `:rotating_light: New report — *${report.category}* against ${targetName} (${report.target.email}) by ${reporterName}`;
    const slackBlocks = [
      { type: 'header', text: { type: 'plain_text', text: '🚨 New User Report' } },
      {
        type: 'section', fields: [
          { type: 'mrkdwn', text: `*Category:*\n${report.category}` },
          { type: 'mrkdwn', text: `*Target:*\n${targetName}` },
          { type: 'mrkdwn', text: `*Reporter:*\n${reporterName}` },
          { type: 'mrkdwn', text: `*Type:*\n${report.targetType}` },
        ],
      },
      ...(report.details ? [{ type: 'section', text: { type: 'mrkdwn', text: `*Details:*\n${report.details.slice(0, 1000)}` } }] : []),
      { type: 'context', elements: [{ type: 'mrkdwn', text: `Report ID: ${report.id}` }] },
    ];

    await Promise.allSettled([
      slackService.postAlert(slackText, slackBlocks),
      emailService.sendAdminAlert(
        adminEmail,
        `[Cleya Moderation] New ${report.category} report against ${targetName}`,
        `<h2>New User Report</h2>
         <p><b>Category:</b> ${report.category}</p>
         <p><b>Type:</b> ${report.targetType}</p>
         <p><b>Target:</b> ${targetName} (${report.target.email})</p>
         <p><b>Reporter:</b> ${reporterName} (${report.reporter.email})</p>
         ${report.details ? `<p><b>Details:</b><br/>${report.details.replace(/</g, '&lt;')}</p>` : ''}
         <p><a href="${env.FRONTEND_URL || 'https://cleya.ai'}/admin/reports">Review in admin panel</a></p>`
      ),
    ]);
  } catch (err) {
    console.error('[Moderation] Failed to notify admins:', err);
  }
}
