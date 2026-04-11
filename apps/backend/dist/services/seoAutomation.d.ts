/**
 * Run a full daily SEO optimization routine for cleya.ai.
 * Called by the Scout agent's scheduled run.
 */
export declare function runDailySEORoutine(): Promise<string>;
/**
 * Fetch SEO daily reports from Supabase.
 */
export declare function getSEOReports(limit?: number): Promise<any[]>;
/**
 * Fetch a specific day's SEO report.
 */
export declare function getSEOReportByDate(date: string): Promise<any | null>;
/**
 * Fetch the most recent SEO report.
 */
export declare function getLatestSEOReport(): Promise<any | null>;
//# sourceMappingURL=seoAutomation.d.ts.map