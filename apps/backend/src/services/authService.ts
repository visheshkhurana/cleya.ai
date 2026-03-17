import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@boardy/db';
import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler';
import { AuthPayload } from '../middleware/auth';

export class AuthService {
  async signup(data: { email: string; password: string; phone?: string }) {
    // Check existing user
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email: data.email },
          ...(data.phone ? [{ phone: data.phone }] : []),
        ],
      },
    });

    if (existing) {
      throw new AppError(409, 'User already exists with this email or phone', 'USER_EXISTS');
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        phone: data.phone,
        passwordHash,
        profile: {
          create: {}, // Create empty profile
        },
      },
      include: { profile: true },
    });

    const token = this.generateToken(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profile: user.profile,
      },
      token,
    };
  }

  async login(data: { email: string; password: string }) {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
      include: { profile: true },
    });

    if (!user) {
      throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
    }

    const validPassword = await bcrypt.compare(data.password, user.passwordHash);
    if (!validPassword) {
      throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
    }

    if (!user.isActive) {
      throw new AppError(403, 'Account is disabled', 'ACCOUNT_DISABLED');
    }

    const token = this.generateToken(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profile: user.profile,
      },
      token,
    };
  }

  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
    }

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      profile: user.profile,
      createdAt: user.createdAt,
    };
  }

  async findOrCreateGoogleUser(googleProfile: { email: string; name?: string; googleId: string }) {
    let user = await prisma.user.findUnique({
      where: { email: googleProfile.email },
      include: { profile: true },
    });

    if (user) {
      if (!user.isActive) {
        throw new AppError(403, 'Account is disabled', 'ACCOUNT_DISABLED');
      }
      const token = this.generateToken(user);
      return {
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone,
          role: user.role,
          profile: user.profile,
        },
        token,
        isNew: false,
      };
    }

    user = await prisma.user.create({
      data: {
        email: googleProfile.email,
        passwordHash: '',
        profile: {
          create: {
            ...(googleProfile.name ? { currentRole: googleProfile.name } : {}),
          },
        },
      },
      include: { profile: true },
    });

    const token = this.generateToken(user);
    return {
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profile: user.profile,
      },
      token,
      isNew: true,
    };
  }

  private generateToken(user: { id: string; email: string; role: string }): string {
    const payload: AuthPayload = {
      userId: user.id,
      email: user.email,
      role: user.role as 'user' | 'admin',
    };

    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN,
    } as jwt.SignOptions);
  }
}

export const authService = new AuthService();
