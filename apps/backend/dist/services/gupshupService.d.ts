export declare class GupshupService {
    private apiKey;
    private appName;
    private sourceNumber;
    private templateNamespace;
    private baseUrl;
    constructor();
    isConfigured(): boolean;
    private formatPhone;
    /**
     * Opt-in a user for WhatsApp messaging by updating the local database.
     *
     * The Gupshup opt-in API (https://api.gupshup.io/sm/api/v1/app/opt/in/{appName})
     * was deprecated as of September 1, 2024. Gupshup no longer manages opt-in/opt-out
     * state and no longer checks it when sending messages.
     * See: https://support.gupshup.io/hc/en-us/articles/35183519921689-Prepare-for-Sunset-of-Optin-Optout-service-by-Gupshup-before-31st-Aug-2024
     */
    optInUser(phoneNumber: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Opt-out a user from WhatsApp messaging by updating the local database.
     *
     * The Gupshup opt-out API (https://api.gupshup.io/sm/api/v1/app/opt/out/{appName})
     * was deprecated as of September 1, 2024. Gupshup no longer manages opt-in/opt-out
     * state and no longer checks it when sending messages.
     * See: https://support.gupshup.io/hc/en-us/articles/35183519921689-Prepare-for-Sunset-of-Optin-Optout-service-by-Gupshup-before-31st-Aug-2024
     */
    optOutUser(phoneNumber: string): Promise<{
        success: boolean;
        error?: string;
    }>;
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
    sendWhatsAppDirect(phoneNumber: string, message: string): Promise<{
        success: boolean;
        error?: string;
        httpStatus?: number;
        response?: any;
    }>;
    sendTemplate(userId: string, phoneNumber: string, templateId: string, params?: string[]): Promise<{
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
    sendImage(userId: string, phoneNumber: string, imageUrl: string, caption?: string): Promise<{
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