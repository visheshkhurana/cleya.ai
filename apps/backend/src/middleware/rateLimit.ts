import rateLimit from 'express-rate-limit';
import { securityLogger } from '../services/securityLogger';
import type { Request } from 'express';

const onRateLimitHit = (req: Request, limiterName: string) => {
  securityLogger.suspiciousEvent(req, 'RATE_LIMIT_HIT', {
    limiter: limiterName,
    path: req.path,
    method: req.method,
  });
};

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many requests. Please try again later.', code: 'RATE_LIMITED' } },
  handler: (req, res, _next, options) => {
    onRateLimitHit(req, 'general');
    res.status(options.statusCode).json(options.message);
  },
});

export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many authentication attempts. Please wait a minute and try again.', code: 'RATE_LIMITED' } },
  handler: (req, res, _next, options) => {
    onRateLimitHit(req, 'auth');
    res.status(options.statusCode).json(options.message);
  },
});

export const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many signup attempts. Please try again later.', code: 'RATE_LIMITED' } },
  handler: (req, res, _next, options) => {
    onRateLimitHit(req, 'signup');
    res.status(options.statusCode).json(options.message);
  },
});

export const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many login attempts. Please wait a minute and try again.', code: 'RATE_LIMITED' } },
  handler: (req, res, _next, options) => {
    onRateLimitHit(req, 'login');
    res.status(options.statusCode).json(options.message);
  },
});

export const matchProposalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many match proposals. Please try again later.', code: 'RATE_LIMITED' } },
  handler: (req, res, _next, options) => {
    onRateLimitHit(req, 'matchProposal');
    res.status(options.statusCode).json(options.message);
  },
});

export const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many password reset attempts. Please try again later.', code: 'RATE_LIMITED' } },
  handler: (req, res, _next, options) => {
    onRateLimitHit(req, 'passwordReset');
    res.status(options.statusCode).json(options.message);
  },
});
