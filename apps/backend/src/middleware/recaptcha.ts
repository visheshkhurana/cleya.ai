import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

const RECAPTCHA_THRESHOLD = 0.5;
const VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

interface VerifyResponse {
  success: boolean;
  score?: number;
  action?: string;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
}

/**
 * Verifies a Google reCAPTCHA v3 token attached as `recaptchaToken` on the
 * request body. Gracefully no-ops when RECAPTCHA_SECRET_KEY is not configured
 * (development / preview environments). On verification failure or low score,
 * responds with a 400 JSON error.
 */
export function verifyRecaptcha(action?: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const secret = env.RECAPTCHA_SECRET_KEY;
    if (!secret) {
      // Fail open when not configured so non-prod environments keep working.
      return next();
    }

    const token = (req.body?.recaptchaToken || req.body?.captchaToken || '').toString();
    if (!token) {
      res.status(400).json({
        success: false,
        error: { message: 'Captcha verification required. Please refresh the page and try again.', code: 'CAPTCHA_REQUIRED' },
      });
      return;
    }

    try {
      const params = new URLSearchParams({ secret, response: token });
      const r = await fetch(VERIFY_URL, { method: 'POST', body: params });
      const data = (await r.json()) as VerifyResponse;
      const score = typeof data.score === 'number' ? data.score : null;
      const decision =
        !data.success ? 'invalid'
          : (score !== null && score < RECAPTCHA_THRESHOLD) ? 'low_score'
          : (action && data.action && data.action !== action) ? 'action_mismatch'
          : 'allowed';

      console.log('[recaptcha]', JSON.stringify({
        event: 'verify',
        path: req.path,
        expectedAction: action ?? null,
        observedAction: data.action ?? null,
        score,
        threshold: RECAPTCHA_THRESHOLD,
        decision,
        errorCodes: data['error-codes'] ?? [],
        ip: req.ip,
      }));

      if (decision === 'invalid' || decision === 'low_score') {
        res.status(400).json({
          success: false,
          error: { message: "We couldn't verify you're human. Please try again.", code: 'CAPTCHA_FAILED' },
        });
        return;
      }
      if (decision === 'action_mismatch') {
        res.status(400).json({
          success: false,
          error: { message: 'Captcha verification failed. Please reload the page.', code: 'CAPTCHA_ACTION_MISMATCH' },
        });
        return;
      }
      next();
    } catch (e) {
      console.error('[recaptcha]', JSON.stringify({
        event: 'transport_error',
        path: req.path,
        expectedAction: action ?? null,
        error: (e as Error)?.message,
        ip: req.ip,
      }));
      res.status(503).json({
        success: false,
        error: {
          message: "We couldn't reach our verification service. Please try again in a moment.",
          code: 'CAPTCHA_UNAVAILABLE',
        },
      });
    }
  };
}
