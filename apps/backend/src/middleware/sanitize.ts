import { Request, Response, NextFunction } from 'express';
import { securityLogger } from '../services/securityLogger';

const NULL_BYTE_REGEX = /\x00/g;
const CONTROL_CHAR_REGEX = /[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value
      .replace(NULL_BYTE_REGEX, '')
      .replace(CONTROL_CHAR_REGEX, '')
      .normalize('NFKC');
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = sanitizeValue(v);
    }
    return result;
  }
  return value;
}

export function sanitizeInput(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') {
    const originalBody = JSON.stringify(req.body);
    req.body = sanitizeValue(req.body);
    const sanitizedBody = JSON.stringify(req.body);
    if (originalBody !== sanitizedBody) {
      securityLogger.suspiciousEvent(req, 'BLOCKED_INPUT', {
        path: req.path,
        method: req.method,
      });
    }
  }
  next();
}
