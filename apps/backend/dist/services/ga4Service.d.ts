interface GA4Metrics {
    pageviews: number;
    sessions: number;
    activeUsers: number;
    bounceRate: number;
    topPages: {
        page: string;
        views: number;
    }[];
    trafficSources: {
        source: string;
        sessions: number;
    }[];
    geoBreakdown: {
        country: string;
        users: number;
    }[];
    dailyTrend: {
        date: string;
        pageviews: number;
        sessions: number;
        users: number;
    }[];
}
declare function isConfigured(): boolean;
declare function getAuthMethod(): 'oauth' | 'service_account' | 'none';
declare function getMetrics(dateRange?: '7d' | '30d' | '90d'): Promise<GA4Metrics | null>;
export declare const ga4Service: {
    isConfigured: typeof isConfigured;
    getAuthMethod: typeof getAuthMethod;
    getMetrics: typeof getMetrics;
};
export type { GA4Metrics };
//# sourceMappingURL=ga4Service.d.ts.map