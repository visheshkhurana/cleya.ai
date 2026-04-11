export declare class AutomationService {
    onOnboardingComplete(userId: string, context: Record<string, any>): Promise<void>;
    private scheduleAutoMatch;
    private scheduleDealPartnerScout;
    private scheduleVenturePartnerMatch;
    private scheduleEventRegistration;
    private scheduleCall;
    private sendWelcomeMessages;
    schedulePostEventFollowUp(eventId: string, delayMs?: number): Promise<void>;
    triggerCallForUser(userId: string, phoneNumber: string): Promise<null>;
    triggerMessageForUser(userId: string, phoneNumber: string, channel: 'SMS' | 'WHATSAPP', message: string): Promise<{
        status: string;
        messageSid: string | undefined;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        provider: string | null;
        channel: import(".prisma/client").$Enums.MessageChannel;
        userId: string;
        errorMessage: string | null;
        content: string;
        recipientPhone: string;
    } | {
        status: string;
        errorMessage: any;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        provider: string | null;
        channel: import(".prisma/client").$Enums.MessageChannel;
        userId: string;
        content: string;
        recipientPhone: string;
        messageSid: string | null;
    }>;
}
export declare const automationService: AutomationService;
//# sourceMappingURL=automationService.d.ts.map