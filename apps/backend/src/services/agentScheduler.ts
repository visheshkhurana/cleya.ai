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

    this.started = true;
    console.log('[AgentScheduler] All agent schedules initialized');
    console.log('[AgentScheduler] Task processing scheduled every 4 hours');
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

      return result;
    } finally {
      this.running.delete(agentId);
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
            await supabaseInsert('dm_agent_tasks', {
              agent_id: subAgentId,
              title: task.title || 'Orchestrator-assigned task',
              description: task.description || '',
              priority: task.priority || 'medium',
              status: 'pending',
              due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              output: {},
              created_at: new Date().toISOString(),
            });
            totalTasksCreated++;
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

export const agentScheduler = new AgentScheduler();
