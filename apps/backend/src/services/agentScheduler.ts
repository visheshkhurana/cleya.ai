import cron, { ScheduledTask } from 'node-cron';
import { runAgent, processAgentTasks, setAgentScheduleStatus } from './agentRunner';

interface ScheduleConfig {
  agentId: string;
  cronExpression: string;
  description: string;
}

const SCHEDULES: ScheduleConfig[] = [
  { agentId: 'orchestrator', cronExpression: '0 7 * * *', description: 'Daily at 7:00 AM IST' },
  { agentId: 'content-strategist', cronExpression: '30 7 * * 1', description: 'Mondays at 7:30 AM IST' },
  { agentId: 'social-media', cronExpression: '0 9 * * 1,3,5', description: 'Mon/Wed/Fri at 9:00 AM IST' },
  { agentId: 'email-marketing', cronExpression: '0 10 * * 2', description: 'Tuesdays at 10:00 AM IST' },
  { agentId: 'cold-outreach', cronExpression: '0 11 * * 4', description: 'Thursdays at 11:00 AM IST' },
];

class AgentScheduler {
  private tasks: ScheduledTask[] = [];
  private started = false;
  private running = new Set<string>();

  getScheduleInfo(): Record<string, string> {
    const info: Record<string, string> = {};
    for (const schedule of SCHEDULES) {
      info[schedule.agentId] = schedule.description;
    }
    return info;
  }

  start() {
    if (this.started) {
      console.log('[AgentScheduler] Already started, skipping');
      return;
    }

    for (const schedule of SCHEDULES) {
      const task = cron.schedule(schedule.cronExpression, () => {
        this.executeAgent(schedule.agentId).catch(err =>
          console.error(`[AgentScheduler] ${schedule.agentId} execution failed:`, err)
        );
      }, { timezone: 'Asia/Kolkata' });

      this.tasks.push(task);
      setAgentScheduleStatus(schedule.agentId, 'scheduled');
      console.log(`[AgentScheduler] Scheduled ${schedule.agentId}: ${schedule.description}`);
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

      if (agentId === 'orchestrator' && result.status === 'success') {
        console.log('[AgentScheduler] Orchestrator completed, triggering sub-agents...');
        const subAgents = ['content-strategist', 'social-media', 'email-marketing'];
        for (const subId of subAgents) {
          try {
            await this.executeAgent(subId);
          } catch (err: any) {
            console.error(`[AgentScheduler] Sub-agent ${subId} failed:`, err.message);
          }
        }
      }

      return result;
    } finally {
      this.running.delete(agentId);
    }
  }

  private async processAllTasks() {
    console.log('[AgentScheduler] Processing pending tasks for all agents...');
    const agentIds = SCHEDULES.map(s => s.agentId);
    let totalProcessed = 0;

    for (const agentId of agentIds) {
      const processed = await processAgentTasks(agentId);
      totalProcessed += processed;
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
