export declare function chatWithCleo(userId: string, message: string, conversationHistory?: {
    role: 'user' | 'assistant';
    content: string;
}[]): Promise<{
    content: string;
    success: boolean;
    fallback: boolean;
}>;
//# sourceMappingURL=ai.d.ts.map