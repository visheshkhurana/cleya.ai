import { prisma } from '@boardy/db';
import { matchingEngine, ProfileForMatching } from '@boardy/matching';
import { createAIService } from '@boardy/ai';
import { AppError } from '../middleware/errorHandler';
import { sendToUser } from '../websocket/server';

export class MatchingService {
  private ai = createAIService();

  // Run matching for a specific user
  async findMatchesForUser(userId: string, limit = 10) {
    const userProfile = await this.getProfileForMatching(userId);
    if (!userProfile) throw new AppError(404, 'Profile not found', 'PROFILE_NOT_FOUND');

    // Get all other complete profiles
    const candidates = await this.getAllCandidates(userId);

    // Get already matched user IDs to exclude
    const existingMatches = await prisma.match.findMany({
      where: {
        OR: [{ userAId: userId }, { userBId: userId }],
      },
      select: { userAId: true, userBId: true },
    });

    const matchedIds = new Set(
      existingMatches.flatMap((m) => [m.userAId, m.userBId])
    );

    const eligibleCandidates = candidates.filter(
      (c) => !matchedIds.has(c.userId)
    );

    // Score and rank
    const matches = matchingEngine.findMatches(userProfile, eligibleCandidates, {
      limit,
      minScore: 0.35,
    });

    return matches;
  }

  // Create a match proposal
  async proposeMatch(userAId: string, userBId: string) {
    // Check if match already exists
    const existing = await prisma.match.findFirst({
      where: {
        OR: [
          { userAId, userBId },
          { userAId: userBId, userBId: userAId },
        ],
      },
    });

    if (existing) {
      throw new AppError(409, 'Match already exists', 'MATCH_EXISTS');
    }

    // Calculate score
    const profileA = await this.getProfileForMatching(userAId);
    const profileB = await this.getProfileForMatching(userBId);
    if (!profileA || !profileB) throw new AppError(404, 'Profile not found');

    const score = matchingEngine.score(profileA, profileB);

    // Generate AI match reason
    const reason = await this.generateMatchReason(profileA, profileB);

    const match = await prisma.match.create({
      data: {
        userAId,
        userBId,
        status: 'PROPOSED',
        score: score.total,
        scoreBreakdown: score.breakdown as any,
        reason,
        userAResponse: 'PENDING',
        userBResponse: 'PENDING',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Notify both users
    sendToUser(userAId, 'match:proposed', {
      matchId: match.id,
      reason,
      score: score.total,
    });
    sendToUser(userBId, 'match:proposed', {
      matchId: match.id,
      reason,
      score: score.total,
    });

    return match;
  }

  // Double opt-in response
  async respondToMatch(matchId: string, userId: string, response: 'ACCEPTED' | 'REJECTED') {
    const match = await prisma.match.findUnique({ where: { id: matchId } });
    if (!match) throw new AppError(404, 'Match not found');

    const isUserA = match.userAId === userId;
    const isUserB = match.userBId === userId;

    if (!isUserA && !isUserB) {
      throw new AppError(403, 'Not part of this match');
    }

    // Update the response
    const updateData: any = {};
    if (isUserA) {
      updateData.userAResponse = response;
      updateData.userARespondedAt = new Date();
    } else {
      updateData.userBResponse = response;
      updateData.userBRespondedAt = new Date();
    }

    // Determine match status
    const otherResponse = isUserA ? match.userBResponse : match.userAResponse;

    if (response === 'REJECTED') {
      updateData.status = 'REJECTED';
    } else if (otherResponse === 'ACCEPTED') {
      updateData.status = 'ACCEPTED';
    } else if (otherResponse === 'REJECTED') {
      updateData.status = 'REJECTED';
    } else {
      updateData.status = isUserA ? 'PENDING_B' : 'PENDING_A';
    }

    const updated = await prisma.match.update({
      where: { id: matchId },
      data: updateData,
    });

    // If both accepted, reveal contacts
    if (updated.status === 'ACCEPTED') {
      await this.revealContacts(updated);
    }

    return updated;
  }

  private async revealContacts(match: any) {
    const [userA, userB] = await Promise.all([
      prisma.user.findUnique({
        where: { id: match.userAId },
        include: { profile: true },
      }),
      prisma.user.findUnique({
        where: { id: match.userBId },
        include: { profile: true },
      }),
    ]);

    if (!userA || !userB) return;

    // Send contact info to both users
    sendToUser(match.userAId, 'match:accepted', {
      matchId: match.id,
      contact: {
        name: `${userB.profile?.currentRole} at ${userB.profile?.companyName}`,
        email: userB.email,
        linkedin: userB.profile?.linkedinUrl,
        headline: userB.profile?.headline,
      },
    });

    sendToUser(match.userBId, 'match:accepted', {
      matchId: match.id,
      contact: {
        name: `${userA.profile?.currentRole} at ${userA.profile?.companyName}`,
        email: userA.email,
        linkedin: userA.profile?.linkedinUrl,
        headline: userA.profile?.headline,
      },
    });
  }

  async getMatchesForUser(userId: string) {
    return prisma.match.findMany({
      where: {
        OR: [{ userAId: userId }, { userBId: userId }],
      },
      include: {
        userA: { include: { profile: true } },
        userB: { include: { profile: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async generateMatchReason(a: ProfileForMatching, b: ProfileForMatching): Promise<string> {
    try {
      const response = await this.ai.chat([
        {
          role: 'system',
          content: 'You write concise, warm introduction reasons for why two professionals should connect. Keep it to 1-2 sentences. Be specific about the synergy.',
        },
        {
          role: 'user',
          content: `Person A: ${a.persona} - ${a.headline || ''} at ${a.industries.join(', ')}
Person B: ${b.persona} - ${b.headline || ''} at ${b.industries.join(', ')}
A is looking for: ${a.lookingFor.join(', ')}
B is looking for: ${b.lookingFor.join(', ')}
Write a brief reason why they should connect.`,
        },
      ]);
      return response.content;
    } catch {
      return 'You both have complementary backgrounds and interests that could lead to a great connection.';
    }
  }

  private async getProfileForMatching(userId: string): Promise<ProfileForMatching | null> {
    const profile = await prisma.profile.findUnique({ where: { userId } });
    if (!profile) return null;

    // Get embedding if exists
    let embedding: number[] | undefined;
    try {
      const embRow = await prisma.$queryRawUnsafe<any[]>(
        `SELECT vector::text FROM user_embeddings WHERE "userId" = $1 AND source = 'PROFILE' LIMIT 1`,
        userId
      );
      if (embRow.length > 0) {
        embedding = JSON.parse(embRow[0].vector);
      }
    } catch {}

    return {
      userId,
      persona: profile.persona || 'OTHER',
      companyStage: profile.companyStage || undefined,
      industries: profile.industries,
      interests: profile.interests,
      lookingFor: profile.lookingFor,
      location: profile.location || undefined,
      skills: profile.skills,
      headline: profile.headline || undefined,
      bio: profile.bio || undefined,
      embedding,
    };
  }

  private async getAllCandidates(excludeUserId: string): Promise<ProfileForMatching[]> {
    const profiles = await prisma.profile.findMany({
      where: {
        userId: { not: excludeUserId },
        isComplete: true,
      },
    });

    return profiles.map((p) => ({
      userId: p.userId,
      persona: p.persona || 'OTHER',
      companyStage: p.companyStage || undefined,
      industries: p.industries,
      interests: p.interests,
      lookingFor: p.lookingFor,
      location: p.location || undefined,
      skills: p.skills,
      headline: p.headline || undefined,
      bio: p.bio || undefined,
    }));
  }
}

export const matchingService = new MatchingService();
