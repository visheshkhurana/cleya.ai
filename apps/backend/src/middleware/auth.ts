import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';
import { securityLogger } from '../services/securityLogger';
import {
  verifyAccessToken,
  isTokenBlacklisted,
  checkSessionActivity,
  updateLastActive,
} from '../services/tokenService';

export interface AuthPayload {
  userId: string;
  email: string;
  role: 'user' | 'admin';
}

type UserTier = 'FREE' | 'PRO' | 'ENTERPRISE';

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
      userTier?: UserTier;
      tokenJti?: string;
      tokenExp?: number;
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
    securityLogger.authEvent(req, 'TOKEN_INVALID', 'FAILURE', null, { reason: 'missing_token' });
    throw new AppError(401, 'Missing or invalid authorization', 'UNAUTHORIZED');
  }

  try {
    const payload = verifyAccessToken(token);

    (async () => {
      try {
        if (payload.jti && await isTokenBlacklisted(payload.jti)) {
          return next(new AppError(401, 'Token has been revoked', 'TOKEN_REVOKED'));
        }

        const sessionActive = await checkSessionActivity(payload.userId);
        if (!sessionActive) {
          return next(new AppError(401, 'Session expired due to inactivity', 'SESSION_EXPIRED'));
        }

        req.user = {
          userId: payload.userId,
          email: payload.email,
          role: payload.role,
        };
        req.tokenJti = payload.jti;
        req.tokenExp = payload.exp;

        updateLastActive(payload.userId).catch(() => {});

        next();
      } catch (err) {
        next(err);
      }
    })();
  } catch {
    securityLogger.authEvent(req, 'TOKEN_INVALID', 'FAILURE', null, { reason: 'invalid_or_expired' });
    throw new AppError(401, 'Invalid or expired token', 'TOKEN_EXPIRED');
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.role?.toUpperCase() !== 'ADMIN') {
    securityLogger.authEvent(req, 'ROLE_CHECK_FAILURE', 'FAILURE', req.user?.userId ?? null, { requiredRole: 'ADMIN', actualRole: req.user?.role });
    throw new AppError(403, 'Admin access required', 'FORBIDDEN');
  }
  next();
}
