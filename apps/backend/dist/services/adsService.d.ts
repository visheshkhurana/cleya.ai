/**
 * Ads Service — full campaign lifecycle for Meta, LinkedIn, and Google Ads.
 *
 * SAFETY:
 *   - All campaigns created in PAUSED state (1-hour hold before auto-activation allowed)
 *   - Budget cap: ₹10,000/day per campaign
 *   - Total daily spend cap: ₹50,000 across all platforms
 *   - All budget changes and activations logged to audit trail
 */
interface CreateCampaignParams {
    platform: 'meta' | 'linkedin' | 'google';
    name: string;
    budget: number;
    targeting?: Record<string, any>;
    objective?: string;
}
interface AdsResponse {
    success: boolean;
    data?: any;
    error?: string;
}
declare function enforceBudgetCap(budget: number): number;
declare function checkTotalSpendCap(additionalSpend: number): Promise<{
    allowed: boolean;
    currentSpend: number;
}>;
declare function createMetaAdSet(params: {
    campaignId: string;
    name: string;
    dailyBudget: number;
    targeting: Record<string, any>;
    billingEvent?: string;
    optimizationGoal?: string;
    startTime?: string;
}): Promise<AdsResponse>;
declare function createMetaAd(params: {
    adSetId: string;
    name: string;
    pageId: string;
    creative: {
        title: string;
        body: string;
        linkUrl: string;
        imageUrl?: string;
        videoUrl?: string;
        callToAction?: string;
    };
}): Promise<AdsResponse>;
declare function getAdSetInsights(adSetId: string, datePreset?: string): Promise<AdsResponse>;
declare function getCampaignInsights(campaignId: string, datePreset?: string): Promise<AdsResponse>;
declare function createGoogleAdGroup(params: {
    campaignResourceName: string;
    name: string;
    cpcBidMicros?: string;
    keywords: string[];
}): Promise<AdsResponse>;
declare function createGoogleAd(params: {
    adGroupResourceName: string;
    headlines: string[];
    descriptions: string[];
    finalUrl: string;
    path1?: string;
    path2?: string;
}): Promise<AdsResponse>;
declare function getGoogleCampaignPerformance(dateRange?: {
    start: string;
    end: string;
}): Promise<AdsResponse>;
declare function createLinkedInAdCreative(params: {
    campaignId: string;
    commentary: string;
    title?: string;
    contentUrl?: string;
    imageUrl?: string;
}): Promise<AdsResponse>;
declare function getLinkedInCampaignAnalytics(campaignIds: string[], dateRange?: {
    start: string;
    end: string;
}): Promise<AdsResponse>;
declare function createCampaign(params: CreateCampaignParams): Promise<AdsResponse>;
declare function getCampaigns(platform: string): Promise<AdsResponse>;
declare function activateCampaign(platform: string, campaignId: string): Promise<AdsResponse>;
declare function pauseCampaign(platform: string, campaignId: string): Promise<AdsResponse>;
declare function updateBudget(platform: string, resourceId: string, newBudget: number): Promise<AdsResponse>;
declare function optimizeCampaigns(platform: string): Promise<AdsResponse>;
export declare const adsService: {
    createCampaign: typeof createCampaign;
    getCampaigns: typeof getCampaigns;
    activateCampaign: typeof activateCampaign;
    pauseCampaign: typeof pauseCampaign;
    updateBudget: typeof updateBudget;
    optimizeCampaigns: typeof optimizeCampaigns;
    enforceBudgetCap: typeof enforceBudgetCap;
    checkTotalSpendCap: typeof checkTotalSpendCap;
    BUDGET_CAP_INR: number;
    TOTAL_DAILY_SPEND_CAP: number;
    createMetaAdSet: typeof createMetaAdSet;
    createMetaAd: typeof createMetaAd;
    getAdSetInsights: typeof getAdSetInsights;
    getCampaignInsights: typeof getCampaignInsights;
    createGoogleAdGroup: typeof createGoogleAdGroup;
    createGoogleAd: typeof createGoogleAd;
    getGoogleCampaignPerformance: typeof getGoogleCampaignPerformance;
    createLinkedInAdCreative: typeof createLinkedInAdCreative;
    getLinkedInCampaignAnalytics: typeof getLinkedInCampaignAnalytics;
};
export {};
//# sourceMappingURL=adsService.d.ts.map