import type { DailyBriefing } from './founderModeService';
interface AgentNotification {
    agentId: string;
    agentName: string;
    status: 'success' | 'error';
    duration: number;
    outputSummary: string;
    error?: string;
    retryCount?: number;
}
export declare function notifyAgentCompletion(notification: AgentNotification): Promise<void>;
export declare function sendBriefingNotifications(briefing: DailyBriefing): Promise<void>;
export {};
//# sourceMappingURL=agentNotifier.d.ts.map