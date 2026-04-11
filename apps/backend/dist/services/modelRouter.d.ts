import { type LLMProvider } from '@cleya/ai';
export interface ModelRoutingDecision {
    primaryModel: string;
    primaryProvider: LLMProvider;
    fallbackModel: string;
    fallbackProvider: LLMProvider;
    reason: string;
}
export type TaskType = 'content_generation' | 'linkedin_post' | 'instagram_post' | 'social_caption' | 'newsletter' | 'blog_article' | 'thought_leadership' | 'support_reply' | 'support_faq' | 'financial_report' | 'financial_analysis' | 'tech_report' | 'security_audit' | 'growth_experiment' | 'sales_outreach' | 'operational_plan' | 'indian_language_content' | 'research' | 'quick_task';
export type QualityLevel = 'economy' | 'standard' | 'premium';
export interface RoutingInput {
    agentId: string;
    taskType?: TaskType | string;
    qualityLevel?: QualityLevel;
    language?: string;
    complexity?: 'low' | 'medium' | 'high';
}
export declare function routeModel(input: RoutingInput): ModelRoutingDecision;
export declare function inferTaskType(agentId: string, taskContext?: string): TaskType | string;
export declare const HIGH_COST_THRESHOLD_INR = 500;
export declare const USD_TO_INR = 85;
export declare function isHighCostTask(costUSD: number): boolean;
//# sourceMappingURL=modelRouter.d.ts.map