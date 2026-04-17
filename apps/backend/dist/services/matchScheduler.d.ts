import { type MatchMetrics } from './matchMetrics';
interface TickStats {
    ticks: number;
    usersConsidered: number;
    proposalsCreated: number;
    proposalsBlocked: number;
    errors: number;
    lastTickAt: Date | null;
}
export interface MatchmakingTrendPoint {
    ts: string;
    usersConsidered: number;
    proposalsCreated: number;
    proposalsBlocked: number;
    errors: number;
}
declare class MatchScheduler {
    private tasks;
    private tickRunning;
    private safetyRunning;
    private started;
    private pendingQueue;
    private lastCheckAt;
    private startedAt;
    private stallAlertActive;
    private stallAlertedAt;
    private lastStallAlertAt;
    private stats;
    start(): void;
    runFreeTierReset(): Promise<void>;
    runTickWatchdog(): Promise<void>;
    stop(): void;
    enqueueUserCheck(userId: string): void;
    enqueueRecheckPeers(userId: string): Promise<void>;
    getStats(): TickStats & {
        metrics: MatchMetrics;
        queueSize: number;
    };
    runTick(): Promise<void>;
    private recordSample;
    getTrend(windowMs?: number): Promise<MatchmakingTrendPoint[]>;
    private selectDueUsers;
    runSafetyNetSweep(): Promise<{
        usersProcessed: number;
        totalProposed: number;
        errors: number;
        skipped: boolean;
        duration?: undefined;
    } | {
        usersProcessed: number;
        totalProposed: number;
        errors: number;
        duration: string;
        skipped?: undefined;
    }>;
    /** @deprecated kept for backwards-compatibility — runs the safety-net sweep. */
    runBatchMatching(): Promise<{
        usersProcessed: number;
        totalProposed: number;
        errors: number;
        skipped: boolean;
        duration?: undefined;
    } | {
        usersProcessed: number;
        totalProposed: number;
        errors: number;
        duration: string;
        skipped?: undefined;
    }>;
    runDripCampaign(): Promise<{
        sent: number;
        skipped: number;
        failed: number;
    }>;
    runWeeklyDigest(): Promise<{
        sent: number;
        failed: number;
        total: number;
    }>;
    runInvestorStatsAggregation(): Promise<{
        updated: number;
        errors: number;
    }>;
    runLinkedinEnrichment(): Promise<{
        total: number;
        enriched: number;
        skipped: number;
        errors: number;
    }>;
}
export declare const matchScheduler: MatchScheduler;
export {};
//# sourceMappingURL=matchScheduler.d.ts.map