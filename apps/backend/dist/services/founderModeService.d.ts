export interface Decision {
    id: number;
    title: string;
    context: string;
    options: string[];
    requesting_agent: string;
    urgency: 'low' | 'medium' | 'high' | 'critical';
    status: 'pending' | 'approved' | 'rejected' | 'deferred';
    chosen_option: string | null;
    outcome: string | null;
    founder_notes: string | null;
    created_at: string;
    decided_at: string | null;
}
export interface DebateEntry {
    id: number;
    decision_id: number;
    agent_id: string;
    agent_name: string;
    position: 'for' | 'against' | 'neutral';
    argument: string;
    data_points: Record<string, any>;
    created_at: string;
}
export interface DailyBriefing {
    date: string;
    metrics: Record<string, any>;
    agentActivity: any[];
    pendingDecisions: Decision[];
    pendingContent: any[];
    priorityItems: any[];
    actionList: string[];
}
export declare function ensureFounderModeTables(): Promise<void>;
export declare function createDecision(data: {
    title: string;
    context: string;
    options: string[];
    requesting_agent: string;
    urgency: string;
}): Promise<Decision>;
export declare function getDecisions(filters?: {
    status?: string;
    urgency?: string;
    limit?: number;
}): Promise<Decision[]>;
export declare function updateDecisionStatus(id: number, status: 'approved' | 'rejected' | 'deferred', chosenOption?: string, founderNotes?: string): Promise<void>;
export declare function updateDecisionOutcome(id: number, outcome: string): Promise<void>;
export declare function triggerDebate(decisionId: number): Promise<DebateEntry[]>;
export declare function getDebateEntries(decisionId: number): Promise<DebateEntry[]>;
export declare function generateDailyBriefing(): Promise<DailyBriefing>;
export declare function getPriorityInbox(): Promise<{
    pendingDecisions: Decision[];
    pendingContent: any[];
    agentErrors: any[];
    criticalAlerts: any[];
    totalCount: number;
}>;
export declare function getLatestBriefing(): Promise<any | null>;
//# sourceMappingURL=founderModeService.d.ts.map