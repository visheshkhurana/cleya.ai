/**
 * Master Prompt — tool-calling instructions injected into agent system prompts.
 *
 * Each agent is told which tools they have, how to invoke them, and safety constraints.
 */

import { AGENT_TOOLS, TOOL_DEFINITIONS, type ToolDefinition } from '../services/agentTools';

function formatToolSchema(tool: ToolDefinition): string {
  const params = tool.parameters.properties || {};
  const required = tool.parameters.required || [];
  const paramLines = Object.entries(params).map(([key, schema]: [string, any]) => {
    const req = required.includes(key) ? ' (required)' : ' (optional)';
    return `    - ${key}${req}: ${schema.description || schema.type}`;
  });

  return `  ${tool.name}: ${tool.description}\n    Parameters:\n${paramLines.join('\n')}`;
}

export function getToolPromptForAgent(agentId: string): string {
  const toolNames = AGENT_TOOLS[agentId];
  if (!toolNames || toolNames.length === 0) return '';

  const toolSchemas = toolNames
    .map(name => TOOL_DEFINITIONS[name])
    .filter(Boolean)
    .map(formatToolSchema)
    .join('\n\n');

  return `

## YOUR TOOLS — You can take REAL ACTIONS

You have access to the following tools that let you execute real actions (post to social media, create ad campaigns, etc.). You are NOT limited to generating text — you can actually DO things.

### Available Tools:
${toolSchemas}

### How to Use Tools

When you decide an action is needed, include a tool_call in your response as a JSON block:

\`\`\`json
{"tool_call": {"name": "TOOL_NAME", "arguments": { ... }}}
\`\`\`

The system will execute the tool and return the result. You can then respond to the user with the outcome.

### IMPORTANT RULES:
1. Only use tools when the user requests an action or when it's clearly needed for the task.
2. If the user is just chatting or asking questions, respond normally WITHOUT tool calls.
3. ALL ad campaigns are created in PAUSED state — they will NOT go live automatically.
4. Budget cap: ₹10,000/day maximum per campaign. The system enforces this.
5. Always confirm what you're about to do before executing high-impact actions (posting, creating campaigns).
6. Include the tool_call JSON block ONLY when you intend to execute an action.
7. You may include explanatory text before or after the tool_call block.

### Analytics & Data Tools — USE THESE PROACTIVELY:
You have access to real analytics data. **Always query data before making recommendations.** Don't guess — use the analytics tools to ground your decisions in real numbers.

- **get_analytics_overview**: Start here for a bird's-eye view across all platforms.
- **get_posthog_insights**: Dig into user behavior — events, sessions, retention, feature usage.
- **get_ga4_insights**: Understand traffic sources, top pages, geo distribution, bounce rates.
- **get_platform_stats**: Core business metrics — users, matches, calls, acceptance rates, top cities/roles.
- **get_funnel_metrics**: See where users drop off in the activation funnel.
- **get_user_growth_trend**: Track signup and match momentum over time.
- **get_agent_performance**: Review how other agents are performing (useful for Nexus orchestration).

These tools are read-only and safe to call anytime. Use them to:
- Back up marketing claims with real data
- Identify growth bottlenecks
- Track the impact of campaigns and content
- Generate data-driven reports and recommendations

### Safety Guidelines:
- Never post content that could be defamatory, misleading, or violate regulations.
- Financial claims must be verified — do not auto-post unverified numbers.
- Ad campaigns are always created PAUSED so a human can review before going live.
- If in doubt about whether to execute an action, ask the user first.
`;
}
