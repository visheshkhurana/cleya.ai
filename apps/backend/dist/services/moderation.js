"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBlockedUserIds = getBlockedUserIds;
exports.isBlockedBetween = isBlockedBetween;
exports.notifyAdminsOfReport = notifyAdminsOfReport;
const db_1 = require("@cleya/db");
const slackService_1 = require("./slackService");
const email_1 = require("./email");
const env_1 = require("../config/env");
async function getBlockedUserIds(userId) {
    const rows = await db_1.prisma.blockedUser.findMany({
        where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
        select: { blockerId: true, blockedId: true },
    });
    const ids = new Set();
    for (const r of rows) {
        if (r.blockerId === userId)
            ids.add(r.blockedId);
        else
            ids.add(r.blockerId);
    }
    return Array.from(ids);
}
async function isBlockedBetween(a, b) {
    if (!a || !b || a === b)
        return false;
    const row = await db_1.prisma.blockedUser.findFirst({
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
async function notifyAdminsOfReport(reportId) {
    try {
        const report = await db_1.prisma.report.findUnique({
            where: { id: reportId },
            include: {
                reporter: { select: { email: true, name: true } },
                target: { select: { email: true, name: true, id: true } },
            },
        });
        if (!report)
            return;
        const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || env_1.env.FROM_EMAIL || 'admin@cleya.ai';
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
            slackService_1.slackService.postAlert(slackText, slackBlocks),
            email_1.emailService.sendAdminAlert(adminEmail, `[Cleya Moderation] New ${report.category} report against ${targetName}`, `<h2>New User Report</h2>
         <p><b>Category:</b> ${report.category}</p>
         <p><b>Type:</b> ${report.targetType}</p>
         <p><b>Target:</b> ${targetName} (${report.target.email})</p>
         <p><b>Reporter:</b> ${reporterName} (${report.reporter.email})</p>
         ${report.details ? `<p><b>Details:</b><br/>${report.details.replace(/</g, '&lt;')}</p>` : ''}
         <p><a href="${env_1.env.FRONTEND_URL || 'https://cleya.ai'}/admin/reports">Review in admin panel</a></p>`),
        ]);
    }
    catch (err) {
        console.error('[Moderation] Failed to notify admins:', err);
    }
}
//# sourceMappingURL=moderation.js.map