interface SentryMetrics {
    totalErrors: number;
    unresolvedIssues: number;
    topIssues: {
        id: string;
        title: string;
        shortId: string;
        count: number;
        userCount: number;
        level: string;
        lastSeen: string;
        permalink: string;
    }[];
    errorTrend: {
        date: string;
        count: number;
    }[];
    transactionStats: {
        totalTransactions: number;
        avgDuration: number;
        p95Duration: number;
    } | null;
}
declare function isConfigured(): boolean;
declare function getMetrics(dateRange?: '7d' | '30d' | '90d'): Promise<SentryMetrics | null>;
export declare const sentryService: {
    isConfigured: typeof isConfigured;
    getMetrics: typeof getMetrics;
};
export type { SentryMetrics };
//# sourceMappingURL=sentryService.d.ts.map