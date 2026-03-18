import { Request, Response, NextFunction } from 'express';
import * as Sentry from '@sentry/node';
import { env } from '../config/env';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        message: err.message,
        code: err.code || 'ERROR',
      },
    });
  }

  console.error('Unhandled error:', err);

  if (env.SENTRY_DSN) {
    Sentry.captureException(err, {
      extra: {
        method: req.method,
        url: req.originalUrl,
        userId: (req as any).user?.userId,
      },
    });
  }

  res.status(500).json({
    error: {
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    },
  });
}
