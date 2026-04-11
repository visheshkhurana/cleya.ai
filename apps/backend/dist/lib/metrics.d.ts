interface MetricOptions {
    tags?: Record<string, string>;
}
declare function increment(metric: string, value?: number, opts?: MetricOptions): void;
declare function gauge(metric: string, value: number, opts?: MetricOptions): void;
declare function timing(metric: string, durationMs: number, opts?: MetricOptions): void;
export declare const metrics: {
    increment: typeof increment;
    gauge: typeof gauge;
    timing: typeof timing;
    agent: {
        runStarted(agentName: string): void;
        runCompleted(agentName: string, durationMs: number): void;
        runFailed(agentName: string): void;
    };
    ai: {
        callStarted(provider: string, model: string): void;
        callCompleted(provider: string, model: string, durationMs: number, tokens?: number): void;
        callFailed(provider: string, model: string): void;
    };
    api: {
        requestReceived(method: string, path: string): void;
        requestCompleted(method: string, path: string, statusCode: number, durationMs: number): void;
        requestFailed(method: string, path: string, statusCode: number): void;
    };
    db: {
        queryExecuted(operation: string, durationMs: number): void;
        queryFailed(operation: string): void;
        connectionPoolSize(size: number): void;
    };
    cache: {
        hit(key: string): void;
        miss(key: string): void;
    };
    message: {
        sent(channel: string): void;
        failed(channel: string): void;
    };
    user: {
        registered(): void;
        login(): void;
        profileCompleted(): void;
        activeSession(): void;
    };
};
export {};
//# sourceMappingURL=metrics.d.ts.map