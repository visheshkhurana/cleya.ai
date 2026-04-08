import { logger } from './logger';
import { metrics } from './metrics';
import { sendAlert, AlertSeverity } from './alerting';

interface PipelineStage {
  name: string;
  startedAt: number;
  completedAt?: number;
  recordsIn: number;
  recordsOut: number;
  errors: number;
}

interface PipelineConfig {
  name: string;
  maxFailureRate: number;
  maxQueueDepth: number;
  maxDurationMs: number;
}

const DEFAULT_CONFIG: Omit<PipelineConfig, 'name'> = {
  maxFailureRate: 10,
  maxQueueDepth: 1000,
  maxDurationMs: 300000,
};

interface PipelineState {
  config: PipelineConfig;
  stages: PipelineStage[];
  currentStage: PipelineStage | null;
  startedAt: number;
  totalRecordsProcessed: number;
  totalErrors: number;
  queueDepth: number;
}

const activePipelines = new Map<string, PipelineState>();

export class PipelineMonitor {
  private pipelineName: string;
  private config: PipelineConfig;

  constructor(name: string, config?: Partial<Omit<PipelineConfig, 'name'>>) {
    this.pipelineName = name;
    this.config = { name, ...DEFAULT_CONFIG, ...config };
  }

  startPipeline(): void {
    const state: PipelineState = {
      config: this.config,
      stages: [],
      currentStage: null,
      startedAt: Date.now(),
      totalRecordsProcessed: 0,
      totalErrors: 0,
      queueDepth: 0,
    };
    activePipelines.set(this.pipelineName, state);

    logger.info(`Pipeline started: ${this.pipelineName}`);
    metrics.increment('pipeline.started', 1, { tags: { pipeline: this.pipelineName } });
  }

  startStage(stageName: string, recordsIn: number): void {
    const state = activePipelines.get(this.pipelineName);
    if (!state) return;

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

    logger.debug(`Pipeline stage started: ${this.pipelineName}/${stageName}`, { recordsIn });
  }

  completeStage(recordsOut: number, errors = 0): void {
    const state = activePipelines.get(this.pipelineName);
    if (!state || !state.currentStage) return;

    state.currentStage.completedAt = Date.now();
    state.currentStage.recordsOut = recordsOut;
    state.currentStage.errors = errors;
    state.totalRecordsProcessed += recordsOut;
    state.totalErrors += errors;

    const stageDuration = state.currentStage.completedAt - state.currentStage.startedAt;
    metrics.timing('pipeline.stage.duration', stageDuration, {
      tags: { pipeline: this.pipelineName, stage: state.currentStage.name },
    });

    state.stages.push(state.currentStage);
    state.currentStage = null;

    const failureRate = state.totalRecordsProcessed > 0
      ? (state.totalErrors / (state.totalRecordsProcessed + state.totalErrors)) * 100
      : 0;

    if (failureRate > this.config.maxFailureRate) {
      sendAlert({
        severity: AlertSeverity.P2_HIGH,
        title: 'Pipeline Failure Rate Exceeded',
        service: this.pipelineName,
        message: `Failure rate ${failureRate.toFixed(1)}% exceeds threshold of ${this.config.maxFailureRate}%`,
        errorRate: failureRate,
      });
    }
  }

  updateQueueDepth(depth: number): void {
    const state = activePipelines.get(this.pipelineName);
    if (!state) return;

    state.queueDepth = depth;
    metrics.gauge('pipeline.queue.depth', depth, { tags: { pipeline: this.pipelineName } });

    if (depth > this.config.maxQueueDepth) {
      sendAlert({
        severity: AlertSeverity.P3_MEDIUM,
        title: 'Pipeline Queue Depth Exceeded',
        service: this.pipelineName,
        message: `Queue depth ${depth} exceeds threshold of ${this.config.maxQueueDepth}`,
      });
    }
  }

  completePipeline(): void {
    const state = activePipelines.get(this.pipelineName);
    if (!state) return;

    if (state.currentStage && !state.currentStage.completedAt) {
      state.currentStage.completedAt = Date.now();
      state.stages.push(state.currentStage);
    }

    const totalDuration = Date.now() - state.startedAt;
    metrics.timing('pipeline.duration', totalDuration, { tags: { pipeline: this.pipelineName } });
    metrics.increment('pipeline.completed', 1, { tags: { pipeline: this.pipelineName } });
    metrics.gauge('pipeline.records.processed', state.totalRecordsProcessed, { tags: { pipeline: this.pipelineName } });

    if (totalDuration > this.config.maxDurationMs) {
      sendAlert({
        severity: AlertSeverity.P3_MEDIUM,
        title: 'Pipeline Duration Exceeded',
        service: this.pipelineName,
        message: `Pipeline took ${Math.round(totalDuration / 1000)}s, exceeds threshold of ${Math.round(this.config.maxDurationMs / 1000)}s`,
        duration: totalDuration,
      });
    }

    logger.info(`Pipeline completed: ${this.pipelineName}`, {
      durationMs: totalDuration,
      stages: state.stages.length,
      totalRecords: state.totalRecordsProcessed,
      totalErrors: state.totalErrors,
    });

    activePipelines.delete(this.pipelineName);
  }

  failPipeline(error: string): void {
    const state = activePipelines.get(this.pipelineName);
    const totalDuration = state ? Date.now() - state.startedAt : 0;

    metrics.increment('pipeline.failed', 1, { tags: { pipeline: this.pipelineName } });

    logger.error(`Pipeline failed: ${this.pipelineName}`, { error, durationMs: totalDuration });

    sendAlert({
      severity: AlertSeverity.P2_HIGH,
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
    if (!state) return null;

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
