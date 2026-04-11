interface PipelineConfig {
    name: string;
    maxFailureRate: number;
    maxQueueDepth: number;
    maxDurationMs: number;
}
export declare class PipelineMonitor {
    private pipelineName;
    private config;
    constructor(name: string, config?: Partial<Omit<PipelineConfig, 'name'>>);
    startPipeline(): void;
    startStage(stageName: string, recordsIn: number): void;
    completeStage(recordsOut: number, errors?: number): void;
    updateQueueDepth(depth: number): void;
    completePipeline(): void;
    failPipeline(error: string): void;
    getStatus(): {
        pipeline: string;
        running: boolean;
        durationMs: number;
        stagesCompleted: number;
        currentStage: string | null;
        totalRecordsProcessed: number;
        totalErrors: number;
        queueDepth: number;
    } | null;
}
export {};
//# sourceMappingURL=pipelineMonitor.d.ts.map