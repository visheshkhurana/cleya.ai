export type ProposalSkipReason = 'DAILY_CAP' | 'COOLDOWN' | 'FREE_LIMIT' | 'SAME_PERSONA' | 'DUPLICATE' | 'OTHER';
export type NotificationSkipReason = 'QUIET_HOURS' | 'DAILY_CAP';
export interface MatchMetrics {
    proposalsCreated: number;
    proposalsSkipped: Record<ProposalSkipReason, number>;
    notificationsSent: number;
    notificationsSkipped: Record<NotificationSkipReason, number>;
}
export declare function recordProposalCreated(): void;
export declare function recordProposalSkipped(reason: ProposalSkipReason): void;
export declare function recordNotificationSent(): void;
export declare function recordNotificationSkipped(reason: NotificationSkipReason): void;
export declare function snapshot(): MatchMetrics;
export declare function diffSince(prev: MatchMetrics): MatchMetrics;
export declare function formatSkipBreakdown(m: MatchMetrics): string;
//# sourceMappingURL=matchMetrics.d.ts.map