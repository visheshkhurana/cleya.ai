export interface CrisisModeState {
    active: boolean;
    activatedAt: string | null;
    activatedBy: string | null;
    reason: string | null;
}
export declare function ensureSafetyTables(): Promise<void>;
export declare function notifyApprovalNeeded(decision: {
    id: number;
    title: string;
    context: string;
    requesting_agent: string;
    urgency: string;
    options?: string[];
}): Promise<void>;
export declare function processEscalations(): Promise<{
    escalated: number;
    autoCancelled: number;
}>;
export declare function getCrisisMode(): Promise<CrisisModeState>;
export declare function activateCrisisMode(activatedBy: string, reason: string): Promise<CrisisModeState>;
export declare function deactivateCrisisMode(deactivatedBy: string): Promise<CrisisModeState>;
export declare function isCrisisModeActive(): Promise<boolean>;
export declare function sendDailyAuditDigest(): Promise<void>;
export declare function sendWeeklyPerformanceReport(): Promise<void>;
//# sourceMappingURL=founderSafetyService.d.ts.map