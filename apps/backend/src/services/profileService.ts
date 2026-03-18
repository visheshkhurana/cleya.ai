import { prisma } from '@boardy/db';
import { createAIService } from '@boardy/ai';
import { generateAndStoreEmbedding } from '@boardy/api';
import { AppError } from '../middleware/errorHandler';

function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, ' ').trim();
}

function validateLinkedinUrl(url: string): boolean {
  if (!url) return true;
  return /^https?:\/\/(www\.)?linkedin\.com\/in\/[\w-]+\/?$/i.test(url);
}

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
      phoneNumber: context.phoneNumber,
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
      await generateAndStoreEmbedding(userId, profile);
      console.log(`Embedding generated for user ${userId}`);
    } catch (error) {
      console.error('Failed to generate embedding:', error);
    }
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

    const textFields = [
      'headline', 'bio', 'companyName', 'currentRole', 'location',
      'businessDescription', 'keyTractionPoints', 'raiseAmount',
      'amountRaisedToDate', 'fundName', 'fundSize', 'investmentRange',
      'industryFocus', 'investmentThesis', 'cityBased', 'exampleInvestment',
      'outreachMethod', 'founderAccessPitch', 'investmentAmount',
    ];
    for (const key of textFields) {
      if (typeof sanitized[key] === 'string') {
        sanitized[key] = stripHtml(sanitized[key]);
      }
    }

    if (typeof sanitized.headline === 'string' && sanitized.headline.length > 150) {
      sanitized.headline = sanitized.headline.substring(0, 150);
    }
    if (typeof sanitized.bio === 'string' && sanitized.bio.length > 1000) {
      sanitized.bio = sanitized.bio.substring(0, 1000);
    }
    if (typeof sanitized.businessDescription === 'string' && sanitized.businessDescription.length > 2000) {
      sanitized.businessDescription = sanitized.businessDescription.substring(0, 2000);
    }

    if (sanitized.linkedinUrl && !validateLinkedinUrl(sanitized.linkedinUrl)) {
      throw new AppError(400, 'Invalid LinkedIn URL. Must be in format: https://linkedin.com/in/your-name', 'INVALID_LINKEDIN_URL');
    }

    if (Array.isArray(sanitized.skills)) {
      sanitized.skills = sanitized.skills.map((s: any) => typeof s === 'string' ? stripHtml(s).substring(0, 100) : s);
    }
    if (Array.isArray(sanitized.interests)) {
      sanitized.interests = sanitized.interests.map((s: any) => typeof s === 'string' ? stripHtml(s).substring(0, 100) : s);
    }
    if (Array.isArray(sanitized.industries)) {
      sanitized.industries = sanitized.industries.map((s: any) => typeof s === 'string' ? stripHtml(s).substring(0, 100) : s);
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
