export declare function chatWithSecretary(userId: string, message: string): Promise<{
    content: string;
    actions?: any[];
}>;
export declare function executeSecretaryAction(userId: string, action: any): Promise<{
    success: boolean;
    message: string;
    data?: any;
}>;
export declare function generateDailyDigest(userId: string): Promise<string>;
export declare function getConversationHistory(userId: string, limit?: number): Promise<any[]>;
export declare function clearConversationHistory(userId: string): Promise<void>;
export declare function onMatchAccepted(matchId: string, userAId: string, userBId: string): Promise<void>;
//# sourceMappingURL=secretaryService.d.ts.map