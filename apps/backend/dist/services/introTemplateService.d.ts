export declare class IntroTemplateService {
    ensureDefaultsSeeded(): Promise<void>;
    list(userId: string): Promise<{
        defaults: {
            body: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            category: string;
            description: string | null;
            variables: string[];
            ownerId: string | null;
            isDefault: boolean;
            isPro: boolean;
        }[];
        custom: {
            body: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            category: string;
            description: string | null;
            variables: string[];
            ownerId: string | null;
            isDefault: boolean;
            isPro: boolean;
        }[];
    }>;
    createCustom(userId: string, data: {
        name: string;
        category: string;
        body: string;
        description?: string;
    }): Promise<{
        body: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        category: string;
        description: string | null;
        variables: string[];
        ownerId: string | null;
        isDefault: boolean;
        isPro: boolean;
    }>;
    updateCustom(userId: string, id: string, data: {
        name?: string;
        body?: string;
        description?: string;
        category?: string;
    }): Promise<{
        body: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        category: string;
        description: string | null;
        variables: string[];
        ownerId: string | null;
        isDefault: boolean;
        isPro: boolean;
    }>;
    deleteCustom(userId: string, id: string): Promise<import(".prisma/client").Prisma.BatchPayload>;
    fillTemplate(body: string, vars: Record<string, string | undefined>): string;
    buildVariablesForMatch(matchId: string, senderUserId: string): Promise<Record<string, string>>;
}
export declare const introTemplateService: IntroTemplateService;
//# sourceMappingURL=introTemplateService.d.ts.map