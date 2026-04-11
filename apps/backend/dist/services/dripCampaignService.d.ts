declare class DripCampaignService {
    enrollOnboarding(userId: string): Promise<void>;
    enrollMatchFollowUp(userId: string, matchId: string): Promise<void>;
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