export declare class MessagingService {
    sendWhatsApp(userId: string, phoneNumber: string, message: string): Promise<{
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
    sendWhatsAppTemplate(userId: string, phoneNumber: string, templateId: string, params?: string[]): Promise<{
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
    sendWhatsAppImage(userId: string, phoneNumber: string, imageUrl: string, caption?: string): Promise<{
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
    sendSMS(userId: string, phoneNumber: string, message: string): Promise<{
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
    getActiveProvider(): string;
    getWelcomeMessage(userName?: string): string;
    getMatchNotificationMessage(matchName: string): string;
    getFollowUpMessage(): string;
    getMessageHistory(userId: string): Promise<{
        status: import(".prisma/client").$Enums.MessageStatus;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        provider: string | null;
        channel: import(".prisma/client").$Enums.MessageChannel;
        userId: string;
        errorMessage: string | null;
        content: string;
        recipientPhone: string;
        messageSid: string | null;
    }[]>;
    getAllMessages(limit?: number): Promise<({
        user: {
            email: string;
            phone: string | null;
        };
    } & {
        status: import(".prisma/client").$Enums.MessageStatus;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        provider: string | null;
        channel: import(".prisma/client").$Enums.MessageChannel;
        userId: string;
        errorMessage: string | null;
        content: string;
        recipientPhone: string;
        messageSid: string | null;
    })[]>;
    getMessageStats(): Promise<{
        totalSMS: number;
        totalWhatsApp: number;
        delivered: number;
        failed: number;
        total: number;
    }>;
}
export declare const messagingService: MessagingService;
//# sourceMappingURL=messagingService.d.ts.map