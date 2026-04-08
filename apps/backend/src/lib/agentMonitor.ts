import { prisma } from '@cleya/db';
import { logger } from './logger';
import { metrics } from './metrics';
import { sendAlert, AlertSeverity } from './alerting';
import { recordEvent } from './alertRules';

interface AgentRunResult {
  agentName: string;
  success: boolean;
  durationMs: number;
  recordsProcessed?: number;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

interface AgentHealth {
  agentName: string;
  consecutiveFailures: number;
  lastRunAt: Date | null;
  lastSuccess: Date | null;
  successRate: number;
  totalRuns: number;
}

const agentHealthCache = new Map<string, {
  consecutiveFailures: number;
  lastSuccess: Date | null;
  recentResults: boolean[];
}>();

const MAX_RECENT_RESULTS = 20;
const CONSECUTIVE_FAILURE_THRESHOLD = 3;

export class AgentMonitor {
  async logRun(result: AgentRunResult): Promise<void> {
    const log = logger.child({ component: 'AgentMonitor', agent: result.agentName });

    try {
      await prisma.agentRunLog.create({
        data: {
          agentName: result.agentName,
          success: result.success,
          durationMs: result.durationMs,
          recordsProcessed: result.recordsProcessed || 0,
          errorMessage: result.errorMessage || null,
          metadata: result.metadata ? JSON.stringify(result.metadata) : null,
        },
      });
    } catch (err: any) {
      log.error('Failed to log agent run to database', { error: err.message });
    }

    if (result.success) {
      metrics.agent.runCompleted(result.agentName, result.durationMs);
    } else {
      metrics.agent.runFailed(result.agentName);
      recordEvent('agent_failures');
    }

    let health = agentHealthCache.get(result.agentName);
    if (!health) {
      health = { consecutiveFailures: 0, lastSuccess: null, recentResults: [] };
      agentHealthCache.set(result.agentName, health);
    }

    health.recentResults.push(result.success);
    if (health.recentResults.length > MAX_RECENT_RESULTS) {
      health.recentResults.shift();
    }

    if (result.success) {
      health.consecutiveFailures = 0;
      health.lastSuccess = new Date();
    } else {
      health.consecutiveFailures++;
    }

    if (health.consecutiveFailures >= CONSECUTIVE_FAILURE_THRESHOLD) {
      log.error(`Agent ${result.agentName} has ${health.consecutiveFailures} consecutive failures`);
      await sendAlert({
        severity: health.consecutiveFailures >= 5 ? AlertSeverity.P1_CRITICAL : AlertSeverity.P2_HIGH,
        title: 'Agent Unhealthy',
        service: result.agentName,
        message: `Agent has failed ${health.consecutiveFailures} consecutive times`,
        error: result.errorMessage,
      });
    }

    log.info(`Agent run: ${result.agentName}`, {
      success: result.success,
      durationMs: result.durationMs,
      recordsProcessed: result.recordsProcessed,
    });
  }

  async getHealth(agentName: string): Promise<AgentHealth> {
    const cached = agentHealthCache.get(agentName);
    const successCount = cached?.recentResults.filter(r => r).length || 0;
    const totalRecent = cached?.recentResults.length || 0;

    return {
      agentName,
      consecutiveFailures: cached?.consecutiveFailures || 0,
      lastRunAt: null,
      lastSuccess: cached?.lastSuccess || null,
      successRate: totalRecent > 0 ? Math.round((successCount / totalRecent) * 100) : 100,
      totalRuns: totalRecent,
    };
  }

  async getAllHealth(): Promise<AgentHealth[]> {
    const agents = Array.from(agentHealthCache.keys());
    return Promise.all(agents.map(name => this.getHealth(name)));
  }

  startRun(agentName: string): () => Promise<void> {
    const startTime = Date.now();
    metrics.agent.runStarted(agentName);

    return async (error?: Error) => {
      const durationMs = Date.now() - startTime;
      await this.logRun({
        agentName,
        success: !error,
        durationMs,
        errorMessage: error?.message,
      });
    };
  }
}

export const agentMonitor = new AgentMonitor();
