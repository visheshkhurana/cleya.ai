import { type LLMProvider, getProviderForModel } from '@cleya/ai';

export interface ModelRoutingDecision {
  primaryModel: string;
  primaryProvider: LLMProvider;
  fallbackModel: string;
  fallbackProvider: LLMProvider;
  reason: string;
}

export type TaskType =
  | 'content_generation'
  | 'linkedin_post'
  | 'instagram_post'
  | 'social_caption'
  | 'newsletter'
  | 'blog_article'
  | 'thought_leadership'
  | 'support_reply'
  | 'support_faq'
  | 'financial_report'
  | 'financial_analysis'
  | 'tech_report'
  | 'security_audit'
  | 'growth_experiment'
  | 'sales_outreach'
  | 'operational_plan'
  | 'indian_language_content'
  | 'research'
  | 'quick_task';

export type QualityLevel = 'economy' | 'standard' | 'premium';

export interface RoutingInput {
  agentId: string;
  taskType?: TaskType | string;
  qualityLevel?: QualityLevel;
  language?: string;
  complexity?: 'low' | 'medium' | 'high';
}

const AGENT_DEFAULT_MODELS: Record<string, { primary: string; fallback: string; reason: string }> = {
  nexus: {
    primary: 'gpt-4o',
    fallback: 'gpt-4o-mini',
    reason: 'Orchestrator needs strong reasoning for delegation planning',
  },
  maven: {
    primary: 'claude-sonnet-4-20250514',
    fallback: 'gpt-4o-mini',
    reason: 'Claude Sonnet excels at long-form marketing content and brand voice',
  },
  ledger: {
    primary: 'gpt-4o',
    fallback: 'claude-sonnet-4-20250514',
    reason: 'GPT-4o is strong at structured financial analysis and reports',
  },
  sentinel: {
    primary: 'gpt-4o',
    fallback: 'claude-sonnet-4-20250514',
    reason: 'GPT-4o handles technical analysis and structured output well',
  },
  ally: {
    primary: 'claude-sonnet-4-20250514',
    fallback: 'gpt-4o-mini',
    reason: 'Claude Sonnet provides empathetic, nuanced support replies',
  },
  catalyst: {
    primary: 'gpt-4o-mini',
    fallback: 'gemini-1.5-flash',
    reason: 'Growth experiments are fast-iteration tasks suited for cost-efficient models',
  },
  closer: {
    primary: 'gpt-4o',
    fallback: 'claude-sonnet-4-20250514',
    reason: 'Sales outreach needs persuasive, well-structured communication',
  },
};

const TASK_TYPE_OVERRIDES: Record<string, { primary: string; fallback: string; reason: string }> = {
  thought_leadership: {
    primary: 'claude-sonnet-4-20250514',
    fallback: 'gpt-4o',
    reason: 'Claude Sonnet excels at LinkedIn thought leadership — nuanced, authentic voice',
  },
  linkedin_post: {
    primary: 'claude-sonnet-4-20250514',
    fallback: 'gpt-4o-mini',
    reason: 'Claude Sonnet for professional, long-form LinkedIn content',
  },
  social_caption: {
    primary: 'gpt-4o-mini',
    fallback: 'gemini-1.5-flash',
    reason: 'Quick social captions are cost-efficient with smaller models',
  },
  instagram_post: {
    primary: 'gpt-4o-mini',
    fallback: 'gemini-1.5-flash',
    reason: 'Short visual-copy is handled well by fast models',
  },
  support_reply: {
    primary: 'claude-sonnet-4-20250514',
    fallback: 'gpt-4o',
    reason: 'Claude Sonnet for empathetic, careful customer support replies',
  },
  support_faq: {
    primary: 'gpt-4o-mini',
    fallback: 'gemini-1.5-flash',
    reason: 'FAQ generation is straightforward — cost-efficient model preferred',
  },
  financial_report: {
    primary: 'gpt-4o',
    fallback: 'claude-sonnet-4-20250514',
    reason: 'GPT-4o for detailed financial analysis with structured output',
  },
  financial_analysis: {
    primary: 'gpt-4o',
    fallback: 'claude-sonnet-4-20250514',
    reason: 'GPT-4o for numerical analysis and financial modeling',
  },
  security_audit: {
    primary: 'gpt-4o',
    fallback: 'claude-sonnet-4-20250514',
    reason: 'GPT-4o for technical security assessment',
  },
  indian_language_content: {
    primary: 'gemini-1.5-pro',
    fallback: 'gpt-4o',
    reason: 'Gemini has superior Indic language support',
  },
  research: {
    primary: 'gemini-1.5-pro',
    fallback: 'gpt-4o',
    reason: 'Gemini 1.5 Pro has strong reasoning for research synthesis',
  },
  operational_plan: {
    primary: 'gpt-4o',
    fallback: 'claude-sonnet-4-20250514',
    reason: 'Orchestration planning needs strong structured JSON output',
  },
  quick_task: {
    primary: 'gpt-4o-mini',
    fallback: 'gemini-1.5-flash',
    reason: 'Cheap/fast model for simple quick tasks',
  },
};

const INDIAN_LANGUAGES = [
  'hindi', 'tamil', 'telugu', 'kannada', 'malayalam', 'marathi',
  'bengali', 'gujarati', 'punjabi', 'odia', 'assamese', 'urdu',
];

export function routeModel(input: RoutingInput): ModelRoutingDecision {
  const { agentId, taskType, qualityLevel, language, complexity } = input;

  if (language && INDIAN_LANGUAGES.includes(language.toLowerCase())) {
    const override = TASK_TYPE_OVERRIDES['indian_language_content'];
    return {
      primaryModel: override.primary,
      primaryProvider: getProviderForModel(override.primary),
      fallbackModel: override.fallback,
      fallbackProvider: getProviderForModel(override.fallback),
      reason: override.reason,
    };
  }

  if (taskType && TASK_TYPE_OVERRIDES[taskType]) {
    const override = TASK_TYPE_OVERRIDES[taskType];
    let primary = override.primary;
    let fallback = override.fallback;

    if (qualityLevel === 'premium' && primary === 'gpt-4o-mini') {
      primary = 'gpt-4o';
    }
    if (qualityLevel === 'economy' && primary !== 'gpt-4o-mini' && primary !== 'gemini-1.5-flash') {
      primary = 'gpt-4o-mini';
      fallback = 'gemini-1.5-flash';
    }

    return {
      primaryModel: primary,
      primaryProvider: getProviderForModel(primary),
      fallbackModel: fallback,
      fallbackProvider: getProviderForModel(fallback),
      reason: override.reason,
    };
  }

  const agentDefaults = AGENT_DEFAULT_MODELS[agentId];
  if (agentDefaults) {
    let primary = agentDefaults.primary;
    let fallback = agentDefaults.fallback;

    if (complexity === 'high' && primary === 'gpt-4o-mini') {
      primary = 'gpt-4o';
    }
    if (qualityLevel === 'economy' && primary !== 'gpt-4o-mini') {
      primary = 'gpt-4o-mini';
      fallback = 'gemini-1.5-flash';
    }

    return {
      primaryModel: primary,
      primaryProvider: getProviderForModel(primary),
      fallbackModel: fallback,
      fallbackProvider: getProviderForModel(fallback),
      reason: agentDefaults.reason,
    };
  }

  return {
    primaryModel: 'gpt-4o-mini',
    primaryProvider: 'openai',
    fallbackModel: 'gemini-1.5-flash',
    fallbackProvider: 'google',
    reason: 'Default fallback — no specific routing rule matched',
  };
}

export function inferTaskType(agentId: string, taskContext?: string): TaskType | string {
  if (!taskContext) {
    const agentTaskMap: Record<string, TaskType> = {
      nexus: 'operational_plan',
      maven: 'content_generation',
      ledger: 'financial_report',
      sentinel: 'tech_report',
      ally: 'support_reply',
      catalyst: 'growth_experiment',
      closer: 'sales_outreach',
    };
    return agentTaskMap[agentId] || 'content_generation';
  }

  const lower = taskContext.toLowerCase();

  if (lower.includes('linkedin') && (lower.includes('thought leadership') || lower.includes('article'))) return 'thought_leadership';
  if (lower.includes('linkedin')) return 'linkedin_post';
  if (lower.includes('instagram') || lower.includes('insta')) return 'instagram_post';
  if (lower.includes('caption') || lower.includes('tweet') || lower.includes('social')) return 'social_caption';
  if (lower.includes('newsletter') || lower.includes('email campaign')) return 'newsletter';
  if (lower.includes('blog')) return 'blog_article';
  if (lower.includes('support') && lower.includes('reply')) return 'support_reply';
  if (lower.includes('faq')) return 'support_faq';
  if (lower.includes('financial') || lower.includes('runway') || lower.includes('burn rate')) return 'financial_analysis';
  if (lower.includes('security') || lower.includes('vulnerability')) return 'security_audit';
  if (lower.includes('research')) return 'research';

  for (const lang of INDIAN_LANGUAGES) {
    if (lower.includes(lang)) return 'indian_language_content';
  }

  return inferTaskType(agentId);
}

export const HIGH_COST_THRESHOLD_INR = 500;
export const USD_TO_INR = 85;

export function isHighCostTask(costUSD: number): boolean {
  return costUSD * USD_TO_INR >= HIGH_COST_THRESHOLD_INR;
}
