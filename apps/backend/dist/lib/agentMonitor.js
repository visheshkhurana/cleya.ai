"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentMonitor = exports.AgentMonitor = void 0;
const db_1 = require("@cleya/db");
const logger_1 = require("./logger");
const metrics_1 = require("./metrics");
const alerting_1 = require("./alerting");
const alertRules_1 = require("./alertRules");
const agentHealthCache = new Map();
const MAX_RECENT_RESULTS = 20;
const CONSECUTIVE_FAILURE_THRESHOLD = 3;
class AgentMonitor {
    async logRun(result) {
        const log = logger_1.logger.child({ component: 'AgentMonitor', agent: result.agentName });
        try {
            await db_1.prisma.agentRunLog.create({
                data: {
                    agentName: result.agentName,
                    success: result.success,
                    durationMs: result.durationMs,
                    recordsProcessed: result.recordsProcessed || 0,
                    errorMessage: result.errorMessage || null,
                    metadata: result.metadata ? JSON.stringify(result.metadata) : null,
                },
            });
        }
        catch (err) {
            log.error('Failed to log agent run to database', { error: err.message });
        }
        if (result.success) {
            metrics_1.metrics.agent.runCompleted(result.agentName, result.durationMs);
        }
        else {
            metrics_1.metrics.agent.runFailed(result.agentName);
            (0, alertRules_1.recordEvent)('agent_failures');
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
        }
        else {
            health.consecutiveFailures++;
        }
        if (health.consecutiveFailures >= CONSECUTIVE_FAILURE_THRESHOLD) {
            log.error(`Agent ${result.agentName} has ${health.consecutiveFailures} consecutive failures`);
            await (0, alerting_1.sendAlert)({
                severity: health.consecutiveFailures >= 5 ? alerting_1.AlertSeverity.P1_CRITICAL : alerting_1.AlertSeverity.P2_HIGH,
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
    async getHealth(agentName) {
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
    async getAllHealth() {
        const agents = Array.from(agentHealthCache.keys());
        return Promise.all(agents.map(name => this.getHealth(name)));
    }
    startRun(agentName) {
        const startTime = Date.now();
        metrics_1.metrics.agent.runStarted(agentName);
        return async (error) => {
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
exports.AgentMonitor = AgentMonitor;
exports.agentMonitor = new AgentMonitor();
//# sourceMappingURL=agentMonitor.js.map