import { prisma } from '@cleya/db';
import { matchingEngine, ProfileForMatching } from '@cleya/matching';
import { createAIService } from '@cleya/ai';
import { AppError } from '../middleware/errorHandler';
import { sendToUser } from '../websocket/server';
import { introductionService } from './introductionService';
import { vectorMatchingService } from './vectorMatchingService';
import { emailService } from './email';
import { onMatchAccepted } from './secretaryService';
import { whatsappTemplates } from './whatsappTemplates';

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

  async proposeMatch(userAId: string, userBId: string, eventId?: string) {
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

    if (profileA.persona === profileB.persona) {
      throw new AppError(400, 'Same-persona matches are not allowed', 'SAME_PERSONA');
    }

    const score = matchingEngine.score(profileA, profileB);

    console.log(`[MatchingService] Generating AI reasoning for match: ${userAId} <-> ${userBId}`);
    const reason = await this.generateMatchReason(profileA, profileB);
    console.log(`[MatchingService] Generated reasoning (${reason.length} chars): "${reason.substring(0, 80)}..."`);

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
        ...(eventId && { eventId }),
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

    const [userAData, userBData] = await Promise.all([
      prisma.user.findUnique({ where: { id: userAId }, include: { profile: true } }),
      prisma.user.findUnique({ where: { id: userBId }, include: { profile: true } }),
    ]);
    if (userAData && userBData) {
      const nameA = userAData.profile?.currentRole || userAData.email.split('@')[0];
      const nameB = userBData.profile?.currentRole || userBData.email.split('@')[0];
      const personaA = userAData.profile?.persona || 'Professional';
      const personaB = userBData.profile?.persona || 'Professional';
      emailService.sendMatchProposed(userAData.email, nameB, personaB, score.total).catch(() => {});
      emailService.sendMatchProposed(userBData.email, nameA, personaA, score.total).catch(() => {});
      whatsappTemplates.triggerMatchFound(userAId, userBId, score.total).catch((e) =>
        console.log('[MatchingService] WhatsApp match found (A) failed:', e)
      );
      whatsappTemplates.triggerMatchFound(userBId, userAId, score.total).catch((e) =>
        console.log('[MatchingService] WhatsApp match found (B) failed:', e)
      );
    }

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
      onMatchAccepted(matchId, updated.userAId, updated.userBId).catch((e) =>
        console.log('[MatchingService] Secretary match notification failed:', e)
      );
      whatsappTemplates.triggerMatchAccepted(updated.userAId, updated.userBId).catch((e) =>
        console.log('[MatchingService] WhatsApp match accepted (A) failed:', e)
      );
      whatsappTemplates.triggerMatchAccepted(updated.userBId, updated.userAId).catch((e) =>
        console.log('[MatchingService] WhatsApp match accepted (B) failed:', e)
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

    const nameA = userA.profile?.currentRole
      ? `${userA.profile.currentRole}${userA.profile.companyName ? ` at ${userA.profile.companyName}` : ''}`
      : userA.email.split('@')[0];
    const nameB = userB.profile?.currentRole
      ? `${userB.profile.currentRole}${userB.profile.companyName ? ` at ${userB.profile.companyName}` : ''}`
      : userB.email.split('@')[0];
    const personaA = userA.profile?.persona || 'Professional';
    const personaB = userB.profile?.persona || 'Professional';
    emailService.sendMatchAccepted(userA.email, nameB, personaB, userB.email).catch(() => {});
    emailService.sendMatchAccepted(userB.email, nameA, personaA, userA.email).catch(() => {});
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
            { userAId: userId, status: { in: ['PROPOSED', 'PENDING_A'] } },
            { userBId: userId, status: { in: ['PROPOSED', 'PENDING_B'] } },
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

  async findEventMatches(eventId: string, userId: string, limit = 5) {
    const participants = await prisma.eventParticipant.findMany({
      where: {
        eventId,
        userId: { not: userId },
        status: { in: ['REGISTERED', 'CONFIRMED', 'ATTENDED'] },
      },
      select: { userId: true },
    });

    if (participants.length === 0) return [];

    const participantIds = participants.map(p => p.userId);

    const allMatches = await this.findMatchesForUser(userId, 50);

    const eventMatches = allMatches
      .filter(m => participantIds.includes(m.profile.userId))
      .slice(0, limit);

    return eventMatches;
  }

  async matchEventParticipants(eventId: string, limit = 3) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        participants: {
          where: { status: { in: ['REGISTERED', 'CONFIRMED', 'ATTENDED'] } },
          select: { userId: true },
        },
      },
    });

    if (!event) throw new AppError(404, 'Event not found');

    const results: { userId: string; matchesProposed: number }[] = [];

    for (const participant of event.participants) {
      const eventMatches = await this.findEventMatches(eventId, participant.userId, limit);
      let proposed = 0;

      for (const match of eventMatches) {
        try {
          await this.proposeMatch(participant.userId, match.profile.userId, eventId);
          proposed++;
        } catch (err: any) {
          if (err.code !== 'MATCH_EXISTS') {
            console.log(`[EventMatch] Propose failed for ${match.profile.userId}:`, err.message);
          }
        }
      }

      results.push({ userId: participant.userId, matchesProposed: proposed });
    }

    console.log(`[EventMatch] Matched ${results.length} participants for event ${eventId}`);
    return results;
  }

  private async generateMatchReason(a: ProfileForMatching, b: ProfileForMatching): Promise<string> {
    const describeProfile = (p: ProfileForMatching) => {
      const parts: string[] = [];
      parts.push(`Persona: ${p.persona}`);
      if (p.headline) parts.push(`Role: ${p.headline}`);
      if (p.fundName) parts.push(`Fund: ${p.fundName}`);
      if (p.industries.length) parts.push(`Industries: ${p.industries.join(', ')}`);
      if (p.skills?.length) parts.push(`Skills: ${p.skills.join(', ')}`);
      if (p.lookingFor.length) parts.push(`Looking for: ${p.lookingFor.join(', ')}`);
      if (p.companyStage) parts.push(`Stage: ${p.companyStage}`);
      if (p.bio) parts.push(`Bio: ${p.bio.slice(0, 150)}`);
      if (p.businessDescription) parts.push(`Business: ${p.businessDescription.slice(0, 150)}`);
      if (p.investmentThesis) parts.push(`Thesis: ${p.investmentThesis.slice(0, 150)}`);
      if (p.raiseAmount) parts.push(`Raising: ${p.raiseAmount}`);
      if (p.investmentRange) parts.push(`Invests: ${p.investmentRange}`);
      if (p.location) parts.push(`Location: ${p.location}`);
      return parts.join('. ');
    };

    try {
      const response = await this.ai.chat([
        {
          role: 'system',
          content: 'You are Cleya, an AI networking assistant for India\'s startup ecosystem. Write exactly 2 sentences explaining why these two people should connect. Be specific — mention their actual roles, companies, industries, stages, and goals. Never be generic. Never say "complementary backgrounds."',
        },
        {
          role: 'user',
          content: `Person A: ${describeProfile(a)}\n\nPerson B: ${describeProfile(b)}\n\nWrite 2 specific sentences about why they should connect.`,
        },
      ]);
      return response.content;
    } catch (err) {
      console.log(`[MatchingService] AI reasoning failed, using profile-based fallback:`, err);
      const aRole = a.headline || a.persona;
      const bRole = b.headline || b.persona;
      const aCompany = a.fundName || (a as any).companyName || '';
      const bCompany = b.fundName || (b as any).companyName || '';
      const aLoc = a.location || '';
      const bLoc = b.location || '';
      const shared = a.industries.filter(i => b.industries.includes(i));

      const aLabel = aCompany ? `${aRole} at ${aCompany}` : aRole;
      const bLabel = bCompany ? `${bRole} at ${bCompany}` : bRole;

      if (a.persona === 'FOUNDER' && (b.persona === 'INVESTOR' || b.persona === 'VENTURE_PARTNER')) {
        const stage = a.companyStage ? ` (${a.companyStage.replace(/_/g, ' ')})` : '';
        const sector = shared.length > 0 ? ` in ${shared[0].replace(/_/g, ' ')}` : '';
        return `${aLabel}${stage} is building${sector} and could benefit from ${bLabel}'s investment expertise. ${bLoc && aLoc ? `Both active in the ${aLoc.includes(bLoc) || bLoc.includes(aLoc) ? aLoc : 'Indian'} startup ecosystem.` : 'A strong cross-role match for deal flow.'}`;
      }
      if (b.persona === 'FOUNDER' && (a.persona === 'INVESTOR' || a.persona === 'VENTURE_PARTNER')) {
        const stage = b.companyStage ? ` (${b.companyStage.replace(/_/g, ' ')})` : '';
        const sector = shared.length > 0 ? ` in ${shared[0].replace(/_/g, ' ')}` : '';
        return `${bLabel}${stage} is building${sector} and could benefit from ${aLabel}'s investment expertise. ${aLoc && bLoc ? `Both active in the ${aLoc.includes(bLoc) || bLoc.includes(aLoc) ? bLoc : 'Indian'} startup ecosystem.` : 'A strong cross-role match for deal flow.'}`;
      }
      if (shared.length > 0) {
        return `${aLabel} and ${bLabel} are both active in ${shared.slice(0, 2).join(' and ').replace(/_/g, ' ')}, creating strong potential for collaboration. ${a.lookingFor.length > 0 ? `${aRole} is looking for ${a.lookingFor[0].replace(/_/g, ' ')}.` : ''}`;
      }
      return `${aLabel} and ${bLabel} bring different perspectives from ${(a.industries[0] || 'their sector').replace(/_/g, ' ')} and ${(b.industries[0] || 'their sector').replace(/_/g, ' ')}, opening up cross-sector collaboration opportunities.`;
    }
  }

}

export const matchingService = new MatchingService();
