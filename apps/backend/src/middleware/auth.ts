import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from './errorHandler';
import { securityLogger } from '../services/securityLogger';

export type RoleType = 'VIEWER' | 'USER' | 'MANAGER' | 'ADMIN';
export type UserTier = 'FREE' | 'PRO' | 'ENTERPRISE';

const ROLE_HIERARCHY: Record<RoleType, number> = {
  VIEWER: 0,
  USER: 1,
  MANAGER: 2,
  ADMIN: 3,
};

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

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  let token: string | undefined;

  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    token = header.split(' ')[1];
  }

  if (!token && req.cookies?.cleo_auth) {
    token = req.cookies.cleo_auth;
  }

  if (!token) {
    throw new AppError(401, 'Missing or invalid authorization', 'UNAUTHORIZED');
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthPayload;

    if (payload.mfaPending) {
      throw new AppError(401, 'MFA verification required', 'MFA_REQUIRED');
    }

    const role = (payload.role || 'VIEWER').toUpperCase() as RoleType;

    if (role === 'ADMIN') {
      const iat = payload.issuedAt || (payload as any).iat;
      if (iat) {
        const now = Math.floor(Date.now() / 1000);
        const ADMIN_TIMEOUT = 30 * 60;
        if (now - iat > ADMIN_TIMEOUT) {
          throw new AppError(401, 'Admin session expired due to inactivity', 'SESSION_EXPIRED');
        }
      }
    }

    req.user = { ...payload, role };
    next();
  } catch (err) {
    if (err instanceof AppError) throw err;
    securityLogger.authEvent(req, 'TOKEN_INVALID', 'FAILURE', null, { reason: 'invalid_or_expired' });
    throw new AppError(401, 'Invalid or expired token', 'TOKEN_EXPIRED');
  }
}

export function requireRole(minimumRole: RoleType) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const userRole = (req.user?.role || 'VIEWER').toUpperCase() as RoleType;
    const requiredLevel = ROLE_HIERARCHY[minimumRole];
    const userLevel = ROLE_HIERARCHY[userRole] ?? -1;

    if (userLevel < requiredLevel) {
      securityLogger.authEvent(req, 'ROLE_CHECK_FAILURE', 'FAILURE', req.user?.userId ?? null, {
        requiredRole: minimumRole,
        actualRole: userRole,
      });
      throw new AppError(403, `${minimumRole} access required`, 'FORBIDDEN');
    }
    next();
  };
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if ((req.user?.role || '').toUpperCase() !== 'ADMIN') {
    securityLogger.authEvent(req, 'ROLE_CHECK_FAILURE', 'FAILURE', req.user?.userId ?? null, { requiredRole: 'ADMIN', actualRole: req.user?.role });
    throw new AppError(403, 'Admin access required', 'FORBIDDEN');
  }
  next();
}

export function requireReauth(req: Request, _res: Response, next: NextFunction) {
  let elevatedToken: string | undefined;

  const header = req.headers['x-elevated-token'] as string;
  if (header) {
    elevatedToken = header;
  }

  if (!elevatedToken) {
    throw new AppError(403, 'Re-authentication required for this operation', 'REAUTH_REQUIRED');
  }

  try {
    const payload = jwt.verify(elevatedToken, env.JWT_SECRET) as any;
    if (!payload.elevated || payload.userId !== req.user?.userId) {
      throw new AppError(403, 'Invalid elevated session', 'REAUTH_REQUIRED');
    }
    req.isElevated = true;
    next();
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(403, 'Elevated session expired, please re-authenticate', 'REAUTH_REQUIRED');
  }
}

export { ROLE_HIERARCHY };
