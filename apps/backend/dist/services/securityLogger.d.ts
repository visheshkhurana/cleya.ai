import { Request } from 'express';
import type { SecurityAction, SecurityResult } from '@cleya/db';
export declare const securityLogger: {
    authEvent(req: Request, action: SecurityAction, result: SecurityResult, userId?: string | null, metadata?: Record<string, unknown>): void;
    accessEvent(req: Request, action: SecurityAction, userId: string, metadata?: Record<string, unknown>): void;
    configEvent(req: Request, action: SecurityAction, userId: string, metadata?: Record<string, unknown>): void;
    suspiciousEvent(req: Request, action: SecurityAction, metadata?: Record<string, unknown>): void;
};
export declare function checkRepeatedAuthFailures(req: Request, ipAddress: string): Promise<void>;
export declare function startLogRetentionJob(): void;
//# sourceMappingURL=securityLogger.d.ts.map