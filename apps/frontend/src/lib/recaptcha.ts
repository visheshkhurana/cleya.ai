declare global {
  interface Window {
    grecaptcha?: {
      ready(cb: () => void): void;
      execute(siteKey: string, opts: { action: string }): Promise<string>;
    };
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '';

export function isRecaptchaEnabled(): boolean {
  return !!SITE_KEY;
}

export class RecaptchaUnavailableError extends Error {
  constructor() {
    super("We couldn't load the verification service. Please refresh the page and try again.");
    this.name = 'RecaptchaUnavailableError';
  }
}

/**
 * Returns a fresh reCAPTCHA v3 token for the given action.
 *
 * - Returns null when reCAPTCHA is not configured (dev/preview without site key)
 *   so callers can submit unprotected requests.
 * - Throws RecaptchaUnavailableError when the site key IS configured but the
 *   script failed to load or execute. Callers should surface this to the user
 *   instead of submitting a token-less request that the server will reject.
 */
export async function getRecaptchaToken(action: string): Promise<string | null> {
  if (!SITE_KEY || typeof window === 'undefined') return null;
  // Wait up to ~5s for the script to attach window.grecaptcha.
  for (let i = 0; i < 50 && !window.grecaptcha; i++) {
    await new Promise(r => setTimeout(r, 100));
  }
  if (!window.grecaptcha) {
    console.warn('[recaptcha] script did not load');
    throw new RecaptchaUnavailableError();
  }
  try {
    return await new Promise<string>((resolve, reject) => {
      window.grecaptcha!.ready(() => {
        window.grecaptcha!.execute(SITE_KEY, { action }).then(resolve, reject);
      });
    });
  } catch (e) {
    console.warn('[recaptcha] execute failed', e);
    throw new RecaptchaUnavailableError();
  }
}
