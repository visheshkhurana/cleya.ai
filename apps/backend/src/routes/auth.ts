import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { authService } from '../services/authService';
import { authenticate } from '../middleware/auth';
import { signupLimiter, loginLimiter, passwordResetLimiter } from '../middleware/rateLimit';
import { emailService } from '../services/email';
import { env } from '../config/env';

export const authRouter = Router();

const oauthStates = new Map<string, { createdAt: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of oauthStates) {
    if (now - val.createdAt > 10 * 60 * 1000) oauthStates.delete(key);
  }
}, 60 * 1000);

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

authRouter.post('/signup', signupLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = signupSchema.parse(req.body);
    const result = await authService.signup(data);
    emailService.sendWelcome(data.email).catch(() => {});
    const verifyToken = crypto.randomBytes(32).toString('hex');
    verifyTokens.set(verifyToken, { userId: result.user.id, createdAt: Date.now() });
    emailService.sendEmailVerification(data.email, verifyToken).catch(() => {});
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/login', loginLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = loginSchema.parse(req.body);
    const result = await authService.login(data);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
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
  const state = crypto.randomBytes(32).toString('hex');
  oauthStates.set(state, { createdAt: Date.now() });
  const redirectUri = `${env.BACKEND_URL}/api/auth/google/callback`;
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
    if (!code || !state || !oauthStates.has(state) || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      res.redirect(`${env.FRONTEND_URL}/?error=google_auth_failed`);
      return;
    }
    oauthStates.delete(state);
    const redirectUri = `${env.BACKEND_URL}/api/auth/google/callback`;
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
      res.redirect(`${env.FRONTEND_URL}/?error=google_token_failed`);
      return;
    }
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile: any = await profileRes.json();
    if (!profile.email || !profile.verified_email) {
      res.redirect(`${env.FRONTEND_URL}/?error=google_no_verified_email`);
      return;
    }
    const result = await authService.findOrCreateGoogleUser({
      email: profile.email,
      name: profile.name,
      googleId: profile.id,
    });
    if (result.isNew) {
      emailService.sendWelcome(profile.email).catch(() => {});
    }
    const profileComplete = result.user.profile?.isComplete;
    const dest = (result.user.role as string).toLowerCase() === 'admin' ? '/admin' : profileComplete ? '/dashboard' : '/chat';
    res.redirect(`${env.FRONTEND_URL}${dest}?token=${result.token}`);
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

const resetTokens = new Map<string, { email: string; createdAt: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of resetTokens) {
    if (now - val.createdAt > 30 * 60 * 1000) resetTokens.delete(key);
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
    if (!entry || Date.now() - entry.createdAt > 30 * 60 * 1000) {
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
