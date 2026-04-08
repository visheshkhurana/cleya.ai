import bcrypt from 'bcryptjs';
import { prisma } from '@cleya/db';
import { AppError } from '../middleware/errorHandler';
import {
  generateAccessToken,
  generateRefreshToken,
} from './tokenService';

function isValidHttpsUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export class AuthService {
  async signup(data: { email: string; password: string; name?: string; persona?: string; phone?: string; utmSource?: string; utmMedium?: string; utmCampaign?: string }) {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email: data.email },
          ...(data.phone ? [{ phone: data.phone }] : []),
        ],
      },
    });

    if (existing) {
      throw new AppError(409, 'Unable to create account. Please try a different email.', 'SIGNUP_FAILED');
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        phone: data.phone,
        name: data.name,
        passwordHash,
        utmSource: data.utmSource,
        utmMedium: data.utmMedium,
        utmCampaign: data.utmCampaign,
        lastActiveAt: new Date(),
        profile: {
          create: data.persona ? { persona: data.persona as any } : {},
        },
      },
      include: { profile: true },
    });

    const token = generateAccessToken(user);
    const refreshToken = await generateRefreshToken(user.id);

    if (user.phone) {
      import('./gupshupService').then(({ gupshupService }) => {
        gupshupService.optInUser(user.phone!).then((optInResult) => {
          if (!optInResult?.success) {
            console.warn(`[Auth] WhatsApp opt-in failed for ${user.id}, skipping welcome`);
            return;
          }
          return prisma.user.update({
            where: { id: user.id },
            data: { whatsappOptedIn: true, whatsappPhone: user.phone },
          }).then(() => {
            return import('./whatsappTemplates').then(({ whatsappTemplates }) => {
              whatsappTemplates.triggerWelcome(user.id);
            });
          });
        }).catch((e) =>
          console.error('[Auth] Welcome WhatsApp failed:', e)
        );
      });
    }

    import('./slackService').then(({ slackService }) => {
      slackService.notifyUserRegistered({ id: user.id, email: user.email, name: user.name || undefined }).catch((e) =>
        console.log('[Auth] Slack notification failed:', e.message)
      );
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
        emailVerified: user.emailVerified,
        profile: user.profile,
      },
      token,
      refreshToken,
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

    const token = generateAccessToken(user);
    const refreshToken = await generateRefreshToken(user.id);

    await prisma.user.update({
      where: { id: user.id },
      data: { lastActiveAt: new Date() },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
        emailVerified: user.emailVerified,
        profile: user.profile,
      },
      token,
      refreshToken,
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
      name: user.name,
      phone: user.phone,
      role: user.role,
      emailVerified: user.emailVerified,
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
      if (!user.emailVerified) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { emailVerified: true, lastActiveAt: new Date() },
          include: { profile: true },
        });
      } else {
        await prisma.user.update({
          where: { id: user.id },
          data: { lastActiveAt: new Date() },
        });
      }
      const token = generateAccessToken(user);
      const refreshToken = await generateRefreshToken(user.id);
      return {
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone,
          role: user.role,
          emailVerified: user.emailVerified,
          profile: user.profile,
        },
        token,
        refreshToken,
        isNew: false,
      };
    }

    user = await prisma.user.create({
      data: {
        email: googleProfile.email,
        passwordHash: '',
        emailVerified: true,
        lastActiveAt: new Date(),
        profile: {
          create: {
            ...(googleProfile.name ? { currentRole: googleProfile.name } : {}),
          },
        },
      },
      include: { profile: true },
    });

    const token = generateAccessToken(user);
    const refreshToken = await generateRefreshToken(user.id);
    return {
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        emailVerified: user.emailVerified,
        profile: user.profile,
      },
      token,
      refreshToken,
      isNew: true,
    };
  }

  async findOrCreateLinkedInUser(linkedinProfile: {
    email: string;
    name?: string;
    linkedinId: string;
    linkedinUrl?: string;
    avatarUrl?: string;
    headline?: string;
    location?: string;
    firstName?: string;
    lastName?: string;
    industryName?: string;
  }) {
    const safeLinkedinUrl = linkedinProfile.linkedinUrl && isValidHttpsUrl(linkedinProfile.linkedinUrl) ? linkedinProfile.linkedinUrl : undefined;
    const safeAvatarUrl = linkedinProfile.avatarUrl && isValidHttpsUrl(linkedinProfile.avatarUrl) ? linkedinProfile.avatarUrl : undefined;

    let user = await prisma.user.findUnique({
      where: { email: linkedinProfile.email },
      include: { profile: true },
    });

    if (user) {
      if (!user.isActive) {
        throw new AppError(403, 'Account is disabled', 'ACCOUNT_DISABLED');
      }

      const userUpdates: any = { lastActiveAt: new Date() };
      if (!user.emailVerified) userUpdates.emailVerified = true;
      if (!user.name && linkedinProfile.name) userUpdates.name = linkedinProfile.name;

      user = await prisma.user.update({
        where: { id: user.id },
        data: userUpdates,
        include: { profile: true },
      });

      if (user.profile) {
        const profileUpdates: any = {};
        if (!user.profile.linkedinUrl && safeLinkedinUrl) profileUpdates.linkedinUrl = safeLinkedinUrl;
        if (!user.profile.avatarUrl && safeAvatarUrl) profileUpdates.avatarUrl = safeAvatarUrl;
        if (!user.profile.headline && linkedinProfile.headline) profileUpdates.headline = linkedinProfile.headline;
        if (!user.profile.currentRole && linkedinProfile.headline) profileUpdates.currentRole = linkedinProfile.headline;
        if (!user.profile.location && linkedinProfile.location) profileUpdates.location = linkedinProfile.location;
        if (!user.profile.linkedinVerified) profileUpdates.linkedinVerified = true;
        if (linkedinProfile.industryName && user.profile.industries.length === 0) {
          profileUpdates.industries = [linkedinProfile.industryName];
        }

        if (Object.keys(profileUpdates).length > 0) {
          await prisma.profile.update({
            where: { userId: user.id },
            data: profileUpdates,
          });
          user = await prisma.user.findUnique({
            where: { id: user.id },
            include: { profile: true },
          }) as typeof user;
        }
      }

      const token = generateAccessToken(user!);
      const refreshToken = await generateRefreshToken(user!.id);
      return {
        user: {
          id: user!.id,
          email: user!.email,
          phone: user!.phone,
          role: user!.role,
          emailVerified: user!.emailVerified,
          profile: user!.profile,
        },
        token,
        refreshToken,
        isNew: false,
      };
    }

    const profileData: any = {
      linkedinVerified: true,
    };
    if (safeLinkedinUrl) profileData.linkedinUrl = safeLinkedinUrl;
    if (safeAvatarUrl) profileData.avatarUrl = safeAvatarUrl;
    if (linkedinProfile.headline) {
      profileData.headline = linkedinProfile.headline;
      profileData.currentRole = linkedinProfile.headline;
    }
    if (linkedinProfile.location) profileData.location = linkedinProfile.location;
    if (linkedinProfile.industryName) profileData.industries = [linkedinProfile.industryName];

    user = await prisma.user.create({
      data: {
        email: linkedinProfile.email,
        name: linkedinProfile.name || undefined,
        passwordHash: '',
        emailVerified: true,
        lastActiveAt: new Date(),
        profile: {
          create: profileData,
        },
      },
      include: { profile: true },
    });

    const token = generateAccessToken(user);
    const refreshToken = await generateRefreshToken(user.id);
    return {
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        emailVerified: user.emailVerified,
        profile: user.profile,
      },
      token,
      refreshToken,
      isNew: true,
    };
  }

  async findUserByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  }

  async resetPassword(email: string, newPassword: string) {
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { email },
      data: { passwordHash },
    });
  }

  async verifyEmail(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true },
    });
  }
}

export const authService = new AuthService();
