/**
 * Google Analytics Data API v1 — OAuth2-based access.
 *
 * Uses the same Google OAuth client credentials as Google Ads
 * (GOOGLE_ADS_CLIENT_ID / GOOGLE_ADS_CLIENT_SECRET) with a dedicated
 * refresh token (GOOGLE_ANALYTICS_REFRESH_TOKEN) that carries the
 * analytics.readonly scope.
 *
 * Scope: https://www.googleapis.com/auth/analytics.readonly
 */
declare function isConfigured(): boolean;
declare function getAccessToken(): Promise<string>;
export declare function getPageViews(startDate: string, endDate: string): Promise<{
    pageViews: number;
    sessions: number;
}>;
export declare function getTopPages(startDate: string, endDate: string, limit?: number): Promise<any>;
export declare function getTrafficSources(startDate: string, endDate: string): Promise<any>;
export declare function getUserMetrics(startDate: string, endDate: string): Promise<{
    totalUsers: number;
    newUsers: number;
    sessions: number;
    averageSessionDuration: number;
    bounceRate: number;
}>;
export declare function getRealTimeUsers(): Promise<{
    activeUsers: number;
}>;
export declare function getAnalyticsSummary(): Promise<object>;
export declare const analyticsOAuthService: {
    isConfigured: typeof isConfigured;
    getAccessToken: typeof getAccessToken;
};
export {};
//# sourceMappingURL=analyticsService.d.ts.map