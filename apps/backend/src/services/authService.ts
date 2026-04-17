import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@cleya/db';
import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler';
import { AuthPayload, RoleType } from '../middleware/auth';

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

    const smtpConfigured = !!(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        phone: data.phone,
        name: data.name,
        passwordHash,
        isActive: !smtpConfigured,
        utmSource: data.utmSource,
        utmMedium: data.utmMedium,
        utmCampaign: data.utmCampaign,
        profile: {
          create: data.persona ? { persona: data.persona as any } : {},
        },
      },
      include: { profile: true },
    });

    const token = smtpConfigured ? null : this.generateToken(user);

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

    import('./dripCampaignService').then(({ dripCampaignService }) => {
      dripCampaignService.enrollOnboarding(user.id).catch((e) =>
        console.log('[Auth] Drip campaign enrollment failed:', e.message)
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
      verificationRequired: !user.isActive,
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
      if (!user.emailVerified) {
        throw new AppError(
          403,
          'Please verify your email to activate your account. Check your inbox or request a new verification link.',
          'EMAIL_NOT_VERIFIED'
        );
      }
      throw new AppError(403, 'Account is disabled', 'ACCOUNT_DISABLED');
    }

    if (user.mfaEnabled && user.totpSecret) {
      const mfaToken = this.generateMfaToken(user);
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
        token: mfaToken,
        mfaRequired: true,
      };
    }

    const token = this.generateToken(user);

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
      mfaRequired: false,
    };
  }

  async validateMfa(userId: string, totpCode: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user || !user.mfaEnabled || !user.totpSecret) {
      throw new AppError(400, 'MFA not enabled for this account', 'MFA_NOT_ENABLED');
    }

    const otplib = await import('otplib');
    const result = otplib.verifySync({
      token: totpCode,
      secret: user.totpSecret,
      crypto: new otplib.NobleCryptoPlugin(),
      base32: new otplib.ScureBase32Plugin(),
    } as any);

    if (!result.valid) {
      throw new AppError(401, 'Invalid MFA code', 'INVALID_MFA_CODE');
    }

    const token = this.generateToken(user);

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
    };
  }

  async setupMfa(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
    }

    const otplib = await import('otplib');
    const secret = otplib.generateSecret();
    const otpauthUrl = otplib.generateURI({ issuer: 'Cleya.ai', label: user.email, secret } as any);

    await prisma.user.update({
      where: { id: userId },
      data: { totpSecret: secret },
    });

    return { secret, otpauthUrl };
  }

  async verifyMfaSetup(userId: string, totpCode: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.totpSecret) {
      throw new AppError(400, 'MFA setup not initiated', 'MFA_NOT_SETUP');
    }

    const otplib = await import('otplib');
    const verifyResult = otplib.verifySync({
      token: totpCode,
      secret: user.totpSecret,
      crypto: new otplib.NobleCryptoPlugin(),
      base32: new otplib.ScureBase32Plugin(),
    } as any);
    const isValid = verifyResult.valid;

    if (!isValid) {
      throw new AppError(400, 'Invalid TOTP code', 'INVALID_MFA_CODE');
    }

    await prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true },
    });

    return { mfaEnabled: true };
  }

  async disableMfa(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: false, totpSecret: null },
    });
    return { mfaEnabled: false };
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
      mfaEnabled: user.mfaEnabled,
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
      const updates: { emailVerified?: boolean; googleId?: string } = {};
      if (!user.emailVerified) updates.emailVerified = true;
      if (user.googleId !== googleProfile.googleId) updates.googleId = googleProfile.googleId;
      if (Object.keys(updates).length > 0) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: updates,
          include: { profile: true },
        });
      }
      const token = this.generateToken(user);
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
        isNew: false,
      };
    }

    user = await prisma.user.create({
      data: {
        email: googleProfile.email,
        passwordHash: '',
        emailVerified: true,
        googleId: googleProfile.googleId,
        profile: {
          create: {
            ...(googleProfile.name ? { currentRole: googleProfile.name } : {}),
          },
        },
      },
      include: { profile: true },
    });

    import('./dripCampaignService').then(({ dripCampaignService }) => {
      dripCampaignService.enrollOnboarding(user!.id).catch((e) =>
        console.log('[Auth] Drip campaign enrollment failed (Google):', e.message)
      );
    });

    const token = this.generateToken(user);
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
      isNew: true,
    };
  }

  async findOrCreateClerkUser(clerkProfile: { email: string; name?: string; clerkUserId: string }) {
    let user = await prisma.user.findUnique({
      where: { email: clerkProfile.email },
      include: { profile: true },
    });

    if (user) {
      if (!user.isActive) {
        throw new AppError(403, 'Account is disabled', 'ACCOUNT_DISABLED');
      }
      const updates: { emailVerified?: boolean; name?: string; clerkId?: string } = {};
      if (!user.emailVerified) updates.emailVerified = true;
      if (!user.name && clerkProfile.name) updates.name = clerkProfile.name;
      if (!user.clerkId) updates.clerkId = clerkProfile.clerkUserId;
      if (Object.keys(updates).length > 0) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: updates,
          include: { profile: true },
        });
      }
      const token = this.generateToken(user);
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
        isNew: false,
      };
    }

    user = await prisma.user.create({
      data: {
        email: clerkProfile.email,
        name: clerkProfile.name,
        passwordHash: '',
        emailVerified: true,
        clerkId: clerkProfile.clerkUserId,
        profile: {
          create: clerkProfile.name ? { currentRole: clerkProfile.name } : {},
        },
      },
      include: { profile: true },
    });

    import('./dripCampaignService').then(({ dripCampaignService }) => {
      dripCampaignService.enrollOnboarding(user!.id).catch((e) =>
        console.log('[Auth] Drip campaign enrollment failed (Clerk):', e.message)
      );
    });

    import('./email').then(({ emailService }) => {
      emailService.sendWelcome(clerkProfile.email).catch(() => {});
    });

    import('./slackService').then(({ slackService }) => {
      slackService
        .notifyUserRegistered({ id: user!.id, email: user!.email, name: user!.name || undefined })
        .catch(() => {});
    });

    const token = this.generateToken(user);
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

      const userUpdates: any = {};
      if (!user.emailVerified) userUpdates.emailVerified = true;
      if (!user.name && linkedinProfile.name) userUpdates.name = linkedinProfile.name;
      if (user.linkedinId !== linkedinProfile.linkedinId) userUpdates.linkedinId = linkedinProfile.linkedinId;

      if (Object.keys(userUpdates).length > 0) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: userUpdates,
          include: { profile: true },
        });
      }

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

      const token = this.generateToken(user!);
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
        linkedinId: linkedinProfile.linkedinId,
        profile: {
          create: profileData,
        },
      },
      include: { profile: true },
    });

    import('./dripCampaignService').then(({ dripCampaignService }) => {
      dripCampaignService.enrollOnboarding(user!.id).catch((e) =>
        console.log('[Auth] Drip campaign enrollment failed (LinkedIn):', e.message)
      );
    });

    const token = this.generateToken(user);
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

  async reauth(userId: string, password: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new AppError(401, 'Invalid password', 'INVALID_CREDENTIALS');
    }

    const elevatedToken = jwt.sign(
      { userId: user.id, elevated: true },
      env.JWT_SECRET,
      { expiresIn: '15m' } as jwt.SignOptions
    );

    return { elevatedToken };
  }

  generateToken(user: { id: string; email: string; role: string }): string {
    const payload: AuthPayload = {
      userId: user.id,
      email: user.email,
      role: user.role as RoleType,
      issuedAt: Math.floor(Date.now() / 1000),
    };

    const expiresIn = (user.role as string).toUpperCase() === 'ADMIN' ? '12h' : env.JWT_EXPIRES_IN;

    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn,
    } as jwt.SignOptions);
  }

  generateMfaToken(user: { id: string; email: string; role: string }): string {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role as RoleType,
      mfaPending: true,
    };

    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: '5m',
    } as jwt.SignOptions);
  }
}

export const authService = new AuthService();
