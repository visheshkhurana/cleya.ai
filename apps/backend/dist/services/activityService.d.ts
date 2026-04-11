export declare class ActivityService {
    record(userId: string, type: string, title: string, metadata?: any): Promise<void>;
    recordMatchFound(userId: string, otherName: string): Promise<void>;
    recordIntroSent(userId: string, otherName: string): Promise<void>;
    recordInviteUsed(userId: string, inviteeName: string): Promise<void>;
}
export declare const activityService: ActivityService;
//# sourceMappingURL=activityService.d.ts.map