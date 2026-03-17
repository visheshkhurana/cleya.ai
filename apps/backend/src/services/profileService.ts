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

    if (data.headline || data.bio || data.skills || data.interests) {
      await this.generateEmbedding(userId, profile);
    }

    return profile;
  }

  async updateFromConversation(userId: string, context: Record<string, any>) {
    const persona = context['persona_select_choice'];
    const founderPriority = context['founder_priority_choice'];
    const talentRole = context['talent_target_role_choice'];
    const channelSource = context['attribution_choice'];

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
      yearsExperience: context.yearsExperience ? Number(context.yearsExperience) : undefined,
    };

    if (persona === 'FOUNDER') {
      profileData.priority = founderPriority;
      profileData.businessDescription = context.businessDescription;
      profileData.keyTractionPoints = context.keyTractionPoints;
      profileData.raiseAmount = context.raiseAmount;
      profileData.amountRaisedToDate = context.amountRaisedToDate;
      profileData.roundCloseDate = context.roundCloseDate;
      profileData.lookingFor = founderPriority ? [founderPriority] : [];
    }

    if (persona === 'TALENT') {
      profileData.targetRole = talentRole;
      profileData.lookingFor = talentRole ? [talentRole] : [];
    }

    if (persona === 'INVESTOR') {
      profileData.investorType = context.investorType;
      profileData.investmentAmount = context.investmentAmount;
    }

    if (persona === 'DEAL_PARTNER') {
      profileData.cityBased = context.cityBased;
      profileData.exampleInvestment = context.exampleInvestment;
      profileData.outreachMethod = context.outreachMethod;
      profileData.trackedCompanies = context.trackedCompanies;
      profileData.founderAccessPitch = context.founderAccessPitch;
    }

    if (persona === 'EVENT_PARTICIPANT') {
      profileData.businessDescription = context.businessDescription;
    }

    if (channelSource) {
      profileData.channelSource = channelSource;
    }

    Object.keys(profileData).forEach((key) => {
      if (profileData[key] === undefined) delete profileData[key];
    });

    return this.updateProfile(userId, profileData);
  }

  async generateEmbedding(userId: string, profile: any) {
    try {
      const text = this.profileToText(profile);
      const result = await this.ai.embed(text);

      await prisma.$executeRawUnsafe(
        `INSERT INTO user_embeddings (id, "userId", vector, source, content, "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2::vector, 'PROFILE', $3, NOW(), NOW())
         ON CONFLICT ("userId") WHERE source = 'PROFILE'
         DO UPDATE SET vector = $2::vector, content = $3, "updatedAt" = NOW()`,
        userId,
        `[${result.vector.join(',')}]`,
        text
      );

      console.log(`Embedding generated for user ${userId}`);
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
      profile.businessDescription && `Business: ${profile.businessDescription}`,
      profile.keyTractionPoints && `Traction: ${profile.keyTractionPoints}`,
      profile.industries?.length && `Industries: ${profile.industries.join(', ')}`,
      profile.skills?.length && `Skills: ${profile.skills.join(', ')}`,
      profile.interests?.length && `Interests: ${profile.interests.join(', ')}`,
      profile.lookingFor?.length && `Looking for: ${profile.lookingFor.join(', ')}`,
      profile.location && `Location: ${profile.location}`,
      profile.investorType && `Investor Type: ${profile.investorType}`,
      profile.investmentAmount && `Check Size: ${profile.investmentAmount}`,
      profile.targetRole && `Target Role: ${profile.targetRole}`,
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
      'currentRole', 'location', 'linkedinUrl', 'websiteUrl', 'phoneNumber',
      'yearsExperience', 'industries', 'skills', 'interests', 'lookingFor',
      'priority', 'raiseAmount', 'roundCloseDate', 'amountRaisedToDate',
      'businessDescription', 'keyTractionPoints',
      'investorType', 'investmentAmount', 'accreditedInvestor',
      'targetRole',
      'fundName', 'fundSize', 'investmentRange', 'industryFocus', 'investmentThesis',
      'cityBased', 'exampleInvestment', 'outreachMethod', 'trackedCompanies', 'founderAccessPitch',
      'channelSource', 'channelType',
    ];

    const sanitized: Record<string, any> = {};
    for (const key of allowed) {
      if (data[key] !== undefined) {
        sanitized[key] = data[key];
      }
    }

    const extraKeys = Object.keys(data).filter((k) => !allowed.includes(k));
    if (extraKeys.length > 0) {
      sanitized.extraData = {};
      for (const key of extraKeys) {
        sanitized.extraData[key] = data[key];
      }
    }

    sanitized.isComplete = this.calculateCompleteness(data) >= 0.75;

    return sanitized;
  }
}

export const profileService = new ProfileService();
