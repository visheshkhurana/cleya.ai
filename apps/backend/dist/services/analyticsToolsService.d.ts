declare function getPostHogInsights(dateRange?: string): Promise<Record<string, any>>;
declare function getGA4Insights(dateRange?: string): Promise<Record<string, any>>;
declare function getAnalyticsOverview(dateRange?: string): Promise<Record<string, any>>;
declare function getPlatformStats(): Promise<Record<string, any>>;
declare function getUserGrowthTrend(days?: number): Promise<Record<string, any>>;
declare function getFunnelMetrics(): Promise<Record<string, any>>;
declare function getAgentPerformanceData(): Promise<Record<string, any>>;
export declare const analyticsToolsService: {
    getPostHogInsights: typeof getPostHogInsights;
    getGA4Insights: typeof getGA4Insights;
    getAnalyticsOverview: typeof getAnalyticsOverview;
    getPlatformStats: typeof getPlatformStats;
    getUserGrowthTrend: typeof getUserGrowthTrend;
    getFunnelMetrics: typeof getFunnelMetrics;
    getAgentPerformanceData: typeof getAgentPerformanceData;
};
export {};
//# sourceMappingURL=analyticsToolsService.d.ts.map