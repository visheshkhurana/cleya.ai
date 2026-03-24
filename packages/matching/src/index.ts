// ============================================
// Cleya.ai — Enhanced Matching Engine
// Three-layer scoring: Rule-based + Intent + Semantic
// ============================================

import { MatchScore } from '@boardy/types';

export interface ProfileForMatching {
  userId: string;
  persona: string;
  companyStage?: string;
  industries: string[];
  interests: string[];
  lookingFor: string[];
  location?: string;
  skills: string[];
  headline?: string;
  bio?: string;
  embedding?: number[];
  priority?: string;
  targetRole?: string;
  investorType?: string;
  investmentAmount?: string;
  raiseAmount?: string;
  trackedCompanies?: string;
  industryFocus?: string[];
  investmentThesis?: string;
  fundName?: string;
  businessDescription?: string;
  investmentRange?: string;
}

// ─── Persona Compatibility Matrix ───
const PERSONA_COMPATIBILITY: Record<string, Record<string, number>> = {
  FOUNDER: {
    INVESTOR: 0.95,
    ADVISOR: 0.85,
    DEAL_PARTNER: 0.90,
    VENTURE_PARTNER: 0.80,
    FOUNDER: 0.70,
    OPERATOR: 0.60,
    TALENT: 0.55,
    EVENT_PARTICIPANT: 0.65,
    RECRUITER: 0.40,
    FREELANCER: 0.50,
    JOB_SEEKER: 0.45,
    OTHER: 0.40,
  },
  INVESTOR: {
    FOUNDER: 0.95,
    EVENT_PARTICIPANT: 0.85,
    DEAL_PARTNER: 0.90,
    VENTURE_PARTNER: 0.75,
    INVESTOR: 0.65,
    ADVISOR: 0.55,
    OPERATOR: 0.40,
    TALENT: 0.15,
    RECRUITER: 0.20,
    FREELANCER: 0.15,
    JOB_SEEKER: 0.10,
    OTHER: 0.30,
  },
  TALENT: {
    FOUNDER: 0.90,
    RECRUITER: 0.95,
    OPERATOR: 0.70,
    ADVISOR: 0.50,
    TALENT: 0.25,
    INVESTOR: 0.15,
    DEAL_PARTNER: 0.20,
    VENTURE_PARTNER: 0.20,
    EVENT_PARTICIPANT: 0.30,
    FREELANCER: 0.30,
    JOB_SEEKER: 0.20,
    OTHER: 0.30,
  },
  DEAL_PARTNER: {
    FOUNDER: 0.90,
    INVESTOR: 0.90,
    DEAL_PARTNER: 0.50,
    VENTURE_PARTNER: 0.70,
    EVENT_PARTICIPANT: 0.75,
    ADVISOR: 0.60,
    OPERATOR: 0.45,
    TALENT: 0.20,
    RECRUITER: 0.25,
    FREELANCER: 0.20,
    JOB_SEEKER: 0.15,
    OTHER: 0.30,
  },
  EVENT_PARTICIPANT: {
    INVESTOR: 0.85,
    FOUNDER: 0.65,
    DEAL_PARTNER: 0.75,
    ADVISOR: 0.70,
    EVENT_PARTICIPANT: 0.55,
    VENTURE_PARTNER: 0.60,
    OPERATOR: 0.45,
    TALENT: 0.30,
    RECRUITER: 0.25,
    FREELANCER: 0.25,
    JOB_SEEKER: 0.20,
    OTHER: 0.35,
  },
  VENTURE_PARTNER: {
    FOUNDER: 0.80,
    INVESTOR: 0.75,
    DEAL_PARTNER: 0.70,
    VENTURE_PARTNER: 0.50,
    EVENT_PARTICIPANT: 0.60,
    ADVISOR: 0.65,
    OPERATOR: 0.50,
    TALENT: 0.20,
    RECRUITER: 0.25,
    FREELANCER: 0.20,
    JOB_SEEKER: 0.15,
    OTHER: 0.30,
  },
  ADVISOR: {
    FOUNDER: 0.85,
    INVESTOR: 0.55,
    DEAL_PARTNER: 0.60,
    VENTURE_PARTNER: 0.65,
    ADVISOR: 0.40,
    OPERATOR: 0.60,
    EVENT_PARTICIPANT: 0.70,
    TALENT: 0.30,
    JOB_SEEKER: 0.30,
    RECRUITER: 0.25,
    FREELANCER: 0.35,
    OTHER: 0.35,
  },
  OPERATOR: {
    FOUNDER: 0.60,
    ADVISOR: 0.60,
    OPERATOR: 0.55,
    TALENT: 0.55,
    INVESTOR: 0.40,
    DEAL_PARTNER: 0.45,
    VENTURE_PARTNER: 0.50,
    EVENT_PARTICIPANT: 0.45,
    RECRUITER: 0.50,
    JOB_SEEKER: 0.45,
    FREELANCER: 0.40,
    OTHER: 0.40,
  },
  JOB_SEEKER: {
    RECRUITER: 0.95,
    FOUNDER: 0.70,
    OPERATOR: 0.60,
    ADVISOR: 0.50,
    TALENT: 0.30,
    INVESTOR: 0.10,
    DEAL_PARTNER: 0.15,
    VENTURE_PARTNER: 0.15,
    EVENT_PARTICIPANT: 0.20,
    JOB_SEEKER: 0.20,
    FREELANCER: 0.25,
    OTHER: 0.25,
  },
  RECRUITER: {
    JOB_SEEKER: 0.95,
    TALENT: 0.95,
    FOUNDER: 0.60,
    OPERATOR: 0.50,
    RECRUITER: 0.30,
    ADVISOR: 0.25,
    INVESTOR: 0.20,
    DEAL_PARTNER: 0.25,
    VENTURE_PARTNER: 0.25,
    EVENT_PARTICIPANT: 0.25,
    FREELANCER: 0.35,
    OTHER: 0.25,
  },
  FREELANCER: {
    FOUNDER: 0.75,
    OPERATOR: 0.60,
    ADVISOR: 0.35,
    FREELANCER: 0.30,
    RECRUITER: 0.35,
    TALENT: 0.30,
    INVESTOR: 0.15,
    DEAL_PARTNER: 0.20,
    VENTURE_PARTNER: 0.20,
    EVENT_PARTICIPANT: 0.25,
    JOB_SEEKER: 0.25,
    OTHER: 0.30,
  },
  OTHER: {
    FOUNDER: 0.40,
    INVESTOR: 0.30,
    ADVISOR: 0.35,
    OPERATOR: 0.40,
    DEAL_PARTNER: 0.30,
    VENTURE_PARTNER: 0.30,
    EVENT_PARTICIPANT: 0.35,
    TALENT: 0.30,
    RECRUITER: 0.25,
    FREELANCER: 0.30,
    JOB_SEEKER: 0.25,
    OTHER: 0.30,
  },
};

// ─── Stage Compatibility ───
const STAGE_COMPATIBILITY: Record<string, string[]> = {
  PRE_SEED: ['PRE_SEED', 'SEED', 'BOOTSTRAPPED'],
  SEED: ['PRE_SEED', 'SEED', 'SERIES_A', 'BOOTSTRAPPED'],
  SERIES_A: ['SEED', 'SERIES_A', 'SERIES_B'],
  SERIES_B: ['SERIES_A', 'SERIES_B', 'SERIES_C_PLUS'],
  SERIES_C_PLUS: ['SERIES_B', 'SERIES_C_PLUS', 'GROWTH'],
  GROWTH: ['SERIES_C_PLUS', 'GROWTH', 'PUBLIC'],
  PUBLIC: ['GROWTH', 'PUBLIC'],
  BOOTSTRAPPED: ['PRE_SEED', 'SEED', 'BOOTSTRAPPED'],
};

// ─── Intent Alignment: lookingFor → persona mapping ───
const INTENT_TO_PERSONA: Record<string, string[]> = {
  fundraising: ['INVESTOR', 'DEAL_PARTNER', 'VENTURE_PARTNER'],
  investors: ['INVESTOR', 'DEAL_PARTNER', 'VENTURE_PARTNER'],
  deal_flow: ['FOUNDER', 'EVENT_PARTICIPANT', 'DEAL_PARTNER'],
  hiring: ['TALENT', 'JOB_SEEKER', 'RECRUITER'],
  job_opportunities: ['FOUNDER', 'OPERATOR', 'RECRUITER'],
  cofounder: ['FOUNDER', 'TALENT'],
  advisors: ['ADVISOR', 'VENTURE_PARTNER'],
  advisory_roles: ['FOUNDER', 'OPERATOR'],
  partnerships: ['FOUNDER', 'OPERATOR', 'DEAL_PARTNER'],
  mentoring: ['FOUNDER', 'TALENT', 'JOB_SEEKER'],
};

// ─── Founder Priority → Best persona match ───
const PRIORITY_PERSONA_BOOST: Record<string, string[]> = {
  FUNDRAISING: ['INVESTOR', 'DEAL_PARTNER', 'VENTURE_PARTNER'],
  COFOUNDER: ['TALENT', 'FOUNDER'],
  HIRING: ['TALENT', 'JOB_SEEKER', 'RECRUITER'],
  MARKETING: ['ADVISOR', 'OPERATOR', 'FREELANCER'],
  SALES_BD: ['ADVISOR', 'DEAL_PARTNER', 'OPERATOR'],
  VENTURE_PARTNER_HIRE: ['VENTURE_PARTNER', 'DEAL_PARTNER', 'ADVISOR'],
};

// ─── Talent Target Role → Best persona match ───
const TARGET_ROLE_BOOST: Record<string, string[]> = {
  FOUNDING_ENGINEER: ['FOUNDER'],
  FOUNDING_GTM: ['FOUNDER'],
  CHIEF_OF_STAFF: ['FOUNDER', 'OPERATOR'],
  GROWTH_CONTENT: ['FOUNDER', 'OPERATOR'],
  OPEN_APPLICATION: ['FOUNDER', 'OPERATOR', 'RECRUITER'],
  COFOUNDER: ['FOUNDER'],
};

export class MatchingEngine {
  private ruleWeight = 0.45;
  private intentWeight = 0.20;
  private semanticWeight = 0.35;

  score(profileA: ProfileForMatching, profileB: ProfileForMatching): MatchScore {
    const roleMatch = this.scoreRoleMatch(profileA, profileB);
    const stageMatch = this.scoreStageMatch(profileA, profileB);
    const industryMatch = this.scoreArrayOverlap(profileA.industries, profileB.industries);
    const interestMatch = this.scoreArrayOverlap(profileA.interests, profileB.interests);
    const locationMatch = this.scoreLocation(profileA.location, profileB.location);
    const skillMatch = this.scoreSkillRelevance(profileA, profileB);
    const founderContextBoost = this.scoreFounderContextMatch(profileA, profileB);

    const ruleScore =
      roleMatch * 0.22 +
      stageMatch * 0.10 +
      industryMatch * 0.20 +
      interestMatch * 0.10 +
      locationMatch * 0.10 +
      skillMatch * 0.13 +
      founderContextBoost * 0.15;

    const intentScore = this.scoreIntentAlignment(profileA, profileB);

    let semanticSimilarity = 0;
    if (profileA.embedding && profileB.embedding) {
      semanticSimilarity = this.cosineSimilarity(profileA.embedding, profileB.embedding);
    }

    const total =
      this.ruleWeight * ruleScore +
      this.intentWeight * intentScore +
      this.semanticWeight * semanticSimilarity;

    return {
      total: Math.round(total * 100) / 100,
      ruleScore: Math.round(ruleScore * 100) / 100,
      semanticScore: Math.round(semanticSimilarity * 100) / 100,
      breakdown: {
        roleMatch: Math.round(roleMatch * 100) / 100,
        stageMatch: Math.round(stageMatch * 100) / 100,
        industryMatch: Math.round(industryMatch * 100) / 100,
        interestMatch: Math.round(interestMatch * 100) / 100,
        locationMatch: Math.round(locationMatch * 100) / 100,
        skillMatch: Math.round(skillMatch * 100) / 100,
        founderContextMatch: Math.round(founderContextBoost * 100) / 100,
        intentScore: Math.round(intentScore * 100) / 100,
        semanticSimilarity: Math.round(semanticSimilarity * 100) / 100,
      },
    };
  }

  findMatches(
    user: ProfileForMatching,
    candidates: ProfileForMatching[],
    options: { limit?: number; minScore?: number } = {}
  ): Array<{ profile: ProfileForMatching; score: MatchScore }> {
    const { limit = 10, minScore = 0.3 } = options;

    const scored = candidates
      .filter((c) => c.userId !== user.userId)
      .map((candidate) => ({
        profile: candidate,
        score: this.score(user, candidate),
      }))
      .filter((m) => m.score.total >= minScore)
      .sort((a, b) => b.score.total - a.score.total);

    return scored.slice(0, limit);
  }

  // --- Scoring Functions ---

  private scoreRoleMatch(a: ProfileForMatching, b: ProfileForMatching): number {
    const base = PERSONA_COMPATIBILITY[a.persona]?.[b.persona] ?? 0.3;

    let priorityBoost = 0;
    if (a.priority && PRIORITY_PERSONA_BOOST[a.priority]?.includes(b.persona)) {
      priorityBoost = 0.15;
    }
    if (b.priority && PRIORITY_PERSONA_BOOST[b.priority]?.includes(a.persona)) {
      priorityBoost = Math.max(priorityBoost, 0.15);
    }

    let targetBoost = 0;
    if (a.targetRole && TARGET_ROLE_BOOST[a.targetRole]?.includes(b.persona)) {
      targetBoost = 0.12;
    }
    if (b.targetRole && TARGET_ROLE_BOOST[b.targetRole]?.includes(a.persona)) {
      targetBoost = Math.max(targetBoost, 0.12);
    }

    return Math.min(base + priorityBoost + targetBoost, 1.0);
  }

  private scoreFounderContextMatch(a: ProfileForMatching, b: ProfileForMatching): number {
    const scoreOneDirection = (founder: ProfileForMatching, candidate: ProfileForMatching): number => {
      if (founder.persona === 'FOUNDER' && founder.priority === 'FUNDRAISING') {
        if (!['INVESTOR', 'DEAL_PARTNER', 'VENTURE_PARTNER'].includes(candidate.persona)) return 0;

        let score = 0.4;

        const industryOverlap = this.scoreArrayOverlap(founder.industries, candidate.industries);
        score += industryOverlap * 0.35;

        if (founder.companyStage && candidate.companyStage) {
          const compatible = STAGE_COMPATIBILITY[founder.companyStage] || [];
          if (compatible.includes(candidate.companyStage)) score += 0.25;
        } else {
          score += 0.1;
        }

        if (founder.raiseAmount && candidate.investmentAmount) {
          const raiseNum = parseFloat(founder.raiseAmount.replace(/[^0-9.]/g, ''));
          const investNum = parseFloat(candidate.investmentAmount.replace(/[^0-9.]/g, ''));
          if (raiseNum > 0 && investNum > 0 && investNum <= raiseNum) {
            score += 0.1;
          }
        }

        return Math.min(score, 1.0);
      }

      if (founder.persona === 'FOUNDER' && founder.priority === 'COFOUNDER') {
        if (!['TALENT', 'FOUNDER'].includes(candidate.persona)) return 0;

        let score = 0.3;

        const founderSkills = new Set(founder.skills.map(s => s.toLowerCase()));
        const candidateSkills = new Set(candidate.skills.map(s => s.toLowerCase()));

        let complementaryCount = 0;
        let totalUnique = 0;
        for (const skill of candidateSkills) {
          if (!founderSkills.has(skill)) complementaryCount++;
          totalUnique++;
        }
        const complementaryRatio = totalUnique > 0 ? complementaryCount / totalUnique : 0;
        score += complementaryRatio * 0.4;

        const industryOverlap = this.scoreArrayOverlap(founder.industries, candidate.industries);
        score += industryOverlap * 0.2;

        const interestOverlap = this.scoreArrayOverlap(founder.interests, candidate.interests);
        score += interestOverlap * 0.1;

        return Math.min(score, 1.0);
      }

      if (founder.persona === 'FOUNDER' && founder.priority === 'HIRING') {
        if (!['TALENT', 'JOB_SEEKER'].includes(candidate.persona)) return 0;

        let score = 0.3;

        if (candidate.targetRole) {
          const roleToFounderNeed: Record<string, string[]> = {
            FOUNDING_ENGINEER: ['HIRING', 'COFOUNDER'],
            FOUNDING_GTM: ['HIRING', 'MARKETING', 'SALES_BD'],
            CHIEF_OF_STAFF: ['HIRING'],
            GROWTH_CONTENT: ['HIRING', 'MARKETING'],
            OPEN_APPLICATION: ['HIRING'],
            COFOUNDER: ['COFOUNDER', 'HIRING'],
          };
          const matchingPriorities = roleToFounderNeed[candidate.targetRole] || [];
          if (matchingPriorities.includes(founder.priority)) {
            score += 0.35;
          }
        }

        const industryOverlap = this.scoreArrayOverlap(founder.industries, candidate.industries);
        score += industryOverlap * 0.2;

        const skillRelevance = this.scoreArrayOverlap(founder.skills, candidate.skills);
        score += skillRelevance * 0.15;

        return Math.min(score, 1.0);
      }

      if (founder.persona === 'INVESTOR') {
        if (candidate.persona !== 'FOUNDER') return 0;

        let score = 0.3;

        const industryOverlap = this.scoreArrayOverlap(founder.industries, candidate.industries);
        score += industryOverlap * 0.30;

        if (founder.companyStage && candidate.companyStage) {
          const compatible = STAGE_COMPATIBILITY[founder.companyStage] || [];
          if (compatible.includes(candidate.companyStage)) score += 0.20;
        } else {
          score += 0.05;
        }

        if (founder.investmentAmount && candidate.raiseAmount) {
          const investNum = parseFloat(founder.investmentAmount.replace(/[^0-9.]/g, ''));
          const raiseNum = parseFloat(candidate.raiseAmount.replace(/[^0-9.]/g, ''));
          if (investNum > 0 && raiseNum > 0 && investNum <= raiseNum) {
            score += 0.20;
          }
        } else if (founder.investmentAmount || candidate.raiseAmount) {
          score += 0.05;
        }

        return Math.min(score, 1.0);
      }

      if (founder.persona === 'TALENT' || founder.persona === 'JOB_SEEKER') {
        if (candidate.persona !== 'FOUNDER') return 0;

        let score = 0.3;

        if (founder.targetRole && candidate.priority) {
          const roleMatchesPriority: Record<string, string[]> = {
            FOUNDING_ENGINEER: ['HIRING', 'COFOUNDER'],
            FOUNDING_GTM: ['HIRING', 'MARKETING', 'SALES_BD'],
            CHIEF_OF_STAFF: ['HIRING'],
            GROWTH_CONTENT: ['HIRING', 'MARKETING'],
            OPEN_APPLICATION: ['HIRING', 'COFOUNDER', 'MARKETING', 'SALES_BD'],
            COFOUNDER: ['COFOUNDER'],
          };
          const matchingPriorities = roleMatchesPriority[founder.targetRole] || [];
          if (matchingPriorities.includes(candidate.priority)) {
            score += 0.35;
          }
        }

        const industryOverlap = this.scoreArrayOverlap(founder.industries, candidate.industries);
        score += industryOverlap * 0.20;

        const skillRelevance = this.scoreArrayOverlap(founder.skills, candidate.skills);
        score += skillRelevance * 0.15;

        return Math.min(score, 1.0);
      }

      if (founder.persona === 'DEAL_PARTNER') {
        if (candidate.persona !== 'FOUNDER') return 0;

        let score = 0.25;

        const focusIndustries = founder.industryFocus?.length ? founder.industryFocus : founder.industries;
        const industryOverlap = this.scoreArrayOverlap(focusIndustries, candidate.industries);
        score += industryOverlap * 0.30;

        if (founder.trackedCompanies && candidate.headline) {
          const tracked = founder.trackedCompanies.toLowerCase();
          const candidateText = [
            candidate.headline || '',
            candidate.bio || '',
          ].join(' ').toLowerCase();
          const trackedList = tracked.split(/[,;|]+/).map(s => s.trim()).filter(Boolean);
          const hasOverlap = trackedList.some(company => candidateText.includes(company));
          if (hasOverlap) score += 0.25;
        }

        if (founder.companyStage && candidate.companyStage) {
          const compatible = STAGE_COMPATIBILITY[founder.companyStage] || [];
          if (compatible.includes(candidate.companyStage)) score += 0.15;
        } else {
          score += 0.05;
        }

        return Math.min(score, 1.0);
      }

      if (founder.persona === 'VENTURE_PARTNER') {
        if (candidate.persona !== 'FOUNDER') return 0;

        let score = 0.15;

        const focusIndustries = founder.industryFocus?.length ? founder.industryFocus : founder.industries;
        const industryOverlap = this.scoreArrayOverlap(focusIndustries, candidate.industries);
        score += industryOverlap * 0.20;

        if (founder.companyStage && candidate.companyStage) {
          const compatible = STAGE_COMPATIBILITY[founder.companyStage] || [];
          if (compatible.includes(candidate.companyStage)) score += 0.10;
        } else {
          score += 0.03;
        }

        if (founder.investmentRange && candidate.raiseAmount) {
          const range = founder.investmentRange.replace(/[^0-9.\-–—kKmMbB]/g, '').toLowerCase();
          const raiseNum = this.parseMoneyValue(candidate.raiseAmount);
          const rangeParts = range.split(/[-–—]/);
          if (rangeParts.length === 2) {
            const rangeMin = this.parseMoneyValue(rangeParts[0]);
            const rangeMax = this.parseMoneyValue(rangeParts[1]);
            if (rangeMin > 0 && rangeMax > 0 && raiseNum > 0 && raiseNum >= rangeMin && raiseNum <= rangeMax) {
              score += 0.20;
            } else if (rangeMax > 0 && raiseNum > 0 && raiseNum <= rangeMax * 1.5) {
              score += 0.08;
            }
          } else {
            const investNum = this.parseMoneyValue(founder.investmentRange);
            if (investNum > 0 && raiseNum > 0 && investNum <= raiseNum) {
              score += 0.15;
            }
          }
        } else if (founder.investmentAmount && candidate.raiseAmount) {
          const investNum = this.parseMoneyValue(founder.investmentAmount);
          const raiseNum = this.parseMoneyValue(candidate.raiseAmount);
          if (investNum > 0 && raiseNum > 0 && investNum <= raiseNum) {
            score += 0.20;
          }
        } else if (founder.investmentRange || founder.investmentAmount || candidate.raiseAmount) {
          score += 0.05;
        }

        if (founder.investmentThesis) {
          const thesis = founder.investmentThesis.toLowerCase();
          const candidateText = [
            candidate.businessDescription || '',
            candidate.headline || '',
            candidate.bio || '',
            ...candidate.industries,
          ].join(' ').toLowerCase();
          const thesisTerms = thesis.split(/\s+/).filter(t => t.length > 3);
          const matchedTerms = thesisTerms.filter(term => candidateText.includes(term));
          const thesisOverlap = thesisTerms.length > 0 ? matchedTerms.length / thesisTerms.length : 0;
          score += thesisOverlap * 0.35;
        }

        return Math.min(score, 1.0);
      }

      return 0;
    };

    const abScore = scoreOneDirection(a, b);
    const baScore = scoreOneDirection(b, a);
    return Math.max(abScore, baScore);
  }

  private scoreIntentAlignment(a: ProfileForMatching, b: ProfileForMatching): number {
    let score = 0;
    let checks = 0;

    for (const intent of a.lookingFor) {
      const idealPersonas = INTENT_TO_PERSONA[intent] || [];
      if (idealPersonas.includes(b.persona)) {
        score += 1.0;
      }
      checks++;
    }

    for (const intent of b.lookingFor) {
      const idealPersonas = INTENT_TO_PERSONA[intent] || [];
      if (idealPersonas.includes(a.persona)) {
        score += 1.0;
      }
      checks++;
    }

    const lookingForOverlap = this.scoreArrayOverlap(a.lookingFor, b.lookingFor);
    score += lookingForOverlap * 0.5;
    checks++;

    return checks > 0 ? Math.min(score / checks, 1.0) : 0.3;
  }

  private scoreSkillRelevance(a: ProfileForMatching, b: ProfileForMatching): number {
    if (!a.skills.length && !b.skills.length) return 0.3;

    const directOverlap = this.scoreArrayOverlap(a.skills, b.skills);

    let complementaryScore = 0;
    const aNeeds = new Set(a.lookingFor.map(s => s.toLowerCase()));
    const bSkills = new Set(b.skills.map(s => s.toLowerCase()));
    const bNeeds = new Set(b.lookingFor.map(s => s.toLowerCase()));
    const aSkills = new Set(a.skills.map(s => s.toLowerCase()));

    let complementaryChecks = 0;
    for (const need of aNeeds) {
      if (bSkills.has(need)) complementaryScore += 1;
      complementaryChecks++;
    }
    for (const need of bNeeds) {
      if (aSkills.has(need)) complementaryScore += 1;
      complementaryChecks++;
    }

    const compScore = complementaryChecks > 0 ? complementaryScore / complementaryChecks : 0;

    return directOverlap * 0.4 + compScore * 0.6;
  }

  private scoreStageMatch(a: ProfileForMatching, b: ProfileForMatching): number {
    if (!a.companyStage || !b.companyStage) return 0.5;
    const compatible = STAGE_COMPATIBILITY[a.companyStage] || [];
    return compatible.includes(b.companyStage) ? 1.0 : 0.2;
  }

  private parseMoneyValue(value: string): number {
    const cleaned = value.replace(/[^0-9.kKmMbB]/g, '').toLowerCase();
    let num = parseFloat(cleaned.replace(/[kmb]/g, ''));
    if (isNaN(num)) return 0;
    if (cleaned.includes('b')) num *= 1_000_000_000;
    else if (cleaned.includes('m')) num *= 1_000_000;
    else if (cleaned.includes('k')) num *= 1_000;
    return num;
  }

  private scoreArrayOverlap(arrA: string[], arrB: string[]): number {
    if (!arrA.length || !arrB.length) return 0.3;
    const setA = new Set(arrA.map((s) => s.toLowerCase()));
    const setB = new Set(arrB.map((s) => s.toLowerCase()));
    const intersection = [...setA].filter((x) => setB.has(x));
    const union = new Set([...setA, ...setB]);
    return intersection.length / union.size;
  }

  private scoreLocation(locA?: string, locB?: string): number {
    if (!locA || !locB) return 0.5;
    const a = locA.toLowerCase().trim();
    const b = locB.toLowerCase().trim();
    if (a === b) return 1.0;
    const partsA = a.split(',').map((s) => s.trim());
    const partsB = b.split(',').map((s) => s.trim());
    for (const pa of partsA) {
      for (const pb of partsB) {
        if (pa === pb) return 0.7;
      }
    }
    return 0.2;
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dotProduct / denom;
  }
}

export const matchingEngine = new MatchingEngine();
