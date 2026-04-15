export interface TemplateConfig {
    id: string;
    name: string;
    description: string;
    buildMessage: (params: Record<string, string>) => string;
    gupshupTemplateId?: string;
    gupshupParamOrder?: string[];
}
export declare class WhatsAppTemplateService {
    getTemplate(templateId: string): TemplateConfig | undefined;
    getAllTemplates(): TemplateConfig[];
    sendTemplate(userId: string, phoneNumber: string, templateId: string, params: Record<string, string>): Promise<{
        status: string;
        messageSid: any;
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
    } | {
        success: boolean;
        messageId: string;
        status: import("twilio/lib/rest/api/v2010/account/message").MessageStatus;
    } | null>;
    triggerWelcome(userId: string): Promise<{
        status: string;
        messageSid: any;
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
    } | {
        success: boolean;
        messageId: string;
        status: import("twilio/lib/rest/api/v2010/account/message").MessageStatus;
    } | null>;
    triggerMatchFound(userId: string, matchUserId: string, matchScore?: number): Promise<{
        status: string;
        messageSid: any;
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
    } | {
        success: boolean;
        messageId: string;
        status: import("twilio/lib/rest/api/v2010/account/message").MessageStatus;
    } | null>;
    triggerMatchAccepted(userId: string, matchUserId: string): Promise<{
        status: string;
        messageSid: any;
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
    } | {
        success: boolean;
        messageId: string;
        status: import("twilio/lib/rest/api/v2010/account/message").MessageStatus;
    } | null>;
    triggerIntroSent(userId: string, introName: string, introRole?: string, introReason?: string): Promise<{
        status: string;
        messageSid: any;
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
    } | {
        success: boolean;
        messageId: string;
        status: import("twilio/lib/rest/api/v2010/account/message").MessageStatus;
    } | null>;
    triggerIntroAccepted(userId: string, introName: string): Promise<{
        status: string;
        messageSid: any;
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
    } | {
        success: boolean;
        messageId: string;
        status: import("twilio/lib/rest/api/v2010/account/message").MessageStatus;
    } | null>;
    triggerMeetingScheduled(userId: string, meetingTitle: string, withName: string, proposedTime?: string): Promise<{
        status: string;
        messageSid: any;
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
    } | {
        success: boolean;
        messageId: string;
        status: import("twilio/lib/rest/api/v2010/account/message").MessageStatus;
    } | null>;
    triggerMeetingConfirmed(userId: string, meetingTitle: string, withName: string, confirmedTime: string, location?: string): Promise<{
        status: string;
        messageSid: any;
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
    } | {
        success: boolean;
        messageId: string;
        status: import("twilio/lib/rest/api/v2010/account/message").MessageStatus;
    } | null>;
    triggerMeetingReminder(userId: string, meetingTitle: string, withName: string, timeUntil: string, location?: string, meetingLink?: string): Promise<{
        status: string;
        messageSid: any;
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
    } | {
        success: boolean;
        messageId: string;
        status: import("twilio/lib/rest/api/v2010/account/message").MessageStatus;
    } | null>;
    triggerProfileIncomplete(userId: string, completionPct: number): Promise<{
        status: string;
        messageSid: any;
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
    } | {
        success: boolean;
        messageId: string;
        status: import("twilio/lib/rest/api/v2010/account/message").MessageStatus;
    } | null>;
    triggerEventRegistration(userId: string, eventName: string, eventDate: string, eventLocation?: string): Promise<{
        status: string;
        messageSid: any;
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
    } | {
        success: boolean;
        messageId: string;
        status: import("twilio/lib/rest/api/v2010/account/message").MessageStatus;
    } | null>;
    triggerEventFollowup(userId: string, eventName: string, matchList: string): Promise<{
        status: string;
        messageSid: any;
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
    } | {
        success: boolean;
        messageId: string;
        status: import("twilio/lib/rest/api/v2010/account/message").MessageStatus;
    } | null>;
    triggerWeeklyDigest(userId: string, stats: {
        newMatches: number;
        introsSent: number;
        meetingsScheduled: number;
    }): Promise<{
        status: string;
        messageSid: any;
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
    } | {
        success: boolean;
        messageId: string;
        status: import("twilio/lib/rest/api/v2010/account/message").MessageStatus;
    } | null>;
    triggerFollowUp(userId: string): Promise<{
        status: string;
        messageSid: any;
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
    } | {
        success: boolean;
        messageId: string;
        status: import("twilio/lib/rest/api/v2010/account/message").MessageStatus;
    } | null>;
    private getUserWithPhone;
}
export declare const whatsappTemplates: WhatsAppTemplateService;
//# sourceMappingURL=whatsappTemplates.d.ts.map