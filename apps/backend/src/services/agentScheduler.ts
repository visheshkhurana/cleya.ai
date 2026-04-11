import cron, { ScheduledTask } from 'node-cron';
import {
  runAgent,
  processAgentTasks,
  setAgentScheduleStatus,
  isAgentEnabled,
  getAgentStatuses,
  hydrateAgentStatesFromDB,
  AGENT_DEFINITIONS,
} from './agentRunner';
import { supabaseInsert, supabaseSelect } from './supabaseClient';
import { processContentCalendar } from './publishingService';
import { generateDailyBriefing } from './founderModeService';
import { sendBriefingNotifications } from './agentNotifier';
import {
  processEscalations,
  isCrisisModeActive,
  sendDailyAuditDigest,
  sendWeeklyPerformanceReport,
  ensureSafetyTables,
} from './founderSafetyService';
import { routeModel, inferTaskType } from './modelRouter';
import { runDailySEORoutine } from './seoAutomation';
import { runDailyQARoutine } from './qaAutomation';
import {
  runNexusDailyBrief,
  runMavenContentPost,
  runLedgerFinancialMonitor,
  runLedgerWeeklyReview,
  runSentinelHealthCheck,
  runAllyEngagementCheck,
  runCatalystGrowthAnalysis,
  runCatalystWeeklyReview,
  runCloserSalesPipeline,
} from './autonomousWorkflows';

const ORCHESTRATOR_SUB_AGENT_MAP: Record<string, string> = {
  mavenTasks: 'maven',
  ledgerTasks: 'ledger',
  sentinelTasks: 'sentinel',
  allyTasks: 'ally',
  catalystTasks: 'catalyst',
  closerTasks: 'closer',
};

class AgentScheduler {
  private tasks: ScheduledTask[] = [];
  private started = false;
  private running = new Set<string>();

  getScheduleInfo(): Record<string, string> {
    const statuses = getAgentStatuses();
    const info: Record<string, string> = {};
    for (const s of statuses) {
      if (s.cronExpression) {
        info[s.agentId] = s.nextRunAt || s.cronExpression;
      }
    }
    return info;
  }

  async start() {
    if (this.started) {
      console.log('[AgentScheduler] Already started, skipping');
      return;
    }

    await hydrateAgentStatesFromDB();
    await ensureSafetyTables();

    const statuses = getAgentStatuses();

    for (const agent of statuses) {
      if (!agent.cronExpression) continue;

      try {
        if (!cron.validate(agent.cronExpression)) {
          console.log(`[AgentScheduler] Invalid cron for ${agent.agentId}: ${agent.cronExpression}`);
          continue;
        }

        const task = cron.schedule(agent.cronExpression, () => {
          if (!isAgentEnabled(agent.agentId)) {
            console.log(`[AgentScheduler] ${agent.agentId} is disabled, skipping scheduled run`);
            return;
          }
          this.executeAgent(agent.agentId).catch(err =>
            console.error(`[AgentScheduler] ${agent.agentId} execution failed:`, err)
          );
        }, { timezone: 'Asia/Kolkata' });

        this.tasks.push(task);
        if (agent.enabled) {
          setAgentScheduleStatus(agent.agentId, 'scheduled');
        }
        console.log(`[AgentScheduler] Scheduled ${agent.agentId}: ${agent.cronExpression} (${agent.enabled ? 'enabled' : 'disabled'})`);
      } catch (err: any) {
        console.log(`[AgentScheduler] Failed to schedule ${agent.agentId}: ${err.message}`);
      }
    }

    const taskProcessingJob = cron.schedule('0 */4 * * *', () => {
      this.processAllTasks().catch(err =>
        console.error('[AgentScheduler] Task processing failed:', err)
      );
    }, { timezone: 'Asia/Kolkata' });
    this.tasks.push(taskProcessingJob);

    const contentCalendarJob = cron.schedule('*/15 * * * *', () => {
      this.processContentCalendarCron().catch(err =>
        console.error('[AgentScheduler] Content calendar processing failed:', err)
      );
    }, { timezone: 'Asia/Kolkata' });
    this.tasks.push(contentCalendarJob);

    const dailyBriefingJob = cron.schedule('0 8 * * *', () => {
      this.sendDailyBriefing().catch(err =>
        console.error('[AgentScheduler] Daily briefing failed:', err)
      );
    }, { timezone: 'Asia/Kolkata' });
    this.tasks.push(dailyBriefingJob);

    const escalationJob = cron.schedule('*/30 * * * *', () => {
      processEscalations().catch(err =>
        console.error('[AgentScheduler] Escalation check failed:', err)
      );
    }, { timezone: 'Asia/Kolkata' });
    this.tasks.push(escalationJob);
    console.log('[AgentScheduler] Escalation check scheduled every 30 minutes');

    const dailyAuditJob = cron.schedule('0 22 * * *', () => {
      sendDailyAuditDigest().catch(err =>
        console.error('[AgentScheduler] Daily audit digest failed:', err)
      );
    }, { timezone: 'Asia/Kolkata' });
    this.tasks.push(dailyAuditJob);
    console.log('[AgentScheduler] Daily audit digest scheduled at 10 PM IST');

    const weeklyReportJob = cron.schedule('0 7 * * 1', () => {
      sendWeeklyPerformanceReport().catch(err =>
        console.error('[AgentScheduler] Weekly performance report failed:', err)
      );
    }, { timezone: 'Asia/Kolkata' });
    this.tasks.push(weeklyReportJob);
    console.log('[AgentScheduler] Weekly performance report scheduled for Monday 7 AM IST');

    // Maven autonomous content posting — 3x daily (9 AM, 1 PM, 6 PM IST)
    const mavenMorningJob = cron.schedule('30 3 * * *', () => {
      if (!isAgentEnabled('maven')) return;
      this.runAutonomousWorkflow('maven', 'Morning Insight post', () => runMavenContentPost('morning'))
        .catch(err => console.error('[AgentScheduler] Maven morning post failed:', err));
    }, { timezone: 'UTC' });
    this.tasks.push(mavenMorningJob);

    const mavenAfternoonJob = cron.schedule('30 7 * * *', () => {
      if (!isAgentEnabled('maven')) return;
      this.runAutonomousWorkflow('maven', 'Founder Spotlight post', () => runMavenContentPost('afternoon'))
        .catch(err => console.error('[AgentScheduler] Maven afternoon post failed:', err));
    }, { timezone: 'UTC' });
    this.tasks.push(mavenAfternoonJob);

    const mavenEveningJob = cron.schedule('30 12 * * *', () => {
      if (!isAgentEnabled('maven')) return;
      this.runAutonomousWorkflow('maven', 'Evening Engagement post', () => runMavenContentPost('evening'))
        .catch(err => console.error('[AgentScheduler] Maven evening post failed:', err));
    }, { timezone: 'UTC' });
    this.tasks.push(mavenEveningJob);
    console.log('[AgentScheduler] Maven autonomous content posting: 9 AM, 1 PM, 6 PM IST');

    this.started = true;
    console.log('[AgentScheduler] All agent schedules initialized');
    console.log('[AgentScheduler] Task processing scheduled every 4 hours');
    console.log('[AgentScheduler] Content calendar processor running every 15 minutes');
    console.log('[AgentScheduler] Daily briefing scheduled at 8:00 AM IST');
  }

  stop() {
    this.tasks.forEach(t => t.stop());
    this.tasks = [];
    this.started = false;
    console.log('[AgentScheduler] All scheduled agent tasks stopped');
  }

  async reload() {
    console.log('[AgentScheduler] Reloading schedules from database...');
    this.stop();
    await this.start();
  }

  async executeAgent(agentId: string): Promise<any> {
    if (this.running.has(agentId)) {
      console.log(`[AgentScheduler] ${agentId} already running, skipping`);
      return { skipped: true };
    }

    const crisisActive = await isCrisisModeActive();
    if (crisisActive) {
      console.log(`[AgentScheduler] ${agentId} blocked — crisis mode is active`);
      return { blocked: true, reason: 'crisis_mode' };
    }

    this.running.add(agentId);
    try {
      const tasksProcessed = await processAgentTasks(agentId);
      if (tasksProcessed > 0) {
        console.log(`[AgentScheduler] Processed ${tasksProcessed} tasks for ${agentId}`);
      }

      const result = await runAgent(agentId);

      if (agentId === 'nexus' && result.status === 'success') {
        await this.handleOrchestratorDelegation(result.fullOutput || result.outputSummary);
      }

      // Scout: run the daily SEO automation pipeline after the LLM run
      if (agentId === 'scout') {
        try {
          console.log('[AgentScheduler] Running Scout daily SEO automation pipeline...');
          const seoReport = await runDailySEORoutine();
          console.log(`[AgentScheduler] Scout SEO pipeline completed (${seoReport.length} chars)`);

          // Log the SEO routine as a separate action
          await supabaseInsert('dm_agent_logs', {
            agent_id: 'scout',
            action: 'Daily SEO automation pipeline',
            details: {
              report_length: seoReport.length,
              report_preview: seoReport.substring(0, 500),
            },
            status: 'success',
            created_at: new Date().toISOString(),
          });
        } catch (seoErr: any) {
          console.error('[AgentScheduler] Scout SEO pipeline failed:', seoErr.message);
          await supabaseInsert('dm_agent_logs', {
            agent_id: 'scout',
            action: 'Daily SEO automation pipeline failed',
            details: { error: seoErr.message },
            status: 'error',
            created_at: new Date().toISOString(),
          }).catch(() => {});
        }
      }

      // Probe: run the daily QA automation pipeline after the LLM run
      if (agentId === 'probe') {
        try {
          console.log('[AgentScheduler] Running Probe daily QA automation pipeline...');
          const qaResult = await runDailyQARoutine();
          console.log(`[AgentScheduler] Probe QA pipeline completed — ${qaResult.results.length} tests run`);

          await supabaseInsert('dm_agent_logs', {
            agent_id: 'probe',
            action: 'Daily QA automation pipeline',
            details: {
              total_tests: qaResult.results.length,
              passed: qaResult.results.filter((r: any) => r.status === 'pass').length,
              failed: qaResult.results.filter((r: any) => r.status === 'fail').length,
              warnings: qaResult.results.filter((r: any) => r.status === 'warning').length,
              summary: qaResult.summary,
            },
            status: qaResult.results.some((r: any) => r.status === 'fail') ? 'warning' : 'success',
            created_at: new Date().toISOString(),
          });
        } catch (qaErr: any) {
          console.error('[AgentScheduler] Probe QA pipeline failed:', qaErr.message);
          await supabaseInsert('dm_agent_logs', {
            agent_id: 'probe',
            action: 'Daily QA automation pipeline failed',
            details: { error: qaErr.message },
            status: 'error',
            created_at: new Date().toISOString(),
          }).catch(() => {});
        }
      }

      // Nexus: run daily operations brief after the LLM run
      if (agentId === 'nexus') {
        await this.runAutonomousWorkflow('nexus', 'Daily operations brief', runNexusDailyBrief);
      }

      // Ledger: run daily financial monitor after the LLM run
      if (agentId === 'ledger') {
        await this.runAutonomousWorkflow('ledger', 'Daily financial monitor', runLedgerFinancialMonitor);
        // Weekly review on Mondays
        if (new Date().getDay() === 1) {
          await this.runAutonomousWorkflow('ledger', 'Weekly budget review', runLedgerWeeklyReview);
        }
      }

      // Sentinel: run system health check after the LLM run
      if (agentId === 'sentinel') {
        await this.runAutonomousWorkflow('sentinel', 'System health check', runSentinelHealthCheck);
      }

      // Ally: run member engagement check after the LLM run
      if (agentId === 'ally') {
        await this.runAutonomousWorkflow('ally', 'Member engagement check', runAllyEngagementCheck);
      }

      // Catalyst: run growth analysis after the LLM run
      if (agentId === 'catalyst') {
        await this.runAutonomousWorkflow('catalyst', 'Daily growth analysis', runCatalystGrowthAnalysis);
        // Weekly review on Wednesdays
        if (new Date().getDay() === 3) {
          await this.runAutonomousWorkflow('catalyst', 'Weekly growth review', runCatalystWeeklyReview);
        }
      }

      // Closer: run sales pipeline after the LLM run
      if (agentId === 'closer') {
        await this.runAutonomousWorkflow('closer', 'Sales pipeline analysis', runCloserSalesPipeline);
      }

      return result;
    } finally {
      this.running.delete(agentId);
    }
  }

  private async runAutonomousWorkflow(
    agentId: string,
    actionName: string,
    workflowFn: () => Promise<string>,
  ): Promise<void> {
    try {
      console.log(`[AgentScheduler] Running ${agentId} autonomous workflow: ${actionName}...`);
      const result = await workflowFn();
      console.log(`[AgentScheduler] ${agentId} ${actionName} completed (${result.length} chars)`);

      await supabaseInsert('dm_agent_logs', {
        agent_id: agentId,
        action: actionName,
        details: {
          result_length: result.length,
          result_preview: result.substring(0, 500),
        },
        status: 'success',
        created_at: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error(`[AgentScheduler] ${agentId} ${actionName} failed:`, err.message);
      await supabaseInsert('dm_agent_logs', {
        agent_id: agentId,
        action: `${actionName} failed`,
        details: { error: err.message },
        status: 'error',
        created_at: new Date().toISOString(),
      }).catch(() => {});
    }
  }

  private async handleOrchestratorDelegation(output: string): Promise<void> {
    console.log('[AgentScheduler] Orchestrator completed, parsing delegation plan...');

    try {
      let plan: Record<string, any[]>;
      try {
        const jsonMatch = output.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          const fullLogs = await supabaseSelect<{ body: string }>('dm_content_queue', {
            agent_id: 'nexus',
          }, { order: 'created_at.desc', limit: 1 });

          if (fullLogs.length > 0) {
            const bodyMatch = fullLogs[0].body.match(/\{[\s\S]*\}/);
            if (bodyMatch) {
              plan = JSON.parse(bodyMatch[0]);
            } else {
              throw new Error('No JSON found in orchestrator output');
            }
          } else {
            throw new Error('No orchestrator output found');
          }
        } else {
          plan = JSON.parse(jsonMatch[0]);
        }
      } catch (parseErr: any) {
        console.log(`[AgentScheduler] Could not parse orchestrator JSON: ${parseErr.message}`);
        console.log('[AgentScheduler] Falling back to triggering all sub-agents...');
        const subAgents = Object.values(ORCHESTRATOR_SUB_AGENT_MAP);
        for (const subId of subAgents) {
          if (isAgentEnabled(subId)) {
            try {
              await this.executeAgent(subId);
            } catch (err: any) {
              console.error(`[AgentScheduler] Sub-agent ${subId} failed:`, err.message);
            }
          }
        }
        return;
      }

      let totalTasksCreated = 0;

      for (const [taskKey, subAgentId] of Object.entries(ORCHESTRATOR_SUB_AGENT_MAP)) {
        const tasks = plan[taskKey];
        if (!Array.isArray(tasks) || tasks.length === 0) continue;

        for (const task of tasks) {
          try {
            const platforms = task.platforms || (subAgentId === 'maven' ? ['linkedin', 'instagram'] : []);
            const contentPillars = task.content_pillars || task.contentPillars || [];
            const targetDate = task.target_date || task.targetDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

            let assignedModel = task.assignedModel || task.assigned_model;
            if (!assignedModel) {
              const taskType = inferTaskType(subAgentId, task.description || task.title);
              const routing = routeModel({ agentId: subAgentId, taskType });
              assignedModel = routing.primaryModel;
            }

            await supabaseInsert('dm_agent_tasks', {
              agent_id: subAgentId,
              title: task.title || 'Orchestrator-assigned task',
              description: buildTaskDescription(task, subAgentId, platforms, contentPillars),
              priority: task.priority || 'medium',
              assigned_model: assignedModel,
              status: 'pending',
              due_date: targetDate,
              output: {},
              created_at: new Date().toISOString(),
            });
            totalTasksCreated++;
            console.log(`[AgentScheduler] Task for ${subAgentId}: "${task.title}" → model: ${assignedModel}`);
          } catch (err: any) {
            console.error(`[AgentScheduler] Failed to create task for ${subAgentId}:`, err.message);
          }
        }
      }

      console.log(`[AgentScheduler] Created ${totalTasksCreated} tasks from orchestrator plan`);

      for (const subAgentId of Object.values(ORCHESTRATOR_SUB_AGENT_MAP)) {
        if (isAgentEnabled(subAgentId)) {
          try {
            await this.executeAgent(subAgentId);
          } catch (err: any) {
            console.error(`[AgentScheduler] Sub-agent ${subAgentId} failed:`, err.message);
          }
        }
      }
    } catch (err: any) {
      console.error('[AgentScheduler] Orchestrator delegation failed:', err.message);
    }
  }

  private async processContentCalendarCron(): Promise<void> {
    console.log('[AgentScheduler] Running content calendar publish processor...');
    try {
      const result = await processContentCalendar();
      if (result.published > 0 || result.failed > 0) {
        console.log(`[AgentScheduler] Content calendar: ${result.published} published, ${result.failed} failed`);
      }
      if (result.errors.length > 0) {
        console.log(`[AgentScheduler] Content calendar errors: ${result.errors.join('; ')}`);
      }
    } catch (err: any) {
      console.error('[AgentScheduler] Content calendar processor error:', err.message);
    }
  }

  private async sendDailyBriefing(): Promise<void> {
    console.log('[AgentScheduler] Generating daily Nexus briefing...');
    try {
      const briefing = await generateDailyBriefing();
      await sendBriefingNotifications(briefing);
      console.log('[AgentScheduler] Daily briefing sent successfully');
    } catch (err: any) {
      console.error('[AgentScheduler] Daily briefing failed:', err.message);
    }
  }

  private async processAllTasks() {
    console.log('[AgentScheduler] Processing pending tasks for all agents...');
    const agentIds = Object.keys(AGENT_DEFINITIONS);
    let totalProcessed = 0;

    for (const agentId of agentIds) {
      if (isAgentEnabled(agentId)) {
        const processed = await processAgentTasks(agentId);
        totalProcessed += processed;
      }
    }

    if (totalProcessed > 0) {
      console.log(`[AgentScheduler] Processed ${totalProcessed} total tasks`);
    }
  }

  isStarted(): boolean {
    return this.started;
  }

  isRunning(): boolean {
    return this.started;
  }
}

function buildTaskDescription(
  task: any,
  subAgentId: string,
  platforms: string[],
  contentPillars: string[],
): string {
  let description = task.description || '';

  if (subAgentId === 'maven' && platforms.length > 0) {
    description += `\n\nTarget Platforms: ${platforms.join(', ')}`;
  }

  if (contentPillars.length > 0) {
    description += `\nContent Pillars: ${contentPillars.join(', ')}`;
  }

  if (task.channel) {
    description += `\nChannel: ${task.channel}`;
  }

  return description.trim();
}

export const agentScheduler = new AgentScheduler();
