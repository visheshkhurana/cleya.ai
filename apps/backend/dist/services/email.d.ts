declare class EmailService {
    private resendAvailable;
    sendRaw(opts: {
        to: string;
        subject: string;
        html: string;
        replyTo?: string;
    }): Promise<boolean>;
    private send;
    sendAdminAlert(to: string, subject: string, html: string): Promise<boolean>;
    sendNewSignupNotification(opts: {
        email: string;
        name?: string | null;
        provider: 'email' | 'google' | 'linkedin' | 'clerk';
        userId?: string;
    }): Promise<void>;
    sendWelcome(email: string): Promise<boolean>;
    sendMatchProposed(recipientEmail: string, recipientName: string, matchName: string, matchPersona: string, matchScore: number, matchDetails?: {
        companyName?: string;
        headline?: string;
        raiseAmount?: string;
        sector?: string;
        stage?: string;
        traction?: string;
        linkedinUrl?: string;
        location?: string;
        bio?: string;
        matchReason?: string;
        matchId?: string;
        recipientUserId?: string;
    }): Promise<void>;
    /**
     * Instant acknowledgement when a user accepts or declines via email.
     * Fired from the one-click match action route AND from the Resend Inbound
     * webhook so both paths give the same "OK, I have conveyed your message"
     * confirmation the user expects.
     */
    sendIntroResponseAck(opts: {
        to: string;
        responderName: string;
        partnerName: string;
        action: 'accept' | 'decline';
        bothAccepted: boolean;
    }): Promise<boolean>;
    /**
     * Boardy-style joint introduction email.
     *
     * Fires ONE email with BOTH parties on To:, so they share a single thread
     * (just like the Boardy "to bigansh.agarwal, me" pattern). Reply-To is set
     * to both addresses so a Reply naturally lands in the OTHER person's inbox
     * — no more bouncing off hello@cleya.ai because hitting Reply replies to
     * the partner's mailbox, not to a non-existent Cleya alias.
     *
     * This is what should fire automatically the moment the second person
     * accepts a match — it is the actual "warm intro" that makes the network
     * worth being in.
     */
    sendMatchIntroJoint(opts: {
        emailA: string;
        nameA: string;
        emailB: string;
        nameB: string;
        personaA?: string;
        personaB?: string;
        headlineA?: string;
        headlineB?: string;
        companyA?: string;
        companyB?: string;
        sectorA?: string;
        sectorB?: string;
        locationA?: string;
        locationB?: string;
        tractionA?: string;
        tractionB?: string;
        linkedinA?: string;
        linkedinB?: string;
        matchReason?: string;
        talkingPoints?: string[];
    }): Promise<boolean>;
    sendMatchAccepted(recipientEmail: string, recipientName: string, matchName: string, matchPersona: string, matchEmail: string, matchLinkedin?: string, matchDetails?: {
        headline?: string;
        companyName?: string;
        sector?: string;
        location?: string;
        traction?: string;
        matchReason?: string;
        matchUserId?: string;
    }): Promise<void>;
    sendPasswordReset(email: string, token: string): Promise<void>;
    sendEmailVerification(email: string, token: string): Promise<void>;
    sendNewMatch(email: string, matchName: string, matchScore: number): Promise<void>;
    sendWeeklyDigest(userId: string): Promise<void>;
    sendMeetingInvite(to: string, otherName: string, title: string, meetingTime: Date, duration: number, meetingUrl: string | null): Promise<void>;
    sendFollowup(to: string, subject: string, body: string): Promise<void>;
    sendDailyDigest(to: string, digestContent: string): Promise<void>;
    sendIntroductionEmail(recipientEmail: string, recipientName: string, introPersonName: string, introBody: string, linkedinUrl?: string, introDetails?: {
        headline?: string;
        companyName?: string;
        sector?: string;
        location?: string;
        traction?: string;
        matchReason?: string;
        partnerUserId?: string;
    }): Promise<void>;
    private generateICS;
    sendProfileNudge(email: string, name?: string, teasers?: string[]): Promise<boolean>;
    sendHowMatchingWorks(email: string, name?: string): Promise<boolean>;
    sendMatchCheckIn(email: string, name?: string): Promise<boolean>;
    /**
     * Interim "still working on your matches" email.
     *
     * Sent when a freshly onboarded user still has zero matches after a couple
     * of hours. Matches usually land within 2 hours, so this only fires for
     * users who would otherwise sit on an empty dashboard wondering whether
     * the product is broken. Setting expectations beats silence.
     */
    sendMatchInterim(email: string, name?: string): Promise<boolean>;
    /**
     * Day-1 follow-up: still no matches 24h after onboarding.
     *
     * Fires if the user is *still* sitting on zero matches a day in
     * (gated independently of the 2h send — the only condition is
     * matchCount === 0 at trigger time). Tone matches sendMatchInterim:
     * keep expectations honest, encourage a reply with more context.
     */
    sendMatchInterimDay1(email: string, name?: string): Promise<boolean>;
    /**
     * Day-2 follow-up: still no matches 48h after onboarding.
     *
     * Polite, confidence-preserving update. Frames the wait as careful
     * curation rather than a shortfall, and sets the expectation that we'll
     * reach out the moment a strong match is ready. After this we go quiet
     * until matches actually appear.
     */
    sendMatchInterimDay2(email: string, name?: string): Promise<boolean>;
    /**
     * Onboarding email for someone introduced to Cleya via a referral
     * (typically forwarded an invite or emailed hello@cleya.ai directly).
     * Goal: minimum-friction first response — they can either reply with
     * a quick blurb (and Cleya matches them manually), or tap through to
     * sign up themselves. No sales tone, no list of features. Just a
     * warm "hi, here's the easiest path forward."
     */
    sendReferralOnboarding(email: string, opts?: {
        name?: string;
        referrerName?: string;
    }): Promise<boolean>;
    sendPostIntroFollowUp(email: string, name?: string, matchName?: string): Promise<boolean>;
    /**
     * Sent 72h after a match is proposed if the recipient has neither
     * accepted nor declined. We give them four single-tap reasons so we
     * can quietly improve future curation. Each button is a signed
     * feedback URL that records a MatchFeedback row server-side.
     */
    sendNonResponseFeedback(opts: {
        to: string;
        recipientName: string;
        partnerName: string;
        matchId: string;
        recipientUserId: string;
    }): Promise<boolean>;
    sendFeedbackRequest(email: string, name?: string, matchName?: string): Promise<boolean>;
    sendReferralInvite(userId: string, opts?: {
        earlyAccessBonus?: boolean;
        force?: boolean;
    }): Promise<boolean>;
    sendReferralInviteToAll(opts?: {
        earlyAccessBonus?: boolean;
        limit?: number;
        dryRun?: boolean;
    }): Promise<{
        sent: number;
        failed: number;
        total: number;
        dryRun: boolean;
    } | {
        sent: number;
        failed: number;
        total: number;
        dryRun?: undefined;
    }>;
    sendDigestToAll(): Promise<{
        sent: number;
        failed: number;
        total: number;
    }>;
}
export declare const emailService: EmailService;
export {};
//# sourceMappingURL=email.d.ts.map