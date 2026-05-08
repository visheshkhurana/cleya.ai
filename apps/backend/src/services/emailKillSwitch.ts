import { prisma } from '@cleya/db';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Engagement kill-switch for match-proposed emails.
 *
 * Per the engagement audit: 40 match-proposed emails sent, 0 responses.
 * If we've sent the same user 3+ match-proposed emails in the last 7 days
 * and not a single one has been opened or clicked, stop emailing them on
 * this channel. The caller (matchingService dispatch) routes the proposal
 * through WhatsApp / in-app instead, so the user still hears about the
 * match — just not via a channel that's clearly being filtered out.
 *
 * Linkage works because:
 *   - email.ts now writes an EmailEvent row with event='sent' + emailKey
 *     immediately on Resend success.
 *   - resendWebhook.ts writes EmailEvent rows for delivered/opened/clicked
 *     keyed by the same resendId.
 *   - We compare sent-resendIds against opened/clicked-resendIds for the
 *     last 3 sends.
 */
export async function shouldKillMatchProposedEmail(userId: string): Promise<boolean> {
  const since = new Date(Date.now() - SEVEN_DAYS_MS);
  const sentRows = await prisma.emailEvent.findMany({
    where: {
      userId,
      emailKey: 'match_proposed',
      event: 'sent',
      occurredAt: { gte: since },
    },
    orderBy: { occurredAt: 'desc' },
    take: 3,
    select: { resendId: true },
  });

  if (sentRows.length < 3) return false;

  const resendIds = sentRows.map(r => r.resendId).filter((id): id is string => !!id);
  if (resendIds.length === 0) return false;

  const opens = await prisma.emailEvent.count({
    where: {
      resendId: { in: resendIds },
      event: { in: ['email.opened', 'email.clicked', 'opened', 'clicked'] },
    },
  });

  return opens === 0;
}
