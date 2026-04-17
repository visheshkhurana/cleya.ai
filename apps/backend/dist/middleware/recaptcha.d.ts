import type { Request, Response, NextFunction } from 'express';
/**
 * Verifies a Google reCAPTCHA v3 token attached as `recaptchaToken` on the
 * request body. Gracefully no-ops when RECAPTCHA_SECRET_KEY is not configured
 * (development / preview environments). On verification failure or low score,
 * responds with a 400 JSON error.
 */
export declare function verifyRecaptcha(action?: string): (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=recaptcha.d.ts.map