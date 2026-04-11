import { Request } from 'express';
export declare function logAdminAction(req: Request, action: string, options?: {
    targetId?: string;
    metadata?: Record<string, unknown>;
}): Promise<void>;
export declare function getAuditLogs(options: {
    page?: number;
    limit?: number;
    action?: string;
    actorId?: string;
    targetId?: string;
}): Promise<{
    logs: ({
        actor: {
            id: string;
            email: string;
            role: import(".prisma/client").$Enums.Role;
            name: string | null;
        };
        target: {
            id: string;
            email: string;
            role: import(".prisma/client").$Enums.Role;
            name: string | null;
        } | null;
    } & {
        id: string;
        timestamp: Date;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        action: string;
        ipAddress: string | null;
        userAgent: string | null;
        actorId: string;
        targetId: string | null;
    })[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}>;
//# sourceMappingURL=auditLogger.d.ts.map