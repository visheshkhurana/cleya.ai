import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { profileService } from '../services/profileService';
import { prisma } from '@cleya/db';
import bcrypt from 'bcryptjs';
import { validate, profileUpdateSchema, changePasswordSchema } from '../middleware/validation';
import { securityLogger } from '../services/securityLogger';

export const userRouter = Router();

userRouter.get('/profile', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await profileService.getProfile(req.user!.userId);
    securityLogger.accessEvent(req, 'PROFILE_VIEW', req.user!.userId, { viewedUserId: req.user!.userId });
    res.json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
});

userRouter.put('/profile', authenticate, validate(profileUpdateSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const persona = req.body.persona;
    if (persona === 'FOUNDER' && !req.body.companyName?.trim()) {
      res.status(400).json({ success: false, error: { message: 'Company name is required for founders' } });
      return;
    }
    const profile = await profileService.updateProfile(req.user!.userId, req.body);
    res.json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
});

userRouter.patch('/profile', authenticate, validate(profileUpdateSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const persona = req.body.persona;
    if (persona === 'FOUNDER' && !req.body.companyName?.trim()) {
      res.status(400).json({ success: false, error: { message: 'Company name is required for founders' } });
      return;
    }
    if (!persona && req.body.companyName === '') {
      const existing = await prisma.profile.findUnique({ where: { userId }, select: { persona: true } });
      if (existing?.persona === 'FOUNDER') {
        res.status(400).json({ success: false, error: { message: 'Company name is required for founders' } });
        return;
      }
    }
    const profile = await profileService.updateProfile(userId, req.body);
    res.json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
});

userRouter.post('/change-password', authenticate, validate(changePasswordSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) {
      res.status(404).json({ success: false, error: { message: 'User not found' } });
      return;
    }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      res.status(400).json({ success: false, error: { message: 'Current password is incorrect' } });
      return;
    }
    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashed } });
    securityLogger.authEvent(req, 'PASSWORD_CHANGE', 'SUCCESS', req.user!.userId);

    const { authService } = await import('../services/authService');
    const newToken = authService.generateToken({ id: user.id, email: user.email, role: user.role });
    res.cookie('cleo_auth', newToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.json({ success: true, token: newToken });
  } catch (error) {
    next(error);
  }
});

userRouter.delete('/account', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;

    securityLogger.configEvent(req, 'ACCOUNT_DELETION', userId, { email: req.user!.email });

    await prisma.$transaction(async (tx) => {
      await tx.activity.deleteMany({ where: { userId } });
      await tx.notification.deleteMany({ where: { userId } });
      await tx.matchFeedback.deleteMany({ where: { userId } });
      await tx.messageRecord.deleteMany({ where: { userId } });
      await tx.communicationPreference.deleteMany({ where: { userId } });
      await tx.eventParticipant.deleteMany({ where: { userId } });
      await tx.introductionRecord.deleteMany({ where: { OR: [{ userAId: userId }, { userBId: userId }] } });
      await tx.match.deleteMany({ where: { OR: [{ userAId: userId }, { userBId: userId }] } });
      await tx.dealTracking.deleteMany({ where: { OR: [{ dealPartnerId: userId }, { founderId: userId }] } });
      await tx.conversation.deleteMany({ where: { userId } });
      await tx.call.deleteMany({ where: { userId } });
      await tx.userEmbedding.deleteMany({ where: { userId } });
      await tx.inviteCode.updateMany({ where: { usedById: userId }, data: { usedById: null, usedAt: null } });
      await tx.inviteCode.deleteMany({ where: { createdById: userId } });
      await tx.profile.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });
    });

    res.json({ success: true, message: 'Account permanently deleted' });
  } catch (error) {
    next(error);
  }
});

userRouter.get('/export', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const format = (req.query.format as string) || 'json';

    const [user, profile, matches, messages, notifications, feedbacks] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, phone: true, role: true, createdAt: true, updatedAt: true, emailVerified: true },
      }),
      prisma.profile.findUnique({
        where: { userId },
        select: {
          persona: true, headline: true, bio: true, companyName: true, companyStage: true,
          currentRole: true, location: true, linkedinUrl: true, websiteUrl: true, phoneNumber: true,
          yearsExperience: true, industries: true, skills: true, interests: true, lookingFor: true,
          priority: true, raiseAmount: true, investorType: true, investmentAmount: true,
          targetRole: true, fundName: true, channelSource: true, completenessScore: true,
          isComplete: true, createdAt: true, updatedAt: true,
        },
      }),
      prisma.match.findMany({
        where: { OR: [{ userAId: userId }, { userBId: userId }] },
        select: {
          id: true, status: true, score: true, reason: true, createdAt: true,
          userAId: true, userBId: true, userAResponse: true, userBResponse: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.message.findMany({
        where: { conversation: { userId } },
        select: { id: true, sender: true, content: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.findMany({
        where: { userId },
        select: { id: true, event: true, title: true, body: true, createdAt: true, readAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.matchFeedback.findMany({
        where: { userId },
        select: { id: true, matchId: true, rating: true, feedback: true, createdAt: true },
      }),
    ]);

    securityLogger.accessEvent(req, 'DATA_EXPORT', userId, { format: format });

    const exportData = {
      exportedAt: new Date().toISOString(),
      user,
      profile,
      matches,
      messages,
      notifications,
      feedbacks,
    };

    if (format === 'csv') {
      const lines: string[] = [];
      lines.push('section,field,value');
      if (user) {
        Object.entries(user).forEach(([k, v]) => lines.push(`user,${k},"${String(v ?? '')}"`));
      }
      if (profile) {
        Object.entries(profile).forEach(([k, v]) => {
          const val = Array.isArray(v) ? v.join('; ') : String(v ?? '');
          lines.push(`profile,${k},"${val}"`);
        });
      }
      matches.forEach((m, i) => {
        Object.entries(m).forEach(([k, v]) => lines.push(`match_${i + 1},${k},"${String(v ?? '')}"`));
      });
      notifications.forEach((n, i) => {
        Object.entries(n).forEach(([k, v]) => lines.push(`notification_${i + 1},${k},"${String(v ?? '')}"`));
      });
      messages.forEach((m, i) => {
        Object.entries(m).forEach(([k, v]) => lines.push(`message_${i + 1},${k},"${String(v ?? '')}"`));
      });
      feedbacks.forEach((f, i) => {
        Object.entries(f).forEach(([k, v]) => lines.push(`feedback_${i + 1},${k},"${String(v ?? '')}"`));
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=cleya-data-export.csv');
      res.send(lines.join('\n'));
      return;
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=cleya-data-export.json');
    res.json({ success: true, data: exportData });
  } catch (error) {
    next(error);
  }
});

userRouter.get('/settings', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { email: true, phone: true, name: true, createdAt: true, whatsappOptedIn: true, whatsappPhone: true },
    });
    const profile = await prisma.profile.findUnique({
      where: { userId: req.user!.userId },
      select: { persona: true, currentRole: true, isComplete: true, phoneNumber: true },
    });
    const prefs = await prisma.communicationPreference.findUnique({
      where: { userId: req.user!.userId },
    });
    const phone = user?.phone || profile?.phoneNumber || null;
    res.json({ success: true, data: { ...user, phone, profile, notificationPrefs: prefs } });
  } catch (error) {
    next(error);
  }
});

userRouter.patch('/notification-preferences', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { matchNotify, introNotify, weeklyDigest, whatsappMatchNotify, whatsappIntroNotify, whatsappWeeklyDigest } = req.body;
    const data: any = {};
    if (typeof matchNotify === 'boolean') data.matchNotify = matchNotify;
    if (typeof introNotify === 'boolean') data.introNotify = introNotify;
    if (typeof weeklyDigest === 'boolean') data.weeklyDigest = weeklyDigest;
    if (typeof whatsappMatchNotify === 'boolean') data.whatsappMatchNotify = whatsappMatchNotify;
    if (typeof whatsappIntroNotify === 'boolean') data.whatsappIntroNotify = whatsappIntroNotify;
    if (typeof whatsappWeeklyDigest === 'boolean') data.whatsappWeeklyDigest = whatsappWeeklyDigest;

    const prefs = await prisma.communicationPreference.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
    res.json({ success: true, data: prefs });
  } catch (error) {
    next(error);
  }
});
