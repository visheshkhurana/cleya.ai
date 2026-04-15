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
        body: string;
        userId: string;
        id: string;
        channel: import(".prisma/client").$Enums.NotificationChannel;
        createdAt: Date;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        title: string;
        event: import(".prisma/client").$Enums.NotificationEvent;
        sentAt: Date | null;
        readAt: Date | null;
    }>;
    sendMultiChannel(userId: string, event: NotifEvent, title: string, body: string, metadata?: Record<string, any>): Promise<PromiseSettledResult<{
        body: string;
        userId: string;
        id: string;
        channel: import(".prisma/client").$Enums.NotificationChannel;
        createdAt: Date;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        title: string;
        event: import(".prisma/client").$Enums.NotificationEvent;
        sentAt: Date | null;
        readAt: Date | null;
    }>[]>;
    private sendInApp;
    private sendWhatsApp;
    private sendSMS;
    private sendEmail;
    getNotifications(userId: string, limit?: number): Promise<{
        body: string;
        userId: string;
        id: string;
        channel: import(".prisma/client").$Enums.NotificationChannel;
        createdAt: Date;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        title: string;
        event: import(".prisma/client").$Enums.NotificationEvent;
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