export declare class AutomationService {
    private interimEmailScheduled;
    onOnboardingComplete(userId: string, context: Record<string, any>): Promise<void>;
    private scheduleDealPartnerScout;
    private scheduleEventRegistration;
    /**
     * Schedules the interim "still working on your matches" email.
     *
     * Fires after INTERIM_MATCH_EMAIL_DELAY_MS (2h). At trigger time we
     * re-check the database — if the user already has at least one
     * proposed match by then, we skip (the match-proposed email already
     * communicated the news). Otherwise we send the interim so the user
     * isn't left wondering whether anything is happening.
     *
     * Uses setTimeout for parity with scheduleCall / scheduleDealPartnerScout.
     * If the process restarts inside the 2h window the timer is lost; that's
     * an acceptable trade-off for v1 — the worst case is a missed reassurance
     * email, not a broken match.
     */
    private scheduleInterimMatchEmail;
    private scheduleInterimMatchEmailDay1;
    private scheduleInterimMatchEmailDay2;
    /**
     * Shared scheduler for all three interim-email stages.
     *
     * Each stage is dedup-keyed independently (`${userId}:${stage}`) so the
     * 2h, 24h, and 48h timers don't collide and a replay of onOnboardingComplete
     * never queues two timers for the same stage. At trigger time we re-check
     * the database and bail out if any matches now exist.
     */
    private scheduleInterimEmailStage;
    private scheduleCall;
    private sendWelcomeMessages;
    schedulePostEventFollowUp(eventId: string, delayMs?: number): Promise<void>;
    triggerCallForUser(userId: string, phoneNumber: string): Promise<null>;
    triggerMessageForUser(userId: string, phoneNumber: string, channel: 'SMS' | 'WHATSAPP', message: string): Promise<{
        success: boolean;
        messageId: string;
        status: import("twilio/lib/rest/api/v2010/account/message").MessageStatus;
    } | {
        status: string;
        messageSid: any;
        userId: string;
        id: string;
        channel: import(".prisma/client").$Enums.MessageChannel;
        createdAt: Date;
        updatedAt: Date;
        recipientPhone: string;
        content: string;
        errorMessage: string | null;
        provider: string | null;
    } | {
        status: string;
        errorMessage: any;
        userId: string;
        id: string;
        channel: import(".prisma/client").$Enums.MessageChannel;
        createdAt: Date;
        updatedAt: Date;
        recipientPhone: string;
        content: string;
        messageSid: string | null;
        provider: string | null;
    } | null>;
}
export declare const automationService: AutomationService;
//# sourceMappingURL=automationService.d.ts.map