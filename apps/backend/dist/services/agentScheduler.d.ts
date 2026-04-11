declare class AgentScheduler {
    private tasks;
    private started;
    private running;
    getScheduleInfo(): Record<string, string>;
    start(): Promise<void>;
    stop(): void;
    reload(): Promise<void>;
    executeAgent(agentId: string, taskContext?: string): Promise<any>;
    private runAutonomousWorkflow;
    private handleOrchestratorDelegation;
    private processContentCalendarCron;
    private sendDailyBriefing;
    private processAllTasks;
    isStarted(): boolean;
    isRunning(): boolean;
}
export declare const agentScheduler: AgentScheduler;
export {};
//# sourceMappingURL=agentScheduler.d.ts.map