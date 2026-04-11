import { type AutonomyLevel, type AgentGuardrails } from './guardrailsService';
export declare function resolveAgentId(id: string): string;
interface AgentRunResult {
    agentId: string;
    status: 'success' | 'error';
    duration: number;
    outputSummary: string;
    fullOutput?: string;
    contentItems: number;
    error?: string;
    retryCount?: number;
}
type AgentStatus = 'idle' | 'running' | 'completed' | 'failed' | 'scheduled';
interface AgentStatusInfo {
    agentId: string;
    name: string;
    codename: string;
    emoji: string;
    color: string;
    status: AgentStatus;
    lastRunAt: string | null;
    lastRunDuration: number | null;
    lastRunStatus: string | null;
    nextRunAt: string | null;
    enabled: boolean;
    cronExpression: string | null;
    autonomyLevel: AutonomyLevel;
    guardrails: AgentGuardrails;
}
export declare function hydrateAgentStatesFromDB(): Promise<void>;
export declare function runAgent(agentId: string, taskContext?: string, assignedModel?: string): Promise<AgentRunResult>;
export declare function processAgentTasks(agentId: string): Promise<number>;
export declare function getAgentStatuses(scheduleInfo?: Record<string, string>): AgentStatusInfo[];
export declare function setAgentScheduleStatus(agentId: string, status: AgentStatus): void;
export declare function isAgentEnabled(agentId: string): boolean;
export declare function updateAgentConfig(agentId: string, config: {
    enabled?: boolean;
    cronExpression?: string;
    cronDescription?: string;
    autonomyLevel?: AutonomyLevel;
    guardrails?: Partial<AgentGuardrails>;
}): Promise<void>;
export declare function emergencyStopAllAgents(): Promise<{
    stoppedAgents: string[];
}>;
export declare function getAgentAutonomyLevel(agentId: string): AutonomyLevel;
export declare function getAgentGuardrails(agentId: string): AgentGuardrails;
export declare function getAgentRunHistory(agentId: string, limit?: number): Promise<any[]>;
export declare function getAgentAccountability(agentId: string): Promise<{
    totalRuns: number;
    successCount: number;
    failureCount: number;
    successRate: number;
    avgDuration: number;
    contentItemsGenerated: number;
}>;
export declare const KNOWN_AGENT_IDS: string[];
export declare const AGENT_DEFINITIONS: Record<string, {
    name: string;
    codename: string;
    emoji: string;
    color: string;
    systemPrompt: string;
    contentType: string;
    channel: string;
}>;
export {};
//# sourceMappingURL=agentRunner.d.ts.map