export type AutonomyLevel = 'manual' | 'semi_autonomous' | 'autonomous';
export interface AgentGuardrails {
    maxActionsPerDay: number;
    maxSpendPerDay: number;
    maxPostsPerDay: number;
    contentBlocklist: string[];
}
export declare const DEFAULT_GUARDRAILS: AgentGuardrails;
export type RiskScore = 1 | 2 | 3 | 4 | 5;
export interface RiskAssessment {
    score: RiskScore;
    factors: string[];
    requiresApproval: boolean;
}
export declare function scoreContentRisk(content: string, actionType?: string): RiskAssessment;
export type ActionRiskLevel = 'low' | 'high';
export declare function classifyActionRisk(actionType: string): ActionRiskLevel;
export interface GuardrailCheckResult {
    allowed: boolean;
    reason?: string;
    escalated: boolean;
    riskScore?: RiskScore;
    riskFactors?: string[];
}
export declare function checkGuardrails(agentId: string, actionType: string, guardrails: AgentGuardrails, content?: string, spendAmount?: number): Promise<GuardrailCheckResult>;
export declare function shouldAutoExecute(autonomyLevel: AutonomyLevel, riskScore: RiskScore): 'execute' | 'queue_for_approval';
export declare function logExecution(params: {
    agentId: string;
    actionType: string;
    actionDescription: string;
    autonomyLevel: AutonomyLevel;
    guardrailsChecked: string[];
    guardrailResult: 'passed' | 'blocked' | 'escalated';
    executionResult: 'success' | 'error' | 'queued';
    details?: Record<string, any>;
    spendAmount?: number;
}): Promise<void>;
export declare function logAudit(params: {
    agentId: string;
    actionType: string;
    actionDescription: string;
    entityType?: string;
    entityId?: string;
    riskScore?: number;
    costAmount?: number;
    costCurrency?: string;
    inputSummary?: string;
    outputSummary?: string;
    status?: string;
    metadata?: Record<string, any>;
}): Promise<void>;
//# sourceMappingURL=guardrailsService.d.ts.map