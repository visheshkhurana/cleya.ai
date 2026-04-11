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
export { ROLE_HIERARCHY };
//# sourceMappingURL=auth.d.ts.map