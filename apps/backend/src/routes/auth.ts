import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { authService } from '../services/authService';
import { authenticate } from '../middleware/auth';
import { signupLimiter, loginLimiter, passwordResetLimiter, adminLoginLimiter } from '../middleware/rateLimit';
import { emailService } from '../services/email';
import { env } from '../config/env';
import { whatsappTemplates } from '../services/whatsappTemplates';
import { gupshupService } from '../services/gupshupService';
import { prisma } from '@cleya/db';
import { securityLogger, checkRepeatedAuthFailures } from '../services/securityLogger';

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

function getOAuthRedirectBase(_req: Request): string {
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
    .regex(/[A-Za-z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
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

authRouter.post('/signup', signupLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = signupSchema.parse(req.body);
    const result = await authService.signup(data);
    const smtpConfigured = !!(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
    if (smtpConfigured) {
      emailService.sendWelcome(data.email).catch(() => {});
      const verifyToken = crypto.randomBytes(32).toString('hex');
      verifyTokens.set(verifyToken, { userId: result.user.id, createdAt: Date.now() });
      emailService.sendEmailVerification(data.email, verifyToken).catch(() => {});
    } else {
      await authService.verifyEmail(result.user.id);
      result.user.emailVerified = true;
    }
    setAuthCookie(res, result.token);
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

authRouter.post('/login', loginLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = loginSchema.parse(req.body);
    const result = await authService.login(data);
    setAuthCookie(res, result.token);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('cleo_auth', { httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
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
      res.redirect(`${env.FRONTEND_URL}/?error=linkedin_auth_denied`);
      return;
    }
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const stateData = oauthStates.get(state);
    if (!code || !state || !stateData || !env.LINKEDIN_CLIENT_ID || !env.LINKEDIN_CLIENT_SECRET) {
      res.redirect(`${env.FRONTEND_URL}/?error=linkedin_auth_failed`);
      return;
    }
    const baseUrl = stateData.baseUrl;
    const oauthBase = stateData.oauthBase || baseUrl;
    oauthStates.delete(state);
    const redirectUri = `${oauthBase}/api/auth/linkedin/callback`;
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
      console.error('LinkedIn token exchange HTTP error:', tokenRes.status);
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

const verifyTokens = new Map<string, { userId: string; createdAt: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of verifyTokens) {
    if (now - val.createdAt > 24 * 60 * 60 * 1000) verifyTokens.delete(key);
  }
}, 5 * 60 * 1000);

authRouter.post('/forgot-password', passwordResetLimiter, async (req: Request, res: Response, next: NextFunction) => {
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

authRouter.post('/reset-password', passwordResetLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, password } = z.object({
      token: z.string(),
      password: z.string().min(8),
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
    const token = crypto.randomBytes(32).toString('hex');
    verifyTokens.set(token, { userId: req.user!.userId, createdAt: Date.now() });
    emailService.sendEmailVerification(user.email, token).catch(() => {});
    res.json({ success: true, message: 'Verification email sent.' });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/verify-email', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = z.object({ token: z.string() }).parse(req.body);
    const entry = verifyTokens.get(token);
    if (!entry || Date.now() - entry.createdAt > 24 * 60 * 60 * 1000) {
      res.status(400).json({ success: false, error: { message: 'Invalid or expired verification token', code: 'INVALID_TOKEN' } });
      return;
    }
    await authService.verifyEmail(entry.userId);
    verifyTokens.delete(token);
    res.json({ success: true, message: 'Email verified successfully.' });
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
