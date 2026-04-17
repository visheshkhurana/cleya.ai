declare class TwilioWhatsAppService {
    private client;
    private getClient;
    isConfigured(): boolean;
    private formatPhone;
    private resolveTemplateSid;
    private extractRecipientName;
    sendWhatsApp(userId: string, phoneNumber: string, message: string, recipientName?: string): Promise<{
        success: boolean;
        messageId: string;
        status: import("twilio/lib/rest/api/v2010/account/message").MessageStatus;
    } | null>;
    sendWhatsAppDirect(phoneNumber: string, message: string, recipientName?: string): Promise<{
        success: boolean;
        messageId: string;
        status: import("twilio/lib/rest/api/v2010/account/message").MessageStatus;
    } | null>;
    sendTemplate(userId: string, phoneNumber: string, templateName: string, params?: string[]): Promise<{
        success: boolean;
        messageId: string;
        status: import("twilio/lib/rest/api/v2010/account/message").MessageStatus;
    } | null>;
    sendImage(userId: string, phoneNumber: string, imageUrl: string, caption?: string): Promise<{
        success: boolean;
        messageId: string;
    }>;
    sendWhatsAppButton(userId: string, phoneNumber: string, bodyText: string, buttons: Array<{
        id: string;
        title: string;
    }>): Promise<{
        success: boolean;
        messageId: string;
        status: import("twilio/lib/rest/api/v2010/account/message").MessageStatus;
    } | null>;
    optInUser(phoneNumber: string): Promise<{
        success: boolean;
    }>;
    optOutUser(phoneNumber: string): Promise<{
        success: boolean;
    }>;
    handleStatusCallback(body: any): Promise<{
        messageId: any;
        status: any;
    }>;
    handleInbound(body: any): Promise<{
        phone: any;
        message: any;
        messageId: any;
        numMedia: any;
    }>;
}
export declare const twilioWhatsAppService: TwilioWhatsAppService;
export {};
//# sourceMappingURL=twilioWhatsAppService.d.ts.map