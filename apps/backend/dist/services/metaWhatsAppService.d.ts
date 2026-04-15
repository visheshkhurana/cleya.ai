export declare class MetaWhatsAppService {
    private token;
    private phoneId;
    private wabaId;
    private appSecret;
    private verifyToken;
    constructor();
    isConfigured(): boolean;
    getVerifyToken(): string | null;
    private formatPhone;
    private callApi;
    verifyWebhookSignature(rawBody: Buffer, signature: string): boolean;
    optInUser(phoneNumber: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    optOutUser(phoneNumber: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    sendWhatsApp(userId: string, phoneNumber: string, message: string): Promise<{
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
    }>;
    sendWhatsAppDirect(phoneNumber: string, message: string): Promise<{
        success: boolean;
        error?: string;
        httpStatus?: number;
        response?: any;
    }>;
    sendTemplate(userId: string, phoneNumber: string, templateName: string, params?: string[]): Promise<{
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
    }>;
    sendImage(userId: string, phoneNumber: string, imageUrl: string, caption?: string): Promise<{
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
    }>;
    sendWhatsAppButton(userId: string, phoneNumber: string, bodyText: string, buttons: Array<{
        id: string;
        title: string;
    }>): Promise<{
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
    }>;
    listTemplates(): Promise<{
        success: boolean;
        data?: any;
        error?: string;
    }>;
    registerTemplate(name: string, category: string, language: string, components: any[]): Promise<{
        success: boolean;
        data?: any;
        error?: string;
    }>;
    handleWebhook(payload: any): Promise<void>;
    private updateMessageStatus;
    private handleInboundFrom;
}
export declare const metaWhatsAppService: MetaWhatsAppService;
//# sourceMappingURL=metaWhatsAppService.d.ts.map