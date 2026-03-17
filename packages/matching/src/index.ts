// ============================================
// Cleo.ai — Matching Engine
// Two-layer scoring: Rule-based + Semantic
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
}

// ─── Persona Compatibility Matrix ───
// Defines which persona pairs have high networking value
const PERSONA_COMPATIBILITY: Record<string, Record<string, number>> = {
  FOUNDER: {
    INVESTOR: 0.95,
    ADVISOR: 0.85,
    FOUNDER: 0.70,
    OPERATOR: 0.60,
    RECRUITER: 0.40,
    FREELANCER: 0.50,
    JOB_SEEKER: 0.45,
  },
  INVESTOR: {
    FOUNDER: 0.95,
    INVESTOR: 0.65,
    ADVISOR: 0.55,
    OPERATOR: 0.40,
    RECRUITER: 0.20,
    FREELANCER: 0.15,
    JOB_SEEKER: 0.10,
  },
  ADVISOR: {
    FOUNDER: 0.85,
    INVESTOR: 0.55,
    ADVISOR: 0.40,
    OPERATOR: 0.60,
    JOB_SEEKER: 0.30,
    RECRUITER: 0.25,
    FREELANCER: 0.35,
  },
  OPERATOR: {
    FOUNDER: 0.60,
    ADVISOR: 0.60,
    OPERATOR: 0.55,
    INVESTOR: 0.40,
    RECRUITER: 0.50,
    JOB_SEEKER: 0.45,
    FREELANCER: 0.40,
  },
  JOB_SEEKER: {
    RECRUITER: 0.95,
    FOUNDER: 0.70,
    OPERATOR: 0.60,
    ADVISOR: 0.50,
    INVESTOR: 0.10,
    JOB_SEEKER: 0.20,
    FREELANCER: 0.25,
  },
  RECRUITER: {
    JOB_SEEKER: 0.95,
    FOUNDER: 0.60,
    OPERATOR: 0.50,
    RECRUITER: 0.30,
    ADVISOR: 0.25,
    INVESTOR: 0.20,
    FREELANCER: 0.35,
  },
  FREELANCER: {
    FOUNDER: 0.75,
    OPERATOR: 0.60,
    ADVISOR: 0.35,
    FREELANCER: 0.30,
    RECRUITER: 0.35,
    INVESTOR: 0.15,
    JOB_SEEKER: 0.25,
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

export class MatchingEngine {
  private ruleWeight = 0.6;
  private semanticWeight = 0.4;

  // Compute full match score between two profiles
  score(profileA: ProfileForMatching, profileB: ProfileForMatching): MatchScore {
    const roleMatch = this.scoreRoleMatch(profileA, profileB);
    const stageMatch = this.scoreStageMatch(profileA, profileB);
    const industryMatch = this.scoreArrayOverlap(profileA.industries, profileB.industries);
    const interestMatch = this.scoreArrayOverlap(profileA.interests, profileB.interests);
    const locationMatch = this.scoreLocation(profileA.location, profileB.location);

    // Rule-based composite
    const ruleScore =
      roleMatch * 0.30 +
      stageMatch * 0.15 +
      industryMatch * 0.25 +
      interestMatch * 0.15 +
      locationMatch * 0.15;

    // Semantic similarity (if embeddings available)
    let semanticSimilarity = 0;
    if (profileA.embedding && profileB.embedding) {
      semanticSimilarity = this.cosineSimilarity(profileA.embedding, profileB.embedding);
    }

    const total =
      this.ruleWeight * ruleScore +
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
        semanticSimilarity: Math.round(semanticSimilarity * 100) / 100,
      },
    };
  }

  // Find top N matches for a user from a candidate pool
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
    return PERSONA_COMPATIBILITY[a.persona]?.[b.persona] ?? 0.3;
  }

  private scoreStageMatch(a: ProfileForMatching, b: ProfileForMatching): number {
    if (!a.companyStage || !b.companyStage) return 0.5; // Neutral if unknown
    const compatible = STAGE_COMPATIBILITY[a.companyStage] || [];
    return compatible.includes(b.companyStage) ? 1.0 : 0.2;
  }

  private scoreArrayOverlap(arrA: string[], arrB: string[]): number {
    if (!arrA.length || !arrB.length) return 0.3;
    const setA = new Set(arrA.map((s) => s.toLowerCase()));
    const setB = new Set(arrB.map((s) => s.toLowerCase()));
    const intersection = [...setA].filter((x) => setB.has(x));
    const union = new Set([...setA, ...setB]);
    return intersection.length / union.size; // Jaccard similarity
  }

  private scoreLocation(locA?: string, locB?: string): number {
    if (!locA || !locB) return 0.5;
    const a = locA.toLowerCase().trim();
    const b = locB.toLowerCase().trim();
    if (a === b) return 1.0;
    // Check city or country overlap
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
