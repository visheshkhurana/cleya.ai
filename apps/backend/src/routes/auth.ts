import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { authService } from '../services/authService';
import { authenticate } from '../middleware/auth';
import { signupLimiter, loginLimiter, passwordResetLimiter, adminLoginLimiter, verificationResendLimiter } from '../middleware/rateLimit';
import { verifyRecaptcha } from '../middleware/recaptcha';
import { emailService } from '../services/email';
import { env } from '../config/env';
import { whatsappTemplates } from '../services/whatsappTemplates';
import { gupshupService } from '../services/gupshupService';
import { prisma } from '@cleya/db';
import { securityLogger, checkRepeatedAuthFailures } from '../services/securityLogger';
import { clerkService } from '../services/clerkService';

export const authRouter = Router();

const ALLOWED_HOSTS = [
  env.FRONTEND_URL ? new URL(env.FRONTEND_URL).host : '',
  process.env.REPLIT_DEV_DOMAIN || '',
  ...(process.env.REPLIT_DOMAINS || '').split(',').map(d => d.trim()),
  env.BACKEND_URL ? new URL(env.BACKEND_URL).host : '',
].filter(Boolean);

function getBaseUrl(req: Request): string {
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
  const host = (req.headers['x-forwarded-host'] as string) || req.headers['host'] || '';
  const hostOnly = host.split(':')[0];
  if (ALLOWED_HOSTS.includes(hostOnly)) {
    return `${proto}://${host}`;
  }
  return env.FRONTEND_URL;
}

function getOAuthRedirectBase(req: Request): string {
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
  const host = (req.headers['x-forwarded-host'] as string) || req.headers['host'] || '';
  const hostOnly = host.split(':')[0];
  if (ALLOWED_HOSTS.includes(hostOnly)) {
    return `${proto}://${host}`;
  }
  return env.FRONTEND_URL;
}

const oauthStates = new Map<string, { createdAt: number; baseUrl: string; oauthBase: string }>();
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of oauthStates) {
    if (now - val.createdAt > 10 * 60 * 1000) oauthStates.delete(key);
  }
}, 60 * 1000);

function stripHtmlBasic(str: string): string {
  return str.replace(/<[^>]*>/g, '').replace(/&#?[a-z0-9]+;/gi, ' ').trim();
}

const signupSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be less than 128 characters')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  name: z.string().min(2, 'Full name is required').max(100).transform(stripHtmlBasic).optional(),
  persona: z.enum(['FOUNDER', 'INVESTOR', 'TALENT']).optional(),
  phone: z.string().max(20).optional(),
  utmSource: z.string().max(100).optional(),
  utmMedium: z.string().max(100).optional(),
  utmCampaign: z.string().max(100).optional(),
});

const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().max(128),
});

function setAuthCookie(res: Response, token: string) {
  res.cookie('cleo_auth', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

async function issueVerificationToken(userId: string, email: string) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await prisma.user.update({
    where: { id: userId },
    data: { verificationToken: token, verificationTokenExpiry: expiry },
  });
  emailService.sendEmailVerification(email, token).catch(() => {});
  return token;
}

/**
 * Magic-link request: any visitor can ask for a sign-in link to their email.
 * Replies 200 in all cases (including unknown email) to avoid disclosing
 * which addresses have accounts. Rate-limited via the same passwordReset
 * limiter — 5 requests / 15 min per IP is plenty for a real human.
 */
const magicLinkRequestSchema = z.object({ email: z.string().email().max(255) });

authRouter.post('/magic-link', passwordResetLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = magicLinkRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(200).json({ ok: true });
    }
    const email = parsed.data.email.toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, isActive: true },
    });
    if (user && user.isActive) {
      const token = authService.generateMagicLinkToken(user.id);
      const baseUrl = getBaseUrl(req);
      const next = typeof req.body?.next === 'string' && req.body.next.startsWith('/') ? req.body.next : '/matches';
      const magicUrl = `${baseUrl}/api/auth/magic?token=${encodeURIComponent(token)}&next=${encodeURIComponent(next)}`;
      emailService.sendMagicLink(user.email, magicUrl, user.name).catch((err) =>
        console.error('[Auth] sendMagicLink failed:', err)
      );
      securityLogger.authEvent(req, 'PASSWORD_RESET_REQUEST', 'SUCCESS', user.id, { kind: 'magic_link' });
    }
    return res.status(200).json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

/**
 * Magic-link consumer: GET so it works directly from an email button.
 * Verifies the token, mints a real session JWT, sets the cookie, and
 * 302s to the requested `next` path (defaults to /matches).
 */
authRouter.get('/magic', async (req: Request, res: Response) => {
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  const nextParam = typeof req.query.next === 'string' && req.query.next.startsWith('/') ? req.query.next : '/matches';
  if (!token) {
    return res.redirect(302, `${env.FRONTEND_URL}/login?error=magic_link_invalid`);
  }
  try {
    const result = await authService.exchangeMagicLink(token);
    setAuthCookie(res, result.token);
    securityLogger.authEvent(req, 'LOGIN_SUCCESS', 'SUCCESS', result.user.id, { method: 'magic_link' });
    return res.redirect(302, `${env.FRONTEND_URL}${nextParam}`);
  } catch (err: any) {
    securityLogger.authEvent(req, 'LOGIN_FAILURE', 'FAILURE', null, { method: 'magic_link', error: err?.message });
    return res.redirect(302, `${env.FRONTEND_URL}/login?error=magic_link_expired`);
  }
});

authRouter.post('/signup', signupLimiter, verifyRecaptcha('signup'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = signupSchema.parse(req.body);
    const result = await authService.signup(data);
    emailService.sendNewSignupNotification({
      email: data.email,
      name: (data as any).name || null,
      provider: 'email',
      userId: result.user.id,
    }).catch((e) => console.error('[Auth/Email] Signup notify failed:', e));
    const smtpConfigured = !!(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
    if (smtpConfigured) {
      emailService.sendWelcome(data.email).catch(() => {});
      await issueVerificationToken(result.user.id, data.email);
    } else {
      await authService.verifyEmail(result.user.id);
      result.user.emailVerified = true;
    }
    if (result.token) {
      setAuthCookie(res, result.token);
    }
    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.errors.map(e => ({ field: e.path.join('.'), message: e.message })),
        },
      });
      return;
    }
    next(error);
  }
});

authRouter.post('/login', loginLimiter, verifyRecaptcha('login'), async (req: Request, res: Response, next: NextFunction) => {
  let parsedEmail: string | undefined;
  try {
    const data = loginSchema.parse(req.body);
    parsedEmail = data.email;
    const result = await authService.login(data);
    setAuthCookie(res, result.token);
    securityLogger.authEvent(req, 'LOGIN_SUCCESS', 'SUCCESS', result.user.id, { email: result.user.email });
    res.json({ success: true, data: result });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Please enter a valid email and password.',
          code: 'VALIDATION_ERROR',
          details: error.errors.map(e => ({ field: e.path.join('.'), message: e.message })),
        },
      });
      return;
    }
    securityLogger.authEvent(req, 'LOGIN_FAILURE', 'FAILURE', null, {
      email: parsedEmail,
      reason: error?.code || error?.message || 'unknown',
    });
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
    checkRepeatedAuthFailures(req, ip).catch(() => {});
    next(error);
  }
});

authRouter.post('/logout', (req: Request, res: Response) => {
  const userId = (req as any).user?.userId ?? null;
  res.clearCookie('cleo_auth', { httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
  securityLogger.authEvent(req, 'LOGOUT', 'SUCCESS', userId);
  res.json({ success: true, message: 'Logged out' });
});

authRouter.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await authService.getMe(req.user!.userId);
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
});

authRouter.get('/google', (req: Request, res: Response) => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    res.status(501).json({ success: false, error: { message: 'Google OAuth not configured' } });
    return;
  }
  const oauthBase = getOAuthRedirectBase(req);
  const baseUrl = getBaseUrl(req);
  const state = crypto.randomBytes(32).toString('hex');
  oauthStates.set(state, { createdAt: Date.now(), baseUrl, oauthBase });
  const redirectUri = `${oauthBase}/api/auth/google/callback`;
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

authRouter.get('/google/callback', async (req: Request, res: Response) => {
  try {
    if (req.query.error) {
      res.redirect(`${env.FRONTEND_URL}/?error=google_auth_denied`);
      return;
    }
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const stateData = oauthStates.get(state);
    if (!code || !state || !stateData || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      res.redirect(`${env.FRONTEND_URL}/?error=google_auth_failed`);
      return;
    }
    const baseUrl = stateData.baseUrl;
    const oauthBase = stateData.oauthBase || baseUrl;
    oauthStates.delete(state);
    const redirectUri = `${oauthBase}/api/auth/google/callback`;
    const tokenBody = new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody.toString(),
    });
    const tokenData: any = await tokenRes.json();
    if (!tokenData.access_token) {
      res.redirect(`${baseUrl}/?error=google_token_failed`);
      return;
    }
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile: any = await profileRes.json();
    if (!profile.email || !profile.verified_email) {
      res.redirect(`${baseUrl}/?error=google_no_verified_email`);
      return;
    }
    const result = await authService.findOrCreateGoogleUser({
      email: profile.email,
      name: profile.name,
      googleId: profile.id,
    });
    if (result.isNew) {
      emailService.sendWelcome(profile.email).catch(() => {});
      emailService.sendNewSignupNotification({
        email: profile.email,
        name: profile.name || null,
        provider: 'google',
        userId: result.user.id,
      }).catch((e) => console.error('[Auth/Google] Signup notify failed:', e));
      if (result.user.phone) {
        gupshupService.optInUser(result.user.phone).then((optInResult) => {
          if (!optInResult?.success) return;
          return prisma.user.update({ where: { id: result.user.id }, data: { whatsappOptedIn: true, whatsappPhone: result.user.phone } });
        }).then(() =>
          whatsappTemplates.triggerWelcome(result.user.id)
        ).catch((e) => console.error('[Auth/Google] WhatsApp welcome failed:', e));
      }
    }
    setAuthCookie(res, result.token);
    const profileComplete = result.user.profile?.isComplete;
    const roleLower = (result.user.role as string).toLowerCase();
    const dest = (roleLower === 'admin' || roleLower === 'manager') ? '/controltower' : profileComplete ? '/dashboard' : '/chat';
    res.redirect(`${baseUrl}${dest}`);
  } catch (err) {
    console.error('Google OAuth error:', err);
    res.redirect(`${env.FRONTEND_URL}/?error=google_auth_error`);
  }
});

authRouter.get('/google/status', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: { enabled: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) },
  });
});

authRouter.get('/linkedin', (req: Request, res: Response) => {
  if (!env.LINKEDIN_CLIENT_ID || !env.LINKEDIN_CLIENT_SECRET) {
    res.status(501).json({ success: false, error: { message: 'LinkedIn OAuth not configured' } });
    return;
  }
  const oauthBase = getOAuthRedirectBase(req);
  const baseUrl = getBaseUrl(req);
  const state = crypto.randomBytes(32).toString('hex');
  oauthStates.set(state, { createdAt: Date.now(), baseUrl, oauthBase });
  const redirectUri = `${oauthBase}/api/auth/linkedin/callback`;
  console.log('[LinkedIn OAuth] Initiating login, redirectUri:', redirectUri, 'oauthBase:', oauthBase);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: env.LINKEDIN_CLIENT_ID,
    redirect_uri: redirectUri,
    state,
    scope: 'openid profile email',
  });
  res.redirect(`https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`);
});

authRouter.get('/linkedin/callback', async (req: Request, res: Response) => {
  try {
    if (req.query.error) {
      console.error('[LinkedIn OAuth] Auth denied by user:', req.query.error, req.query.error_description);
      res.redirect(`${getBaseUrl(req)}/?error=linkedin_auth_denied`);
      return;
    }
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const stateData = oauthStates.get(state);
    if (!code || !state || !stateData || !env.LINKEDIN_CLIENT_ID || !env.LINKEDIN_CLIENT_SECRET) {
      console.error('[LinkedIn OAuth] Callback validation failed - code:', !!code, 'state:', !!state, 'stateData:', !!stateData);
      res.redirect(`${getBaseUrl(req)}/?error=linkedin_auth_failed`);
      return;
    }
    const baseUrl = stateData.baseUrl;
    const oauthBase = stateData.oauthBase || baseUrl;
    oauthStates.delete(state);
    const redirectUri = `${oauthBase}/api/auth/linkedin/callback`;
    console.log('[LinkedIn OAuth] Exchanging code, redirectUri:', redirectUri);
    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: env.LINKEDIN_CLIENT_ID,
        client_secret: env.LINKEDIN_CLIENT_SECRET,
        redirect_uri: redirectUri,
      }).toString(),
    });
    if (!tokenRes.ok) {
      const errorBody = await tokenRes.text().catch(() => 'no body');
      console.error('[LinkedIn OAuth] Token exchange failed:', tokenRes.status, errorBody);
      res.redirect(`${baseUrl}/?error=linkedin_token_failed`);
      return;
    }
    const tokenData: any = await tokenRes.json();
    if (!tokenData.access_token) {
      console.error('LinkedIn token exchange failed:', tokenData);
      res.redirect(`${baseUrl}/?error=linkedin_token_failed`);
      return;
    }

    const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!profileRes.ok) {
      console.error('LinkedIn userinfo HTTP error:', profileRes.status);
      res.redirect(`${baseUrl}/?error=linkedin_no_email`);
      return;
    }
    const profile: any = await profileRes.json();

    if (!profile.email || !profile.sub) {
      res.redirect(`${baseUrl}/?error=linkedin_no_email`);
      return;
    }

    let linkedinHeadline: string | undefined;
    let linkedinLocation: string | undefined;
    let linkedinIndustry: string | undefined;
    let linkedinVanityName: string | undefined;

    try {
      const meRes = await fetch('https://api.linkedin.com/v2/me?projection=(id,localizedFirstName,localizedLastName,localizedHeadline,vanityName)', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (meRes.ok) {
        const meData: any = await meRes.json();
        linkedinHeadline = meData.localizedHeadline || undefined;
        linkedinVanityName = meData.vanityName || undefined;
      }
    } catch (err: any) {
      console.log('LinkedIn /v2/me not available (expected for basic OAuth):', err.message);
    }

    const linkedinUrl = linkedinVanityName
      ? `https://www.linkedin.com/in/${linkedinVanityName}`
      : profile.profile || undefined;

    const localeCountry = profile.locale?.country;
    if (localeCountry) {
      const countryMap: Record<string, string> = {
        IN: 'India', US: 'United States', GB: 'United Kingdom', CA: 'Canada',
        AU: 'Australia', DE: 'Germany', FR: 'France', SG: 'Singapore',
        AE: 'UAE', NL: 'Netherlands', IL: 'Israel', JP: 'Japan',
        CN: 'China', KR: 'South Korea', BR: 'Brazil', SE: 'Sweden',
        HK: 'Hong Kong', CH: 'Switzerland', IE: 'Ireland', ES: 'Spain',
      };
      linkedinLocation = countryMap[localeCountry] || localeCountry;
    }

    const fullName = profile.name || `${profile.given_name || ''} ${profile.family_name || ''}`.trim();

    const result = await authService.findOrCreateLinkedInUser({
      email: profile.email,
      name: fullName || undefined,
      linkedinId: profile.sub,
      linkedinUrl,
      avatarUrl: profile.picture || undefined,
      headline: linkedinHeadline || undefined,
      location: linkedinLocation || undefined,
      firstName: profile.given_name || undefined,
      lastName: profile.family_name || undefined,
      industryName: linkedinIndustry || undefined,
    });

    if (result.isNew) {
      emailService.sendWelcome(profile.email).catch(() => {});
      emailService.sendNewSignupNotification({
        email: profile.email,
        name: profile.name || null,
        provider: 'linkedin',
        userId: result.user.id,
      }).catch((e) => console.error('[Auth/LinkedIn] Signup notify failed:', e));
      if (result.user.phone) {
        gupshupService.optInUser(result.user.phone).then((optInResult) => {
          if (!optInResult?.success) return;
          return prisma.user.update({ where: { id: result.user.id }, data: { whatsappOptedIn: true, whatsappPhone: result.user.phone } });
        }).then(() =>
          whatsappTemplates.triggerWelcome(result.user.id)
        ).catch((e) => console.error('[Auth/LinkedIn] WhatsApp welcome failed:', e));
      }
    }

    setAuthCookie(res, result.token);
    const profileComplete = result.user.profile?.isComplete;
    const roleLower = (result.user.role as string).toLowerCase();
    const dest = (roleLower === 'admin' || roleLower === 'manager') ? '/controltower' : profileComplete ? '/dashboard' : '/chat';
    res.redirect(`${baseUrl}${dest}`);
  } catch (err) {
    console.error('LinkedIn OAuth error:', err);
    res.redirect(`${env.FRONTEND_URL}/?error=linkedin_auth_error`);
  }
});

authRouter.get('/clerk/status', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: { enabled: clerkService.isConfigured() },
  });
});

authRouter.post('/clerk/exchange', loginLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!clerkService.isConfigured()) {
      res.status(503).json({
        success: false,
        error: { message: 'Clerk authentication is not configured', code: 'CLERK_NOT_CONFIGURED' },
      });
      return;
    }

    const { sessionToken, platform } = z.object({
      sessionToken: z.string().min(1),
      platform: z.enum(['web', 'mobile']).optional(),
    }).parse(req.body);

    const result = await clerkService.exchangeSessionToken(sessionToken);

    securityLogger.authEvent(
      req,
      result.isNew ? 'SIGNUP' : 'LOGIN_SUCCESS',
      'SUCCESS',
      result.user.id,
      { provider: 'clerk', isNew: result.isNew }
    );

    if (result.isNew) {
      emailService.sendNewSignupNotification({
        email: result.user.email,
        name: null,
        provider: 'clerk',
        userId: result.user.id,
      }).catch((e) => console.error('[Auth/Clerk] Signup notify failed:', e));
    }

    if (platform !== 'mobile') {
      setAuthCookie(res, result.token);
    }

    res.json({
      success: true,
      data: {
        user: result.user,
        token: result.token,
        isNew: result.isNew,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: { message: 'Invalid request', code: 'VALIDATION_ERROR', details: error.errors },
      });
      return;
    }
    next(error);
  }
});

authRouter.get('/linkedin/status', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: { enabled: !!(env.LINKEDIN_CLIENT_ID && env.LINKEDIN_CLIENT_SECRET) },
  });
});

const resetTokens = new Map<string, { email: string; createdAt: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of resetTokens) {
    if (now - val.createdAt > 60 * 60 * 1000) resetTokens.delete(key);
  }
}, 60 * 1000);

authRouter.post('/forgot-password', passwordResetLimiter, verifyRecaptcha('forgot_password'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const user = await authService.findUserByEmail(email);
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      resetTokens.set(token, { email, createdAt: Date.now() });
      emailService.sendPasswordReset(email, token).catch(() => {});
    }
    res.json({ success: true, message: 'If an account exists with that email, a reset link has been sent.' });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/reset-password', passwordResetLimiter, verifyRecaptcha('reset_password'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, password } = z.object({
      token: z.string(),
      password: z.string().min(8, 'Password must be at least 8 characters')
        .max(128, 'Password must be less than 128 characters')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number')
        .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
    }).parse(req.body);

    const entry = resetTokens.get(token);
    if (!entry || Date.now() - entry.createdAt > 60 * 60 * 1000) {
      res.status(400).json({ success: false, error: { message: 'Invalid or expired reset token', code: 'INVALID_TOKEN' } });
      return;
    }

    await authService.resetPassword(entry.email, password);
    resetTokens.delete(token);
    res.json({ success: true, message: 'Password has been reset successfully.' });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/send-verification', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await authService.getMe(req.user!.userId);
    if (user.emailVerified) {
      res.json({ success: true, message: 'Your email is already verified.' });
      return;
    }
    await issueVerificationToken(req.user!.userId, user.email);
    res.json({ success: true, message: 'Verification email sent.' });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/resend-verification', verificationResendLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, emailVerified: true } });
    // Always respond with the same generic message to avoid email enumeration.
    if (user && !user.emailVerified) {
      await issueVerificationToken(user.id, user.email);
    }
    res.json({ success: true, message: 'If an account with that email exists and is unverified, a new verification link has been sent.' });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/verify-email', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = z.object({ token: z.string().min(16) }).parse(req.body);
    const user = await prisma.user.findUnique({
      where: { verificationToken: token },
      select: { id: true, verificationTokenExpiry: true, emailVerified: true },
    });
    if (!user || !user.verificationTokenExpiry || user.verificationTokenExpiry.getTime() < Date.now()) {
      res.status(400).json({ success: false, error: { message: 'This verification link is invalid or has expired. Please request a new one.', code: 'INVALID_TOKEN' } });
      return;
    }
    if (user.emailVerified) {
      // Token still matched a record but the user has already been verified
      // (e.g. duplicate clicks). Clear the token and respond idempotently.
      await prisma.user.update({
        where: { id: user.id },
        data: { verificationToken: null, verificationTokenExpiry: null },
      });
      res.json({ success: true, data: { alreadyVerified: true, message: 'Your email is already verified.' } });
      return;
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, isActive: true, verificationToken: null, verificationTokenExpiry: null },
    });
    res.json({ success: true, data: { alreadyVerified: false, message: 'Email verified successfully.' } });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/mfa/setup', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.setupMfa(req.user!.userId);
    const qrcode = await import('qrcode');
    const qrDataUrl = await qrcode.toDataURL(result.otpauthUrl);
    securityLogger.authEvent(req, 'MFA_SETUP', 'SUCCESS', req.user!.userId);
    res.json({ success: true, data: { secret: result.secret, otpauthUrl: result.otpauthUrl, qrCode: qrDataUrl } });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/mfa/verify', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = z.object({ code: z.string().length(6) }).parse(req.body);
    const result = await authService.verifyMfaSetup(req.user!.userId, code);
    securityLogger.authEvent(req, 'MFA_ENABLED', 'SUCCESS', req.user!.userId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/mfa/validate', adminLoginLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = z.object({ code: z.string().length(6) }).parse(req.body);

    let token: string | undefined;
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      token = header.split(' ')[1];
    }
    if (!token && req.cookies?.cleo_auth) {
      token = req.cookies.cleo_auth;
    }
    if (!token) {
      res.status(401).json({ success: false, error: { message: 'Missing token', code: 'UNAUTHORIZED' } });
      return;
    }

    const jwt = await import('jsonwebtoken');
    const payload = jwt.default.verify(token, env.JWT_SECRET) as any;
    if (!payload.mfaPending) {
      res.status(400).json({ success: false, error: { message: 'No MFA pending for this session', code: 'MFA_NOT_PENDING' } });
      return;
    }

    const result = await authService.validateMfa(payload.userId, code);
    securityLogger.authEvent(req, 'MFA_VALIDATE', 'SUCCESS', payload.userId);
    setAuthCookie(res, result.token);
    res.json({ success: true, data: result });
  } catch (error) {
    securityLogger.authEvent(req, 'MFA_VALIDATE', 'FAILURE', null, { error: (error as Error)?.message });
    next(error);
  }
});

authRouter.get('/providers', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { email: true, passwordHash: true, googleId: true, linkedinId: true, clerkId: true },
    });
    if (!user) {
      res.status(404).json({ success: false, error: { message: 'User not found', code: 'USER_NOT_FOUND' } });
      return;
    }
    const providers = [
      { id: 'password', label: 'Email & password', linked: !!user.passwordHash, identifier: user.passwordHash ? user.email : null },
      { id: 'google', label: 'Google', linked: !!user.googleId, identifier: user.googleId ? user.email : null },
      { id: 'linkedin', label: 'LinkedIn', linked: !!user.linkedinId, identifier: user.linkedinId ? user.email : null },
      { id: 'clerk', label: 'Clerk', linked: !!user.clerkId, identifier: user.clerkId ? user.email : null },
    ];
    res.json({ success: true, data: { providers } });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/providers/disconnect', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { provider } = z.object({
      provider: z.enum(['password', 'google', 'linkedin', 'clerk']),
    }).parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { passwordHash: true, googleId: true, linkedinId: true, clerkId: true },
    });
    if (!user) {
      res.status(404).json({ success: false, error: { message: 'User not found', code: 'USER_NOT_FOUND' } });
      return;
    }

    const linked = {
      password: !!user.passwordHash,
      google: !!user.googleId,
      linkedin: !!user.linkedinId,
      clerk: !!user.clerkId,
    };

    if (!linked[provider]) {
      res.status(400).json({ success: false, error: { message: 'Provider is not connected', code: 'PROVIDER_NOT_LINKED' } });
      return;
    }

    const linkedCount = Object.values(linked).filter(Boolean).length;
    if (linkedCount <= 1) {
      res.status(400).json({
        success: false,
        error: {
          message: 'You cannot disconnect your only sign-in method. Add another way to sign in first.',
          code: 'LAST_PROVIDER',
        },
      });
      return;
    }

    const data: { passwordHash?: string; googleId?: null; linkedinId?: null; clerkId?: null } = {};
    if (provider === 'password') data.passwordHash = '';
    if (provider === 'google') data.googleId = null;
    if (provider === 'linkedin') data.linkedinId = null;
    if (provider === 'clerk') data.clerkId = null;

    await prisma.user.update({ where: { id: req.user!.userId }, data });
    securityLogger.authEvent(req, 'PROVIDER_DISCONNECT', 'SUCCESS', req.user!.userId, { provider });
    res.json({ success: true, data: { provider, disconnected: true } });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/reauth', adminLoginLimiter, authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { password } = z.object({ password: z.string() }).parse(req.body);
    const result = await authService.reauth(req.user!.userId, password);
    securityLogger.authEvent(req, 'REAUTH', 'SUCCESS', req.user!.userId);
    res.json({ success: true, data: result });
  } catch (error) {
    securityLogger.authEvent(req, 'REAUTH', 'FAILURE', req.user?.userId ?? null, { error: (error as Error)?.message });
    next(error);
  }
});
