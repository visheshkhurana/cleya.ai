import { createAIService } from '@cleya/ai';
import { supabaseInsert, supabaseSelect, supabaseUpdate } from './supabaseClient';

const AGENT_PROMPTS: Record<string, { name: string; systemPrompt: string; contentType: string; channel: string }> = {
  'orchestrator': {
    name: 'Orchestrator',
    systemPrompt: `You are the Orchestrator — Master coordinator for all Cleya marketing agents.
You coordinate weekly content across LinkedIn, Instagram, email, and outreach channels.
Generate a content plan for the week. Output a structured JSON plan with tasks for each sub-agent:
- content-strategist: topic research and calendar
- social-media: LinkedIn and Instagram posts
- email-marketing: newsletter and drip sequences
- cold-outreach: lead sourcing and outreach sequences

Format your response as a JSON object with keys: contentStrategyTasks, socialMediaTasks, emailTasks, outreachTasks.
Each should be an array of {title, description, channel, priority} objects.
Be specific to Indian startup ecosystem context. Include dates relative to today.`,
    contentType: 'content_plan',
    channel: 'internal',
  },
  'content-strategist': {
    name: 'Content Strategist',
    systemPrompt: `You are the Content Strategist for Cleya.ai — an AI-powered professional networking platform for India's startup ecosystem.
Generate a weekly content plan: 5 LinkedIn posts, 3 Instagram posts, 1 newsletter, 1 blog article.
Each piece of content should include: title, hook/opening line, key points, CTA, and target audience segment (Founders/Investors/Operators).
Focus on trending topics in Indian startup ecosystem. Map content to funnel stages (Awareness/Consideration/Activation).
Output each content piece as a separate section with clear formatting.`,
    contentType: 'content_draft',
    channel: 'linkedin',
  },
  'social-media': {
    name: 'Social Media Manager',
    systemPrompt: `You are the Social Media Manager for Cleya.ai — an AI-powered professional networking platform for India's startup ecosystem.
Create copy-ready social media posts. For each post include:
- Platform (LinkedIn or Instagram)
- Post text (ready to publish)
- Suggested image/carousel description
- Best posting time (IST)
- Hashtags
Focus on founder stories, data insights, and networking tips. Optimize for engagement.
Generate 3 LinkedIn posts and 2 Instagram post concepts.`,
    contentType: 'social_post',
    channel: 'social',
  },
  'email-marketing': {
    name: 'Email Marketing Agent',
    systemPrompt: `You are the Email Marketing Agent for Cleya.ai — an AI-powered professional networking platform for India's startup ecosystem.
Create email content ready for campaigns. Include:
- Subject line (with A/B variant)
- Preview text
- Email body (HTML-friendly)
- CTA button text
- Target segment (Founders/Investors/Operators)
Generate 1 weekly newsletter draft and 1 drip sequence email.
Optimize for open rates. Use personalization tokens where appropriate.`,
    contentType: 'email_draft',
    channel: 'email',
  },
  'cold-outreach': {
    name: 'Cold Outreach Agent',
    systemPrompt: `You are the Cold Outreach Agent for Cleya.ai — an AI-powered professional networking platform for India's startup ecosystem.
Create outreach sequences for potential users. Include:
- Target persona description
- 4-step sequence: Day 1 email, Day 3 LinkedIn, Day 5 follow-up, Day 8 final
- Personalization variables
- Subject lines
Target recently funded startups and active angel investors in India.
Aim for >15% reply rate. Keep messages concise and value-focused.`,
    contentType: 'outreach_sequence',
    channel: 'outreach',
  },
};

interface AgentRunResult {
  agentId: string;
  status: 'success' | 'error';
  duration: number;
  outputSummary: string;
  contentItems: number;
  error?: string;
}

type AgentStatus = 'idle' | 'running' | 'completed' | 'failed' | 'scheduled';

interface AgentStatusInfo {
  agentId: string;
  name: string;
  status: AgentStatus;
  lastRunAt: string | null;
  lastRunDuration: number | null;
  lastRunStatus: string | null;
  nextRunAt: string | null;
}

const agentStates = new Map<string, {
  status: AgentStatus;
  lastRunAt: string | null;
  lastRunDuration: number | null;
  lastRunStatus: string | null;
}>();

function initAgentState(agentId: string) {
  if (!agentStates.has(agentId)) {
    agentStates.set(agentId, {
      status: 'idle',
      lastRunAt: null,
      lastRunDuration: null,
      lastRunStatus: null,
    });
  }
}

Object.keys(AGENT_PROMPTS).forEach(id => initAgentState(id));

let aiService: ReturnType<typeof createAIService> | null = null;
function getAI() {
  if (!aiService) {
    if (!process.env.OPENAI_API_KEY) return null;
    aiService = createAIService({ provider: 'openai', model: 'gpt-4o-mini' });
  }
  return aiService;
}

export async function runAgent(agentId: string, taskContext?: string): Promise<AgentRunResult> {
  const config = AGENT_PROMPTS[agentId];
  if (!config) {
    throw new Error(`Unknown agent: ${agentId}`);
  }

  initAgentState(agentId);
  const state = agentStates.get(agentId)!;
  state.status = 'running';

  const startTime = Date.now();
  console.log(`[AgentRunner] Starting agent: ${config.name} (${agentId})`);

  try {
    const ai = getAI();
    if (!ai) {
      throw new Error('AI service not configured. Set OPENAI_API_KEY.');
    }

    let userPrompt = `Today is ${new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`;
    if (taskContext) {
      userPrompt += `\n\nTask context: ${taskContext}`;
    }
    userPrompt += '\n\nGenerate content now.';

    const messages = [
      { role: 'system' as const, content: config.systemPrompt },
      { role: 'user' as const, content: userPrompt },
    ];

    const result = await ai.chat(messages);
    const content = result.content;

    const duration = Date.now() - startTime;
    const outputSummary = content.substring(0, 200) + (content.length > 200 ? '...' : '');

    await supabaseInsert('dm_content_queue', {
      agent_id: agentId,
      channel: config.channel,
      content_type: config.contentType,
      title: `${config.name} — ${new Date().toLocaleDateString('en-IN')}`,
      body: content,
      media_urls: [],
      scheduled_for: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      status: 'pending',
      metadata: { generated_by: 'agent_scheduler', task_context: taskContext || null },
      created_at: new Date().toISOString(),
    });

    await supabaseInsert('dm_agent_logs', {
      agent_id: agentId,
      action: `Autonomous run: ${config.contentType}`,
      details: {
        duration_ms: duration,
        output_length: content.length,
        output_summary: outputSummary,
        content_type: config.contentType,
        channel: config.channel,
      },
      status: 'success',
      created_at: new Date().toISOString(),
    });

    state.status = 'completed';
    state.lastRunAt = new Date().toISOString();
    state.lastRunDuration = duration;
    state.lastRunStatus = 'success';

    console.log(`[AgentRunner] ${config.name} completed in ${(duration / 1000).toFixed(1)}s`);

    return {
      agentId,
      status: 'success',
      duration,
      outputSummary,
      contentItems: 1,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    const errorMsg = error.message || 'Unknown error';

    try {
      await supabaseInsert('dm_agent_logs', {
        agent_id: agentId,
        action: `Autonomous run failed: ${config.contentType}`,
        details: {
          duration_ms: duration,
          error: errorMsg,
        },
        status: 'error',
        created_at: new Date().toISOString(),
      });
    } catch (logErr) {
      console.error(`[AgentRunner] Failed to log error for ${agentId}:`, logErr);
    }

    state.status = 'failed';
    state.lastRunAt = new Date().toISOString();
    state.lastRunDuration = duration;
    state.lastRunStatus = 'error';

    console.error(`[AgentRunner] ${config.name} failed after ${(duration / 1000).toFixed(1)}s:`, errorMsg);

    return {
      agentId,
      status: 'error',
      duration,
      outputSummary: '',
      contentItems: 0,
      error: errorMsg,
    };
  }
}

export async function processAgentTasks(agentId: string): Promise<number> {
  const config = AGENT_PROMPTS[agentId];
  if (!config) return 0;

  try {
    const tasks = await supabaseSelect<{
      id: number;
      title: string;
      description: string;
      priority: string;
      status: string;
      due_date: string;
    }>('dm_agent_tasks', { agent_id: agentId, status: 'pending' }, {
      order: 'priority.desc,due_date.asc',
      limit: 5,
    });

    if (tasks.length === 0) return 0;

    console.log(`[AgentRunner] Processing ${tasks.length} pending tasks for ${config.name}`);

    let processed = 0;
    for (const task of tasks) {
      try {
        await supabaseUpdate('dm_agent_tasks', { id: String(task.id) }, {
          status: 'in_progress',
        });

        const result = await runAgent(agentId, `Task: ${task.title}\n${task.description}`);

        await supabaseUpdate('dm_agent_tasks', { id: String(task.id) }, {
          status: result.status === 'success' ? 'completed' : 'failed',
          completed_at: new Date().toISOString(),
          output: { result: result.outputSummary, duration: result.duration },
        });

        processed++;
      } catch (err: any) {
        console.error(`[AgentRunner] Task ${task.id} failed:`, err.message);
        await supabaseUpdate('dm_agent_tasks', { id: String(task.id) }, {
          status: 'failed',
          output: { error: err.message },
        });
      }
    }

    return processed;
  } catch (err: any) {
    console.error(`[AgentRunner] Failed to fetch tasks for ${agentId}:`, err.message);
    return 0;
  }
}

export function getAgentStatuses(scheduleInfo?: Record<string, string>): AgentStatusInfo[] {
  return Object.entries(AGENT_PROMPTS).map(([id, config]) => {
    const state = agentStates.get(id);
    return {
      agentId: id,
      name: config.name,
      status: state?.status || 'idle',
      lastRunAt: state?.lastRunAt || null,
      lastRunDuration: state?.lastRunDuration || null,
      lastRunStatus: state?.lastRunStatus || null,
      nextRunAt: scheduleInfo?.[id] || null,
    };
  });
}

export function setAgentScheduleStatus(agentId: string, status: AgentStatus) {
  initAgentState(agentId);
  agentStates.get(agentId)!.status = status;
}

export const KNOWN_AGENT_IDS = Object.keys(AGENT_PROMPTS);
