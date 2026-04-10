/**
 * Agent Tools — bridges agent LLM responses to real actions (social posting, ads, analytics).
 *
 * Each agent has a permitted set of tools. When the LLM returns a tool_call,
 * the system validates access and executes via the underlying service.
 */

import { ayrshareService } from './ayrshareService';
import { adsService } from './adsService';
import { analyticsToolsService } from './analyticsToolsService';
import { logExecution, logAudit, scoreContentRisk, checkGuardrails, shouldAutoExecute, type AutonomyLevel } from './guardrailsService';
import { getAgentGuardrails, getAgentAutonomyLevel } from './agentRunner';

// --- Tool definitions per agent ---

const ANALYTICS_TOOLS = [
  'get_posthog_insights', 'get_ga4_insights', 'get_analytics_overview',
  'get_platform_stats', 'get_user_growth_trend', 'get_funnel_metrics',
  'get_agent_performance',
];

export const AGENT_TOOLS: Record<string, string[]> = {
  maven: ['post_to_social', 'schedule_post', 'get_post_analytics', 'get_post_history', ...ANALYTICS_TOOLS],
  ledger: ['create_ad_campaign', 'get_campaign_stats', 'optimize_campaigns', ...ANALYTICS_TOOLS],
  catalyst: ['post_to_social', 'create_ad_campaign', 'schedule_post', ...ANALYTICS_TOOLS],
  nexus: ['post_to_social', 'send_email', 'schedule_post', ...ANALYTICS_TOOLS],
  sentinel: ['get_campaign_stats', 'get_post_analytics', ...ANALYTICS_TOOLS],
  ally: ['send_email', 'schedule_post', ...ANALYTICS_TOOLS],
  closer: ['send_email', 'create_ad_campaign', ...ANALYTICS_TOOLS],
};

// --- Tool parameter schemas (used in OpenAI function-calling format) ---

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export const TOOL_DEFINITIONS: Record<string, ToolDefinition> = {
  post_to_social: {
    name: 'post_to_social',
    description: 'Post content to one or more social media platforms immediately via Ayrshare. Supported platforms: twitter, linkedin, instagram, facebook.',
    parameters: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'The post content/caption' },
        platforms: { type: 'array', items: { type: 'string', enum: ['twitter', 'linkedin', 'instagram', 'facebook'] }, description: 'Platforms to post to' },
        mediaUrls: { type: 'array', items: { type: 'string' }, description: 'Optional image/video URLs to attach' },
      },
      required: ['content', 'platforms'],
    },
  },
  schedule_post: {
    name: 'schedule_post',
    description: 'Schedule a social media post for a future date/time via Ayrshare. Supported platforms: twitter, linkedin, instagram, facebook.',
    parameters: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'The post content/caption' },
        platforms: { type: 'array', items: { type: 'string', enum: ['twitter', 'linkedin', 'instagram', 'facebook'] }, description: 'Platforms to post to' },
        scheduledDate: { type: 'string', description: 'ISO 8601 date-time for when to publish' },
        mediaUrls: { type: 'array', items: { type: 'string' }, description: 'Optional image/video URLs to attach' },
      },
      required: ['content', 'platforms', 'scheduledDate'],
    },
  },
  get_post_analytics: {
    name: 'get_post_analytics',
    description: 'Get analytics/performance data for a specific post by its Ayrshare post ID.',
    parameters: {
      type: 'object',
      properties: {
        postId: { type: 'string', description: 'The Ayrshare post ID to get analytics for' },
      },
      required: ['postId'],
    },
  },
  get_post_history: {
    name: 'get_post_history',
    description: 'Get the history of all posts made through Ayrshare.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  create_ad_campaign: {
    name: 'create_ad_campaign',
    description: 'Create a new ad campaign on Meta, LinkedIn, or Google. Campaign is created PAUSED with a max budget of ₹10,000/day.',
    parameters: {
      type: 'object',
      properties: {
        platform: { type: 'string', enum: ['meta', 'linkedin', 'google'], description: 'Ad platform' },
        name: { type: 'string', description: 'Campaign name' },
        budget: { type: 'number', description: 'Daily budget in INR (max ₹10,000)' },
        targeting: { type: 'object', description: 'Optional targeting criteria (audiences, geo, interests)' },
        objective: { type: 'string', description: 'Campaign objective (e.g. BRAND_AWARENESS, LEAD_GENERATION)' },
      },
      required: ['platform', 'name', 'budget'],
    },
  },
  get_campaign_stats: {
    name: 'get_campaign_stats',
    description: 'Get stats for all ad campaigns on a given platform (meta, linkedin, or google).',
    parameters: {
      type: 'object',
      properties: {
        platform: { type: 'string', enum: ['meta', 'linkedin', 'google'], description: 'Ad platform to get stats for' },
      },
      required: ['platform'],
    },
  },
  optimize_campaigns: {
    name: 'optimize_campaigns',
    description: 'Get optimization recommendations for ad campaigns on a given platform.',
    parameters: {
      type: 'object',
      properties: {
        platform: { type: 'string', enum: ['meta', 'linkedin', 'google'], description: 'Ad platform to optimize' },
      },
      required: ['platform'],
    },
  },
  send_email: {
    name: 'send_email',
    description: 'Send an email (placeholder — email integration not yet configured). Returns not_configured status.',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient email address' },
        subject: { type: 'string', description: 'Email subject' },
        body: { type: 'string', description: 'Email body content' },
      },
      required: ['to', 'subject', 'body'],
    },
  },
  get_posthog_insights: {
    name: 'get_posthog_insights',
    description: 'Get product analytics from PostHog: unique users, total events, top events, daily event volume, session duration, retention cohorts, and feature usage. Essential for understanding user behavior and product engagement.',
    parameters: {
      type: 'object',
      properties: {
        dateRange: { type: 'string', enum: ['7d', '30d', '90d'], description: 'Date range for analytics (default: 30d)' },
      },
    },
  },
  get_ga4_insights: {
    name: 'get_ga4_insights',
    description: 'Get website analytics from Google Analytics 4: pageviews, sessions, active users, bounce rate, top pages, traffic sources, geographic breakdown, and daily trends. Essential for understanding website traffic and acquisition channels.',
    parameters: {
      type: 'object',
      properties: {
        dateRange: { type: 'string', enum: ['7d', '30d', '90d'], description: 'Date range for analytics (default: 30d)' },
      },
    },
  },
  get_analytics_overview: {
    name: 'get_analytics_overview',
    description: 'Get a combined overview of all analytics platforms at once: GA4 (website traffic), PostHog (product analytics), Instagram (social), and Sentry (errors). Returns a summary from each configured platform.',
    parameters: {
      type: 'object',
      properties: {
        dateRange: { type: 'string', enum: ['7d', '30d', '90d'], description: 'Date range for analytics (default: 30d)' },
      },
    },
  },
  get_platform_stats: {
    name: 'get_platform_stats',
    description: 'Get Cleya.ai platform statistics from the database: total users, profiles, matches, conversations, calls, events, match acceptance rate, call completion rate, new signups, top cities, and top roles. This is the core business metrics data.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  get_user_growth_trend: {
    name: 'get_user_growth_trend',
    description: 'Get daily user signups and match creation trends over a specified number of days. Shows growth trajectory and momentum.',
    parameters: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Number of days to look back (default: 30, max: 90)' },
      },
    },
  },
  get_funnel_metrics: {
    name: 'get_funnel_metrics',
    description: 'Get the complete user activation funnel: Signed Up → Completed Profile → Received Match → Accepted Match → Started Conversation → Completed Call. Shows conversion rates at each stage. Critical for identifying drop-off points.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  get_agent_performance: {
    name: 'get_agent_performance',
    description: 'Get performance data for all AI agents: activity logs, content generation stats, run history, and enabled/disabled status. Useful for the orchestrator (Nexus) to coordinate agent activity.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
};

// --- Get OpenAI-format tool schemas for a specific agent ---

export function getToolsForAgent(agentId: string): ToolDefinition[] {
  const toolNames = AGENT_TOOLS[agentId];
  if (!toolNames) return [];
  return toolNames.map(name => TOOL_DEFINITIONS[name]).filter(Boolean);
}

export function getOpenAIToolSchemas(agentId: string): Array<{ type: 'function'; function: { name: string; description: string; parameters: Record<string, any> } }> {
  return getToolsForAgent(agentId).map(tool => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

// --- Tool execution ---

export interface ToolCallResult {
  success: boolean;
  toolName: string;
  result?: any;
  error?: string;
}

export async function executeTool(agentId: string, toolName: string, params: Record<string, any>): Promise<ToolCallResult> {
  // Verify agent has permission for this tool
  const allowedTools = AGENT_TOOLS[agentId];
  if (!allowedTools || !allowedTools.includes(toolName)) {
    return { success: false, toolName, error: `Agent "${agentId}" is not authorized to use tool "${toolName}"` };
  }

  // Run guardrails for action-type tools
  const actionTools = ['post_to_social', 'schedule_post', 'create_ad_campaign', 'send_email'];
  if (actionTools.includes(toolName)) {
    const guardrails = getAgentGuardrails(agentId);
    const autonomyLevel = getAgentAutonomyLevel(agentId);
    const contentToCheck = params.content || params.body || params.name || '';
    const riskAssessment = scoreContentRisk(contentToCheck, toolName);
    const guardrailCheck = await checkGuardrails(agentId, toolName, guardrails, contentToCheck);

    if (!guardrailCheck.allowed) {
      await logExecution({
        agentId,
        actionType: `tool_blocked_${toolName}`,
        actionDescription: `Tool ${toolName} blocked by guardrails: ${guardrailCheck.reason}`,
        autonomyLevel,
        guardrailsChecked: ['max_actions_per_day', 'max_posts_per_day', 'content_blocklist'],
        guardrailResult: 'blocked',
        executionResult: 'error',
        details: { toolName, params, reason: guardrailCheck.reason, blocked: true },
      });
      return { success: false, toolName, error: `Blocked by guardrails: ${guardrailCheck.reason}` };
    }

    const decision = shouldAutoExecute(autonomyLevel, riskAssessment.score);
    if (decision !== 'execute') {
      await logExecution({
        agentId,
        actionType: `tool_queued_${toolName}`,
        actionDescription: `Tool ${toolName} queued for approval (risk: ${riskAssessment.score}, autonomy: ${autonomyLevel})`,
        autonomyLevel,
        guardrailsChecked: ['risk_scoring', 'autonomy_level'],
        guardrailResult: 'escalated',
        executionResult: 'queued',
        details: { toolName, params, riskScore: riskAssessment.score },
      });
      return {
        success: true,
        toolName,
        result: {
          status: 'queued_for_approval',
          reason: `Risk score ${riskAssessment.score} requires approval under "${autonomyLevel}" autonomy level.`,
          riskFactors: riskAssessment.factors,
        },
      };
    }
  }

  try {
    let result: any;

    switch (toolName) {
      case 'post_to_social':
        result = await ayrshareService.post({
          content: params.content,
          platforms: params.platforms,
          mediaUrls: params.mediaUrls,
        });
        break;

      case 'schedule_post':
        result = await ayrshareService.schedulePost({
          content: params.content,
          platforms: params.platforms,
          scheduledDate: params.scheduledDate,
          mediaUrls: params.mediaUrls,
        });
        break;

      case 'get_post_analytics':
        result = await ayrshareService.getAnalytics({ postId: params.postId });
        break;

      case 'get_post_history':
        result = await ayrshareService.getHistory();
        break;

      case 'create_ad_campaign':
        result = await adsService.createCampaign({
          platform: params.platform,
          name: params.name,
          budget: params.budget,
          targeting: params.targeting,
          objective: params.objective,
        });
        break;

      case 'get_campaign_stats':
        result = await adsService.getCampaigns(params.platform);
        break;

      case 'optimize_campaigns':
        result = await adsService.optimizeCampaigns(params.platform);
        break;

      case 'send_email':
        result = { status: 'not_configured', message: 'Email sending is not yet configured. Use the publishingService email flow or configure a dedicated email provider.' };
        break;

      case 'get_posthog_insights':
        result = await analyticsToolsService.getPostHogInsights(params.dateRange);
        break;

      case 'get_ga4_insights':
        result = await analyticsToolsService.getGA4Insights(params.dateRange);
        break;

      case 'get_analytics_overview':
        result = await analyticsToolsService.getAnalyticsOverview(params.dateRange);
        break;

      case 'get_platform_stats':
        result = await analyticsToolsService.getPlatformStats();
        break;

      case 'get_user_growth_trend':
        result = await analyticsToolsService.getUserGrowthTrend(Math.min(params.days || 30, 90));
        break;

      case 'get_funnel_metrics':
        result = await analyticsToolsService.getFunnelMetrics();
        break;

      case 'get_agent_performance':
        result = await analyticsToolsService.getAgentPerformanceData();
        break;

      default:
        return { success: false, toolName, error: `Unknown tool: ${toolName}` };
    }

    // Log successful execution
    await logExecution({
      agentId,
      actionType: `tool_${toolName}`,
      actionDescription: `Executed tool ${toolName}`,
      autonomyLevel: getAgentAutonomyLevel(agentId),
      guardrailsChecked: ['max_actions_per_day'],
      guardrailResult: 'passed',
      executionResult: result?.success === false ? 'error' : 'success',
      details: { toolName, params, result },
    }).catch(() => {});

    return {
      success: result?.success !== false,
      toolName,
      result: result?.data || result,
      error: result?.error,
    };
  } catch (err: any) {
    await logExecution({
      agentId,
      actionType: `tool_error_${toolName}`,
      actionDescription: `Tool ${toolName} threw an error: ${err.message}`,
      autonomyLevel: getAgentAutonomyLevel(agentId),
      guardrailsChecked: [],
      guardrailResult: 'passed',
      executionResult: 'error',
      details: { toolName, params, error: err.message },
    }).catch(() => {});

    return { success: false, toolName, error: err.message };
  }
}

// --- Parse tool calls from LLM response (handles OpenAI function-calling format) ---

export interface ParsedToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export function parseToolCallsFromResponse(response: any): ParsedToolCall[] {
  // OpenAI format: response.choices[0].message.tool_calls
  if (response?.choices?.[0]?.message?.tool_calls) {
    return response.choices[0].message.tool_calls.map((tc: any) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: typeof tc.function.arguments === 'string'
        ? JSON.parse(tc.function.arguments)
        : tc.function.arguments,
    }));
  }

  // Manual parsing: if agent outputs JSON with tool_call pattern
  if (typeof response === 'string') {
    try {
      const jsonMatch = response.match(/\{\s*"tool_call"\s*:\s*\{[\s\S]*?\}\s*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.tool_call?.name) {
          return [{
            id: `manual_${Date.now()}`,
            name: parsed.tool_call.name,
            arguments: parsed.tool_call.arguments || {},
          }];
        }
      }
    } catch {
      // Not a tool call — agent is just chatting
    }
  }

  return [];
}
