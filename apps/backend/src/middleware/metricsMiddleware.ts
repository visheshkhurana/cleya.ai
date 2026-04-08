import { Request, Response, NextFunction } from 'express';
import { metrics } from '../lib/metrics';

function normalizePath(path: string): string {
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/cl[a-z0-9]{20,}/gi, '/:id')
    .replace(/\/\d+/g, '/:id');
}

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  const normalizedPath = normalizePath(req.path);

  metrics.api.requestReceived(req.method, normalizedPath);

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    metrics.api.requestCompleted(req.method, normalizedPath, res.statusCode, duration);

    if (res.statusCode >= 400) {
      metrics.api.requestFailed(req.method, normalizedPath, res.statusCode);
    }
  });

  next();
}
