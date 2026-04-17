import { Request, Response, NextFunction } from 'express';
export type RoleType = 'VIEWER' | 'USER' | 'MANAGER' | 'ADMIN';
export type UserTier = 'FREE' | 'PRO' | 'ENTERPRISE';
declare const ROLE_HIERARCHY: Record<RoleType, number>;
export interface AuthPayload {
    userId: string;
    email: string;
    role: RoleType;
    issuedAt?: number;
    mfaPending?: boolean;
}
declare global {
    namespace Express {
        interface Request {
            user?: AuthPayload;
            userTier?: UserTier;
            isElevated?: boolean;
        }
    }
}
export declare function authenticate(req: Request, _res: Response, next: NextFunction): void;
export declare function requireRole(minimumRole: RoleType): (req: Request, _res: Response, next: NextFunction) => void;
export declare function requireAdmin(req: Request, _res: Response, next: NextFunction): void;
export declare function requireReauth(req: Request, _res: Response, next: NextFunction): void;
/**
 * Requires the authenticated user's email to be verified before running the
 * downstream handler. Use on actions that send outbound communication or
 * create user-visible records (match requests, direct messages, etc.).
 *
 * Must be mounted after `authenticate`. Looks the user up fresh so a recent
 * verification is reflected without forcing a token refresh.
 */
export declare function requireEmailVerified(req: Request, _res: Response, next: NextFunction): void;
export { ROLE_HIERARCHY };
//# sourceMappingURL=auth.d.ts.map