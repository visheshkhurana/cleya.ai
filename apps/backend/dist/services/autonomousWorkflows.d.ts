/**
 * Autonomous Workflows — scheduled automation routines for all Cleya Control Tower agents.
 *
 * Each function gathers data from relevant APIs, uses the LLM router for insights/content,
 * saves reports to Supabase, and executes actions where appropriate.
 */
export declare function runNexusDailyBrief(): Promise<string>;
export declare function runMavenContentPost(timeSlot: 'morning' | 'afternoon' | 'evening'): Promise<string>;
export declare function runLedgerFinancialMonitor(): Promise<string>;
export declare function runLedgerWeeklyReview(): Promise<string>;
export declare function runSentinelHealthCheck(): Promise<string>;
export declare function runAllyEngagementCheck(): Promise<string>;
export declare function runCatalystGrowthAnalysis(): Promise<string>;
export declare function runCatalystWeeklyReview(): Promise<string>;
export declare function runCloserSalesPipeline(): Promise<string>;
export declare function runAdCampaignAutomation(): Promise<string>;
//# sourceMappingURL=autonomousWorkflows.d.ts.map