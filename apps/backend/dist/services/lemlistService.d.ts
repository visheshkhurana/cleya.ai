export declare function addLead(params: {
    campaignId: string;
    email: string;
    firstName?: string;
    lastName?: string;
    companyName?: string;
    linkedinUrl?: string;
    icebreaker?: string;
    phone?: string;
}): Promise<any>;
export declare function getLead(email: string): Promise<any>;
export declare function markInterested(campaignId: string, email: string): Promise<any>;
export declare function markNotInterested(campaignId: string, email: string): Promise<any>;
export declare function unsubscribeLead(campaignId: string, email: string): Promise<any>;
export declare function pauseLead(email: string): Promise<any>;
export declare function resumeLead(email: string): Promise<any>;
//# sourceMappingURL=lemlistService.d.ts.map