declare const FREE_MATCH_LIMIT = 5;
declare class RazorpayService {
    private keyId;
    private keySecret;
    private planId;
    private webhookSecret;
    private baseUrl;
    constructor();
    isConfigured(): boolean;
    private getAuthHeader;
    private apiRequest;
    createSubscription(userId: string, email: string): Promise<{
        subscriptionId: string;
        keyId: string;
        shortUrl?: string;
    }>;
    getSubscriptionStatus(userId: string): Promise<{
        tier: import(".prisma/client").$Enums.UserTier;
        matchesUsed: number;
        matchesRemaining: number;
        freeMatchLimit: number;
        bonusMatches: number;
        subscription: {
            status: import(".prisma/client").$Enums.SubscriptionStatus;
            currentPeriodStart: Date | null;
            currentPeriodEnd: Date | null;
            cancelledAt: Date | null;
        } | null;
    }>;
    verifyWebhookSignature(body: string, signature: string): boolean;
    handleWebhookEvent(event: string, payload: any): Promise<void>;
    checkPaywall(userId: string): Promise<{
        allowed: boolean;
        matchesUsed: number;
        matchesRemaining: number;
        tier: string;
        freeMatchLimit: number;
        bonusMatches: number;
    }>;
    incrementMatchesUsed(userId: string): Promise<void>;
}
export declare const razorpayService: RazorpayService;
export { FREE_MATCH_LIMIT };
//# sourceMappingURL=razorpayService.d.ts.map