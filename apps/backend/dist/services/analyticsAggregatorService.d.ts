import { type GA4Metrics } from './ga4Service';
import { type InstagramMetrics } from './instagramService';
import { type PostHogMetrics } from './posthogService';
import { type SentryMetrics } from './sentryService';
type DateRange = '7d' | '30d' | '90d';
declare function getGA4(dateRange?: DateRange): Promise<{
    configured: boolean;
    data: GA4Metrics | null;
    error?: string;
}>;
declare function getInstagram(dateRange?: DateRange): Promise<{
    configured: boolean;
    data: InstagramMetrics | null;
    error?: string;
}>;
declare function getPostHog(dateRange?: DateRange): Promise<{
    configured: boolean;
    data: PostHogMetrics | null;
    error?: string;
}>;
declare function getSentry(dateRange?: DateRange): Promise<{
    configured: boolean;
    data: SentryMetrics | null;
    error?: string;
}>;
declare function getOverview(dateRange?: DateRange): Promise<{
    ga4: {
        configured: boolean;
        hasData: boolean;
        summary: {
            pageviews: number;
            sessions: number;
            activeUsers: number;
            bounceRate: number;
        } | null;
    };
    instagram: {
        configured: boolean;
        hasData: boolean;
        summary: {
            followers: number;
            followerGrowth: number;
            reach: number;
            engagementRate: number;
        } | null;
    };
    posthog: {
        configured: boolean;
        hasData: boolean;
        summary: {
            uniqueUsers: number;
            totalEvents: number;
            avgSessionDurationSeconds: number;
        } | null;
    };
    sentry: {
        configured: boolean;
        hasData: boolean;
        summary: {
            totalErrors: number;
            unresolvedIssues: number;
        } | null;
    };
}>;
export declare const analyticsAggregatorService: {
    getGA4: typeof getGA4;
    getInstagram: typeof getInstagram;
    getPostHog: typeof getPostHog;
    getSentry: typeof getSentry;
    getOverview: typeof getOverview;
};
export {};
//# sourceMappingURL=analyticsAggregatorService.d.ts.map