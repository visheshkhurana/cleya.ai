import { prisma } from '@boardy/db';
import { createAIService } from '@boardy/ai';
import { AppError } from '../middleware/errorHandler';

export class ProfileService {
  private ai = createAIService();

  async getProfile(userId: string) {
    const profile = await prisma.profile.findUnique({
      where: { userId },
    });
    if (!profile) throw new AppError(404, 'Profile not found', 'PROFILE_NOT_FOUND');
    return profile;
  }

  async updateProfile(userId: string, data: Record<string, any>) {
    const profile = await prisma.profile.upsert({
      where: { userId },
      update: {
        ...this.sanitizeProfileData(data),
        completenessScore: this.calculateCompleteness(data),
        updatedAt: new Date(),
      },
      create: {
        userId,
        ...this.sanitizeProfileData(data),
        completenessScore: this.calculateCompleteness(data),
      },
    });

    // Regenerate embedding if significant fields changed
    if (data.headline || data.bio || data.skills || data.interests) {
      await this.generateEmbedding(userId, profile);
    }

    return profile;
  }

  // Called when onboarding conversation completes
  async updateFromConversation(userId: string, context: Record<string, any>) {
    // Map conversation context to profile fields
    const persona = context['persona_select_choice'];
    const goalChoice = context['founder_goals_choice'] || context['lookingFor'];

    const profileData: Record<string, any> = {
      persona,
      companyName: context.companyName,
      companyStage: context.companyStage,
      currentRole: context.currentRole,
      headline: context.headline,
      bio: context.bio,
      location: context.location,
      linkedinUrl: context.linkedinUrl,
      industries: context.industries || [],
      skills: context.skills || [],
      interests: context.interests || [],
      lookingFor: goalChoice ? [goalChoice] : [],
      yearsExperience: context.yearsExperience ? Number(context.yearsExperience) : undefined,
    };

    // Clean undefined values
    Object.keys(profileData).forEach((key) => {
      if (profileData[key] === undefined) delete profileData[key];
    });

    return this.updateProfile(userId, profileData);
  }

  async generateEmbedding(userId: string, profile: any) {
    try {
      // Build text representation for embedding
      const text = this.profileToText(profile);
      const result = await this.ai.embed(text);

      // Store embedding using raw SQL (pgvector)
      await prisma.$executeRawUnsafe(
        `INSERT INTO user_embeddings (id, "userId", vector, source, content, "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2::vector, 'PROFILE', $3, NOW(), NOW())
         ON CONFLICT ("userId") WHERE source = 'PROFILE'
         DO UPDATE SET vector = $2::vector, content = $3, "updatedAt" = NOW()`,
        userId,
        `[${result.vector.join(',')}]`,
        text
      );

      console.log(`🧠 Embedding generated for user ${userId}`);
    } catch (error) {
      console.error('Failed to generate embedding:', error);
    }
  }

  private profileToText(profile: any): string {
    const parts = [
      profile.persona && `Role: ${profile.persona}`,
      profile.headline && `Headline: ${profile.headline}`,
      profile.bio && `Bio: ${profile.bio}`,
      profile.companyName && `Company: ${profile.companyName}`,
      profile.currentRole && `Title: ${profile.currentRole}`,
      profile.industries?.length && `Industries: ${profile.industries.join(', ')}`,
      profile.skills?.length && `Skills: ${profile.skills.join(', ')}`,
      profile.interests?.length && `Interests: ${profile.interests.join(', ')}`,
      profile.lookingFor?.length && `Looking for: ${profile.lookingFor.join(', ')}`,
      profile.location && `Location: ${profile.location}`,
    ];
    return parts.filter(Boolean).join('. ');
  }

  calculateCompleteness(data: Record<string, any>): number {
    const fields = [
      'persona',
      'headline',
      'bio',
      'companyName',
      'currentRole',
      'location',
      'industries',
      'linkedinUrl',
    ];

    const filled = fields.filter((f) => {
      const val = data[f];
      if (Array.isArray(val)) return val.length > 0;
      return val !== undefined && val !== null && val !== '';
    });

    return Math.round((filled.length / fields.length) * 100) / 100;
  }

  private sanitizeProfileData(data: Record<string, any>) {
    const allowed = [
      'persona', 'headline', 'bio', 'companyName', 'companyStage',
      'currentRole', 'location', 'linkedinUrl', 'websiteUrl',
      'yearsExperience', 'industries', 'skills', 'interests', 'lookingFor',
    ];

    const sanitized: Record<string, any> = {};
    for (const key of allowed) {
      if (data[key] !== undefined) {
        sanitized[key] = data[key];
      }
    }

    // Store extra fields in JSONB
    const extraKeys = Object.keys(data).filter((k) => !allowed.includes(k));
    if (extraKeys.length > 0) {
      sanitized.extraData = {};
      for (const key of extraKeys) {
        sanitized.extraData[key] = data[key];
      }
    }

    // Calculate isComplete
    sanitized.isComplete = this.calculateCompleteness(data) >= 0.75;

    return sanitized;
  }
}

export const profileService = new ProfileService();
