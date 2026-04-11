interface InstagramMetrics {
    accountInfo: {
        username: string;
        name: string;
        followersCount: number;
        followsCount: number;
        mediaCount: number;
        profilePictureUrl: string;
    };
    followerGrowth: number;
    postReach: number;
    impressions: number;
    engagementRate: number;
    topPosts: {
        id: string;
        caption: string;
        mediaUrl: string;
        mediaType: string;
        likeCount: number;
        commentsCount: number;
        timestamp: string;
    }[];
    audienceDemographics: {
        cities: {
            name: string;
            value: number;
        }[];
        countries: {
            name: string;
            value: number;
        }[];
        genderAge: {
            name: string;
            value: number;
        }[];
    };
}
declare function isConfigured(): boolean;
declare function getConnectionMethod(): 'graph_api' | 'meta_ads' | 'ayrshare' | 'none';
declare function getMetrics(dateRange?: '7d' | '30d' | '90d'): Promise<InstagramMetrics | null>;
interface InstagramPublishResult {
    success: boolean;
    postId?: string;
    error?: string;
}
declare function publishSingleImage(imageUrl: string, caption: string): Promise<InstagramPublishResult>;
declare function publishCarousel(imageUrls: string[], caption: string): Promise<InstagramPublishResult>;
declare function publishTextPost(caption: string): Promise<InstagramPublishResult>;
export declare const instagramService: {
    isConfigured: typeof isConfigured;
    getConnectionMethod: typeof getConnectionMethod;
    getMetrics: typeof getMetrics;
    publishSingleImage: typeof publishSingleImage;
    publishCarousel: typeof publishCarousel;
    publishTextPost: typeof publishTextPost;
};
export type { InstagramMetrics, InstagramPublishResult };
//# sourceMappingURL=instagramService.d.ts.map