interface AuditLogEntry {
    userId: string;
    endpoint: string;
    provider?: string;
    model?: string;
    inputLength: number;
    outputLength: number;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    latencyMs: number;
    promptInjectionDetected?: boolean;
    piiRedacted?: boolean;
    redactionDetails?: string[];
    outputTruncated?: boolean;
    agentId?: string;
    userTier?: string;
    success?: boolean;
    errorMessage?: string;
    inputContent?: string;
    outputContent?: string;
}
export declare function logAIInteraction(entry: AuditLogEntry): Promise<void>;
export declare function trackUsageAndAlert(provider: string, model: string, tokens: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
}, isError?: boolean): Promise<void>;
export {};
//# sourceMappingURL=aiAuditService.d.ts.map