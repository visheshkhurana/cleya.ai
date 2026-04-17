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
        success: boolean;
        messageId: string;
        status: import("twilio/lib/rest/api/v2010/account/message").MessageStatus;
    } | {
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
    } | null>;
    triggerWelcome(userId: string): Promise<{
        success: boolean;
        messageId: string;
        status: import("twilio/lib/rest/api/v2010/account/message").MessageStatus;
    } | {
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
    } | null>;
    triggerMatchFound(userId: string, matchUserId: string, matchScore?: number): Promise<{
        success: boolean;
        messageId: string;
        status: import("twilio/lib/rest/api/v2010/account/message").MessageStatus;
    } | {
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
    } | null>;
    triggerMatchAccepted(userId: string, matchUserId: string): Promise<{
        success: boolean;
        messageId: string;
        status: import("twilio/lib/rest/api/v2010/account/message").MessageStatus;
    } | {
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
    } | null>;
    triggerIntroSent(userId: string, introName: string, introRole?: string, introReason?: string): Promise<{
        success: boolean;
        messageId: string;
        status: import("twilio/lib/rest/api/v2010/account/message").MessageStatus;
    } | {
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
    } | null>;
    triggerIntroAccepted(userId: string, introName: string): Promise<{
        success: boolean;
        messageId: string;
        status: import("twilio/lib/rest/api/v2010/account/message").MessageStatus;
    } | {
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
    } | null>;
    triggerMeetingScheduled(userId: string, meetingTitle: string, withName: string, proposedTime?: string): Promise<{
        success: boolean;
        messageId: string;
        status: import("twilio/lib/rest/api/v2010/account/message").MessageStatus;
    } | {
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
    } | null>;
    triggerMeetingConfirmed(userId: string, meetingTitle: string, withName: string, confirmedTime: string, location?: string): Promise<{
        success: boolean;
        messageId: string;
        status: import("twilio/lib/rest/api/v2010/account/message").MessageStatus;
    } | {
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
    } | null>;
    triggerMeetingReminder(userId: string, meetingTitle: string, withName: string, timeUntil: string, location?: string, meetingLink?: string): Promise<{
        success: boolean;
        messageId: string;
        status: import("twilio/lib/rest/api/v2010/account/message").MessageStatus;
    } | {
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
    } | null>;
    triggerProfileIncomplete(userId: string, completionPct: number): Promise<{
        success: boolean;
        messageId: string;
        status: import("twilio/lib/rest/api/v2010/account/message").MessageStatus;
    } | {
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
    } | null>;
    triggerEventRegistration(userId: string, eventName: string, eventDate: string, eventLocation?: string): Promise<{
        success: boolean;
        messageId: string;
        status: import("twilio/lib/rest/api/v2010/account/message").MessageStatus;
    } | {
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
    } | null>;
    triggerEventFollowup(userId: string, eventName: string, matchList: string): Promise<{
        success: boolean;
        messageId: string;
        status: import("twilio/lib/rest/api/v2010/account/message").MessageStatus;
    } | {
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
    } | null>;
    triggerWeeklyDigest(userId: string, stats: {
        newMatches: number;
        introsSent: number;
        meetingsScheduled: number;
    }): Promise<{
        success: boolean;
        messageId: string;
        status: import("twilio/lib/rest/api/v2010/account/message").MessageStatus;
    } | {
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
    } | null>;
    triggerFollowUp(userId: string): Promise<{
        success: boolean;
        messageId: string;
        status: import("twilio/lib/rest/api/v2010/account/message").MessageStatus;
    } | {
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
    } | null>;
    private getUserWithPhone;
}
export declare const whatsappTemplates: WhatsAppTemplateService;
//# sourceMappingURL=whatsappTemplates.d.ts.map