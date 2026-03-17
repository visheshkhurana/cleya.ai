import { prisma } from '@boardy/db';
import { matchingEngine, ProfileForMatching } from '@boardy/matching';
import { createAIService } from '@boardy/ai';
import { AppError } from '../middleware/errorHandler';
import { sendToUser } from '../websocket/server';
import { introductionService } from './introductionService';
import { vectorMatchingService } from './vectorMatchingService';

export class MatchingService {
  private ai = createAIService();

  async findMatchesForUser(userId: string, limit = 10) {
    const results = await vectorMatchingService.findMatches(userId, limit);

    return results.map((r) => ({
      profile: r.profile,
      score: {
        total: r.hybridScore,
        ruleScore: r.ruleScore,
        semanticScore: r.vectorSimilarity,
        breakdown: r.breakdown,
      },
    }));
  }

  async findAndAutoPropose(userId: string, limit = 5) {
    const matches = await this.findMatchesForUser(userId, limit);
    const proposed = [];

    for (const match of matches) {
      try {
        const proposal = await this.proposeMatch(userId, match.profile.userId);
        proposed.push({
          matchId: proposal.id,
          userId: match.profile.userId,
          score: match.score.total,
          reason: proposal.reason,
        });
      } catch (err: any) {
        if (err.code !== 'MATCH_EXISTS') {
          console.log(`[MatchingService] Auto-propose failed for ${match.profile.userId}:`, err.message);
        }
      }
    }

    console.log(`[MatchingService] Auto-proposed ${proposed.length} matches for user ${userId}`);
    return proposed;
  }

  async proposeMatch(userAId: string, userBId: string) {
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

    const profileA = await vectorMatchingService.getProfileForMatching(userAId);
    const profileB = await vectorMatchingService.getProfileForMatching(userBId);
    if (!profileA || !profileB) throw new AppError(404, 'Profile not found');

    const score = matchingEngine.score(profileA, profileB);

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
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

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

  async respondToMatch(matchId: string, userId: string, response: 'ACCEPTED' | 'REJECTED') {
    const match = await prisma.match.findUnique({ where: { id: matchId } });
    if (!match) throw new AppError(404, 'Match not found');

    const isUserA = match.userAId === userId;
    const isUserB = match.userBId === userId;

    if (!isUserA && !isUserB) {
      throw new AppError(403, 'Not part of this match');
    }

    const updateData: any = {};
    if (isUserA) {
      updateData.userAResponse = response;
      updateData.userARespondedAt = new Date();
    } else {
      updateData.userBResponse = response;
      updateData.userBRespondedAt = new Date();
    }

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

    if (updated.status === 'ACCEPTED') {
      await this.revealContacts(updated);
      introductionService.sendIntroduction(matchId).catch((e) =>
        console.log('[MatchingService] Intro send failed:', e)
      );
      this.progressDealOnAcceptance(updated.userAId, updated.userBId).catch((e) =>
        console.log('[MatchingService] Deal progression failed:', e)
      );
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
    const matches = await prisma.match.findMany({
      where: {
        OR: [{ userAId: userId }, { userBId: userId }],
        status: { not: 'REJECTED' },
      },
      include: {
        userA: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                persona: true,
                headline: true,
                companyName: true,
                currentRole: true,
                location: true,
                industries: true,
                skills: true,
                linkedinUrl: true,
                bio: true,
              },
            },
          },
        },
        userB: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                persona: true,
                headline: true,
                companyName: true,
                currentRole: true,
                location: true,
                industries: true,
                skills: true,
                linkedinUrl: true,
                bio: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return matches.map((m) => {
      const isAccepted = m.status === 'ACCEPTED';
      const isUserA = m.userAId === userId;
      const other = isUserA ? m.userB : m.userA;

      if (!isAccepted && other?.profile) {
        (other as any).email = undefined;
        if (other.profile) {
          (other.profile as any).linkedinUrl = undefined;
        }
      }
      return m;
    });
  }

  async getMatchStats(userId: string) {
    const [total, pending, accepted] = await Promise.all([
      prisma.match.count({
        where: { OR: [{ userAId: userId }, { userBId: userId }] },
      }),
      prisma.match.count({
        where: {
          OR: [
            { userAId: userId, status: { in: ['PROPOSED', 'PENDING_B'] } },
            { userBId: userId, status: { in: ['PROPOSED', 'PENDING_A'] } },
          ],
        },
      }),
      prisma.match.count({
        where: {
          OR: [{ userAId: userId }, { userBId: userId }],
          status: 'ACCEPTED',
        },
      }),
    ]);
    return { total, pending, accepted };
  }

  private async progressDealOnAcceptance(userAId: string, userBId: string) {
    const [profileA, profileB] = await Promise.all([
      prisma.profile.findUnique({ where: { userId: userAId }, select: { persona: true } }),
      prisma.profile.findUnique({ where: { userId: userBId }, select: { persona: true } }),
    ]);

    let dealPartnerId: string | null = null;
    let founderId: string | null = null;

    if (profileA?.persona === 'DEAL_PARTNER' && profileB?.persona === 'FOUNDER') {
      dealPartnerId = userAId;
      founderId = userBId;
    } else if (profileB?.persona === 'DEAL_PARTNER' && profileA?.persona === 'FOUNDER') {
      dealPartnerId = userBId;
      founderId = userAId;
    }

    if (!dealPartnerId || !founderId) return;

    const deal = await prisma.dealTracking.findUnique({
      where: { dealPartnerId_founderId: { dealPartnerId, founderId } },
    });

    if (deal && deal.status === 'OPEN') {
      await prisma.dealTracking.update({
        where: { id: deal.id },
        data: { status: 'INTRO_MADE', introSent: true, introSentAt: new Date(), introDate: new Date() },
      });
      console.log(`[DealFlow] Deal ${deal.id} progressed OPEN → INTRO_MADE on match acceptance`);
    }
  }

  async autoScoutFounders(dealPartnerId: string, limit = 5) {
    const matches = await this.findMatchesForUser(dealPartnerId, limit);
    const scouted = [];

    for (const match of matches) {
      const founderProfile = await prisma.profile.findUnique({
        where: { userId: match.profile.userId },
        select: { persona: true, industries: true, companyStage: true },
      });

      if (founderProfile?.persona !== 'FOUNDER') continue;

      try {
        const deal = await prisma.dealTracking.create({
          data: {
            dealPartnerId,
            founderId: match.profile.userId,
            industry: founderProfile.industries?.[0] || null,
            stage: founderProfile.companyStage || null,
            notes: `Auto-scouted via matching engine (score: ${(match.score.total * 100).toFixed(0)}%)`,
          },
          include: {
            founder: { select: { id: true, email: true, profile: { select: { headline: true, persona: true, companyName: true } } } },
          },
        });
        scouted.push(deal);

        try {
          await this.proposeMatch(dealPartnerId, match.profile.userId);
        } catch (err: any) {
          if (err.code !== 'MATCH_EXISTS') {
            console.log(`[DealFlow] Match propose failed for ${match.profile.userId}:`, err.message);
          }
        }
      } catch (err: any) {
        if (err.code === 'P2002') {
          console.log(`[DealFlow] Deal already tracked for founder ${match.profile.userId}`);
        } else {
          console.log(`[DealFlow] Failed to create deal for ${match.profile.userId}:`, err.message);
        }
      }
    }

    console.log(`[DealFlow] Auto-scouted ${scouted.length} founders for deal partner ${dealPartnerId}`);
    return scouted;
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

}

export const matchingService = new MatchingService();
