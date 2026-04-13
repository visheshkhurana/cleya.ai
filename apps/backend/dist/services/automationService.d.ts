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
        userId: string;
        id: string;
        channel: import(".prisma/client").$Enums.MessageChannel;
        createdAt: Date;
        updatedAt: Date;
        recipientPhone: string;
        content: string;
        errorMessage: string | null;
        provider: string | null;
    } | {
        status: string;
        errorMessage: any;
        userId: string;
        id: string;
        channel: import(".prisma/client").$Enums.MessageChannel;
        createdAt: Date;
        updatedAt: Date;
        recipientPhone: string;
        content: string;
        messageSid: string | null;
        provider: string | null;
    }>;
}
export declare const automationService: AutomationService;
//# sourceMappingURL=automationService.d.ts.map