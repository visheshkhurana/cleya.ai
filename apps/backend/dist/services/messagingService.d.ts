export declare class MessagingService {
    sendWhatsApp(userId: string, phoneNumber: string, message: string): Promise<{
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
    sendWhatsAppTemplate(userId: string, phoneNumber: string, templateId: string, params?: string[]): Promise<{
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
    sendWhatsAppImage(userId: string, phoneNumber: string, imageUrl: string, caption?: string): Promise<{
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
    sendSMS(userId: string, phoneNumber: string, message: string): Promise<{
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
    getActiveProvider(): string;
    getWelcomeMessage(userName?: string): string;
    getMatchNotificationMessage(matchName: string): string;
    getFollowUpMessage(): string;
    getMessageHistory(userId: string): Promise<{
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
    }[]>;
    getAllMessages(limit?: number): Promise<({
        user: {
            email: string;
            phone: string | null;
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