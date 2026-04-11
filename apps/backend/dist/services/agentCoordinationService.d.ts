interface AgentCommRow {
    id: number;
    from_agent_id: string;
    to_agent_id: string;
    message_type: string;
    subject: string;
    content: string;
    priority: string;
    status: string;
    parent_id: number | null;
    metadata: any;
    created_at: Date;
}
declare const VALID_AGENTS: string[];
declare const AGENT_NAMES: Record<string, string>;
export declare function sendAgentToAgentMessage(fromAgentId: string, toAgentId: string, content: string, messageType?: 'message' | 'task_delegation' | 'status_update' | 'question' | 'insight' | 'task_result', subject?: string, priority?: 'critical' | 'urgent' | 'high' | 'normal' | 'low', metadata?: any): Promise<{
    success: boolean;
    messageId?: number;
    error?: string;
}>;
export declare function getAgentInbox(agentId: string, unreadOnly?: boolean, limit?: number): Promise<AgentCommRow[]>;
export declare function markMessagesRead(agentId: string, messageIds?: number[]): Promise<void>;
export declare function getTeamUpdates(agentId: string, limit?: number): Promise<AgentCommRow[]>;
export declare function getAllTeamComms(limit?: number): Promise<AgentCommRow[]>;
export declare function delegateTask(fromAgentId: string, toAgentId: string, taskDescription: string, priority?: 'urgent' | 'high' | 'normal' | 'low', context?: string): Promise<{
    success: boolean;
    messageId?: number;
    error?: string;
}>;
export declare function shareInsight(fromAgentId: string, insight: string, category?: string, importance?: 'critical' | 'high' | 'normal' | 'low'): Promise<{
    success: boolean;
    broadcastCount: number;
}>;
export declare function coordinateTask(coordinatorAgentId: string, taskDescription: string, involvedAgents: string[], priority?: 'urgent' | 'high' | 'normal' | 'low'): Promise<{
    success: boolean;
    delegations: {
        agentId: string;
        success: boolean;
        messageId?: number;
    }[];
}>;
export declare function processAgentInbox(agentId: string): Promise<{
    prompt: string;
    messageIds: number[];
}>;
export declare function formatTeamCommsForPrompt(comms: AgentCommRow[]): string;
export { VALID_AGENTS, AGENT_NAMES };
//# sourceMappingURL=agentCoordinationService.d.ts.map