interface AgentRunResult {
    agentName: string;
    success: boolean;
    durationMs: number;
    recordsProcessed?: number;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
}
interface AgentHealth {
    agentName: string;
    consecutiveFailures: number;
    lastRunAt: Date | null;
    lastSuccess: Date | null;
    successRate: number;
    totalRuns: number;
}
export declare class AgentMonitor {
    logRun(result: AgentRunResult): Promise<void>;
    getHealth(agentName: string): Promise<AgentHealth>;
    getAllHealth(): Promise<AgentHealth[]>;
    startRun(agentName: string): () => Promise<void>;
}
export declare const agentMonitor: AgentMonitor;
export {};
//# sourceMappingURL=agentMonitor.d.ts.map