declare class LinkedinEnrichmentService {
    enrichProfile(userId: string): Promise<boolean>;
    private extractSignals;
    enrichBatch(batchSize?: number): Promise<{
        total: number;
        enriched: number;
        skipped: number;
        errors: number;
    }>;
    onNewUserSignup(userId: string): Promise<void>;
}
export declare const linkedinEnrichmentService: LinkedinEnrichmentService;
export {};
//# sourceMappingURL=linkedinEnrichmentService.d.ts.map