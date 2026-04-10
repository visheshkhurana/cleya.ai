import { prisma } from '@cleya/db';
import { slackService } from './slackService';
import { getUncachableResendClient } from './resendClient';
import { supabaseSelect, supabaseInsert, supabaseUpdate } from './supabaseClient';

const ADMIN_PANEL_URL = process.env.FRONTEND_URL || 'https://cleya.ai';
const ESCALATION_HOURS = 2;
const AUTO_CANCEL_HOURS = 4;

export interface CrisisModeState {
  active: boolean;
  activatedAt: string | null;
  activatedBy: string | null;
  reason: string | null;
}

export async function ensureSafetyTables(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS dm_system_flags (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL DEFAULT '{}',
        updated_at TIMESTAMPTZ DEFAULT now()
      );
    `);
    console.log('[FounderSafety] Safety tables ensured');
  } catch (err: any) {
    console.log(`[FounderSafety] Could not create safety tables: ${err.message}`);
  }
}

export async function notifyApprovalNeeded(decision: {
  id: number;
  title: string;
  context: string;
  requesting_agent: string;
  urgency: string;
  options?: string[];
}): Promise<void> {
  try {
    const approvalUrl = `${ADMIN_PANEL_URL}/controltower`;

    const blocks: any[] = [
      {
        type: 'header',
        text: { type: 'plain_text', text: ':rotating_light: Founder Approval Required' },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${decision.title}*\n\n>*Agent:* ${decision.requesting_agent}\n>*Urgency:* ${decision.urgency}\n>*Decision ID:* #${decision.id}`,
        },
      },
    ];

    if (decision.context) {
      const preview = decision.context.length > 500
        ? decision.context.substring(0, 500) + '...'
        : decision.context;
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `*Context:*\n${preview}` },
      });
    }

    if (decision.options && decision.options.length > 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Options:*\n${decision.options.map((o, i) => `${i + 1}. ${o}`).join('\n')}`,
        },
      });
    }

    blocks.push(
      { type: 'divider' },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:point_right: <${approvalUrl}|Review & Approve in Control Tower>`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Auto-escalation in ${ESCALATION_HOURS}h | Auto-cancel in ${AUTO_CANCEL_HOURS}h if no action taken`,
          },
        ],
      }
    );

    const text = `Approval needed: ${decision.title} (${decision.urgency}) from ${decision.requesting_agent}`;
    await slackService.postAlert(text, blocks);
    console.log(`[FounderSafety] Sent approval notification for decision #${decision.id}`);
  } catch (err: any) {
    console.log(`[FounderSafety] Failed to send approval notification: ${err.message}`);
  }
}

export async function processEscalations(): Promise<{
  escalated: number;
  autoCancelled: number;
}> {
  let escalated = 0;
  let autoCancelled = 0;

  try {
    const pendingDecisions = await supabaseSelect<any>('dm_decisions', { status: 'pending' });

    const now = Date.now();

    for (const decision of pendingDecisions) {
      const createdAt = new Date(decision.created_at).getTime();
      const hoursElapsed = (now - createdAt) / (1000 * 60 * 60);

      if (hoursElapsed >= AUTO_CANCEL_HOURS) {
        await supabaseUpdate('dm_decisions', { id: String(decision.id) }, {
          status: 'rejected',
          founder_notes: `Auto-cancelled after ${AUTO_CANCEL_HOURS} hours with no response`,
          decided_at: new Date().toISOString(),
        });

        try {
          await supabaseInsert('dm_execution_log', {
            agent_id: 'system',
            action_type: 'auto_cancel_decision',
            action_description: `Decision #${decision.id} "${decision.title}" auto-cancelled after ${AUTO_CANCEL_HOURS}h`,
            autonomy_level: 'autonomous',
            guardrails_checked: ['escalation_timeout'],
            guardrail_result: 'blocked',
            execution_result: 'success',
            details: { decision_id: decision.id, hours_elapsed: hoursElapsed },
            spend_amount: 0,
            executed_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          });
        } catch {}

        const blocks = [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `:no_entry: *Decision Auto-Cancelled*\n*${decision.title}* (#${decision.id})\nNo response received within ${AUTO_CANCEL_HOURS} hours. The action has been blocked.`,
            },
          },
          {
            type: 'context',
            elements: [{ type: 'mrkdwn', text: `Agent: ${decision.requesting_agent} | Urgency: ${decision.urgency}` }],
          },
        ];
        await slackService.postAlert(`Decision auto-cancelled: ${decision.title}`, blocks);
        autoCancelled++;
      } else if (hoursElapsed >= ESCALATION_HOURS) {
        const alreadyEscalated = decision.founder_notes?.includes('ESCALATED');
        if (!alreadyEscalated) {
          await supabaseUpdate('dm_decisions', { id: String(decision.id) }, {
            founder_notes: (decision.founder_notes || '') + ' [ESCALATED]',
          });

          const blocks = [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `:warning: *ESCALATION: Pending ${Math.round(hoursElapsed)}h*\n*${decision.title}* (#${decision.id})\nThis decision has been pending for over ${ESCALATION_HOURS} hours. It will be *auto-cancelled* in ${Math.round(AUTO_CANCEL_HOURS - hoursElapsed)}h if no action is taken.`,
              },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `:point_right: <${ADMIN_PANEL_URL}/controltower|Review Now in Control Tower>`,
              },
            },
          ];
          await slackService.postAlert(`ESCALATION: Decision pending ${Math.round(hoursElapsed)}h - ${decision.title}`, blocks);
          escalated++;
        }
      }
    }
  } catch (err: any) {
    console.error(`[FounderSafety] Escalation processing failed: ${err.message}`);
  }

  if (escalated > 0 || autoCancelled > 0) {
    console.log(`[FounderSafety] Escalation run: ${escalated} escalated, ${autoCancelled} auto-cancelled`);
  }

  return { escalated, autoCancelled };
}

export async function getCrisisMode(): Promise<CrisisModeState> {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT value FROM dm_system_flags WHERE key = 'crisis_mode'`
    );
    if (rows.length > 0 && rows[0].value) {
      return rows[0].value as CrisisModeState;
    }
  } catch {}
  return { active: false, activatedAt: null, activatedBy: null, reason: null };
}

export async function activateCrisisMode(activatedBy: string, reason: string): Promise<CrisisModeState> {
  const state: CrisisModeState = {
    active: true,
    activatedAt: new Date().toISOString(),
    activatedBy,
    reason,
  };

  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO dm_system_flags (key, value, updated_at)
       VALUES ('crisis_mode', $1::jsonb, now())
       ON CONFLICT (key) DO UPDATE SET value = $1::jsonb, updated_at = now()`,
      JSON.stringify(state)
    );
  } catch (err: any) {
    console.error(`[FounderSafety] Failed to activate crisis mode: ${err.message}`);
    throw err;
  }

  try {
    await supabaseInsert('dm_execution_log', {
      agent_id: 'system',
      action_type: 'crisis_mode_activated',
      action_description: `Crisis mode activated by ${activatedBy}: ${reason}`,
      autonomy_level: 'manual',
      guardrails_checked: ['crisis_mode'],
      guardrail_result: 'blocked',
      execution_result: 'success',
      details: state,
      spend_amount: 0,
      executed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });
  } catch {}

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: ':rotating_light: CRISIS MODE ACTIVATED' },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*All autonomous agent activity has been paused.*\n\n>*Activated by:* ${activatedBy}\n>*Reason:* ${reason}\n>*Time:* ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:lock: All scheduled content, ad spend, and autonomous actions are *blocked* until crisis mode is deactivated.\n\n<${ADMIN_PANEL_URL}/controltower|Manage in Control Tower>`,
      },
    },
  ];
  await slackService.postAlert('CRISIS MODE ACTIVATED - All autonomous activity paused', blocks);

  console.log(`[FounderSafety] Crisis mode activated by ${activatedBy}: ${reason}`);
  return state;
}

export async function deactivateCrisisMode(deactivatedBy: string): Promise<CrisisModeState> {
  const state: CrisisModeState = {
    active: false,
    activatedAt: null,
    activatedBy: null,
    reason: null,
  };

  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO dm_system_flags (key, value, updated_at)
       VALUES ('crisis_mode', $1::jsonb, now())
       ON CONFLICT (key) DO UPDATE SET value = $1::jsonb, updated_at = now()`,
      JSON.stringify(state)
    );
  } catch (err: any) {
    console.error(`[FounderSafety] Failed to deactivate crisis mode: ${err.message}`);
    throw err;
  }

  try {
    await supabaseInsert('dm_execution_log', {
      agent_id: 'system',
      action_type: 'crisis_mode_deactivated',
      action_description: `Crisis mode deactivated by ${deactivatedBy}`,
      autonomy_level: 'manual',
      guardrails_checked: ['crisis_mode'],
      guardrail_result: 'passed',
      execution_result: 'success',
      details: { deactivatedBy },
      spend_amount: 0,
      executed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });
  } catch {}

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: ':white_check_mark: Crisis Mode Deactivated' },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Normal operations resumed.*\n\n>*Deactivated by:* ${deactivatedBy}\n>*Time:* ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`,
      },
    },
  ];
  await slackService.postAlert('Crisis mode deactivated - Normal operations resumed', blocks);

  console.log(`[FounderSafety] Crisis mode deactivated by ${deactivatedBy}`);
  return state;
}

export async function isCrisisModeActive(): Promise<boolean> {
  const state = await getCrisisMode();
  return state.active;
}

export async function sendDailyAuditDigest(): Promise<void> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  let executionLogs: any[] = [];
  try {
    const allLogs = await supabaseSelect('dm_execution_log', undefined, {
      order: 'executed_at.desc',
      limit: 500,
    });
    executionLogs = allLogs.filter(
      (l: any) => new Date(l.executed_at || l.created_at) >= todayStart
    );
  } catch {}

  let agentLogs: any[] = [];
  try {
    const allAgentLogs = await supabaseSelect('dm_agent_logs', undefined, {
      order: 'created_at.desc',
      limit: 500,
    });
    agentLogs = allAgentLogs.filter(
      (l: any) => new Date(l.created_at) >= todayStart
    );
  } catch {}

  const agentSummary: Record<string, { taken: number; blocked: number; pending: number; errors: number }> = {};

  for (const log of executionLogs) {
    const agentId = log.agent_id || 'unknown';
    if (!agentSummary[agentId]) {
      agentSummary[agentId] = { taken: 0, blocked: 0, pending: 0, errors: 0 };
    }
    if (log.execution_result === 'success') agentSummary[agentId].taken++;
    else if (log.execution_result === 'error') agentSummary[agentId].errors++;
    else if (log.guardrail_result === 'blocked') agentSummary[agentId].blocked++;
    else if (log.execution_result === 'queued') agentSummary[agentId].pending++;
  }

  for (const log of agentLogs) {
    const agentId = log.agent_id || 'unknown';
    if (!agentSummary[agentId]) {
      agentSummary[agentId] = { taken: 0, blocked: 0, pending: 0, errors: 0 };
    }
    if (log.status === 'success') agentSummary[agentId].taken++;
    else if (log.status === 'error') agentSummary[agentId].errors++;
  }

  const totalSpend = executionLogs.reduce(
    (sum: number, l: any) => sum + (parseFloat(l.spend_amount) || 0),
    0
  );

  let pendingDecisions = 0;
  try {
    const pending = await supabaseSelect('dm_decisions', { status: 'pending' });
    pendingDecisions = pending.length;
  } catch {}

  const dateStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Kolkata',
  });

  const totalActions = Object.values(agentSummary).reduce((s, a) => s + a.taken, 0);
  const totalBlocked = Object.values(agentSummary).reduce((s, a) => s + a.blocked, 0);
  const totalErrors = Object.values(agentSummary).reduce((s, a) => s + a.errors, 0);

  const agentLines = Object.entries(agentSummary)
    .filter(([id]) => id !== 'system')
    .map(([id, stats]) => {
      return `>  *${id}*: ${stats.taken} actions, ${stats.blocked} blocked, ${stats.errors} errors`;
    })
    .join('\n');

  const crisisState = await getCrisisMode();

  const blocks: any[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `Daily Audit Digest — ${dateStr}` },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:bar_chart: *Summary*\n>Actions taken: *${totalActions}*\n>Actions blocked: *${totalBlocked}*\n>Errors: *${totalErrors}*\n>Pending decisions: *${pendingDecisions}*\n>Total API spend: *$${totalSpend.toFixed(2)}*`,
      },
    },
  ];

  if (crisisState.active) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:rotating_light: *Crisis Mode is ACTIVE*\nActivated by ${crisisState.activatedBy} at ${crisisState.activatedAt}`,
      },
    });
  }

  if (agentLines) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `:robot_face: *Agent Breakdown*\n${agentLines}` },
    });
  }

  blocks.push(
    { type: 'divider' },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `<${ADMIN_PANEL_URL}/controltower|View Full Details in Control Tower>`,
        },
      ],
    }
  );

  await slackService.postAlert(`Daily Audit Digest — ${dateStr}`, blocks);

  try {
    const { client, fromEmail } = await getUncachableResendClient();
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      const agentHtmlRows = Object.entries(agentSummary)
        .filter(([id]) => id !== 'system')
        .map(([id, stats]) => `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${id}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">${stats.taken}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">${stats.blocked}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">${stats.errors}</td>
          </tr>
        `).join('');

      await client.emails.send({
        from: fromEmail || 'Cleya AI <hello@cleya.ai>',
        to: adminEmail,
        subject: `[Cleya] Daily Audit Digest — ${dateStr}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #6366f1;">Daily Audit Digest</h2>
            <p style="color: #64748b;">${dateStr}</p>
            ${crisisState.active ? '<div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; margin-bottom: 16px;"><strong style="color: #dc2626;">Crisis Mode is ACTIVE</strong></div>' : ''}
            <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
              <h3 style="margin: 0 0 8px; color: #334155;">Summary</h3>
              <p style="margin: 4px 0;"><strong>Actions taken:</strong> ${totalActions}</p>
              <p style="margin: 4px 0;"><strong>Actions blocked:</strong> ${totalBlocked}</p>
              <p style="margin: 4px 0;"><strong>Errors:</strong> ${totalErrors}</p>
              <p style="margin: 4px 0;"><strong>Pending decisions:</strong> ${pendingDecisions}</p>
              <p style="margin: 4px 0;"><strong>Total API spend:</strong> $${totalSpend.toFixed(2)}</p>
            </div>
            ${agentHtmlRows ? `
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
                <thead>
                  <tr style="background: #f1f5f9;">
                    <th style="padding: 8px; text-align: left;">Agent</th>
                    <th style="padding: 8px; text-align: center;">Taken</th>
                    <th style="padding: 8px; text-align: center;">Blocked</th>
                    <th style="padding: 8px; text-align: center;">Errors</th>
                  </tr>
                </thead>
                <tbody>${agentHtmlRows}</tbody>
              </table>
            ` : ''}
            <p style="margin-top: 20px;">
              <a href="${ADMIN_PANEL_URL}/controltower" style="background: #6366f1; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px;">View in Control Tower</a>
            </p>
          </div>
        `,
      });
      console.log('[FounderSafety] Daily audit email sent');
    }
  } catch (err: any) {
    console.log(`[FounderSafety] Daily audit email failed: ${err.message}`);
  }

  console.log('[FounderSafety] Daily audit digest sent');
}

export async function sendWeeklyPerformanceReport(): Promise<void> {
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  weekStart.setHours(0, 0, 0, 0);

  const [
    totalUsers,
    newUsersThisWeek,
    completedProfiles,
    totalMatches,
    acceptedMatches,
    totalCalls,
    totalMessages,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: weekStart } } }),
    prisma.profile.count({ where: { isComplete: true } }),
    prisma.match.count({ where: { createdAt: { gte: weekStart } } }),
    prisma.match.count({ where: { status: 'ACCEPTED', createdAt: { gte: weekStart } } }),
    prisma.call.count({ where: { createdAt: { gte: weekStart } } }),
    prisma.messageRecord.count({ where: { createdAt: { gte: weekStart } } }),
  ]);

  let contentPublished = 0;
  let contentPending = 0;
  try {
    const published = await supabaseSelect('dm_content_queue', { status: 'published' });
    const publishedThisWeek = published.filter(
      (c: any) => new Date(c.created_at) >= weekStart
    );
    contentPublished = publishedThisWeek.length;

    const pending = await supabaseSelect('dm_content_queue', { status: 'pending' });
    contentPending = pending.length;
  } catch {}

  let executionLogs: any[] = [];
  try {
    const allLogs = await supabaseSelect('dm_execution_log', undefined, {
      order: 'executed_at.desc',
      limit: 1000,
    });
    executionLogs = allLogs.filter(
      (l: any) => new Date(l.executed_at || l.created_at) >= weekStart
    );
  } catch {}

  const totalAgentActions = executionLogs.length;
  const totalSpend = executionLogs.reduce(
    (sum: number, l: any) => sum + (parseFloat(l.spend_amount) || 0),
    0
  );

  const matchAcceptRate = totalMatches > 0 ? Math.round((acceptedMatches / totalMatches) * 100) : 0;

  const dateStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Kolkata',
  });

  try {
    const { client, fromEmail } = await getUncachableResendClient();
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
      console.log('[FounderSafety] No ADMIN_EMAIL configured, skipping weekly report');
      return;
    }

    await client.emails.send({
      from: fromEmail || 'Cleya AI <hello@cleya.ai>',
      to: adminEmail,
      subject: `[Cleya] Weekly Performance Report — ${dateStr}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #6366f1;">Weekly Performance Report</h2>
          <p style="color: #64748b;">${dateStr} (Last 7 days)</p>

          <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
            <h3 style="margin: 0 0 12px; color: #334155;">Platform Metrics</h3>
            <table style="width: 100%;">
              <tr><td style="padding: 4px 0; color: #64748b;">Total Users</td><td style="text-align: right; font-weight: bold;">${totalUsers}</td></tr>
              <tr><td style="padding: 4px 0; color: #64748b;">New Users This Week</td><td style="text-align: right; font-weight: bold;">${newUsersThisWeek}</td></tr>
              <tr><td style="padding: 4px 0; color: #64748b;">Completed Profiles</td><td style="text-align: right; font-weight: bold;">${completedProfiles}</td></tr>
              <tr><td style="padding: 4px 0; color: #64748b;">Matches This Week</td><td style="text-align: right; font-weight: bold;">${totalMatches}</td></tr>
              <tr><td style="padding: 4px 0; color: #64748b;">Accepted Matches</td><td style="text-align: right; font-weight: bold;">${acceptedMatches}</td></tr>
              <tr><td style="padding: 4px 0; color: #64748b;">Match Accept Rate</td><td style="text-align: right; font-weight: bold;">${matchAcceptRate}%</td></tr>
              <tr><td style="padding: 4px 0; color: #64748b;">Calls</td><td style="text-align: right; font-weight: bold;">${totalCalls}</td></tr>
              <tr><td style="padding: 4px 0; color: #64748b;">Messages</td><td style="text-align: right; font-weight: bold;">${totalMessages}</td></tr>
            </table>
          </div>

          <div style="background: #f0fdf4; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
            <h3 style="margin: 0 0 12px; color: #334155;">Content & Agent Activity</h3>
            <table style="width: 100%;">
              <tr><td style="padding: 4px 0; color: #64748b;">Content Published</td><td style="text-align: right; font-weight: bold;">${contentPublished}</td></tr>
              <tr><td style="padding: 4px 0; color: #64748b;">Content Pending Review</td><td style="text-align: right; font-weight: bold;">${contentPending}</td></tr>
              <tr><td style="padding: 4px 0; color: #64748b;">Total Agent Actions</td><td style="text-align: right; font-weight: bold;">${totalAgentActions}</td></tr>
              <tr><td style="padding: 4px 0; color: #64748b;">Total API Spend</td><td style="text-align: right; font-weight: bold;">$${totalSpend.toFixed(2)}</td></tr>
            </table>
          </div>

          <p style="margin-top: 20px;">
            <a href="${ADMIN_PANEL_URL}/controltower" style="background: #6366f1; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px;">View Full Dashboard</a>
          </p>
        </div>
      `,
    });

    console.log('[FounderSafety] Weekly performance report sent');
  } catch (err: any) {
    console.log(`[FounderSafety] Weekly report failed: ${err.message}`);
  }
}
