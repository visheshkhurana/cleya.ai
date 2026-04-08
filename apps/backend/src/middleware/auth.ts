import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from './errorHandler';

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
    req.user = payload;
    next();
  } catch {
    throw new AppError(401, 'Invalid or expired token', 'TOKEN_EXPIRED');
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.role?.toUpperCase() !== 'ADMIN') {
    throw new AppError(403, 'Admin access required', 'FORBIDDEN');
  }
  next();
}
