export declare class WhatsAppBotService {
    private formatPhone;
    private getUserMode;
    handleInboundMessage(from: string, text: string, messageId?: string): Promise<void>;
    private startOnboardingViaWhatsApp;
    private handleOnboardingMessage;
    private handleFormInput;
    private checkPendingMatchResponse;
    private handleMatchResponse;
    private handleIntroFeedback;
    private handleAIChatMessage;
    private parseChoiceInput;
    private getOptionValue;
    private getOptionLabel;
    private parseFormFieldValue;
    private buildFieldPrompt;
    private sendReply;
    private logInboundMessage;
    getWhatsAppActivity(limit?: number): Promise<{
        messages: ({
            user: {
                id: string;
                name: string | null;
                email: string;
                phone: string | null;
                whatsappOptedIn: boolean;
                whatsappPhone: string | null;
            };
        } & {
            status: import(".prisma/client").$Enums.MessageStatus;
            userId: string;
            id: string;
            channel: import(".prisma/client").$Enums.MessageChannel;
            createdAt: Date;
            updatedAt: Date;
            recipientPhone: string;
            content: string;
            messageSid: string | null;
            errorMessage: string | null;
            provider: string | null;
        })[];
        stats: {
            optedInUsers: number;
            totalMessages: number;
            inboundCount: number;
            outboundCount: number;
            deliveredCount: number;
            failedCount: number;
            activeConversations: number;
        };
    }>;
    getWhatsAppUsers(): Promise<{
        messageCount: number;
        id: string;
        createdAt: Date;
        name: string | null;
        email: string;
        phone: string | null;
        whatsappOptedIn: boolean;
        whatsappPhone: string | null;
        messageRecords: {
            status: import(".prisma/client").$Enums.MessageStatus;
            createdAt: Date;
            content: string;
        }[];
    }[]>;
}
export declare const whatsappBotService: WhatsAppBotService;
//# sourceMappingURL=whatsappBotService.d.ts.map