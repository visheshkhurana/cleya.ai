declare class DripCampaignService {
    /**
     * Backfill: enroll all existing users (created within the last `lookbackDays`)
     * who have *no* drip rows yet. Anchors the schedule on the user's
     * `createdAt` so a user who signed up 5 days ago will have profile_nudge
     * sent immediately on the next drip tick.
     *
     * Idempotent thanks to the unique (userId, sequence, emailKey) constraint.
     * Run this once at boot to recover the cohort that pre-dated drip enrollment.
     */
    backfillOnboarding(lookbackDays?: number): Promise<{
        enrolled: number;
        skipped: number;
        rowsCreated: number;
    }>;
    enrollOnboarding(userId: string): Promise<void>;
    enrollMatchFollowUp(userId: string, matchId: string): Promise<void>;
    /**
     * Schedule a one-shot non-response feedback email 72h after a match is
     * proposed. Idempotent per (userId, matchId) thanks to the unique
     * (userId, sequence, emailKey) constraint plus our matchId-suffixed key.
     * The shouldSkip() check will short-circuit if the user has since
     * responded or already left feedback.
     */
    enrollNonResponseFeedback(userId: string, matchId: string): Promise<void>;
    enrollFeedbackRequest(userId: string, matchId: string): Promise<void>;
    processDue(): Promise<{
        sent: number;
        skipped: number;
        failed: number;
    }>;
    private shouldSkip;
    private hasMatches;
    private sendDripEmail;
    private getOtherUserName;
}
export declare const dripCampaignService: DripCampaignService;
export {};
//# sourceMappingURL=dripCampaignService.d.ts.map