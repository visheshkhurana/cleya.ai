import { Request, Response, NextFunction } from 'express';
import * as Sentry from '@sentry/node';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { recordEvent } from '../lib/alertRules';

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

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: err.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      },
    });
  }

  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({
      error: {
        message: 'Invalid request body',
        code: 'INVALID_JSON',
      },
    });
  }

  logger.error('Unhandled error', {
    error: err.message,
    method: req.method,
    url: req.originalUrl,
    stack: err.stack,
  });

  recordEvent('critical_errors');

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
