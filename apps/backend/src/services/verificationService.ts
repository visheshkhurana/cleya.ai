import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface VerificationResult {
  score: number;
  factors: {
    emailVerified: boolean;
    linkedinVerified: boolean;
    profileComplete: boolean;
    hasHeadline: boolean;
    hasCompany: boolean;
    hasIndustries: boolean;
    hasSkills: boolean;
    hasLocation: boolean;
  };
  tier: 'unverified' | 'basic' | 'verified' | 'trusted';
}

export async function calculateVerificationScore(userId: string): Promise<VerificationResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });

  if (!user) {
    return { score: 0, factors: { emailVerified: false, linkedinVerified: false, profileComplete: false, hasHeadline: false, hasCompany: false, hasIndustries: false, hasSkills: false, hasLocation: false }, tier: 'unverified' };
  }

  const profile = user.profile;
  const factors = {
    emailVerified: user.emailVerified,
    linkedinVerified: profile?.linkedinVerified ?? false,
    profileComplete: profile?.isComplete ?? false,
    hasHeadline: !!profile?.headline,
    hasCompany: !!profile?.companyName,
    hasIndustries: (profile?.industries?.length ?? 0) > 0,
    hasSkills: (profile?.skills?.length ?? 0) > 0,
    hasLocation: !!profile?.location,
  };

  let score = 0;
  if (factors.emailVerified) score += 25;
  if (factors.linkedinVerified) score += 25;
  if (factors.profileComplete) score += 15;
  if (factors.hasHeadline) score += 5;
  if (factors.hasCompany) score += 10;
  if (factors.hasIndustries) score += 5;
  if (factors.hasSkills) score += 5;
  if (factors.hasLocation) score += 10;

  score = Math.min(score, 100);

  let tier: VerificationResult['tier'] = 'unverified';
  if (score >= 75) tier = 'trusted';
  else if (score >= 50) tier = 'verified';
  else if (score >= 25) tier = 'basic';

  if (profile) {
    await prisma.profile.update({
      where: { userId },
      data: { verificationScore: score / 100 },
    });
  }

  return { score, factors, tier };
}

export function getVerificationBadge(score: number): { label: string; color: string; icon: string } {
  if (score >= 75) return { label: 'Trusted', color: '#10B981', icon: '✓✓' };
  if (score >= 50) return { label: 'Verified', color: '#0D9488', icon: '✓' };
  if (score >= 25) return { label: 'Basic', color: '#3B82F6', icon: '○' };
  return { label: 'Unverified', color: '#64748B', icon: '−' };
}
