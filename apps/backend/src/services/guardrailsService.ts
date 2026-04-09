import { supabaseSelect, supabaseInsert } from './supabaseClient';

export type AutonomyLevel = 'manual' | 'semi_autonomous' | 'autonomous';

export interface AgentGuardrails {
  maxActionsPerDay: number;
  maxSpendPerDay: number;
  maxPostsPerDay: number;
  contentBlocklist: string[];
}

export const DEFAULT_GUARDRAILS: AgentGuardrails = {
  maxActionsPerDay: 10,
  maxSpendPerDay: 0,
  maxPostsPerDay: 5,
  contentBlocklist: [],
};

export type RiskScore = 1 | 2 | 3 | 4 | 5;

export interface RiskAssessment {
  score: RiskScore;
  factors: string[];
  requiresApproval: boolean;
}

const FINANCIAL_CLAIM_PATTERNS = [
  /\b(?:revenue|arr|mrr|burn|runway|valuation|funding|raised|invest(?:ment|ed)?)\b.*?\$?\d/i,
  /\b\d+[xX]\s*(?:return|growth|revenue)/i,
  /\b(?:roi|roas|cac|ltv|arpu)\s*(?:of|is|was|at)?\s*[\$₹]?\d/i,
  /\b(?:profit|loss|margin)\s*(?:of|is|was|at)?\s*\d+%/i,
  /\bguarantee(?:d|s)?\b.*\b(?:return|growth|revenue|profit)/i,
];

const NAMED_PERSON_PATTERNS = [
  /\b(?:Mr\.|Mrs\.|Ms\.|Dr\.)\s+[A-Z][a-z]+/,
  /\b[A-Z][a-z]+\s+[A-Z][a-z]+\s+(?:said|told|confirmed|announced|stated|denied|claimed)/,
  /\b(?:CEO|CTO|CFO|COO|founder|co-founder)\s+(?:of\s+)?[A-Z][a-z]+/i,
];

const JOURNALIST_INVESTOR_PATTERNS = [
  /\b(?:journalist|reporter|editor|correspondent|analyst)\b/i,
  /\b(?:VC|venture\s*capital|angel\s*invest|seed\s*fund|series\s*[A-F])\b/i,
  /\b(?:sequoia|accel|tiger\s*global|softbank|andreessen|lightspeed|100x\.vc|antler|matrix\s*partners)\b/i,
  /\b(?:techcrunch|economic\s*times|mint|moneycontrol|livemint|yourstory|inc42)\b/i,
];

const LEGAL_LANGUAGE_PATTERNS = [
  /\b(?:lawsuit|litigation|arbitration|injunction|subpoena|indictment)\b/i,
  /\b(?:compliance|regulatory|SEBI|RBI|DPIIT|MCA|GDPR|CCPA)\b/i,
  /\b(?:patent|trademark|copyright|intellectual\s*property|IP\s*infringement)\b/i,
  /\b(?:terms\s*(?:and|&)\s*conditions|privacy\s*policy|disclaimer|liability)\b/i,
  /\b(?:contract|agreement|NDA|non-compete|non-disclosure)\b/i,
];

const CRISIS_PATTERNS = [
  /\b(?:data\s*breach|security\s*incident|hack(?:ed)?|compromised|leaked|vulnerability)\b/i,
  /\b(?:layoff|downsize|restructur|pivot|shut(?:ting)?\s*down|wind(?:ing)?\s*down)\b/i,
  /\b(?:scandal|controversy|allegation|misconduct|fraud|scam)\b/i,
  /\b(?:recall|outage|downtime|incident\s*report|postmortem)\b/i,
];

const NON_ENGLISH_PATTERN = /[^\x00-\x7F]{20,}/;

export function scoreContentRisk(content: string, actionType?: string): RiskAssessment {
  const factors: string[] = [];
  let score = 1;

  let financialHits = 0;
  for (const pattern of FINANCIAL_CLAIM_PATTERNS) {
    if (pattern.test(content)) {
      financialHits++;
    }
  }
  if (financialHits >= 2) {
    score = Math.max(score, 4);
    factors.push('Multiple financial claims detected');
  } else if (financialHits === 1) {
    score = Math.max(score, 3);
    factors.push('Financial claim detected');
  }

  let personHits = 0;
  for (const pattern of NAMED_PERSON_PATTERNS) {
    if (pattern.test(content)) {
      personHits++;
    }
  }
  if (personHits > 0) {
    score = Math.max(score, 3);
    factors.push('Named person/company reference');
  }

  for (const pattern of JOURNALIST_INVESTOR_PATTERNS) {
    if (pattern.test(content)) {
      score = Math.max(score, 4);
      factors.push('Journalist/investor context detected');
      break;
    }
  }

  let legalHits = 0;
  for (const pattern of LEGAL_LANGUAGE_PATTERNS) {
    if (pattern.test(content)) {
      legalHits++;
    }
  }
  if (legalHits >= 2) {
    score = Math.max(score, 5);
    factors.push('Significant legal language detected');
  } else if (legalHits === 1) {
    score = Math.max(score, 3);
    factors.push('Legal language detected');
  }

  for (const pattern of CRISIS_PATTERNS) {
    if (pattern.test(content)) {
      score = Math.max(score, 5);
      factors.push('Crisis/sensitive topic detected');
      break;
    }
  }

  if (NON_ENGLISH_PATTERN.test(content)) {
    score = Math.max(score, 3);
    factors.push('Non-English content detected');
  }

  if (actionType === 'paid_ad_spend' || actionType === 'budget_allocation') {
    score = Math.max(score, 4);
    factors.push('Ad spend / budget action');
  }

  if (actionType === 'send_mass_email') {
    score = Math.max(score, 4);
    factors.push('Mass email action');
  }

  if (actionType === 'delete_content') {
    score = Math.max(score, 3);
    factors.push('Content deletion action');
  }

  if (factors.length === 0) {
    factors.push('Standard content — no elevated risk');
  }

  return {
    score: Math.min(score, 5) as RiskScore,
    factors,
    requiresApproval: score >= 3,
  };
}

export type ActionRiskLevel = 'low' | 'high';

export function classifyActionRisk(actionType: string): ActionRiskLevel {
  const riskAssessment = scoreContentRisk('', actionType);
  return riskAssessment.score >= 3 ? 'high' : 'low';
}

export interface GuardrailCheckResult {
  allowed: boolean;
  reason?: string;
  escalated: boolean;
  riskScore?: RiskScore;
  riskFactors?: string[];
}

export async function checkGuardrails(
  agentId: string,
  actionType: string,
  guardrails: AgentGuardrails,
  content?: string,
  spendAmount?: number
): Promise<GuardrailCheckResult> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const riskAssessment = content
    ? scoreContentRisk(content, actionType)
    : scoreContentRisk('', actionType);

  try {
    const todayLogs = await supabaseSelect<{ id: number }>('dm_execution_log', {
      agent_id: agentId,
    });
    const todayActions = todayLogs.filter(
      (l: any) => new Date(l.executed_at) >= todayStart
    );

    if (todayActions.length >= guardrails.maxActionsPerDay) {
      return {
        allowed: false,
        reason: `Daily action limit reached (${guardrails.maxActionsPerDay})`,
        escalated: true,
        riskScore: riskAssessment.score,
        riskFactors: riskAssessment.factors,
      };
    }

    const publishActions = todayLogs.filter(
      (l: any) =>
        new Date(l.executed_at) >= todayStart &&
        ['publish_linkedin', 'publish_instagram', 'send_email'].includes(l.action_type)
    );
    if (publishActions.length >= guardrails.maxPostsPerDay) {
      return {
        allowed: false,
        reason: `Daily post limit reached (${guardrails.maxPostsPerDay})`,
        escalated: true,
        riskScore: riskAssessment.score,
        riskFactors: riskAssessment.factors,
      };
    }

    if (spendAmount && spendAmount > 0) {
      const todaySpend = todayLogs
        .filter((l: any) => new Date(l.executed_at) >= todayStart && l.spend_amount)
        .reduce((sum: number, l: any) => sum + (l.spend_amount || 0), 0);
      if (todaySpend + spendAmount > guardrails.maxSpendPerDay) {
        return {
          allowed: false,
          reason: `Daily spend limit would be exceeded ($${guardrails.maxSpendPerDay})`,
          escalated: true,
          riskScore: riskAssessment.score,
          riskFactors: riskAssessment.factors,
        };
      }
    }

    if (content && guardrails.contentBlocklist.length > 0) {
      const lowerContent = content.toLowerCase();
      for (const term of guardrails.contentBlocklist) {
        if (lowerContent.includes(term.toLowerCase())) {
          return {
            allowed: false,
            reason: `Content contains blocked term: "${term}"`,
            escalated: true,
            riskScore: riskAssessment.score,
            riskFactors: riskAssessment.factors,
          };
        }
      }
    }
  } catch (err: any) {
    console.error(`[Guardrails] Check failed for ${agentId}, blocking for safety: ${err.message}`);
    return {
      allowed: false,
      reason: `Guardrail check error — action blocked for safety: ${err.message}`,
      escalated: true,
      riskScore: riskAssessment.score,
      riskFactors: riskAssessment.factors,
    };
  }

  return {
    allowed: true,
    escalated: false,
    riskScore: riskAssessment.score,
    riskFactors: riskAssessment.factors,
  };
}

export function shouldAutoExecute(
  autonomyLevel: AutonomyLevel,
  riskScore: RiskScore
): 'execute' | 'queue_for_approval' {
  switch (autonomyLevel) {
    case 'manual':
      return 'queue_for_approval';
    case 'semi_autonomous':
      return riskScore < 3 ? 'execute' : 'queue_for_approval';
    case 'autonomous':
      return riskScore < 3 ? 'execute' : 'queue_for_approval';
    default:
      return 'queue_for_approval';
  }
}

export async function logExecution(params: {
  agentId: string;
  actionType: string;
  actionDescription: string;
  autonomyLevel: AutonomyLevel;
  guardrailsChecked: string[];
  guardrailResult: 'passed' | 'blocked' | 'escalated';
  executionResult: 'success' | 'error' | 'queued';
  details?: Record<string, any>;
  spendAmount?: number;
}): Promise<void> {
  try {
    await supabaseInsert('dm_execution_log', {
      agent_id: params.agentId,
      action_type: params.actionType,
      action_description: params.actionDescription,
      autonomy_level: params.autonomyLevel,
      guardrails_checked: params.guardrailsChecked,
      guardrail_result: params.guardrailResult,
      execution_result: params.executionResult,
      details: params.details || {},
      spend_amount: params.spendAmount || 0,
      executed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error(`[ExecutionLog] Failed to log execution for ${params.agentId}: ${err.message}`);
  }
}

export async function logAudit(params: {
  agentId: string;
  actionType: string;
  actionDescription: string;
  entityType?: string;
  entityId?: string;
  riskScore?: number;
  costAmount?: number;
  costCurrency?: string;
  inputSummary?: string;
  outputSummary?: string;
  status?: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  try {
    await supabaseInsert('audit_log', {
      agent_id: params.agentId,
      action_type: params.actionType,
      action_description: params.actionDescription,
      entity_type: params.entityType || '',
      entity_id: params.entityId || '',
      risk_score: params.riskScore || 1,
      cost_amount: params.costAmount || 0,
      cost_currency: params.costCurrency || 'USD',
      input_summary: params.inputSummary || '',
      output_summary: params.outputSummary || '',
      status: params.status || 'success',
      metadata: params.metadata || {},
      created_at: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error(`[AuditLog] Failed to log audit for ${params.agentId}: ${err.message}`);
  }
}
