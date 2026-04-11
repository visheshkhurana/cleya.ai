"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PipelineMonitor = void 0;
const logger_1 = require("./logger");
const metrics_1 = require("./metrics");
const alerting_1 = require("./alerting");
const DEFAULT_CONFIG = {
    maxFailureRate: 10,
    maxQueueDepth: 1000,
    maxDurationMs: 300000,
};
const activePipelines = new Map();
class PipelineMonitor {
    pipelineName;
    config;
    constructor(name, config) {
        this.pipelineName = name;
        this.config = { name, ...DEFAULT_CONFIG, ...config };
    }
    startPipeline() {
        const state = {
            config: this.config,
            stages: [],
            currentStage: null,
            startedAt: Date.now(),
            totalRecordsProcessed: 0,
            totalErrors: 0,
            queueDepth: 0,
        };
        activePipelines.set(this.pipelineName, state);
        logger_1.logger.info(`Pipeline started: ${this.pipelineName}`);
        metrics_1.metrics.increment('pipeline.started', 1, { tags: { pipeline: this.pipelineName } });
    }
    startStage(stageName, recordsIn) {
        const state = activePipelines.get(this.pipelineName);
        if (!state)
            return;
        if (state.currentStage && !state.currentStage.completedAt) {
            state.currentStage.completedAt = Date.now();
            state.stages.push(state.currentStage);
        }
        state.currentStage = {
            name: stageName,
            startedAt: Date.now(),
            recordsIn,
            recordsOut: 0,
            errors: 0,
        };
        logger_1.logger.debug(`Pipeline stage started: ${this.pipelineName}/${stageName}`, { recordsIn });
    }
    completeStage(recordsOut, errors = 0) {
        const state = activePipelines.get(this.pipelineName);
        if (!state || !state.currentStage)
            return;
        state.currentStage.completedAt = Date.now();
        state.currentStage.recordsOut = recordsOut;
        state.currentStage.errors = errors;
        state.totalRecordsProcessed += recordsOut;
        state.totalErrors += errors;
        const stageDuration = state.currentStage.completedAt - state.currentStage.startedAt;
        metrics_1.metrics.timing('pipeline.stage.duration', stageDuration, {
            tags: { pipeline: this.pipelineName, stage: state.currentStage.name },
        });
        state.stages.push(state.currentStage);
        state.currentStage = null;
        const failureRate = state.totalRecordsProcessed > 0
            ? (state.totalErrors / (state.totalRecordsProcessed + state.totalErrors)) * 100
            : 0;
        if (failureRate > this.config.maxFailureRate) {
            (0, alerting_1.sendAlert)({
                severity: alerting_1.AlertSeverity.P2_HIGH,
                title: 'Pipeline Failure Rate Exceeded',
                service: this.pipelineName,
                message: `Failure rate ${failureRate.toFixed(1)}% exceeds threshold of ${this.config.maxFailureRate}%`,
                errorRate: failureRate,
            });
        }
    }
    updateQueueDepth(depth) {
        const state = activePipelines.get(this.pipelineName);
        if (!state)
            return;
        state.queueDepth = depth;
        metrics_1.metrics.gauge('pipeline.queue.depth', depth, { tags: { pipeline: this.pipelineName } });
        if (depth > this.config.maxQueueDepth) {
            (0, alerting_1.sendAlert)({
                severity: alerting_1.AlertSeverity.P3_MEDIUM,
                title: 'Pipeline Queue Depth Exceeded',
                service: this.pipelineName,
                message: `Queue depth ${depth} exceeds threshold of ${this.config.maxQueueDepth}`,
            });
        }
    }
    completePipeline() {
        const state = activePipelines.get(this.pipelineName);
        if (!state)
            return;
        if (state.currentStage && !state.currentStage.completedAt) {
            state.currentStage.completedAt = Date.now();
            state.stages.push(state.currentStage);
        }
        const totalDuration = Date.now() - state.startedAt;
        metrics_1.metrics.timing('pipeline.duration', totalDuration, { tags: { pipeline: this.pipelineName } });
        metrics_1.metrics.increment('pipeline.completed', 1, { tags: { pipeline: this.pipelineName } });
        metrics_1.metrics.gauge('pipeline.records.processed', state.totalRecordsProcessed, { tags: { pipeline: this.pipelineName } });
        if (totalDuration > this.config.maxDurationMs) {
            (0, alerting_1.sendAlert)({
                severity: alerting_1.AlertSeverity.P3_MEDIUM,
                title: 'Pipeline Duration Exceeded',
                service: this.pipelineName,
                message: `Pipeline took ${Math.round(totalDuration / 1000)}s, exceeds threshold of ${Math.round(this.config.maxDurationMs / 1000)}s`,
                duration: totalDuration,
            });
        }
        logger_1.logger.info(`Pipeline completed: ${this.pipelineName}`, {
            durationMs: totalDuration,
            stages: state.stages.length,
            totalRecords: state.totalRecordsProcessed,
            totalErrors: state.totalErrors,
        });
        activePipelines.delete(this.pipelineName);
    }
    failPipeline(error) {
        const state = activePipelines.get(this.pipelineName);
        const totalDuration = state ? Date.now() - state.startedAt : 0;
        metrics_1.metrics.increment('pipeline.failed', 1, { tags: { pipeline: this.pipelineName } });
        logger_1.logger.error(`Pipeline failed: ${this.pipelineName}`, { error, durationMs: totalDuration });
        (0, alerting_1.sendAlert)({
            severity: alerting_1.AlertSeverity.P2_HIGH,
            title: 'Pipeline Failed',
            service: this.pipelineName,
            message: `Pipeline failed after ${Math.round(totalDuration / 1000)}s`,
            error,
            duration: totalDuration,
        });
        activePipelines.delete(this.pipelineName);
    }
    getStatus() {
        const state = activePipelines.get(this.pipelineName);
        if (!state)
            return null;
        return {
            pipeline: this.pipelineName,
            running: true,
            durationMs: Date.now() - state.startedAt,
            stagesCompleted: state.stages.length,
            currentStage: state.currentStage?.name || null,
            totalRecordsProcessed: state.totalRecordsProcessed,
            totalErrors: state.totalErrors,
            queueDepth: state.queueDepth,
        };
    }
}
exports.PipelineMonitor = PipelineMonitor;
//# sourceMappingURL=pipelineMonitor.js.map