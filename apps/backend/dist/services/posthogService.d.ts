interface PostHogMetrics {
    uniqueUsers: number;
    totalEvents: number;
    topEvents: {
        event: string;
        count: number;
    }[];
    avgEventsPerUser: number;
    dailyEventVolume: {
        date: string;
        count: number;
    }[];
    avgSessionDurationSeconds: number;
    retention: {
        day: number;
        percentage: number;
    }[];
    featureUsage: {
        feature: string;
        count: number;
    }[];
}
declare function isConfigured(): boolean;
declare function getMetrics(dateRange?: '7d' | '30d' | '90d'): Promise<PostHogMetrics | null>;
export declare const posthogService: {
    isConfigured: typeof isConfigured;
    getMetrics: typeof getMetrics;
};
export type { PostHogMetrics };
//# sourceMappingURL=posthogService.d.ts.map