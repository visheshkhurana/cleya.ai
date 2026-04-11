type NotifChannel = 'WHATSAPP' | 'EMAIL' | 'SMS' | 'IN_APP';
type NotifEvent = 'MATCH_FOUND' | 'INTRO_REQUEST' | 'INTRO_ACCEPTED' | 'INTRO_REJECTED' | 'PROFILE_COMPLETE' | 'CALL_SCHEDULED' | 'CALL_REMINDER';
interface NotificationPayload {
    userId: string;
    channel: NotifChannel;
    event: NotifEvent;
    title: string;
    body: string;
    metadata?: Record<string, any>;
}
export declare class NotificationService {
    send(payload: NotificationPayload): Promise<{
        id: string;
        createdAt: Date;
        channel: import(".prisma/client").$Enums.NotificationChannel;
        userId: string;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        event: import(".prisma/client").$Enums.NotificationEvent;
        title: string;
        body: string;
        sentAt: Date | null;
        readAt: Date | null;
    }>;
    sendMultiChannel(userId: string, event: NotifEvent, title: string, body: string, metadata?: Record<string, any>): Promise<PromiseSettledResult<{
        id: string;
        createdAt: Date;
        channel: import(".prisma/client").$Enums.NotificationChannel;
        userId: string;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        event: import(".prisma/client").$Enums.NotificationEvent;
        title: string;
        body: string;
        sentAt: Date | null;
        readAt: Date | null;
    }>[]>;
    private sendInApp;
    private sendWhatsApp;
    private sendSMS;
    private sendEmail;
    getNotifications(userId: string, limit?: number): Promise<{
        id: string;
        createdAt: Date;
        channel: import(".prisma/client").$Enums.NotificationChannel;
        userId: string;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        event: import(".prisma/client").$Enums.NotificationEvent;
        title: string;
        body: string;
        sentAt: Date | null;
        readAt: Date | null;
    }[]>;
    markRead(notificationId: string, userId: string): Promise<import(".prisma/client").Prisma.BatchPayload>;
    markAllRead(userId: string): Promise<import(".prisma/client").Prisma.BatchPayload>;
    getUnreadCount(userId: string): Promise<number>;
}
export declare const notificationService: NotificationService;
export {};
//# sourceMappingURL=notificationService.d.ts.map