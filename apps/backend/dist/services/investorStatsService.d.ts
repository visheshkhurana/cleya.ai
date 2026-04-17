export interface InvestorStatsView {
    responseRate: number;
    avgResponseTimeHours: number;
    lastActiveAt: Date | null;
    introsThisMonth: number;
    acceptanceRate: number;
    totalIntros: number;
    hidden: boolean;
}
export declare class InvestorStatsService {
    computeForUser(userId: string): Promise<{
        userId: string;
        responseRate: number;
        avgResponseTimeMs: number;
        lastActiveAt: Date | null;
        introsThisMonth: number;
        acceptanceRate: number;
        hideStats: boolean;
        totalIntros: number;
        totalAcceptedIntros: number;
        computedAt: Date;
    } | null>;
    runDailyAggregation(): Promise<{
        updated: number;
        errors: number;
    }>;
    getView(userId: string): Promise<InvestorStatsView | null>;
    private toView;
    setHideStats(userId: string, hide: boolean): Promise<{
        userId: string;
        responseRate: number;
        avgResponseTimeMs: number;
        lastActiveAt: Date | null;
        introsThisMonth: number;
        acceptanceRate: number;
        hideStats: boolean;
        totalIntros: number;
        totalAcceptedIntros: number;
        computedAt: Date;
    }>;
}
export declare const investorStatsService: InvestorStatsService;
//# sourceMappingURL=investorStatsService.d.ts.map