type NotifChannel = 'WHATSAPP' | 'EMAIL' | 'SMS' | 'IN_APP';
type NotifEvent = 'MATCH_FOUND' | 'INTRO_REQUEST' | 'INTRO_ACCEPTED' | 'INTRO_REJECTED' | 'PROFILE_COMPLETE' | 'CALL_SCHEDULED' | 'CALL_REMINDER' | 'INTRO_PENDING' | 'MEETING_PROPOSED' | 'MEETING_CONFIRMED' | 'SECRETARY_DIGEST' | 'REFERRAL_JOINED' | 'REFERRAL_REWARD' | 'PROFILE_STRENGTH';
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
export declare function recordSent(opts: {
    userId: string;
    channel: NotifChannel;
    event: NotifEvent;
    title: string;
    body: string;
    metadata?: Record<string, any>;
}): Promise<void>;
/**
 * Mirror an email send by key. Maps the email key to a sane
 * NotificationEvent so dashboards/the bell can group by intent.
 */
export declare function recordEmailSent(opts: {
    userId: string;
    emailKey: string;
    subject: string;
    preview?: string;
    metadata?: Record<string, any>;
}): Promise<void>;
export {};
//# sourceMappingURL=notificationMirror.d.ts.map