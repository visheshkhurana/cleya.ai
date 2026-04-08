import { logger } from './logger';

interface MetricOptions {
  tags?: Record<string, string>;
}

type MetricBackend = 'statsd' | 'log';

function getBackend(): MetricBackend {
  if (process.env.DD_ENABLED === 'true' && process.env.STATSD_HOST) {
    return 'statsd';
  }
  return 'log';
}

let statsdClient: any = null;

function getStatsdClient() {
  if (statsdClient) return statsdClient;
  try {
    const dgram = require('dgram');
    const host = process.env.STATSD_HOST || 'localhost';
    const port = parseInt(process.env.STATSD_PORT || '8125', 10);
    const client = dgram.createSocket('udp4');
    statsdClient = { client, host, port };
    return statsdClient;
  } catch {
    return null;
  }
}

function sendStatsd(metric: string, value: number, type: 'c' | 'g' | 'ms', tags?: Record<string, string>) {
  const sd = getStatsdClient();
  if (!sd) return;

  let tagStr = '';
  if (tags && Object.keys(tags).length > 0) {
    tagStr = '|#' + Object.entries(tags).map(([k, v]) => `${k}:${v}`).join(',');
  }

  const message = `cleya.${metric}:${value}|${type}${tagStr}`;
  const buf = Buffer.from(message);
  sd.client.send(buf, 0, buf.length, sd.port, sd.host, () => {});
}

function increment(metric: string, value = 1, opts?: MetricOptions) {
  const backend = getBackend();
  if (backend === 'statsd') {
    sendStatsd(metric, value, 'c', opts?.tags);
  } else {
    logger.debug(`metric.counter: ${metric}=${value}`, { metric, value, ...opts?.tags });
  }
}

function gauge(metric: string, value: number, opts?: MetricOptions) {
  const backend = getBackend();
  if (backend === 'statsd') {
    sendStatsd(metric, value, 'g', opts?.tags);
  } else {
    logger.debug(`metric.gauge: ${metric}=${value}`, { metric, value, ...opts?.tags });
  }
}

function timing(metric: string, durationMs: number, opts?: MetricOptions) {
  const backend = getBackend();
  if (backend === 'statsd') {
    sendStatsd(metric, durationMs, 'ms', opts?.tags);
  } else {
    logger.debug(`metric.timing: ${metric}=${durationMs}ms`, { metric, durationMs, ...opts?.tags });
  }
}

export const metrics = {
  increment,
  gauge,
  timing,

  agent: {
    runStarted(agentName: string) {
      increment('agent.run.started', 1, { tags: { agent: agentName } });
    },
    runCompleted(agentName: string, durationMs: number) {
      increment('agent.run.completed', 1, { tags: { agent: agentName } });
      timing('agent.run.duration', durationMs, { tags: { agent: agentName } });
    },
    runFailed(agentName: string) {
      increment('agent.run.failed', 1, { tags: { agent: agentName } });
    },
  },

  ai: {
    callStarted(provider: string, model: string) {
      increment('ai.call.started', 1, { tags: { provider, model } });
    },
    callCompleted(provider: string, model: string, durationMs: number, tokens?: number) {
      increment('ai.call.completed', 1, { tags: { provider, model } });
      timing('ai.call.duration', durationMs, { tags: { provider, model } });
      if (tokens) gauge('ai.call.tokens', tokens, { tags: { provider, model } });
    },
    callFailed(provider: string, model: string) {
      increment('ai.call.failed', 1, { tags: { provider, model } });
    },
  },

  api: {
    requestReceived(method: string, path: string) {
      increment('api.request.received', 1, { tags: { method, path } });
    },
    requestCompleted(method: string, path: string, statusCode: number, durationMs: number) {
      increment('api.request.completed', 1, { tags: { method, path, status: String(statusCode) } });
      timing('api.request.duration', durationMs, { tags: { method, path } });
    },
    requestFailed(method: string, path: string, statusCode: number) {
      increment('api.request.failed', 1, { tags: { method, path, status: String(statusCode) } });
    },
  },

  db: {
    queryExecuted(operation: string, durationMs: number) {
      increment('db.query.executed', 1, { tags: { operation } });
      timing('db.query.duration', durationMs, { tags: { operation } });
    },
    queryFailed(operation: string) {
      increment('db.query.failed', 1, { tags: { operation } });
    },
    connectionPoolSize(size: number) {
      gauge('db.pool.size', size);
    },
  },

  cache: {
    hit(key: string) {
      increment('cache.hit', 1, { tags: { key } });
    },
    miss(key: string) {
      increment('cache.miss', 1, { tags: { key } });
    },
  },

  message: {
    sent(channel: string) {
      increment('message.sent', 1, { tags: { channel } });
    },
    failed(channel: string) {
      increment('message.failed', 1, { tags: { channel } });
    },
  },

  user: {
    registered() {
      increment('user.registered');
    },
    login() {
      increment('user.login');
    },
    profileCompleted() {
      increment('user.profile.completed');
    },
    activeSession() {
      increment('user.session.active');
    },
  },
};
