/**
 * Ayrshare Service — social media posting, scheduling, and analytics via Ayrshare API.
 * Docs: https://docs.ayrshare.com
 */
interface AyrsharePostParams {
    content: string;
    platforms: string[];
    mediaUrls?: string[];
}
interface AyrshareScheduleParams {
    content: string;
    platforms: string[];
    scheduledDate: string;
    mediaUrls?: string[];
}
interface AyrshareAnalyticsParams {
    postId: string;
}
interface AyrshareResponse {
    success: boolean;
    data?: any;
    error?: string;
}
declare function isConfigured(): boolean;
declare function post(params: AyrsharePostParams): Promise<AyrshareResponse>;
declare function schedulePost(params: AyrshareScheduleParams): Promise<AyrshareResponse>;
declare function getAnalytics(params: AyrshareAnalyticsParams): Promise<AyrshareResponse>;
declare function getHistory(): Promise<AyrshareResponse>;
declare function deletePost(postId: string): Promise<AyrshareResponse>;
export declare const ayrshareService: {
    isConfigured: typeof isConfigured;
    post: typeof post;
    schedulePost: typeof schedulePost;
    getAnalytics: typeof getAnalytics;
    getHistory: typeof getHistory;
    deletePost: typeof deletePost;
};
export {};
//# sourceMappingURL=ayrshareService.d.ts.map