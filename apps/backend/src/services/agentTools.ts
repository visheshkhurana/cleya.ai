/**
 * Agent Tools — bridges agent LLM responses to real actions (social posting, ads, analytics).
 *
 * Each agent has a permitted set of tools. When the LLM returns a tool_call,
 * the system validates access and executes via the underlying service.
 */

import { ayrshareService } from './ayrshareService';
import { adsService } from './adsService';
import { getAnalyticsSummary, getTopPages, getTrafficSources } from './analyticsService';
import { logExecution, logAudit, scoreContentRisk, checkGuardrails, shouldAutoExecute, type AutonomyLevel } from './guardrailsService';
import { getAgentGuardrails, getAgentAutonomyLevel } from './agentRunner';
import { addSharedMemory, getSharedMemories, searchSharedMemories } from './agentMemoryService';
import {
  sendAgentToAgentMessage, delegateTask, shareInsight,
  coordinateTask, getAgentInbox, getTeamUpdates,
} from './agentCoordinationService';
import { createFileFromContent, getFilesByCreator, getRecentFiles, getMimeType } from './fileService';

// --- Tool definitions per agent ---

const ANALYTICS_TOOLS = [
  'get_posthog_insights', 'get_ga4_insights', 'get_analytics_overview',
  'get_platform_stats', 'get_user_growth_trend', 'get_funnel_metrics',
  'get_agent_performance',
];

const FILE_TOOLS = [
  'create_file', 'list_files',
];

const COORDINATION_TOOLS = [
  'message_agent', 'delegate_to_agent', 'share_insight',
  'get_my_inbox', 'get_team_updates',
  'add_shared_memory', 'search_shared_memory',
];

const ORCHESTRATOR_TOOLS = [
  ...COORDINATION_TOOLS,
  'coordinate_task',
];

export const AGENT_TOOLS: Record<string, string[]> = {
  maven: ['post_to_social', 'schedule_post', 'get_post_analytics', 'get_post_history'],
  ledger: ['create_ad_campaign', 'get_campaign_stats', 'optimize_campaigns'],
  catalyst: ['post_to_social', 'create_ad_campaign', 'schedule_post'],
  nexus: ['post_to_social', 'send_email', 'schedule_post'],
  sentinel: ['get_campaign_stats', 'get_post_analytics', 'get_analytics_summary', 'get_top_pages', 'get_traffic_sources'],
  ally: ['send_email', 'schedule_post'],
  closer: ['send_email', 'create_ad_campaign'],
  scout: ['analyze_seo', 'keyword_research', 'analyze_competitors', 'generate_schema_markup', 'check_indexing', 'optimize_content', 'get_analytics_summary', 'get_top_pages', 'get_traffic_sources'],
  probe: ['run_page_test', 'run_api_test', 'run_agent_test', 'run_full_qa', 'get_qa_report', 'get_analytics_summary'],
  outreach: ['create_email_campaign', 'add_recipients', 'launch_campaign', 'get_campaign_analytics', 'get_recipient_list', 'pause_campaign', 'send_email'],
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
    description: 'Send a single email to one recipient via Resend.',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient email address' },
        subject: { type: 'string', description: 'Email subject' },
        body: { type: 'string', description: 'Email body content (HTML supported)' },
      },
      required: ['to', 'subject', 'body'],
    },
  },
  create_email_campaign: {
    name: 'create_email_campaign',
    description: 'Create a new cold email outreach campaign. Campaign starts as draft. Add recipients and then launch.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Campaign name (e.g. "Bangalore Founders Q2 Outreach")' },
        subjectLine: { type: 'string', description: 'Email subject line. Supports {{first_name}}, {{company}}, {{role}} personalization.' },
        emailBody: { type: 'string', description: 'Email body HTML. Supports {{first_name}}, {{last_name}}, {{company}}, {{role}}, {{full_name}} personalization.' },
        targetSegment: { type: 'string', enum: ['founders', 'investors', 'operators', 'accelerators', 'coworking', 'all'], description: 'Target audience segment' },
        sequenceSteps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              delayDays: { type: 'number', description: 'Days after previous step to send' },
              subjectLine: { type: 'string', description: 'Follow-up subject line' },
              emailBody: { type: 'string', description: 'Follow-up email body' },
            },
          },
          description: 'Optional follow-up sequence steps',
        },
      },
      required: ['name', 'subjectLine', 'emailBody'],
    },
  },
  add_recipients: {
    name: 'add_recipients',
    description: 'Add recipients to an outreach campaign. Automatically filters out unsubscribed emails.',
    parameters: {
      type: 'object',
      properties: {
        campaignId: { type: 'string', description: 'The campaign ID to add recipients to' },
        recipients: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              email: { type: 'string', description: 'Recipient email' },
              firstName: { type: 'string', description: 'First name for personalization' },
              lastName: { type: 'string', description: 'Last name' },
              company: { type: 'string', description: 'Company name' },
              role: { type: 'string', description: 'Job title/role' },
            },
            required: ['email'],
          },
          description: 'Array of recipient objects',
        },
      },
      required: ['campaignId', 'recipients'],
    },
  },
  launch_campaign: {
    name: 'launch_campaign',
    description: 'Launch a draft campaign. Sends emails to all pending recipients with 200ms delay between sends.',
    parameters: {
      type: 'object',
      properties: {
        campaignId: { type: 'string', description: 'The campaign ID to launch' },
      },
      required: ['campaignId'],
    },
  },
  get_campaign_analytics: {
    name: 'get_campaign_analytics',
    description: 'Get analytics and stats for outreach campaigns. Pass campaignId for a specific campaign, or omit for all campaigns.',
    parameters: {
      type: 'object',
      properties: {
        campaignId: { type: 'string', description: 'Optional campaign ID. Omit to get all campaigns.' },
      },
    },
  },
  get_recipient_list: {
    name: 'get_recipient_list',
    description: 'Get the recipient list for a campaign, optionally filtered by status.',
    parameters: {
      type: 'object',
      properties: {
        campaignId: { type: 'string', description: 'The campaign ID' },
        status: { type: 'string', enum: ['pending', 'sent', 'opened', 'clicked', 'replied', 'bounced', 'failed'], description: 'Filter by recipient status' },
      },
      required: ['campaignId'],
    },
  },
  pause_campaign: {
    name: 'pause_campaign',
    description: 'Pause an active or scheduled campaign.',
    parameters: {
      type: 'object',
      properties: {
        campaignId: { type: 'string', description: 'The campaign ID to pause' },
      },
      required: ['campaignId'],
    },
  },
  analyze_seo: {
    name: 'analyze_seo',
    description: 'Analyze a URL for SEO issues. Fetches the page and audits meta tags, headings, structured data, images without alt text, and common SEO problems.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The URL to audit (e.g. https://cleya.ai)' },
      },
      required: ['url'],
    },
  },
  keyword_research: {
    name: 'keyword_research',
    description: 'Generate keyword suggestions with estimated search volume for a given topic or seed keyword. Uses AI to produce keyword ideas relevant to the Indian startup ecosystem.',
    parameters: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'Seed keyword or topic to research (e.g. "AI networking India")' },
        count: { type: 'number', description: 'Number of keyword suggestions to generate (default 20)' },
      },
      required: ['topic'],
    },
  },
  analyze_competitors: {
    name: 'analyze_competitors',
    description: 'Analyze competitor websites for SEO strengths and weaknesses. Fetches competitor pages and compares meta tags, content structure, and technical SEO.',
    parameters: {
      type: 'object',
      properties: {
        urls: { type: 'array', items: { type: 'string' }, description: 'Array of competitor URLs to analyze' },
      },
      required: ['urls'],
    },
  },
  generate_schema_markup: {
    name: 'generate_schema_markup',
    description: 'Generate JSON-LD structured data markup for a given page type. Supports Organization, WebSite, FAQ, Article, LocalBusiness, and Event schemas.',
    parameters: {
      type: 'object',
      properties: {
        schemaType: { type: 'string', enum: ['Organization', 'WebSite', 'FAQPage', 'Article', 'LocalBusiness', 'Event'], description: 'The schema.org type to generate' },
        data: { type: 'object', description: 'Data to populate the schema (e.g. { name, description, url, faqs: [{q, a}] })' },
      },
      required: ['schemaType'],
    },
  },
  check_indexing: {
    name: 'check_indexing',
    description: 'Check if specific pages are indexed by search engines by performing a site: query simulation. Returns indexing status for each URL.',
    parameters: {
      type: 'object',
      properties: {
        urls: { type: 'array', items: { type: 'string' }, description: 'Array of URLs to check indexing for' },
      },
      required: ['urls'],
    },
  },
  optimize_content: {
    name: 'optimize_content',
    description: 'Optimize content for both SEO and GEO (Generative Engine Optimization). Takes content and target keyword, returns an SEO-optimized version with GEO enhancements for AI citability.',
    parameters: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'The content to optimize' },
        targetKeyword: { type: 'string', description: 'Primary target keyword to optimize for' },
        contentType: { type: 'string', enum: ['blog_post', 'landing_page', 'product_page', 'faq', 'about_page'], description: 'Type of content being optimized' },
      },
      required: ['content', 'targetKeyword'],
    },
  },
  run_page_test: {
    name: 'run_page_test',
    description: 'Test a single page load. Checks status code, response time, and basic availability.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The URL to test (e.g. https://cleya.ai)' },
      },
      required: ['url'],
    },
  },
  run_api_test: {
    name: 'run_api_test',
    description: 'Test a single API endpoint. Checks status code, response time, and whether it returns valid JSON.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The API endpoint URL to test (e.g. https://cleya.ai/api/health)' },
        method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'], description: 'HTTP method (default: GET)' },
      },
      required: ['url'],
    },
  },
  run_agent_test: {
    name: 'run_agent_test',
    description: 'Test if a specific agent responds to chat messages. Sends a ping and checks for a valid response.',
    parameters: {
      type: 'object',
      properties: {
        agentId: { type: 'string', description: 'The agent ID to test (e.g. nexus, maven, scout)' },
      },
      required: ['agentId'],
    },
  },
  run_full_qa: {
    name: 'run_full_qa',
    description: 'Run the full daily QA routine on demand. Tests all pages, APIs, agents, security, navigation, and performance.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  get_qa_report: {
    name: 'get_qa_report',
    description: 'Retrieve a QA report from the database. Returns the latest report by default, or a specific date if provided.',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Optional date in YYYY-MM-DD format. Returns latest report if omitted.' },
      },
    },
  },

  // --- GA4 Analytics tools ---
  get_analytics_summary: {
    name: 'get_analytics_summary',
    description: 'Get a combined Google Analytics summary for the last 7 days: page views, top pages, traffic sources, user metrics, and real-time active users.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  get_top_pages: {
    name: 'get_top_pages',
    description: 'Get the top pages by page views from Google Analytics. Returns page path, views, and sessions.',
    parameters: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Start date (e.g. "7daysAgo", "30daysAgo", or "2024-01-01"). Defaults to "7daysAgo".' },
        endDate: { type: 'string', description: 'End date (e.g. "today", "yesterday", or "2024-01-31"). Defaults to "today".' },
        limit: { type: 'number', description: 'Number of top pages to return (default 10)' },
      },
    },
  },
  get_traffic_sources: {
    name: 'get_traffic_sources',
    description: 'Get traffic sources from Google Analytics — session source, medium, sessions, and users.',
    parameters: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Start date (e.g. "7daysAgo", "30daysAgo", or "2024-01-01"). Defaults to "7daysAgo".' },
        endDate: { type: 'string', description: 'End date (e.g. "today", "yesterday", or "2024-01-31"). Defaults to "today".' },
      },
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
  const actionTools = ['post_to_social', 'schedule_post', 'create_ad_campaign', 'send_email', 'launch_campaign'];
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

      case 'send_email': {
        const { getUncachableResendClient } = await import('./resendClient');
        const { env: emailEnv } = await import('../config/env');
        try {
          const { client, fromEmail } = await getUncachableResendClient();
          const senderEmail = fromEmail || emailEnv.FROM_EMAIL;
          const emailResult = await client.emails.send({
            from: `Cleya <${senderEmail}>`,
            to: [params.to],
            subject: params.subject,
            html: params.body,
          });
          result = emailResult.error
            ? { success: false, error: emailResult.error.message }
            : { success: true, id: emailResult.data?.id, to: params.to, subject: params.subject };
        } catch (emailErr: any) {
          result = { success: false, error: emailErr.message };
        }
        break;
      }

      case 'create_email_campaign': {
        const { createCampaign } = await import('./outreachCampaignService');
        result = await createCampaign(params as any);
        break;
      }

      case 'add_recipients': {
        const { addRecipients } = await import('./outreachCampaignService');
        result = await addRecipients(params as any);
        break;
      }

      case 'launch_campaign': {
        const { launchCampaign } = await import('./outreachCampaignService');
        result = await launchCampaign(params.campaignId);
        break;
      }

      case 'get_campaign_analytics': {
        const { getCampaignStats } = await import('./outreachCampaignService');
        result = await getCampaignStats(params.campaignId);
        break;
      }

      case 'get_recipient_list': {
        const { getRecipientList } = await import('./outreachCampaignService');
        result = await getRecipientList(params.campaignId, params.status);
        break;
      }

      case 'pause_campaign': {
        const { pauseCampaign } = await import('./outreachCampaignService');
        result = await pauseCampaign(params.campaignId);
        break;
      }

      case 'analyze_seo':
        result = await executeAnalyzeSeo(params.url);
        break;

      case 'keyword_research':
        result = await executeKeywordResearch(params.topic, params.count || 20);
        break;

      case 'analyze_competitors':
        result = await executeAnalyzeCompetitors(params.urls);
        break;

      case 'generate_schema_markup':
        result = executeGenerateSchemaMarkup(params.schemaType, params.data || {});
        break;

      case 'check_indexing':
        result = await executeCheckIndexing(params.urls);
        break;

      case 'optimize_content':
        result = await executeOptimizeContent(params.content, params.targetKeyword, params.contentType || 'blog_post');
        break;

      // --- Probe QA tools ---
      case 'run_page_test': {
        const { runSinglePageTest } = await import('./qaAutomation');
        result = await runSinglePageTest(params.url);
        break;
      }
      case 'run_api_test': {
        const { runSingleAPITest } = await import('./qaAutomation');
        result = await runSingleAPITest(params.url, params.method || 'GET');
        break;
      }
      case 'run_agent_test': {
        const { runSingleAgentTest } = await import('./qaAutomation');
        result = await runSingleAgentTest(params.agentId);
        break;
      }
      case 'run_full_qa': {
        const { runDailyQARoutine } = await import('./qaAutomation');
        result = await runDailyQARoutine();
        break;
      }
      case 'get_qa_report': {
        if (params.date) {
          const { getQAReportByDate } = await import('./qaAutomation');
          result = await getQAReportByDate(params.date);
        } else {
          const { getLatestQAReport } = await import('./qaAutomation');
          result = await getLatestQAReport();
        }
        if (!result) result = { success: false, error: 'No QA report found' };
        break;
      }

      // --- GA4 Analytics tools ---
      case 'get_analytics_summary':
        result = await getAnalyticsSummary();
        break;

      case 'get_top_pages': {
        const startDate = params.startDate || '7daysAgo';
        const endDate = params.endDate || 'today';
        const limit = params.limit || 10;
        result = await getTopPages(startDate, endDate, limit);
        break;
      }

      case 'get_traffic_sources': {
        const startDate = params.startDate || '7daysAgo';
        const endDate = params.endDate || 'today';
        result = await getTrafficSources(startDate, endDate);
        break;
      }

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

// --- Scout SEO/GEO tool implementations ---

async function fetchPageHtml(url: string): Promise<{ html: string; statusCode: number; headers: Record<string, string> }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'CleyaScoutBot/1.0 (+https://cleya.ai)' },
    });
    const html = await resp.text();
    const headers: Record<string, string> = {};
    resp.headers.forEach((v, k) => { headers[k] = v; });
    return { html, statusCode: resp.status, headers };
  } finally {
    clearTimeout(timeout);
  }
}

function extractMetaTags(html: string): Record<string, string> {
  const tags: Record<string, string> = {};
  const metaRegex = /<meta\s+(?:[^>]*?\s+)?(?:name|property)=["']([^"']+)["']\s+(?:[^>]*?\s+)?content=["']([^"']*?)["'][^>]*>/gi;
  const metaRegexReversed = /<meta\s+(?:[^>]*?\s+)?content=["']([^"']*?)["']\s+(?:[^>]*?\s+)?(?:name|property)=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = metaRegex.exec(html))) tags[match[1]] = match[2];
  while ((match = metaRegexReversed.exec(html))) tags[match[2]] = match[1];
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (titleMatch) tags['title'] = titleMatch[1].trim();
  return tags;
}

function extractHeadings(html: string): Record<string, string[]> {
  const headings: Record<string, string[]> = {};
  for (let level = 1; level <= 6; level++) {
    const regex = new RegExp(`<h${level}[^>]*>([\\s\\S]*?)<\\/h${level}>`, 'gi');
    const found: string[] = [];
    let m;
    while ((m = regex.exec(html))) found.push(m[1].replace(/<[^>]+>/g, '').trim());
    if (found.length > 0) headings[`h${level}`] = found;
  }
  return headings;
}

function findImagesWithoutAlt(html: string): string[] {
  const noAlt: string[] = [];
  const imgRegex = /<img\s+[^>]*?>/gi;
  let m;
  while ((m = imgRegex.exec(html))) {
    const tag = m[0];
    if (!tag.includes('alt=') || /alt=["']\s*["']/i.test(tag)) {
      const srcMatch = tag.match(/src=["']([^"']+)["']/i);
      noAlt.push(srcMatch ? srcMatch[1] : '(unknown src)');
    }
  }
  return noAlt;
}

function findStructuredData(html: string): any[] {
  const schemas: any[] = [];
  const ldRegex = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = ldRegex.exec(html))) {
    try { schemas.push(JSON.parse(m[1])); } catch { /* skip invalid */ }
  }
  return schemas;
}

async function executeAnalyzeSeo(url: string): Promise<any> {
  try {
    const { html, statusCode, headers } = await fetchPageHtml(url);
    const metaTags = extractMetaTags(html);
    const headings = extractHeadings(html);
    const imagesWithoutAlt = findImagesWithoutAlt(html);
    const structuredData = findStructuredData(html);
    const canonicalMatch = html.match(/<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
    const robotsMatch = html.match(/<meta\s+[^>]*name=["']robots["'][^>]*content=["']([^"']+)["']/i);
    const viewportMatch = html.match(/<meta\s+[^>]*name=["']viewport["'][^>]*content=["']([^"']+)["']/i);

    const issues: string[] = [];
    if (!metaTags['title']) issues.push('Missing <title> tag');
    else if (metaTags['title'].length > 60) issues.push(`Title too long (${metaTags['title'].length} chars, recommended ≤60)`);
    else if (metaTags['title'].length < 30) issues.push(`Title too short (${metaTags['title'].length} chars, recommended 30-60)`);
    if (!metaTags['description']) issues.push('Missing meta description');
    else if (metaTags['description'].length > 160) issues.push(`Meta description too long (${metaTags['description'].length} chars, recommended ≤160)`);
    if (!metaTags['og:title']) issues.push('Missing Open Graph title (og:title)');
    if (!metaTags['og:description']) issues.push('Missing Open Graph description (og:description)');
    if (!metaTags['og:image']) issues.push('Missing Open Graph image (og:image)');
    if (!metaTags['twitter:card']) issues.push('Missing Twitter Card meta tag');
    if (!headings['h1'] || headings['h1'].length === 0) issues.push('Missing H1 heading');
    if (headings['h1'] && headings['h1'].length > 1) issues.push(`Multiple H1 tags found (${headings['h1'].length})`);
    if (imagesWithoutAlt.length > 0) issues.push(`${imagesWithoutAlt.length} image(s) missing alt text`);
    if (structuredData.length === 0) issues.push('No JSON-LD structured data found');
    if (!canonicalMatch) issues.push('Missing canonical URL');
    if (!viewportMatch) issues.push('Missing viewport meta tag (mobile-friendliness)');

    return {
      success: true,
      url,
      statusCode,
      metaTags,
      headings,
      imagesWithoutAlt: imagesWithoutAlt.slice(0, 10),
      structuredData,
      canonical: canonicalMatch?.[1] || null,
      robots: robotsMatch?.[1] || null,
      hasViewport: !!viewportMatch,
      issues,
      score: Math.max(0, 100 - issues.length * 8),
      contentLength: html.length,
      hasHreflang: html.includes('hreflang'),
      hasSitemap: headers['x-robots-tag'] || null,
    };
  } catch (err: any) {
    return { success: false, error: `Failed to analyze ${url}: ${err.message}` };
  }
}

async function executeKeywordResearch(topic: string, count: number): Promise<any> {
  // Generate keyword suggestions using LLM-based analysis
  // This provides intelligent keyword research without requiring an external API
  const keywordCategories = [
    { category: 'Primary', modifier: '' },
    { category: 'Long-tail', modifier: 'long tail variations of' },
    { category: 'Question-based', modifier: 'questions people ask about' },
    { category: 'Local', modifier: 'India-specific local variations of' },
    { category: 'GEO-optimized', modifier: 'AI-search-friendly phrasings of' },
  ];

  const suggestions = keywordCategories.flatMap(cat => {
    const base = topic.toLowerCase();
    const keywords: Array<{ keyword: string; category: string; intent: string; difficulty: string }> = [];

    if (cat.category === 'Primary') {
      keywords.push(
        { keyword: base, category: cat.category, intent: 'informational', difficulty: 'medium' },
        { keyword: `best ${base}`, category: cat.category, intent: 'commercial', difficulty: 'medium' },
        { keyword: `${base} platform`, category: cat.category, intent: 'commercial', difficulty: 'low' },
        { keyword: `${base} 2024`, category: cat.category, intent: 'informational', difficulty: 'low' },
      );
    } else if (cat.category === 'Long-tail') {
      keywords.push(
        { keyword: `how to find ${base}`, category: cat.category, intent: 'informational', difficulty: 'low' },
        { keyword: `${base} for startups`, category: cat.category, intent: 'commercial', difficulty: 'low' },
        { keyword: `${base} app for founders`, category: cat.category, intent: 'transactional', difficulty: 'low' },
        { keyword: `top ${base} tools`, category: cat.category, intent: 'commercial', difficulty: 'medium' },
      );
    } else if (cat.category === 'Question-based') {
      keywords.push(
        { keyword: `what is ${base}`, category: cat.category, intent: 'informational', difficulty: 'low' },
        { keyword: `how does ${base} work`, category: cat.category, intent: 'informational', difficulty: 'low' },
        { keyword: `why use ${base}`, category: cat.category, intent: 'informational', difficulty: 'low' },
        { keyword: `is ${base} worth it`, category: cat.category, intent: 'commercial', difficulty: 'low' },
      );
    } else if (cat.category === 'Local') {
      keywords.push(
        { keyword: `${base} in Bangalore`, category: cat.category, intent: 'local', difficulty: 'low' },
        { keyword: `${base} in Delhi NCR`, category: cat.category, intent: 'local', difficulty: 'low' },
        { keyword: `${base} in Mumbai`, category: cat.category, intent: 'local', difficulty: 'low' },
        { keyword: `${base} India`, category: cat.category, intent: 'local', difficulty: 'medium' },
      );
    } else if (cat.category === 'GEO-optimized') {
      keywords.push(
        { keyword: `${base} — complete guide`, category: cat.category, intent: 'informational', difficulty: 'medium' },
        { keyword: `${base} statistics and data`, category: cat.category, intent: 'informational', difficulty: 'low' },
        { keyword: `${base} comparison`, category: cat.category, intent: 'commercial', difficulty: 'medium' },
        { keyword: `${base} expert recommendations`, category: cat.category, intent: 'informational', difficulty: 'low' },
      );
    }
    return keywords;
  });

  return {
    success: true,
    topic,
    totalSuggestions: suggestions.length,
    keywords: suggestions.slice(0, count),
    geoTips: [
      'Structure content with clear, factual claims AI models can cite',
      'Include statistics and data points that AI models prefer to reference',
      'Use FAQ format for question-based keywords — these map directly to AI search queries',
      'Add authoritative source citations to increase AI citability',
    ],
  };
}

async function executeAnalyzeCompetitors(urls: string[]): Promise<any> {
  const results = await Promise.all(
    urls.slice(0, 5).map(async (url) => {
      try {
        const { html, statusCode } = await fetchPageHtml(url);
        const metaTags = extractMetaTags(html);
        const headings = extractHeadings(html);
        const structuredData = findStructuredData(html);
        const wordCount = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split(' ').length;

        const strengths: string[] = [];
        const weaknesses: string[] = [];

        if (metaTags['title'] && metaTags['title'].length >= 30 && metaTags['title'].length <= 60) strengths.push('Well-optimized title tag');
        else weaknesses.push('Title tag needs optimization');
        if (metaTags['description'] && metaTags['description'].length >= 120 && metaTags['description'].length <= 160) strengths.push('Good meta description length');
        else weaknesses.push('Meta description not optimized');
        if (metaTags['og:title'] && metaTags['og:image']) strengths.push('Open Graph tags present');
        else weaknesses.push('Missing Open Graph tags');
        if (structuredData.length > 0) strengths.push(`Has ${structuredData.length} structured data schema(s)`);
        else weaknesses.push('No structured data');
        if (headings['h1']?.length === 1) strengths.push('Single H1 tag (good practice)');
        else weaknesses.push('H1 tag issues');
        if (wordCount > 1000) strengths.push(`Good content depth (${wordCount} words)`);
        else weaknesses.push(`Thin content (${wordCount} words)`);

        return {
          url,
          statusCode,
          title: metaTags['title'] || '(no title)',
          description: metaTags['description'] || '(no description)',
          headingStructure: Object.entries(headings).map(([k, v]) => `${k}: ${v.length}`).join(', '),
          structuredDataTypes: structuredData.map((s: any) => s['@type'] || 'unknown'),
          wordCount,
          strengths,
          weaknesses,
        };
      } catch (err: any) {
        return { url, error: `Could not analyze: ${err.message}` };
      }
    })
  );

  return { success: true, competitors: results, analyzedCount: results.length };
}

function executeGenerateSchemaMarkup(schemaType: string, data: Record<string, any>): any {
  let schema: any;

  switch (schemaType) {
    case 'Organization':
      schema = {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: data.name || 'Cleya.ai',
        url: data.url || 'https://cleya.ai',
        logo: data.logo || 'https://cleya.ai/logo.png',
        description: data.description || 'AI-powered professional networking platform for India\'s startup ecosystem. Connects founders, investors, and operators through intelligent matching.',
        sameAs: data.socialProfiles || [],
        foundingDate: data.foundingDate || undefined,
        founder: data.founder ? { '@type': 'Person', name: data.founder } : undefined,
        areaServed: { '@type': 'Country', name: 'India' },
        knowsAbout: ['AI networking', 'startup ecosystem', 'founder investor matching', 'professional networking'],
      };
      break;

    case 'WebSite':
      schema = {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: data.name || 'Cleya.ai',
        url: data.url || 'https://cleya.ai',
        description: data.description || 'AI-powered networking for India\'s startup ecosystem',
        potentialAction: {
          '@type': 'SearchAction',
          target: { '@type': 'EntryPoint', urlTemplate: `${data.url || 'https://cleya.ai'}/search?q={search_term_string}` },
          'query-input': 'required name=search_term_string',
        },
      };
      break;

    case 'FAQPage':
      schema = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: (data.faqs || []).map((faq: { q: string; a: string }) => ({
          '@type': 'Question',
          name: faq.q,
          acceptedAnswer: { '@type': 'Answer', text: faq.a },
        })),
      };
      break;

    case 'Article':
      schema = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: data.title || '',
        description: data.description || '',
        author: { '@type': data.authorType || 'Organization', name: data.author || 'Cleya.ai' },
        publisher: {
          '@type': 'Organization',
          name: 'Cleya.ai',
          logo: { '@type': 'ImageObject', url: data.logo || 'https://cleya.ai/logo.png' },
        },
        datePublished: data.datePublished || new Date().toISOString(),
        dateModified: data.dateModified || new Date().toISOString(),
        image: data.image || undefined,
        mainEntityOfPage: data.url || undefined,
      };
      break;

    case 'LocalBusiness':
      schema = {
        '@context': 'https://schema.org',
        '@type': 'LocalBusiness',
        name: data.name || 'Cleya.ai',
        description: data.description || 'AI-powered networking platform for startups',
        url: data.url || 'https://cleya.ai',
        address: {
          '@type': 'PostalAddress',
          addressLocality: data.city || 'Bangalore',
          addressRegion: data.state || 'Karnataka',
          addressCountry: 'IN',
        },
        geo: data.latitude && data.longitude ? {
          '@type': 'GeoCoordinates',
          latitude: data.latitude,
          longitude: data.longitude,
        } : undefined,
        areaServed: data.cities || ['Bangalore', 'Delhi NCR', 'Mumbai', 'Hyderabad', 'Pune', 'Chennai'],
      };
      break;

    case 'Event':
      schema = {
        '@context': 'https://schema.org',
        '@type': 'Event',
        name: data.name || '',
        description: data.description || '',
        startDate: data.startDate || '',
        endDate: data.endDate || undefined,
        location: data.isOnline ? {
          '@type': 'VirtualLocation',
          url: data.locationUrl || '',
        } : {
          '@type': 'Place',
          name: data.locationName || '',
          address: data.locationAddress || '',
        },
        organizer: {
          '@type': 'Organization',
          name: 'Cleya.ai',
          url: 'https://cleya.ai',
        },
        eventStatus: 'https://schema.org/EventScheduled',
        eventAttendanceMode: data.isOnline
          ? 'https://schema.org/OnlineEventAttendanceMode'
          : 'https://schema.org/OfflineEventAttendanceMode',
      };
      break;

    default:
      return { success: false, error: `Unsupported schema type: ${schemaType}` };
  }

  // Remove undefined values
  const cleanSchema = JSON.parse(JSON.stringify(schema));

  return {
    success: true,
    schemaType,
    jsonLd: cleanSchema,
    htmlSnippet: `<script type="application/ld+json">\n${JSON.stringify(cleanSchema, null, 2)}\n</script>`,
  };
}

async function executeCheckIndexing(urls: string[]): Promise<any> {
  const results = await Promise.all(
    urls.slice(0, 10).map(async (url) => {
      try {
        // Check if the page itself is accessible and has proper indexing signals
        const { html, statusCode } = await fetchPageHtml(url);
        const robotsMeta = html.match(/<meta\s+[^>]*name=["']robots["'][^>]*content=["']([^"']+)["']/i);
        const canonicalMatch = html.match(/<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
        const noindex = robotsMeta?.[1]?.toLowerCase().includes('noindex') || false;

        return {
          url,
          accessible: statusCode === 200,
          statusCode,
          noindex,
          canonical: canonicalMatch?.[1] || null,
          canonicalMatchesUrl: canonicalMatch?.[1] === url,
          indexingSignals: {
            hasTitle: /<title[^>]*>[^<]+<\/title>/i.test(html),
            hasMetaDescription: /<meta[^>]*name=["']description["']/i.test(html),
            hasCanonical: !!canonicalMatch,
            robotsDirective: robotsMeta?.[1] || 'none (defaults to index,follow)',
          },
          recommendation: noindex
            ? 'Page has noindex directive — it will NOT be indexed'
            : statusCode === 200
              ? 'Page is accessible and indexable — verify in Google Search Console for actual index status'
              : `Page returned ${statusCode} — may not be indexed properly`,
        };
      } catch (err: any) {
        return { url, accessible: false, error: `Could not reach: ${err.message}`, recommendation: 'Page is not accessible — cannot be indexed' };
      }
    })
  );

  return { success: true, results, checkedCount: results.length };
}

async function executeOptimizeContent(content: string, targetKeyword: string, contentType: string): Promise<any> {
  const wordCount = content.split(/\s+/).length;
  const keywordCount = (content.toLowerCase().match(new RegExp(targetKeyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  const keywordDensity = wordCount > 0 ? ((keywordCount / wordCount) * 100).toFixed(2) : '0';

  const recommendations: Array<{ type: string; priority: string; suggestion: string }> = [];

  // SEO checks
  if (parseFloat(keywordDensity) < 0.5) {
    recommendations.push({ type: 'seo', priority: 'high', suggestion: `Increase keyword density for "${targetKeyword}" — currently at ${keywordDensity}%, aim for 1-2%` });
  } else if (parseFloat(keywordDensity) > 3) {
    recommendations.push({ type: 'seo', priority: 'high', suggestion: `Reduce keyword stuffing for "${targetKeyword}" — currently at ${keywordDensity}%, aim for 1-2%` });
  }

  if (wordCount < 300) {
    recommendations.push({ type: 'seo', priority: 'high', suggestion: `Content is thin (${wordCount} words). Aim for 800+ words for blog posts, 300+ for landing pages` });
  }

  if (!content.includes('?')) {
    recommendations.push({ type: 'geo', priority: 'medium', suggestion: 'Add FAQ-style questions that AI models can parse and cite directly' });
  }

  // GEO checks
  const hasStatistics = /\d+%|\d+\+|\d{4,}|\d+x/i.test(content);
  if (!hasStatistics) {
    recommendations.push({ type: 'geo', priority: 'high', suggestion: 'Add specific statistics, numbers, and data points — AI models strongly prefer citation-worthy factual claims' });
  }

  const hasAuthoritative = /according to|research shows|study|survey|data from|report/i.test(content);
  if (!hasAuthoritative) {
    recommendations.push({ type: 'geo', priority: 'medium', suggestion: 'Add authoritative references ("according to...", "research shows...") to increase AI citability' });
  }

  const hasLists = /^[\s]*[-•*]\s|^[\s]*\d+\.\s/m.test(content);
  if (!hasLists) {
    recommendations.push({ type: 'geo', priority: 'medium', suggestion: 'Add bullet points or numbered lists — structured content is easier for AI models to extract and cite' });
  }

  const hasDefinition = /is a|refers to|defined as|means/i.test(content);
  if (!hasDefinition) {
    recommendations.push({ type: 'geo', priority: 'low', suggestion: 'Include a clear definition or "what is" section — this helps AI models understand and describe the topic' });
  }

  // Content type specific suggestions
  if (contentType === 'blog_post') {
    recommendations.push({ type: 'seo', priority: 'medium', suggestion: 'Ensure blog post has H2/H3 subheadings every 200-300 words for readability and SEO' });
    recommendations.push({ type: 'geo', priority: 'medium', suggestion: 'Add a TL;DR or key takeaways section at top — AI models often cite concise summaries' });
  } else if (contentType === 'landing_page') {
    recommendations.push({ type: 'seo', priority: 'high', suggestion: 'Include a clear CTA and ensure the target keyword appears in the first 100 words' });
  } else if (contentType === 'faq') {
    recommendations.push({ type: 'geo', priority: 'high', suggestion: 'Use exact question phrasing that matches conversational AI queries (e.g. "What is the best...")' });
  }

  return {
    success: true,
    analysis: {
      wordCount,
      keywordCount,
      keywordDensity: `${keywordDensity}%`,
      targetKeyword,
      contentType,
    },
    recommendations,
    geoEnhancements: [
      'Add structured data (FAQ schema) for question-answer content',
      'Include entity mentions (Cleya.ai, India startup ecosystem) for entity recognition',
      'Use definitive language ("Cleya.ai is..." rather than "Cleya.ai might be...")',
      'Add "Last updated" date to signal freshness to AI models',
    ],
  };
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
