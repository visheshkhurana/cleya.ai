/**
 * Ad Campaign Automation — autonomous multi-platform campaign management brain.
 *
 * Handles:
 *  - Campaign strategy generation
 *  - Multi-platform launch orchestration
 *  - Performance monitoring & auto-optimization (pause losers, scale winners, refresh creatives)
 *  - AI-generated ad copy per platform
 *  - Cross-platform reporting
 *
 * SAFETY:
 *  - ₹10,000/day per-campaign cap, ₹50,000 total daily cap
 *  - Campaigns start PAUSED for 1 hour before auto-activation
 *  - All changes logged to ad_audit_log
 */
export declare const CLEYA_AUDIENCES: Record<string, {
    interests: string[];
    titles: string[];
    geo: string;
    age_min: number;
    age_max: number;
}>;
export interface CampaignStrategy {
    objective: string;
    totalBudget: number;
    platforms: Array<'meta' | 'linkedin' | 'google'>;
    audienceSegments: string[];
    campaigns: Array<{
        platform: 'meta' | 'linkedin' | 'google';
        name: string;
        budget: number;
        audience: string;
        objective: string;
        adVariations: number;
    }>;
    schedule: {
        launchDate: string;
        reviewDate: string;
        endDate: string;
    };
    kpis: Record<string, string>;
}
export declare function generateCampaignStrategy(objective: string, totalBudget: number, platforms: Array<'meta' | 'linkedin' | 'google'>): Promise<CampaignStrategy>;
export declare function launchCampaign(strategy: CampaignStrategy): Promise<{
    success: boolean;
    results: Array<{
        platform: string;
        campaignName: string;
        success: boolean;
        data?: any;
        error?: string;
    }>;
}>;
interface OptimizationAction {
    platform: string;
    campaignId: string;
    campaignName: string;
    action: 'pause' | 'scale_up' | 'scale_down' | 'refresh_creative' | 'ab_test_pause';
    reason: string;
    details: Record<string, any>;
}
export declare function monitorAndOptimize(): Promise<{
    actions: OptimizationAction[];
    summary: string;
}>;
export declare function generateAdCopy(product: string, audience: string, platform: 'meta' | 'linkedin' | 'google'): Promise<{
    headline: string;
    body: string;
    callToAction: string;
    variations: Array<{
        headline: string;
        body: string;
    }>;
}>;
export declare function generateCampaignReport(dateRange?: {
    start: string;
    end: string;
}): Promise<{
    success: boolean;
    report: string;
    platformData: Record<string, any>;
}>;
export declare const adCampaignAutomation: {
    generateCampaignStrategy: typeof generateCampaignStrategy;
    launchCampaign: typeof launchCampaign;
    monitorAndOptimize: typeof monitorAndOptimize;
    generateAdCopy: typeof generateAdCopy;
    generateCampaignReport: typeof generateCampaignReport;
    CLEYA_AUDIENCES: Record<string, {
        interests: string[];
        titles: string[];
        geo: string;
        age_min: number;
        age_max: number;
    }>;
};
export {};
//# sourceMappingURL=adCampaignAutomation.d.ts.map