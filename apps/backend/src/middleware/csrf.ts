import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { env } from '../config/env';

const CSRF_HEADER = 'x-csrf-token';
const CSRF_COOKIE = 'cleo_csrf';
const TOKEN_EXPIRY = 8 * 60 * 60 * 1000;

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function signToken(token: string): string {
  const hmac = crypto.createHmac('sha256', env.JWT_SECRET);
  hmac.update(token);
  return `${token}.${hmac.digest('hex')}`;
}

function verifySignature(signedToken: string): string | null {
  const parts = signedToken.split('.');
  if (parts.length !== 2) return null;
  const [token, sig] = parts;
  if (!/^[0-9a-f]{64}$/i.test(token) || !/^[0-9a-f]{64}$/i.test(sig)) {
    return null;
  }
  const hmac = crypto.createHmac('sha256', env.JWT_SECRET);
  hmac.update(token);
  const expected = hmac.digest('hex');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) {
      return null;
    }
  } catch {
    return null;
  }
  return token;
}

export function csrfTokenProvider(_req: Request, res: Response) {
  const token = generateToken();
  const signed = signToken(token);
  const isProduction = env.NODE_ENV === 'production';

  res.cookie(CSRF_COOKIE, signed, {
    httpOnly: false,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: TOKEN_EXPIRY,
    path: '/',
  });

  res.json({ success: true, data: { csrfToken: signed } });
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return next();
  }

  const headerToken = req.headers[CSRF_HEADER] as string | undefined;
  const cookieToken = req.cookies?.[CSRF_COOKIE] as string | undefined;

  if (!headerToken || !cookieToken) {
    res.status(403).json({
      success: false,
      error: { message: 'CSRF token missing', code: 'CSRF_MISSING' },
    });
    return;
  }

  if (headerToken !== cookieToken) {
    res.status(403).json({
      success: false,
      error: { message: 'CSRF token mismatch', code: 'CSRF_MISMATCH' },
    });
    return;
  }

  const token = verifySignature(headerToken);
  if (!token) {
    res.status(403).json({
      success: false,
      error: { message: 'Invalid CSRF token', code: 'CSRF_INVALID' },
    });
    return;
  }

  next();
}
