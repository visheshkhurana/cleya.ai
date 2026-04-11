declare class MatchScheduler {
    private tasks;
    private running;
    private started;
    start(): void;
    stop(): void;
    runBatchMatching(): Promise<{
        usersProcessed: number;
        totalProposed: number;
        errors: number;
        duration: string;
        skipped: boolean;
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