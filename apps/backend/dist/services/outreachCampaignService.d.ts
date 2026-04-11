export declare function ensureOutreachTables(): Promise<void>;
export declare function createCampaign(params: {
    name: string;
    subjectLine: string;
    emailBody: string;
    targetSegment?: string;
    targetFilters?: Record<string, any>;
    sequenceSteps?: Array<{
        delayDays: number;
        subjectLine: string;
        emailBody: string;
    }>;
    scheduledAt?: string;
}): Promise<any>;
export declare function addRecipients(params: {
    campaignId: string;
    recipients: Array<{
        email: string;
        firstName?: string;
        lastName?: string;
        company?: string;
        role?: string;
        personalization?: Record<string, any>;
    }>;
}): Promise<any>;
export declare function launchCampaign(campaignId: string): Promise<any>;
export declare function getCampaignStats(campaignId?: string): Promise<any>;
export declare function getRecipientList(campaignId: string, status?: string): Promise<any>;
export declare function pauseCampaign(campaignId: string): Promise<any>;
//# sourceMappingURL=outreachCampaignService.d.ts.map