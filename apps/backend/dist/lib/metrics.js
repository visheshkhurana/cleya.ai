"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metrics = void 0;
const logger_1 = require("./logger");
function getBackend() {
    if (process.env.DD_ENABLED === 'true' && process.env.STATSD_HOST) {
        return 'statsd';
    }
    return 'log';
}
let statsdClient = null;
function getStatsdClient() {
    if (statsdClient)
        return statsdClient;
    try {
        const dgram = require('dgram');
        const host = process.env.STATSD_HOST || 'localhost';
        const port = parseInt(process.env.STATSD_PORT || '8125', 10);
        const client = dgram.createSocket('udp4');
        statsdClient = { client, host, port };
        return statsdClient;
    }
    catch {
        return null;
    }
}
function sendStatsd(metric, value, type, tags) {
    const sd = getStatsdClient();
    if (!sd)
        return;
    let tagStr = '';
    if (tags && Object.keys(tags).length > 0) {
        tagStr = '|#' + Object.entries(tags).map(([k, v]) => `${k}:${v}`).join(',');
    }
    const message = `cleya.${metric}:${value}|${type}${tagStr}`;
    const buf = Buffer.from(message);
    sd.client.send(buf, 0, buf.length, sd.port, sd.host, () => { });
}
function increment(metric, value = 1, opts) {
    const backend = getBackend();
    if (backend === 'statsd') {
        sendStatsd(metric, value, 'c', opts?.tags);
    }
    else {
        logger_1.logger.debug(`metric.counter: ${metric}=${value}`, { metric, value, ...opts?.tags });
    }
}
function gauge(metric, value, opts) {
    const backend = getBackend();
    if (backend === 'statsd') {
        sendStatsd(metric, value, 'g', opts?.tags);
    }
    else {
        logger_1.logger.debug(`metric.gauge: ${metric}=${value}`, { metric, value, ...opts?.tags });
    }
}
function timing(metric, durationMs, opts) {
    const backend = getBackend();
    if (backend === 'statsd') {
        sendStatsd(metric, durationMs, 'ms', opts?.tags);
    }
    else {
        logger_1.logger.debug(`metric.timing: ${metric}=${durationMs}ms`, { metric, durationMs, ...opts?.tags });
    }
}
exports.metrics = {
    increment,
    gauge,
    timing,
    agent: {
        runStarted(agentName) {
            increment('agent.run.started', 1, { tags: { agent: agentName } });
        },
        runCompleted(agentName, durationMs) {
            increment('agent.run.completed', 1, { tags: { agent: agentName } });
            timing('agent.run.duration', durationMs, { tags: { agent: agentName } });
        },
        runFailed(agentName) {
            increment('agent.run.failed', 1, { tags: { agent: agentName } });
        },
    },
    ai: {
        callStarted(provider, model) {
            increment('ai.call.started', 1, { tags: { provider, model } });
        },
        callCompleted(provider, model, durationMs, tokens) {
            increment('ai.call.completed', 1, { tags: { provider, model } });
            timing('ai.call.duration', durationMs, { tags: { provider, model } });
            if (tokens)
                gauge('ai.call.tokens', tokens, { tags: { provider, model } });
        },
        callFailed(provider, model) {
            increment('ai.call.failed', 1, { tags: { provider, model } });
        },
    },
    api: {
        requestReceived(method, path) {
            increment('api.request.received', 1, { tags: { method, path } });
        },
        requestCompleted(method, path, statusCode, durationMs) {
            increment('api.request.completed', 1, { tags: { method, path, status: String(statusCode) } });
            timing('api.request.duration', durationMs, { tags: { method, path } });
        },
        requestFailed(method, path, statusCode) {
            increment('api.request.failed', 1, { tags: { method, path, status: String(statusCode) } });
        },
    },
    db: {
        queryExecuted(operation, durationMs) {
            increment('db.query.executed', 1, { tags: { operation } });
            timing('db.query.duration', durationMs, { tags: { operation } });
        },
        queryFailed(operation) {
            increment('db.query.failed', 1, { tags: { operation } });
        },
        connectionPoolSize(size) {
            gauge('db.pool.size', size);
        },
    },
    cache: {
        hit(key) {
            increment('cache.hit', 1, { tags: { key } });
        },
        miss(key) {
            increment('cache.miss', 1, { tags: { key } });
        },
    },
    message: {
        sent(channel) {
            increment('message.sent', 1, { tags: { channel } });
        },
        failed(channel) {
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
//# sourceMappingURL=metrics.js.map