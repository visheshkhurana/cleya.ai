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

export type ActionRiskLevel = 'low' | 'high';

const HIGH_RISK_ACTIONS = [
  'paid_ad_spend',
  'budget_allocation',
  'delete_content',
  'send_mass_email',
];

export function classifyActionRisk(actionType: string): ActionRiskLevel {
  if (HIGH_RISK_ACTIONS.includes(actionType)) return 'high';
  return 'low';
}

export interface GuardrailCheckResult {
  allowed: boolean;
  reason?: string;
  escalated: boolean;
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
    };
  }

  return { allowed: true, escalated: false };
}

export function shouldAutoExecute(
  autonomyLevel: AutonomyLevel,
  actionRisk: ActionRiskLevel
): 'execute' | 'queue_for_approval' {
  switch (autonomyLevel) {
    case 'manual':
      return 'queue_for_approval';
    case 'semi_autonomous':
      return actionRisk === 'low' ? 'execute' : 'queue_for_approval';
    case 'autonomous':
      return 'execute';
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
