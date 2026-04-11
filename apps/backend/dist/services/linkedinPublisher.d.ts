interface LinkedInPostResult {
    success: boolean;
    postId?: string;
    error?: string;
}
declare function isConfigured(): boolean;
declare function publishTextPost(text: string): Promise<LinkedInPostResult>;
declare function publishImagePost(text: string, imageUrl: string): Promise<LinkedInPostResult>;
declare function publishArticle(text: string, articleUrl: string, title?: string, description?: string): Promise<LinkedInPostResult>;
export declare const linkedinPublisher: {
    isConfigured: typeof isConfigured;
    publishTextPost: typeof publishTextPost;
    publishImagePost: typeof publishImagePost;
    publishArticle: typeof publishArticle;
};
export {};
//# sourceMappingURL=linkedinPublisher.d.ts.map