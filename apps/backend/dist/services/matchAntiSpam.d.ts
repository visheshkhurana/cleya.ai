export declare const ANTI_SPAM_DEFAULTS: {
    dailyProposalCap: number;
    proposalCooldownHours: number;
    dailyNotificationCap: number;
    quietHoursStart: number;
    quietHoursEnd: number;
};
export declare const ANTI_SPAM: {
    proposalCooldownMs: number;
    defaultTimezone: string;
    dailyProposalCap: number;
    proposalCooldownHours: number;
    dailyNotificationCap: number;
    quietHoursStart: number;
    quietHoursEnd: number;
};
export interface ThrottleConfig {
    dailyProposalCap: number;
    proposalCooldownHours: number;
    proposalCooldownMs: number;
    dailyNotificationCap: number;
    quietHoursStart: number;
    quietHoursEnd: number;
    defaultTimezone: string;
    updatedAt: Date | null;
    updatedBy: string | null;
}
export declare function getThrottleConfig(force?: boolean): Promise<ThrottleConfig>;
export declare function invalidateThrottleConfigCache(): void;
export declare function updateThrottleConfig(patch: Partial<{
    dailyProposalCap: number;
    proposalCooldownHours: number;
    dailyNotificationCap: number;
    quietHoursStart: number;
    quietHoursEnd: number;
}>, actorId?: string): Promise<ThrottleConfig>;
export type GuardrailReason = 'OK' | 'DAILY_CAP' | 'COOLDOWN' | 'FREE_LIMIT';
export interface GuardrailDecision {
    allowed: boolean;
    reason: GuardrailReason;
    blockingUserId?: string;
}
export declare function checkProposalGuardrails(userAId: string, userBId: string): Promise<GuardrailDecision>;
export interface NotificationPolicy {
    inQuietHours: boolean;
    overDailyCap: boolean;
    shouldSend: boolean;
    reason?: 'QUIET_HOURS' | 'DAILY_CAP';
    hour: number;
    timezone: string;
}
export declare function evaluateNotificationPolicy(userId: string): Promise<NotificationPolicy>;
export declare function recordMatchNotification(userId: string, channel: 'WHATSAPP' | 'EMAIL' | 'SMS' | 'IN_APP', matchId: string, body: string): Promise<void>;
//# sourceMappingURL=matchAntiSpam.d.ts.map