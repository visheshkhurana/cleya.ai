export interface TestResult {
    name: string;
    category: 'page_load' | 'api' | 'auth' | 'agent' | 'performance' | 'navigation' | 'form' | 'security';
    status: 'pass' | 'fail' | 'warning';
    responseTime?: number;
    statusCode?: number;
    error?: string;
    details?: string;
}
export declare function runDailyQARoutine(): Promise<{
    summary: string;
    results: TestResult[];
}>;
export declare function runSinglePageTest(url: string): Promise<TestResult>;
export declare function runSingleAPITest(url: string, method?: string): Promise<TestResult>;
export declare function runSingleAgentTest(agentId: string): Promise<TestResult>;
export declare function getQAReports(limit?: number): Promise<any[]>;
export declare function getQAReportByDate(date: string): Promise<any | null>;
export declare function getLatestQAReport(): Promise<any | null>;
//# sourceMappingURL=qaAutomation.d.ts.map