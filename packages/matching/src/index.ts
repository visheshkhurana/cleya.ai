// ============================================
// Cleya.ai — Enhanced Matching Engine
// Three-layer scoring: Rule-based + Intent + Semantic
// ============================================

import { MatchScore } from '@cleya/types';

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
  companyName?: string;
  businessDescription?: string;
  investmentRange?: string;
  portfolioCompanies?: PortfolioCompany[];
  openToMeeting?: boolean;
  weeklyIntroCap?: number;
  weeklyIntrosUsed?: number;
  equityPreference?: string;
  workStyle?: string;
  functionalArea?: string;
  tractionMetrics?: TractionMetrics;
  enrichedData?: EnrichedProfileData;
  keyTractionPoints?: string;
}

export interface PortfolioCompany {
  name: string;
  sector: string;
  stage?: string;
}

export interface TractionMetrics {
  revenue?: number;
  mrr?: number;
  userCount?: number;
  growthRate?: number;
  runway?: number;
}

export interface EnrichedProfileData {
  careerHistory?: string[];
  domainExpertise?: string[];
  notableCompanies?: string[];
  exits?: string[];
  enrichedAt?: string;
}

export interface FeedbackSignal {
  userId: string;
  avgRating: number;
  totalFeedbacks: number;
  acceptRate: number;
  declineRate: number;
  positiveOutcomeRate: number;
}

export interface CompatibilitySignals {
  sectorOverlapPct: number;
  stageFit: boolean;
  checkSizeAligned: boolean;
  skillComplementarity: number;
  tractionHighlights: string[];
  conflictFlags: string[];
}

const SECTOR_FAMILIES: Record<string, string[]> = {
  fintech: ['fintech', 'payments', 'payment automation', 'lending', 'insurtech', 'neobanking', 'wealth management', 'financial services', 'banking', 'defi', 'crypto', 'blockchain finance', 'regtech'],
  enterprise: ['enterprise', 'enterprise ai', 'enterprise saas', 'enterprise software', 'b2b saas', 'erp', 'crm'],
  healthtech: ['healthtech', 'health tech', 'medtech', 'biotech', 'digital health', 'telemedicine', 'pharma', 'healthcare'],
  edtech: ['edtech', 'education', 'ed-tech', 'e-learning', 'online learning', 'upskilling'],
  saas: ['saas', 'b2b saas', 'enterprise saas', 'paas', 'software'],
  ai_ml: ['ai', 'ai/ml', 'artificial intelligence', 'machine learning', 'deep learning', 'nlp', 'computer vision', 'generative ai', 'ml'],
  ecommerce: ['ecommerce', 'e-commerce', 'marketplace', 'd2c', 'retail tech', 'commerce'],
  logistics: ['logistics', 'supply chain', 'warehousing', 'fleet management', 'last mile', 'transportation'],
  agritech: ['agritech', 'agriculture', 'farmtech', 'agri-tech', 'food tech'],
  cleantech: ['cleantech', 'clean energy', 'renewable energy', 'climate tech', 'sustainability', 'ev', 'electric vehicles'],
  proptech: ['proptech', 'real estate tech', 'construction tech', 'housing'],
  hrtech: ['hrtech', 'hr tech', 'recruiting', 'talent management', 'workforce management'],
  gaming: ['gaming', 'esports', 'game development', 'metaverse'],
  media: ['media', 'content', 'creator economy', 'social media', 'adtech', 'advertising'],
  cybersecurity: ['cybersecurity', 'security', 'infosec', 'identity management'],
  devtools: ['devtools', 'developer tools', 'infrastructure', 'cloud', 'devops', 'open source'],
  legaltech: ['legaltech', 'legal tech', 'compliance', 'govtech'],
  mobility: ['mobility', 'ride-sharing', 'autonomous vehicles', 'connected cars'],
  spacetech: ['spacetech', 'space tech', 'aerospace', 'satellite', 'drones'],
};

const SECTOR_FAMILY_SIMILARITY: Record<string, Record<string, number>> = {
  fintech: { saas: 0.35, enterprise: 0.08, ai_ml: 0.15, ecommerce: 0.25, legaltech: 0.20 },
  enterprise: { saas: 0.70, ai_ml: 0.40, devtools: 0.45, cybersecurity: 0.35, hrtech: 0.30 },
  healthtech: { ai_ml: 0.25, edtech: 0.10, cleantech: 0.10 },
  edtech: { saas: 0.25, ai_ml: 0.20, media: 0.20 },
  saas: { enterprise: 0.70, devtools: 0.50, ai_ml: 0.35, hrtech: 0.35, fintech: 0.35, cybersecurity: 0.30 },
  ai_ml: { enterprise: 0.40, saas: 0.35, devtools: 0.40, healthtech: 0.25, fintech: 0.20 },
  ecommerce: { logistics: 0.45, fintech: 0.25, media: 0.20 },
  logistics: { ecommerce: 0.45, agritech: 0.25, mobility: 0.35 },
  agritech: { cleantech: 0.30, logistics: 0.25 },
  cleantech: { mobility: 0.35, spacetech: 0.15, agritech: 0.30 },
  devtools: { enterprise: 0.45, saas: 0.50, ai_ml: 0.40, cybersecurity: 0.35 },
  cybersecurity: { enterprise: 0.35, devtools: 0.35, saas: 0.30, fintech: 0.20 },
  media: { ecommerce: 0.20, edtech: 0.20, gaming: 0.30 },
  gaming: { media: 0.30, ai_ml: 0.15 },
  hrtech: { saas: 0.35, enterprise: 0.30 },
  legaltech: { fintech: 0.20, enterprise: 0.25 },
  mobility: { cleantech: 0.35, logistics: 0.35, spacetech: 0.20 },
  proptech: { fintech: 0.15, ecommerce: 0.15 },
  spacetech: { cleantech: 0.15, mobility: 0.20 },
};

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
  private ruleWeight = 0.50;
  private intentWeight = 0.20;
  private semanticWeight = 0.30;

  private sectorFamilyCache = new Map<string, string | null>();

  private getSectorFamily(industry: string): string | null {
    const key = industry.toLowerCase().trim();
    if (this.sectorFamilyCache.has(key)) return this.sectorFamilyCache.get(key)!;
    for (const [family, members] of Object.entries(SECTOR_FAMILIES)) {
      if (members.includes(key)) {
        this.sectorFamilyCache.set(key, family);
        return family;
      }
    }
    this.sectorFamilyCache.set(key, null);
    return null;
  }

  private scoreSectorSimilarity(industriesA: string[], industriesB: string[]): number {
    if (!industriesA.length || !industriesB.length) return 0.3;

    const familiesA = new Set<string>();
    const familiesB = new Set<string>();
    const normedA = new Set(industriesA.map(s => s.toLowerCase().trim()));
    const normedB = new Set(industriesB.map(s => s.toLowerCase().trim()));

    for (const ind of normedA) {
      const fam = this.getSectorFamily(ind);
      if (fam) familiesA.add(fam);
    }
    for (const ind of normedB) {
      const fam = this.getSectorFamily(ind);
      if (fam) familiesB.add(fam);
    }

    const directOverlap = [...normedA].filter(x => normedB.has(x));
    if (directOverlap.length > 0) {
      const union = new Set([...normedA, ...normedB]);
      return Math.max(directOverlap.length / union.size, 0.6);
    }

    const familyOverlap = [...familiesA].filter(f => familiesB.has(f));
    if (familyOverlap.length > 0) {
      const familyUnion = new Set([...familiesA, ...familiesB]);
      return 0.4 + (familyOverlap.length / familyUnion.size) * 0.4;
    }

    let bestCross = 0;
    for (const fA of familiesA) {
      for (const fB of familiesB) {
        const sim = SECTOR_FAMILY_SIMILARITY[fA]?.[fB] ?? SECTOR_FAMILY_SIMILARITY[fB]?.[fA] ?? 0;
        bestCross = Math.max(bestCross, sim);
      }
    }

    if (bestCross > 0) return bestCross;

    if (familiesA.size === 0 || familiesB.size === 0) {
      const fallback = this.scoreArrayOverlap(industriesA, industriesB);
      return fallback;
    }

    return 0.05;
  }

  score(profileA: ProfileForMatching, profileB: ProfileForMatching): MatchScore {
    const roleMatch = this.scoreRoleMatch(profileA, profileB);
    const stageMatch = this.scoreStageMatch(profileA, profileB);
    const industryMatch = this.scoreSectorSimilarity(profileA.industries, profileB.industries);
    const interestMatch = this.scoreArrayOverlap(profileA.interests, profileB.interests);
    const locationMatch = this.scoreLocation(profileA.location, profileB.location);
    const skillMatch = this.scoreSkillRelevance(profileA, profileB);
    const founderContextBoost = this.scoreFounderContextMatch(profileA, profileB);
    const tractionFit = this.scoreTractionStageAlignment(profileA, profileB);
    const talentPrefMatch = this.scoreTalentPreferences(profileA, profileB);
    const portfolioConflict = this.detectPortfolioConflict(profileA, profileB);

    const ruleScore =
      roleMatch * 0.12 +
      stageMatch * 0.08 +
      industryMatch * 0.24 +
      interestMatch * 0.06 +
      locationMatch * 0.10 +
      skillMatch * 0.10 +
      founderContextBoost * 0.12 +
      tractionFit * 0.10 +
      talentPrefMatch * 0.08;

    const intentScore = this.scoreIntentAlignment(profileA, profileB);

    let semanticSimilarity = 0;
    if (profileA.embedding && profileB.embedding) {
      semanticSimilarity = this.cosineSimilarity(profileA.embedding, profileB.embedding);
    }

    const total =
      this.ruleWeight * ruleScore +
      this.intentWeight * intentScore +
      this.semanticWeight * semanticSimilarity;

    let sectorPenalty = 1.0;
    if (industryMatch <= 0.10) sectorPenalty = 0.75;
    else if (industryMatch <= 0.20) sectorPenalty = 0.85;

    const zeroResult = (_reason: string, conflict: number) => ({
      total: 0,
      ruleScore: 0,
      semanticScore: 0,
      breakdown: {
        roleMatch: 0, stageMatch: 0, industryMatch: 0, interestMatch: 0,
        locationMatch: 0, skillMatch: 0, founderContextMatch: 0, intentScore: 0,
        semanticSimilarity: 0, tractionFit: 0, talentPrefMatch: 0,
        portfolioConflict: Math.round(conflict * 100) / 100,
        availabilityPenalty: 0,
      },
    });

    if (portfolioConflict > 0) {
      return zeroResult('portfolio_conflict', portfolioConflict);
    }

    if (profileA.openToMeeting === false || profileB.openToMeeting === false) {
      return zeroResult('not_open_to_meeting', 0);
    }

    const aCapReached = profileA.weeklyIntroCap !== undefined &&
      (profileA.weeklyIntrosUsed ?? 0) >= profileA.weeklyIntroCap;
    const bCapReached = profileB.weeklyIntroCap !== undefined &&
      (profileB.weeklyIntrosUsed ?? 0) >= profileB.weeklyIntroCap;
    if (aCapReached || bCapReached) {
      return zeroResult('intro_cap_reached', 0);
    }

    const adjustedTotal = total * sectorPenalty;

    return {
      total: Math.round(adjustedTotal * 100) / 100,
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
        tractionFit: Math.round(tractionFit * 100) / 100,
        talentPrefMatch: Math.round(talentPrefMatch * 100) / 100,
        portfolioConflict: Math.round(portfolioConflict * 100) / 100,
        availabilityPenalty: 1,
      },
    };
  }

  computeCompatibilitySignals(profileA: ProfileForMatching, profileB: ProfileForMatching): CompatibilitySignals {
    const industryMatch = this.scoreSectorSimilarity(profileA.industries, profileB.industries);
    const stageCompatible = this.scoreStageMatch(profileA, profileB) > 0.5;

    let checkSizeAligned = false;
    if (profileA.investmentAmount && profileB.raiseAmount) {
      const investNum = this.parseMoneyValue(profileA.investmentAmount);
      const raiseNum = this.parseMoneyValue(profileB.raiseAmount);
      checkSizeAligned = investNum > 0 && raiseNum > 0 && investNum <= raiseNum;
    } else if (profileB.investmentAmount && profileA.raiseAmount) {
      const investNum = this.parseMoneyValue(profileB.investmentAmount);
      const raiseNum = this.parseMoneyValue(profileA.raiseAmount);
      checkSizeAligned = investNum > 0 && raiseNum > 0 && investNum <= raiseNum;
    }

    const skillComplementarity = this.scoreSkillRelevance(profileA, profileB);

    const tractionHighlights: string[] = [];
    const addTraction = (p: ProfileForMatching) => {
      if (p.tractionMetrics?.revenue) tractionHighlights.push(`Revenue: ₹${(p.tractionMetrics.revenue / 100000).toFixed(1)}L`);
      if (p.tractionMetrics?.mrr) tractionHighlights.push(`MRR: ₹${(p.tractionMetrics.mrr / 100000).toFixed(1)}L`);
      if (p.tractionMetrics?.userCount) tractionHighlights.push(`Users: ${p.tractionMetrics.userCount.toLocaleString()}`);
      if (p.tractionMetrics?.growthRate) tractionHighlights.push(`Growth: ${p.tractionMetrics.growthRate}% MoM`);
      if (p.keyTractionPoints) tractionHighlights.push(p.keyTractionPoints);
    };
    addTraction(profileA);
    addTraction(profileB);

    const conflictFlags: string[] = [];
    const conflict = this.detectPortfolioConflict(profileA, profileB);
    if (conflict > 0) conflictFlags.push('Portfolio sector conflict detected');
    if (profileA.openToMeeting === false) conflictFlags.push(`${profileA.persona} not open to meeting`);
    if (profileB.openToMeeting === false) conflictFlags.push(`${profileB.persona} not open to meeting`);

    return {
      sectorOverlapPct: Math.round(industryMatch * 100),
      stageFit: stageCompatible,
      checkSizeAligned,
      skillComplementarity: Math.round(skillComplementarity * 100) / 100,
      tractionHighlights,
      conflictFlags,
    };
  }

  findMatches(
    user: ProfileForMatching,
    candidates: ProfileForMatching[],
    options: { limit?: number; minScore?: number } = {}
  ): Array<{ profile: ProfileForMatching; score: MatchScore }> {
    const { limit = 10, minScore = 0.35 } = options;

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

        const industryOverlap = this.scoreSectorSimilarity(founder.industries, candidate.industries);
        if (industryOverlap < 0.20 && founder.industries.length > 0 && candidate.industries.length > 0) return 0.1;

        let score = 0.4;
        score += industryOverlap * 0.35;

        if (founder.companyStage && candidate.companyStage) {
          const compatible = STAGE_COMPATIBILITY[founder.companyStage] || [];
          if (compatible.includes(candidate.companyStage)) score += 0.25;
        } else {
          score += 0.1;
        }

        if (founder.raiseAmount && candidate.investmentAmount) {
          const raiseNum = this.parseMoneyValue(founder.raiseAmount);
          const investNum = this.parseMoneyValue(candidate.investmentAmount);
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

        const industryOverlap = this.scoreSectorSimilarity(founder.industries, candidate.industries);
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

        const industryOverlap = this.scoreSectorSimilarity(founder.industries, candidate.industries);
        score += industryOverlap * 0.2;

        const skillRelevance = this.scoreArrayOverlap(founder.skills, candidate.skills);
        score += skillRelevance * 0.15;

        return Math.min(score, 1.0);
      }

      if (founder.persona === 'INVESTOR') {
        if (candidate.persona !== 'FOUNDER') return 0;

        let score = 0.3;

        const industryOverlap = this.scoreSectorSimilarity(founder.industries, candidate.industries);
        score += industryOverlap * 0.30;

        if (founder.companyStage && candidate.companyStage) {
          const compatible = STAGE_COMPATIBILITY[founder.companyStage] || [];
          if (compatible.includes(candidate.companyStage)) score += 0.20;
        } else {
          score += 0.05;
        }

        if (founder.investmentAmount && candidate.raiseAmount) {
          const investNum = this.parseMoneyValue(founder.investmentAmount);
          const raiseNum = this.parseMoneyValue(candidate.raiseAmount);
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

        const industryOverlap = this.scoreSectorSimilarity(founder.industries, candidate.industries);
        score += industryOverlap * 0.20;

        const skillRelevance = this.scoreArrayOverlap(founder.skills, candidate.skills);
        score += skillRelevance * 0.15;

        return Math.min(score, 1.0);
      }

      if (founder.persona === 'DEAL_PARTNER') {
        if (candidate.persona !== 'FOUNDER') return 0;

        let score = 0.25;

        const focusIndustries = founder.industryFocus?.length ? founder.industryFocus : founder.industries;
        const industryOverlap = this.scoreSectorSimilarity(focusIndustries, candidate.industries);
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
        const industryOverlap = this.scoreSectorSimilarity(focusIndustries, candidate.industries);
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

  private scoreTractionStageAlignment(a: ProfileForMatching, b: ProfileForMatching): number {
    const scoreOneDir = (investor: ProfileForMatching, founder: ProfileForMatching): number => {
      if (!['INVESTOR', 'VENTURE_PARTNER', 'DEAL_PARTNER'].includes(investor.persona)) return 0.5;
      if (founder.persona !== 'FOUNDER') return 0.5;

      let score = 0.3;
      const traction = founder.tractionMetrics;
      if (!traction) return 0.5;

      const stage = investor.companyStage || '';
      if (stage === 'PRE_SEED' || stage === 'SEED') {
        if (traction.mrr && traction.mrr > 0) score += 0.3;
        if (traction.userCount && traction.userCount > 100) score += 0.2;
      } else if (stage === 'SERIES_A') {
        if (traction.mrr && traction.mrr >= 500000) score += 0.3;
        else if (traction.revenue && traction.revenue >= 5000000) score += 0.3;
        if (traction.growthRate && traction.growthRate >= 15) score += 0.2;
      } else if (stage === 'SERIES_B' || stage === 'SERIES_C_PLUS') {
        if (traction.revenue && traction.revenue >= 50000000) score += 0.3;
        if (traction.growthRate && traction.growthRate >= 20) score += 0.2;
      }

      if (traction.runway && traction.runway <= 6) score += 0.1;

      return Math.min(score, 1.0);
    };

    const ab = scoreOneDir(a, b);
    const ba = scoreOneDir(b, a);
    return Math.max(ab, ba);
  }

  detectPortfolioConflict(a: ProfileForMatching, b: ProfileForMatching): number {
    const checkConflict = (investor: ProfileForMatching, founder: ProfileForMatching): number => {
      if (!['INVESTOR', 'VENTURE_PARTNER'].includes(investor.persona)) return 0;
      if (founder.persona !== 'FOUNDER') return 0;
      if (!investor.portfolioCompanies?.length || !founder.industries.length) return 0;

      const founderSectors = new Set(founder.industries.map(s => s.toLowerCase().trim()));
      const founderFamilies = new Set<string>();
      for (const s of founderSectors) {
        const fam = this.getSectorFamily(s);
        if (fam) founderFamilies.add(fam);
      }

      let directMatches = 0;
      let familyMatches = 0;

      for (const pc of investor.portfolioCompanies) {
        const pcSector = pc.sector.toLowerCase().trim();
        if (founderSectors.has(pcSector)) {
          directMatches++;
        } else {
          const pcFamily = this.getSectorFamily(pcSector);
          if (pcFamily && founderFamilies.has(pcFamily)) {
            familyMatches++;
          }
        }
      }

      if (directMatches === 0 && familyMatches === 0) return 0;

      const directOverlap = founderSectors.size > 0
        ? directMatches / founderSectors.size
        : 0;
      const familyOverlap = founderSectors.size > 0
        ? familyMatches / founderSectors.size
        : 0;

      return Math.min(1.0, directOverlap + familyOverlap * 0.5);
    };

    return Math.max(checkConflict(a, b), checkConflict(b, a));
  }

  private scoreTalentPreferences(a: ProfileForMatching, b: ProfileForMatching): number {
    const scoreOneDir = (talent: ProfileForMatching, employer: ProfileForMatching): number => {
      if (!['TALENT', 'JOB_SEEKER'].includes(talent.persona)) return 0.5;
      if (!['FOUNDER', 'OPERATOR'].includes(employer.persona)) return 0.5;

      let score = 0.5;
      let checks = 0;

      if (talent.workStyle && employer.workStyle) {
        checks++;
        if (talent.workStyle.toLowerCase() === employer.workStyle.toLowerCase()) score += 0.2;
        else score -= 0.1;
      }

      if (talent.functionalArea && employer.industries.length > 0) {
        checks++;
        const area = talent.functionalArea.toLowerCase();
        const desc = (employer.businessDescription || '').toLowerCase();
        if (desc.includes(area) || employer.industries.some(i => i.toLowerCase().includes(area))) {
          score += 0.15;
        }
      }

      if (talent.equityPreference) {
        checks++;
        const pref = talent.equityPreference.toLowerCase();
        const stage = employer.companyStage || '';
        if (pref === 'equity_heavy' && ['PRE_SEED', 'SEED'].includes(stage)) score += 0.15;
        else if (pref === 'cash_heavy' && ['SERIES_B', 'SERIES_C_PLUS', 'GROWTH'].includes(stage)) score += 0.15;
        else if (pref === 'balanced') score += 0.1;
      }

      return checks > 0 ? Math.min(score, 1.0) : 0.5;
    };

    const ab = scoreOneDir(a, b);
    const ba = scoreOneDir(b, a);
    return Math.max(ab, ba);
  }

  private scoreStageMatch(a: ProfileForMatching, b: ProfileForMatching): number {
    if (!a.companyStage || !b.companyStage) return 0.5;
    const compatible = STAGE_COMPATIBILITY[a.companyStage] || [];
    return compatible.includes(b.companyStage) ? 1.0 : 0.2;
  }

  private parseMoneyValue(value: string): number {
    const t = value.toLowerCase().trim();
    if (!t) return 0;

    const croreMatch = t.match(/([\d.]+)\s*(?:cr|crore|crores)/);
    if (croreMatch) {
      const num = parseFloat(croreMatch[1]);
      return isNaN(num) ? 0 : num * 10_000_000;
    }

    const lakhMatch = t.match(/([\d.]+)\s*(?:lakh|lakhs|lac|lacs|l)\b/);
    if (lakhMatch) {
      const num = parseFloat(lakhMatch[1]);
      return isNaN(num) ? 0 : num * 100_000;
    }

    const stripped = t.replace(/,/g, '');
    const suffixMatch = stripped.match(/([\d.]+)\s*([kmb])?/);
    if (!suffixMatch) return 0;
    let num = parseFloat(suffixMatch[1]);
    if (isNaN(num)) return 0;
    const suffix = suffixMatch[2];
    if (suffix === 'b') num *= 1_000_000_000;
    else if (suffix === 'm') num *= 1_000_000;
    else if (suffix === 'k') num *= 1_000;
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
