/**
 * Thin wrapper around the `activities` table. All methods are
 * intentionally fire-and-forget (errors are caught and logged) so an
 * activity-recording failure can never break a primary user action like
 * "respond to match" or "save profile". The audit found this table empty
 * in the engagement report — every recommended hook below is now wired
 * from matchingService, profileService, and conversationService.
 */
export declare class ActivityService {
    record(userId: string, type: string, title: string, metadata?: any): Promise<void>;
    recordMatchFound(userId: string, otherName: string, matchId?: string): Promise<void>;
    recordMatchProposed(userId: string, otherName: string, matchId: string, score?: number): Promise<void>;
    recordMatchViewed(userId: string, matchId: string): Promise<void>;
    recordMatchResponded(userId: string, matchId: string, response: 'ACCEPTED' | 'REJECTED', otherName?: string): Promise<void>;
    recordIntroSent(userId: string, otherName: string, matchId?: string): Promise<void>;
    recordInviteUsed(userId: string, inviteeName: string): Promise<void>;
    recordProfileUpdated(userId: string, changedFields: string[]): Promise<void>;
    recordConversationStarted(userId: string, flowId: string, conversationId: string): Promise<void>;
    recordConversationCompleted(userId: string, flowId: string, conversationId: string): Promise<void>;
}
export declare const activityService: ActivityService;
//# sourceMappingURL=activityService.d.ts.map