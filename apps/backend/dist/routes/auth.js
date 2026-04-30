"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const zod_1 = require("zod");
const authService_1 = require("../services/authService");
const auth_1 = require("../middleware/auth");
const rateLimit_1 = require("../middleware/rateLimit");
const recaptcha_1 = require("../middleware/recaptcha");
const email_1 = require("../services/email");
const env_1 = require("../config/env");
const whatsappTemplates_1 = require("../services/whatsappTemplates");
const gupshupService_1 = require("../services/gupshupService");
const db_1 = require("@cleya/db");
const securityLogger_1 = require("../services/securityLogger");
const clerkService_1 = require("../services/clerkService");
exports.authRouter = (0, express_1.Router)();
const ALLOWED_HOSTS = [
    env_1.env.FRONTEND_URL ? new URL(env_1.env.FRONTEND_URL).host : '',
    process.env.REPLIT_DEV_DOMAIN || '',
    ...(process.env.REPLIT_DOMAINS || '').split(',').map(d => d.trim()),
    env_1.env.BACKEND_URL ? new URL(env_1.env.BACKEND_URL).host : '',
].filter(Boolean);
function getBaseUrl(req) {
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers['host'] || '';
    const hostOnly = host.split(':')[0];
    if (ALLOWED_HOSTS.includes(hostOnly)) {
        return `${proto}://${host}`;
    }
    return env_1.env.FRONTEND_URL;
}
function getOAuthRedirectBase(req) {
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers['host'] || '';
    const hostOnly = host.split(':')[0];
    if (ALLOWED_HOSTS.includes(hostOnly)) {
        return `${proto}://${host}`;
    }
    return env_1.env.FRONTEND_URL;
}
const oauthStates = new Map();
setInterval(() => {
    const now = Date.now();
    for (const [key, val] of oauthStates) {
        if (now - val.createdAt > 10 * 60 * 1000)
            oauthStates.delete(key);
    }
}, 60 * 1000);
function stripHtmlBasic(str) {
    return str.replace(/<[^>]*>/g, '').replace(/&#?[a-z0-9]+;/gi, ' ').trim();
}
const signupSchema = zod_1.z.object({
    email: zod_1.z.string().email().max(255),
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters')
        .max(128, 'Password must be less than 128 characters')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number')
        .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
    name: zod_1.z.string().min(2, 'Full name is required').max(100).transform(stripHtmlBasic).optional(),
    persona: zod_1.z.enum(['FOUNDER', 'INVESTOR', 'TALENT']).optional(),
    phone: zod_1.z.string().max(20).optional(),
    utmSource: zod_1.z.string().max(100).optional(),
    utmMedium: zod_1.z.string().max(100).optional(),
    utmCampaign: zod_1.z.string().max(100).optional(),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email().max(255),
    password: zod_1.z.string().max(128),
});
function setAuthCookie(res, token) {
    res.cookie('cleo_auth', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });
}
async function issueVerificationToken(userId, email) {
    const token = crypto_1.default.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await db_1.prisma.user.update({
        where: { id: userId },
        data: { verificationToken: token, verificationTokenExpiry: expiry },
    });
    email_1.emailService.sendEmailVerification(email, token).catch(() => { });
    return token;
}
exports.authRouter.post('/signup', rateLimit_1.signupLimiter, (0, recaptcha_1.verifyRecaptcha)('signup'), async (req, res, next) => {
    try {
        const data = signupSchema.parse(req.body);
        const result = await authService_1.authService.signup(data);
        email_1.emailService.sendNewSignupNotification({
            email: data.email,
            name: data.name || null,
            provider: 'email',
            userId: result.user.id,
        }).catch((e) => console.error('[Auth/Email] Signup notify failed:', e));
        const smtpConfigured = !!(env_1.env.SMTP_HOST && env_1.env.SMTP_USER && env_1.env.SMTP_PASS);
        if (smtpConfigured) {
            email_1.emailService.sendWelcome(data.email).catch(() => { });
            await issueVerificationToken(result.user.id, data.email);
        }
        else {
            await authService_1.authService.verifyEmail(result.user.id);
            result.user.emailVerified = true;
        }
        if (result.token) {
            setAuthCookie(res, result.token);
        }
        res.status(201).json({ success: true, data: result });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
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
exports.authRouter.post('/login', rateLimit_1.loginLimiter, (0, recaptcha_1.verifyRecaptcha)('login'), async (req, res, next) => {
    try {
        const data = loginSchema.parse(req.body);
        const result = await authService_1.authService.login(data);
        setAuthCookie(res, result.token);
        res.json({ success: true, data: result });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
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
        next(error);
    }
});
exports.authRouter.post('/logout', (_req, res) => {
    res.clearCookie('cleo_auth', { httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
    res.json({ success: true, message: 'Logged out' });
});
exports.authRouter.get('/me', auth_1.authenticate, async (req, res, next) => {
    try {
        const user = await authService_1.authService.getMe(req.user.userId);
        res.json({ success: true, data: user });
    }
    catch (error) {
        next(error);
    }
});
exports.authRouter.get('/google', (req, res) => {
    if (!env_1.env.GOOGLE_CLIENT_ID || !env_1.env.GOOGLE_CLIENT_SECRET) {
        res.status(501).json({ success: false, error: { message: 'Google OAuth not configured' } });
        return;
    }
    const oauthBase = getOAuthRedirectBase(req);
    const baseUrl = getBaseUrl(req);
    const state = crypto_1.default.randomBytes(32).toString('hex');
    oauthStates.set(state, { createdAt: Date.now(), baseUrl, oauthBase });
    const redirectUri = `${oauthBase}/api/auth/google/callback`;
    const params = new URLSearchParams({
        client_id: env_1.env.GOOGLE_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        access_type: 'offline',
        prompt: 'consent',
        state,
    });
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});
exports.authRouter.get('/google/callback', async (req, res) => {
    try {
        if (req.query.error) {
            res.redirect(`${env_1.env.FRONTEND_URL}/?error=google_auth_denied`);
            return;
        }
        const code = typeof req.query.code === 'string' ? req.query.code : '';
        const state = typeof req.query.state === 'string' ? req.query.state : '';
        const stateData = oauthStates.get(state);
        if (!code || !state || !stateData || !env_1.env.GOOGLE_CLIENT_ID || !env_1.env.GOOGLE_CLIENT_SECRET) {
            res.redirect(`${env_1.env.FRONTEND_URL}/?error=google_auth_failed`);
            return;
        }
        const baseUrl = stateData.baseUrl;
        const oauthBase = stateData.oauthBase || baseUrl;
        oauthStates.delete(state);
        const redirectUri = `${oauthBase}/api/auth/google/callback`;
        const tokenBody = new URLSearchParams({
            code,
            client_id: env_1.env.GOOGLE_CLIENT_ID,
            client_secret: env_1.env.GOOGLE_CLIENT_SECRET,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
        });
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: tokenBody.toString(),
        });
        const tokenData = await tokenRes.json();
        if (!tokenData.access_token) {
            res.redirect(`${baseUrl}/?error=google_token_failed`);
            return;
        }
        const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const profile = await profileRes.json();
        if (!profile.email || !profile.verified_email) {
            res.redirect(`${baseUrl}/?error=google_no_verified_email`);
            return;
        }
        const result = await authService_1.authService.findOrCreateGoogleUser({
            email: profile.email,
            name: profile.name,
            googleId: profile.id,
        });
        if (result.isNew) {
            email_1.emailService.sendWelcome(profile.email).catch(() => { });
            email_1.emailService.sendNewSignupNotification({
                email: profile.email,
                name: profile.name || null,
                provider: 'google',
                userId: result.user.id,
            }).catch((e) => console.error('[Auth/Google] Signup notify failed:', e));
            if (result.user.phone) {
                gupshupService_1.gupshupService.optInUser(result.user.phone).then((optInResult) => {
                    if (!optInResult?.success)
                        return;
                    return db_1.prisma.user.update({ where: { id: result.user.id }, data: { whatsappOptedIn: true, whatsappPhone: result.user.phone } });
                }).then(() => whatsappTemplates_1.whatsappTemplates.triggerWelcome(result.user.id)).catch((e) => console.error('[Auth/Google] WhatsApp welcome failed:', e));
            }
        }
        setAuthCookie(res, result.token);
        const profileComplete = result.user.profile?.isComplete;
        const roleLower = result.user.role.toLowerCase();
        const dest = (roleLower === 'admin' || roleLower === 'manager') ? '/controltower' : profileComplete ? '/dashboard' : '/chat';
        res.redirect(`${baseUrl}${dest}`);
    }
    catch (err) {
        console.error('Google OAuth error:', err);
        res.redirect(`${env_1.env.FRONTEND_URL}/?error=google_auth_error`);
    }
});
exports.authRouter.get('/google/status', (_req, res) => {
    res.json({
        success: true,
        data: { enabled: !!(env_1.env.GOOGLE_CLIENT_ID && env_1.env.GOOGLE_CLIENT_SECRET) },
    });
});
exports.authRouter.get('/linkedin', (req, res) => {
    if (!env_1.env.LINKEDIN_CLIENT_ID || !env_1.env.LINKEDIN_CLIENT_SECRET) {
        res.status(501).json({ success: false, error: { message: 'LinkedIn OAuth not configured' } });
        return;
    }
    const oauthBase = getOAuthRedirectBase(req);
    const baseUrl = getBaseUrl(req);
    const state = crypto_1.default.randomBytes(32).toString('hex');
    oauthStates.set(state, { createdAt: Date.now(), baseUrl, oauthBase });
    const redirectUri = `${oauthBase}/api/auth/linkedin/callback`;
    console.log('[LinkedIn OAuth] Initiating login, redirectUri:', redirectUri, 'oauthBase:', oauthBase);
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: env_1.env.LINKEDIN_CLIENT_ID,
        redirect_uri: redirectUri,
        state,
        scope: 'openid profile email',
    });
    res.redirect(`https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`);
});
exports.authRouter.get('/linkedin/callback', async (req, res) => {
    try {
        if (req.query.error) {
            console.error('[LinkedIn OAuth] Auth denied by user:', req.query.error, req.query.error_description);
            res.redirect(`${getBaseUrl(req)}/?error=linkedin_auth_denied`);
            return;
        }
        const code = typeof req.query.code === 'string' ? req.query.code : '';
        const state = typeof req.query.state === 'string' ? req.query.state : '';
        const stateData = oauthStates.get(state);
        if (!code || !state || !stateData || !env_1.env.LINKEDIN_CLIENT_ID || !env_1.env.LINKEDIN_CLIENT_SECRET) {
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
                client_id: env_1.env.LINKEDIN_CLIENT_ID,
                client_secret: env_1.env.LINKEDIN_CLIENT_SECRET,
                redirect_uri: redirectUri,
            }).toString(),
        });
        if (!tokenRes.ok) {
            const errorBody = await tokenRes.text().catch(() => 'no body');
            console.error('[LinkedIn OAuth] Token exchange failed:', tokenRes.status, errorBody);
            res.redirect(`${baseUrl}/?error=linkedin_token_failed`);
            return;
        }
        const tokenData = await tokenRes.json();
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
        const profile = await profileRes.json();
        if (!profile.email || !profile.sub) {
            res.redirect(`${baseUrl}/?error=linkedin_no_email`);
            return;
        }
        let linkedinHeadline;
        let linkedinLocation;
        let linkedinIndustry;
        let linkedinVanityName;
        try {
            const meRes = await fetch('https://api.linkedin.com/v2/me?projection=(id,localizedFirstName,localizedLastName,localizedHeadline,vanityName)', {
                headers: { Authorization: `Bearer ${tokenData.access_token}` },
            });
            if (meRes.ok) {
                const meData = await meRes.json();
                linkedinHeadline = meData.localizedHeadline || undefined;
                linkedinVanityName = meData.vanityName || undefined;
            }
        }
        catch (err) {
            console.log('LinkedIn /v2/me not available (expected for basic OAuth):', err.message);
        }
        const linkedinUrl = linkedinVanityName
            ? `https://www.linkedin.com/in/${linkedinVanityName}`
            : profile.profile || undefined;
        const localeCountry = profile.locale?.country;
        if (localeCountry) {
            const countryMap = {
                IN: 'India', US: 'United States', GB: 'United Kingdom', CA: 'Canada',
                AU: 'Australia', DE: 'Germany', FR: 'France', SG: 'Singapore',
                AE: 'UAE', NL: 'Netherlands', IL: 'Israel', JP: 'Japan',
                CN: 'China', KR: 'South Korea', BR: 'Brazil', SE: 'Sweden',
                HK: 'Hong Kong', CH: 'Switzerland', IE: 'Ireland', ES: 'Spain',
            };
            linkedinLocation = countryMap[localeCountry] || localeCountry;
        }
        const fullName = profile.name || `${profile.given_name || ''} ${profile.family_name || ''}`.trim();
        const result = await authService_1.authService.findOrCreateLinkedInUser({
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
            email_1.emailService.sendWelcome(profile.email).catch(() => { });
            email_1.emailService.sendNewSignupNotification({
                email: profile.email,
                name: profile.name || null,
                provider: 'linkedin',
                userId: result.user.id,
            }).catch((e) => console.error('[Auth/LinkedIn] Signup notify failed:', e));
            if (result.user.phone) {
                gupshupService_1.gupshupService.optInUser(result.user.phone).then((optInResult) => {
                    if (!optInResult?.success)
                        return;
                    return db_1.prisma.user.update({ where: { id: result.user.id }, data: { whatsappOptedIn: true, whatsappPhone: result.user.phone } });
                }).then(() => whatsappTemplates_1.whatsappTemplates.triggerWelcome(result.user.id)).catch((e) => console.error('[Auth/LinkedIn] WhatsApp welcome failed:', e));
            }
        }
        setAuthCookie(res, result.token);
        const profileComplete = result.user.profile?.isComplete;
        const roleLower = result.user.role.toLowerCase();
        const dest = (roleLower === 'admin' || roleLower === 'manager') ? '/controltower' : profileComplete ? '/dashboard' : '/chat';
        res.redirect(`${baseUrl}${dest}`);
    }
    catch (err) {
        console.error('LinkedIn OAuth error:', err);
        res.redirect(`${env_1.env.FRONTEND_URL}/?error=linkedin_auth_error`);
    }
});
exports.authRouter.get('/clerk/status', (_req, res) => {
    res.json({
        success: true,
        data: { enabled: clerkService_1.clerkService.isConfigured() },
    });
});
exports.authRouter.post('/clerk/exchange', rateLimit_1.loginLimiter, async (req, res, next) => {
    try {
        if (!clerkService_1.clerkService.isConfigured()) {
            res.status(503).json({
                success: false,
                error: { message: 'Clerk authentication is not configured', code: 'CLERK_NOT_CONFIGURED' },
            });
            return;
        }
        const { sessionToken, platform } = zod_1.z.object({
            sessionToken: zod_1.z.string().min(1),
            platform: zod_1.z.enum(['web', 'mobile']).optional(),
        }).parse(req.body);
        const result = await clerkService_1.clerkService.exchangeSessionToken(sessionToken);
        securityLogger_1.securityLogger.authEvent(req, result.isNew ? 'SIGNUP' : 'LOGIN_SUCCESS', 'SUCCESS', result.user.id, { provider: 'clerk', isNew: result.isNew });
        if (result.isNew) {
            email_1.emailService.sendNewSignupNotification({
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
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({
                success: false,
                error: { message: 'Invalid request', code: 'VALIDATION_ERROR', details: error.errors },
            });
            return;
        }
        next(error);
    }
});
exports.authRouter.get('/linkedin/status', (_req, res) => {
    res.json({
        success: true,
        data: { enabled: !!(env_1.env.LINKEDIN_CLIENT_ID && env_1.env.LINKEDIN_CLIENT_SECRET) },
    });
});
const resetTokens = new Map();
setInterval(() => {
    const now = Date.now();
    for (const [key, val] of resetTokens) {
        if (now - val.createdAt > 60 * 60 * 1000)
            resetTokens.delete(key);
    }
}, 60 * 1000);
exports.authRouter.post('/forgot-password', rateLimit_1.passwordResetLimiter, (0, recaptcha_1.verifyRecaptcha)('forgot_password'), async (req, res, next) => {
    try {
        const { email } = zod_1.z.object({ email: zod_1.z.string().email() }).parse(req.body);
        const user = await authService_1.authService.findUserByEmail(email);
        if (user) {
            const token = crypto_1.default.randomBytes(32).toString('hex');
            resetTokens.set(token, { email, createdAt: Date.now() });
            email_1.emailService.sendPasswordReset(email, token).catch(() => { });
        }
        res.json({ success: true, message: 'If an account exists with that email, a reset link has been sent.' });
    }
    catch (error) {
        next(error);
    }
});
exports.authRouter.post('/reset-password', rateLimit_1.passwordResetLimiter, (0, recaptcha_1.verifyRecaptcha)('reset_password'), async (req, res, next) => {
    try {
        const { token, password } = zod_1.z.object({
            token: zod_1.z.string(),
            password: zod_1.z.string().min(8, 'Password must be at least 8 characters')
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
        await authService_1.authService.resetPassword(entry.email, password);
        resetTokens.delete(token);
        res.json({ success: true, message: 'Password has been reset successfully.' });
    }
    catch (error) {
        next(error);
    }
});
exports.authRouter.post('/send-verification', auth_1.authenticate, async (req, res, next) => {
    try {
        const user = await authService_1.authService.getMe(req.user.userId);
        if (user.emailVerified) {
            res.json({ success: true, message: 'Your email is already verified.' });
            return;
        }
        await issueVerificationToken(req.user.userId, user.email);
        res.json({ success: true, message: 'Verification email sent.' });
    }
    catch (error) {
        next(error);
    }
});
exports.authRouter.post('/resend-verification', rateLimit_1.verificationResendLimiter, async (req, res, next) => {
    try {
        const { email } = zod_1.z.object({ email: zod_1.z.string().email() }).parse(req.body);
        const user = await db_1.prisma.user.findUnique({ where: { email }, select: { id: true, email: true, emailVerified: true } });
        // Always respond with the same generic message to avoid email enumeration.
        if (user && !user.emailVerified) {
            await issueVerificationToken(user.id, user.email);
        }
        res.json({ success: true, message: 'If an account with that email exists and is unverified, a new verification link has been sent.' });
    }
    catch (error) {
        next(error);
    }
});
exports.authRouter.post('/verify-email', async (req, res, next) => {
    try {
        const { token } = zod_1.z.object({ token: zod_1.z.string().min(16) }).parse(req.body);
        const user = await db_1.prisma.user.findUnique({
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
            await db_1.prisma.user.update({
                where: { id: user.id },
                data: { verificationToken: null, verificationTokenExpiry: null },
            });
            res.json({ success: true, data: { alreadyVerified: true, message: 'Your email is already verified.' } });
            return;
        }
        await db_1.prisma.user.update({
            where: { id: user.id },
            data: { emailVerified: true, isActive: true, verificationToken: null, verificationTokenExpiry: null },
        });
        res.json({ success: true, data: { alreadyVerified: false, message: 'Email verified successfully.' } });
    }
    catch (error) {
        next(error);
    }
});
exports.authRouter.post('/mfa/setup', auth_1.authenticate, async (req, res, next) => {
    try {
        const result = await authService_1.authService.setupMfa(req.user.userId);
        const qrcode = await Promise.resolve().then(() => __importStar(require('qrcode')));
        const qrDataUrl = await qrcode.toDataURL(result.otpauthUrl);
        securityLogger_1.securityLogger.authEvent(req, 'MFA_SETUP', 'SUCCESS', req.user.userId);
        res.json({ success: true, data: { secret: result.secret, otpauthUrl: result.otpauthUrl, qrCode: qrDataUrl } });
    }
    catch (error) {
        next(error);
    }
});
exports.authRouter.post('/mfa/verify', auth_1.authenticate, async (req, res, next) => {
    try {
        const { code } = zod_1.z.object({ code: zod_1.z.string().length(6) }).parse(req.body);
        const result = await authService_1.authService.verifyMfaSetup(req.user.userId, code);
        securityLogger_1.securityLogger.authEvent(req, 'MFA_ENABLED', 'SUCCESS', req.user.userId);
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
});
exports.authRouter.post('/mfa/validate', rateLimit_1.adminLoginLimiter, async (req, res, next) => {
    try {
        const { code } = zod_1.z.object({ code: zod_1.z.string().length(6) }).parse(req.body);
        let token;
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
        const jwt = await Promise.resolve().then(() => __importStar(require('jsonwebtoken')));
        const payload = jwt.default.verify(token, env_1.env.JWT_SECRET);
        if (!payload.mfaPending) {
            res.status(400).json({ success: false, error: { message: 'No MFA pending for this session', code: 'MFA_NOT_PENDING' } });
            return;
        }
        const result = await authService_1.authService.validateMfa(payload.userId, code);
        securityLogger_1.securityLogger.authEvent(req, 'MFA_VALIDATE', 'SUCCESS', payload.userId);
        setAuthCookie(res, result.token);
        res.json({ success: true, data: result });
    }
    catch (error) {
        securityLogger_1.securityLogger.authEvent(req, 'MFA_VALIDATE', 'FAILURE', null, { error: error?.message });
        next(error);
    }
});
exports.authRouter.get('/providers', auth_1.authenticate, async (req, res, next) => {
    try {
        const user = await db_1.prisma.user.findUnique({
            where: { id: req.user.userId },
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
    }
    catch (error) {
        next(error);
    }
});
exports.authRouter.post('/providers/disconnect', auth_1.authenticate, async (req, res, next) => {
    try {
        const { provider } = zod_1.z.object({
            provider: zod_1.z.enum(['password', 'google', 'linkedin', 'clerk']),
        }).parse(req.body);
        const user = await db_1.prisma.user.findUnique({
            where: { id: req.user.userId },
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
        const data = {};
        if (provider === 'password')
            data.passwordHash = '';
        if (provider === 'google')
            data.googleId = null;
        if (provider === 'linkedin')
            data.linkedinId = null;
        if (provider === 'clerk')
            data.clerkId = null;
        await db_1.prisma.user.update({ where: { id: req.user.userId }, data });
        securityLogger_1.securityLogger.authEvent(req, 'PROVIDER_DISCONNECT', 'SUCCESS', req.user.userId, { provider });
        res.json({ success: true, data: { provider, disconnected: true } });
    }
    catch (error) {
        next(error);
    }
});
exports.authRouter.post('/reauth', rateLimit_1.adminLoginLimiter, auth_1.authenticate, async (req, res, next) => {
    try {
        const { password } = zod_1.z.object({ password: zod_1.z.string() }).parse(req.body);
        const result = await authService_1.authService.reauth(req.user.userId, password);
        securityLogger_1.securityLogger.authEvent(req, 'REAUTH', 'SUCCESS', req.user.userId);
        res.json({ success: true, data: result });
    }
    catch (error) {
        securityLogger_1.securityLogger.authEvent(req, 'REAUTH', 'FAILURE', req.user?.userId ?? null, { error: error?.message });
        next(error);
    }
});
//# sourceMappingURL=auth.js.map