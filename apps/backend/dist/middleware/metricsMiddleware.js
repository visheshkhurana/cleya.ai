"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metricsMiddleware = metricsMiddleware;
const metrics_1 = require("../lib/metrics");
function normalizePath(path) {
    return path
        .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
        .replace(/\/cl[a-z0-9]{20,}/gi, '/:id')
        .replace(/\/\d+/g, '/:id');
}
function metricsMiddleware(req, res, next) {
    const startTime = Date.now();
    const normalizedPath = normalizePath(req.path);
    metrics_1.metrics.api.requestReceived(req.method, normalizedPath);
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        metrics_1.metrics.api.requestCompleted(req.method, normalizedPath, res.statusCode, duration);
        if (res.statusCode >= 400) {
            metrics_1.metrics.api.requestFailed(req.method, normalizedPath, res.statusCode);
        }
    });
    next();
}
//# sourceMappingURL=metricsMiddleware.js.map