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

// Express 4 doesn't auto-forward rejected promises from async middleware,
// so this is a sync wrapper that calls next(err) explicitly.
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
    return next(new AppError(401, 'Missing or invalid authorization', 'UNAUTHORIZED'));
  }

  let payload: AuthPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
  } catch {
    securityLogger.authEvent(req, 'TOKEN_INVALID', 'FAILURE', null, { reason: 'invalid_or_expired' });
    return next(new AppError(401, 'Invalid or expired token', 'TOKEN_EXPIRED'));
  }

  if (payload.mfaPending) {
    return next(new AppError(401, 'MFA verification required', 'MFA_REQUIRED'));
  }

  const role = (payload.role || 'VIEWER').toUpperCase() as RoleType;

  if (role === 'ADMIN') {
    const iat = payload.issuedAt || (payload as any).iat;
    if (iat) {
      const now = Math.floor(Date.now() / 1000);
      const ADMIN_TIMEOUT = 12 * 60 * 60;
      if (now - iat > ADMIN_TIMEOUT) {
        return next(new AppError(401, 'Admin session expired due to inactivity', 'SESSION_EXPIRED'));
      }
    }
  }

  // Self-service auth routes an unverified user must still be able to call.
  const AUTH_FLOW_ALLOWLIST = new Set([
    '/me',
    '/logout',
    '/verify-email',
    '/resend-verification',
    '/refresh',
  ]);
  if (AUTH_FLOW_ALLOWLIST.has(req.path)) {
    req.user = { ...payload, role };
    return next();
  }

  (async () => {
    try {
      const { prisma } = await import('@cleya/db');
      const u = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { isActive: true, emailVerified: true },
      });
      if (!u) {
        return next(new AppError(401, 'Account not found', 'UNAUTHORIZED'));
      }
      if (!u.isActive && !u.emailVerified) {
        return next(new AppError(
          403,
          'Please verify your email to activate your account.',
          'EMAIL_NOT_VERIFIED'
        ));
      }
      if (!u.isActive) {
        return next(new AppError(403, 'Account is disabled', 'ACCOUNT_DISABLED'));
      }
      req.user = { ...payload, role };
      next();
    } catch (err) {
      console.error('[authenticate] account-state lookup failed:', err);
      next(new AppError(503, 'Authentication service unavailable', 'AUTH_UNAVAILABLE'));
    }
  })();
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

/**
 * Requires the authenticated user's email to be verified before running the
 * downstream handler. Use on actions that send outbound communication or
 * create user-visible records (match requests, direct messages, etc.).
 *
 * Must be mounted after `authenticate`. Looks the user up fresh so a recent
 * verification is reflected without forcing a token refresh.
 */
export function requireEmailVerified(req: Request, _res: Response, next: NextFunction) {
  if (!req.user?.userId) {
    return next(new AppError(401, 'Authentication required', 'UNAUTHORIZED'));
  }
  (async () => {
    try {
      const { prisma } = await import('@cleya/db');
      const u = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        select: { emailVerified: true },
      });
      if (!u?.emailVerified) {
        return next(new AppError(403, 'Please verify your email before performing this action.', 'EMAIL_NOT_VERIFIED'));
      }
      next();
    } catch (err) {
      console.error('[requireEmailVerified] lookup failed:', err);
      next(new AppError(503, 'Verification service unavailable', 'AUTH_UNAVAILABLE'));
    }
  })();
}

export { ROLE_HIERARCHY };
