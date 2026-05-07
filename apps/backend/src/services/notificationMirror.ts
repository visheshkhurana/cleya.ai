import { prisma } from '@cleya/db';

type NotifChannel = 'WHATSAPP' | 'EMAIL' | 'SMS' | 'IN_APP';
type NotifEvent =
  | 'MATCH_FOUND' | 'INTRO_REQUEST' | 'INTRO_ACCEPTED' | 'INTRO_REJECTED'
  | 'PROFILE_COMPLETE' | 'CALL_SCHEDULED' | 'CALL_REMINDER'
  | 'INTRO_PENDING' | 'MEETING_PROPOSED' | 'MEETING_CONFIRMED'
  | 'SECRETARY_DIGEST' | 'REFERRAL_JOINED' | 'REFERRAL_REWARD'
  | 'PROFILE_STRENGTH';

/**
 * Mirror a previously-sent message (email/WhatsApp/SMS) into the
 * `notifications` table as an audit row. Non-blocking — swallows errors.
 *
 * This is *separate* from `notificationService.send()` which actually
 * dispatches the notification. Use this when the dispatch already
 * happened via another channel (e.g. emailService.sendMatchProposed)
 * and you just want the row recorded so analytics + the in-app bell
 * pick it up.
 */
export async function recordSent(opts: {
  userId: string;
  channel: NotifChannel;
  event: NotifEvent;
  title: string;
  body: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: opts.userId,
        channel: opts.channel,
        event: opts.event,
        title: opts.title,
        body: opts.body,
        metadata: opts.metadata || {},
        sentAt: new Date(),
      },
    });
  } catch (err: any) {
    console.error('[NotificationMirror] recordSent failed:', err?.message || err);
  }
}

/**
 * Mirror an email send by key. Maps the email key to a sane
 * NotificationEvent so dashboards/the bell can group by intent.
 */
export async function recordEmailSent(opts: {
  userId: string;
  emailKey: string;
  subject: string;
  preview?: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  const event = mapEmailKeyToEvent(opts.emailKey);
  await recordSent({
    userId: opts.userId,
    channel: 'EMAIL',
    event,
    title: opts.subject,
    body: opts.preview || opts.subject,
    metadata: { emailKey: opts.emailKey, ...(opts.metadata || {}) },
  });
}

function mapEmailKeyToEvent(key: string): NotifEvent {
  if (key.startsWith('match_proposed') || key.startsWith('match_found')) return 'MATCH_FOUND';
  if (key.startsWith('match_accepted') || key.startsWith('intro_accepted')) return 'INTRO_ACCEPTED';
  if (key.startsWith('match_rejected') || key.startsWith('intro_rejected')) return 'INTRO_REJECTED';
  if (key.startsWith('intro_joint') || key.startsWith('intro_request')) return 'INTRO_REQUEST';
  if (key.startsWith('post_intro_followup') || key.startsWith('feedback_request') || key.startsWith('non_response_feedback')) return 'INTRO_PENDING';
  if (key.startsWith('weekly_digest') || key.startsWith('daily_digest')) return 'SECRETARY_DIGEST';
  if (key.startsWith('profile_nudge') || key.startsWith('how_matching_works') || key.startsWith('match_check_in') || key.startsWith('dormant') || key.startsWith('welcome') || key.startsWith('magic_link')) return 'PROFILE_STRENGTH';
  return 'PROFILE_STRENGTH';
}
