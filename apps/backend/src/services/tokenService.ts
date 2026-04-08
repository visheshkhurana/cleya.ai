import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '@cleya/db';
import { env } from '../config/env';
import { AuthPayload } from '../middleware/auth';

function parseExpiryToMs(expiry: string): number {
  const match = expiry.match(/^(\d+)\s*(ms?|s|m|h|d|w|y)$/i);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const val = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  switch (unit) {
    case 'ms': return val;
    case 's': return val * 1000;
    case 'm': return val * 60 * 1000;
    case 'h': return val * 60 * 60 * 1000;
    case 'd': return val * 24 * 60 * 60 * 1000;
    case 'w': return val * 7 * 24 * 60 * 60 * 1000;
    case 'y': return val * 365 * 24 * 60 * 60 * 1000;
    default: return 7 * 24 * 60 * 60 * 1000;
  }
}

let _warnedHs256 = false;

function getSigningOptions(): { algorithm: jwt.Algorithm; key: string | Buffer } {
  if (env.JWT_PRIVATE_KEY) {
    return { algorithm: 'RS256', key: env.JWT_PRIVATE_KEY };
  }
  if (!_warnedHs256) {
    console.warn('[Security] JWT_PRIVATE_KEY not set — using HS256 fallback. Set JWT_PRIVATE_KEY and JWT_PUBLIC_KEY for RS256.');
    _warnedHs256 = true;
  }
  return { algorithm: 'HS256', key: env.JWT_SECRET };
}

function getVerifyOptions(): { algorithms: jwt.Algorithm[]; key: string | Buffer } {
  if (env.JWT_PUBLIC_KEY && env.JWT_PRIVATE_KEY) {
    return { algorithms: ['RS256'], key: env.JWT_PUBLIC_KEY };
  }
  if (env.JWT_PRIVATE_KEY) {
    return { algorithms: ['RS256'], key: env.JWT_PRIVATE_KEY };
  }
  if (env.JWT_PUBLIC_KEY && !env.JWT_PRIVATE_KEY) {
    throw new Error('JWT_PUBLIC_KEY set without JWT_PRIVATE_KEY — misconfiguration');
  }
  return { algorithms: ['HS256'], key: env.JWT_SECRET };
}

export function generateAccessToken(user: { id: string; email: string; role: string }): string {
  const jti = crypto.randomUUID();
  const payload: AuthPayload & { jti: string } = {
    userId: user.id,
    email: user.email,
    role: user.role as 'user' | 'admin',
    jti,
  };

  const { algorithm, key } = getSigningOptions();
  return jwt.sign(payload, key, {
    algorithm,
    expiresIn: env.JWT_EXPIRES_IN,
    notBefore: 0,
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AuthPayload & { jti: string; iat: number; exp: number } {
  const { algorithms, key } = getVerifyOptions();
  return jwt.verify(token, key, { algorithms }) as AuthPayload & { jti: string; iat: number; exp: number };
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function generateRefreshToken(userId: string, familyId?: string): Promise<string> {
  const rawToken = crypto.randomBytes(48).toString('base64url');
  const tokenHash = hashToken(rawToken);
  const family = familyId || crypto.randomUUID();
  const refreshExpiryMs = parseExpiryToMs(env.REFRESH_TOKEN_EXPIRES_IN);
  const expiresAt = new Date(Date.now() + refreshExpiryMs);

  await prisma.refreshToken.create({
    data: {
      tokenHash,
      userId,
      familyId: family,
      expiresAt,
    },
  });

  const payload = JSON.stringify({ t: rawToken, f: family });
  return Buffer.from(payload).toString('base64url');
}

function decodeRefreshTokenValue(encoded: string): { rawToken: string; familyId: string } {
  try {
    const json = Buffer.from(encoded, 'base64url').toString('utf8');
    const parsed = JSON.parse(json);
    if (!parsed.t || !parsed.f) {
      throw new Error('INVALID_REFRESH_TOKEN');
    }
    return { rawToken: parsed.t, familyId: parsed.f };
  } catch {
    throw new Error('INVALID_REFRESH_TOKEN');
  }
}

export async function rotateRefreshToken(encodedToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  userId: string;
}> {
  const { rawToken } = decodeRefreshTokenValue(encodedToken);
  const tokenHash = hashToken(rawToken);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.refreshToken.updateMany({
      where: {
        tokenHash,
        usedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { usedAt: new Date() },
    });

    if (updated.count === 0) {
      const existing = await tx.refreshToken.findUnique({
        where: { tokenHash },
      });

      if (!existing) {
        throw new Error('INVALID_REFRESH_TOKEN');
      }

      if (existing.usedAt) {
        await tx.refreshToken.updateMany({
          where: { familyId: existing.familyId },
          data: { revokedAt: new Date() },
        });
        throw new Error('REFRESH_TOKEN_REUSE');
      }

      if (existing.revokedAt) {
        throw new Error('INVALID_REFRESH_TOKEN');
      }

      if (existing.expiresAt < new Date()) {
        throw new Error('REFRESH_TOKEN_EXPIRED');
      }

      throw new Error('INVALID_REFRESH_TOKEN');
    }

    const tokenRecord = await tx.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!tokenRecord || !tokenRecord.user) {
      throw new Error('INVALID_REFRESH_TOKEN');
    }

    if (!tokenRecord.user.isActive) {
      throw new Error('ACCOUNT_DISABLED');
    }

    await tx.user.update({
      where: { id: tokenRecord.userId },
      data: { lastActiveAt: new Date() },
    });

    const newRawToken = crypto.randomBytes(48).toString('base64url');
    const newTokenHash = hashToken(newRawToken);
    const refreshExpiryMs = parseExpiryToMs(env.REFRESH_TOKEN_EXPIRES_IN);
    const newExpiresAt = new Date(Date.now() + refreshExpiryMs);

    await tx.refreshToken.create({
      data: {
        tokenHash: newTokenHash,
        userId: tokenRecord.userId,
        familyId: tokenRecord.familyId,
        expiresAt: newExpiresAt,
      },
    });

    const newRefreshPayload = JSON.stringify({ t: newRawToken, f: tokenRecord.familyId });
    const newRefreshToken = Buffer.from(newRefreshPayload).toString('base64url');
    const accessToken = generateAccessToken(tokenRecord.user);

    return {
      accessToken,
      refreshToken: newRefreshToken,
      userId: tokenRecord.userId,
    };
  });
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeTokenFamily(familyId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { familyId },
    data: { revokedAt: new Date() },
  });
}

export async function blacklistAccessToken(jti: string, userId: string, exp: number): Promise<void> {
  const expiresAt = new Date(exp * 1000);
  await prisma.tokenBlacklist.upsert({
    where: { jti },
    create: { jti, userId, expiresAt },
    update: {},
  });
}

export async function isTokenBlacklisted(jti: string): Promise<boolean> {
  const entry = await prisma.tokenBlacklist.findUnique({ where: { jti } });
  return !!entry;
}

export async function checkSessionActivity(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lastActiveAt: true },
  });

  if (!user?.lastActiveAt) {
    return true;
  }

  const elapsed = Date.now() - user.lastActiveAt.getTime();
  return elapsed < env.SESSION_INACTIVITY_TIMEOUT;
}

export async function updateLastActive(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { lastActiveAt: new Date() },
  });
}

export async function cleanupExpiredTokens(): Promise<void> {
  const now = new Date();
  await prisma.refreshToken.deleteMany({
    where: { expiresAt: { lt: now } },
  });
  await prisma.tokenBlacklist.deleteMany({
    where: { expiresAt: { lt: now } },
  });
}
