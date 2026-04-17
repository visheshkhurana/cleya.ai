import { prisma } from '@cleya/db';
import { notificationService } from './notification/notificationService';

export interface ProfileStrengthChecklist {
  key: string;
  label: string;
  done: boolean;
  weight: number;
}

export interface ProfileStrengthResult {
  score: number;
  checklist: ProfileStrengthChecklist[];
  isComplete: boolean;
}

export class ProfileStrengthService {
  computeFromProfile(user: { emailVerified: boolean; phoneVerified: boolean }, profile: any): ProfileStrengthResult {
    const items: ProfileStrengthChecklist[] = [
      { key: 'photo', label: 'Profile photo', done: !!profile?.avatarUrl, weight: 10 },
      { key: 'bio', label: 'Bio (60+ chars)', done: !!profile?.bio && profile.bio.length >= 60, weight: 15 },
      { key: 'company', label: 'Company / role', done: !!(profile?.companyName || profile?.currentRole), weight: 10 },
      { key: 'linkedin', label: 'LinkedIn URL', done: !!profile?.linkedinUrl, weight: 15 },
      { key: 'emailVerified', label: 'Email verified', done: !!user?.emailVerified, weight: 10 },
      { key: 'phoneVerified', label: 'Phone verified', done: !!user?.phoneVerified, weight: 10 },
      { key: 'workExperience', label: 'Work experience', done: typeof profile?.yearsExperience === 'number' && profile.yearsExperience > 0, weight: 10 },
      { key: 'education', label: 'Education / headline', done: !!profile?.headline && profile.headline.length >= 10, weight: 10 },
      { key: 'industries', label: 'Industries selected', done: Array.isArray(profile?.industries) && profile.industries.length > 0, weight: 5 },
      { key: 'skills', label: 'Skills selected', done: Array.isArray(profile?.skills) && profile.skills.length > 0, weight: 5 },
    ];
    const total = items.reduce((s, i) => s + i.weight, 0);
    const earned = items.reduce((s, i) => (i.done ? s + i.weight : s), 0);
    const score = Math.min(100, Math.round((earned / total) * 100));
    return { score, checklist: items, isComplete: score >= 100 };
  }

  async recompute(userId: string): Promise<ProfileStrengthResult | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { emailVerified: true, phoneVerified: true, profile: true },
    });
    if (!user) return null;
    const result = this.computeFromProfile(
      { emailVerified: user.emailVerified, phoneVerified: user.phoneVerified },
      user.profile,
    );

    const previous = await prisma.profile.findUnique({
      where: { userId },
      select: { profileScore: true, profileCompleteBadgeAt: true },
    });

    const data: any = {
      profileScore: result.score,
      profileScoreDetails: result as any,
    };

    const justCompleted = result.isComplete && !previous?.profileCompleteBadgeAt;
    if (justCompleted) {
      data.profileCompleteBadgeAt = new Date();
    }

    await prisma.profile.update({ where: { userId }, data }).catch(() => null);

    if (justCompleted) {
      await notificationService
        .send({
          userId,
          channel: 'IN_APP',
          event: 'PROFILE_COMPLETE',
          title: 'Profile Complete! 🏆',
          body: 'Your profile is at 100%. You\'ll show up in more matches now.',
        })
        .catch(() => null);
    }

    return result;
  }

  async getStrength(userId: string): Promise<ProfileStrengthResult | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { emailVerified: true, phoneVerified: true, profile: true },
    });
    if (!user) return null;
    return this.computeFromProfile(
      { emailVerified: user.emailVerified, phoneVerified: user.phoneVerified },
      user.profile,
    );
  }
}

export const profileStrengthService = new ProfileStrengthService();
