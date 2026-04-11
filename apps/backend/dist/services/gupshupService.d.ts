export declare class GupshupService {
    private apiKey;
    private appName;
    private sourceNumber;
    private templateNamespace;
    private baseUrl;
    constructor();
    isConfigured(): boolean;
    private formatPhone;
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
    sendWhatsAppDirect(phoneNumber: string, message: string): Promise<{
        success: boolean;
        error?: string;
        httpStatus?: number;
        response?: any;
    }>;
    sendTemplate(userId: string, phoneNumber: string, templateId: string, params?: string[]): Promise<{
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
    sendImage(userId: string, phoneNumber: string, imageUrl: string, caption?: string): Promise<{
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
    handleWebhook(payload: any): Promise<void>;
    private handleMetaWebhook;
    updateMessageStatus(gsId: string, newStatus: string, errorDetails?: {
        code?: string | number;
        message?: string;
    }): Promise<void>;
    private handleInboundFrom;
    registerTemplate(elementName: string, languageCode: string, category: string, templateType: string, content: string, example?: string): Promise<{
        success: boolean;
        data?: any;
        error?: string;
    }>;
    listTemplates(): Promise<{
        success: boolean;
        data?: any;
        error?: string;
    }>;
}
export declare const gupshupService: GupshupService;
//# sourceMappingURL=gupshupService.d.ts.map