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
exports.authService = exports.AuthService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = require("@cleya/db");
const env_1 = require("../config/env");
const errorHandler_1 = require("../middleware/errorHandler");
function isValidHttpsUrl(url) {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:';
    }
    catch {
        return false;
    }
}
class AuthService {
    async signup(data) {
        const existing = await db_1.prisma.user.findFirst({
            where: {
                OR: [
                    { email: data.email },
                    ...(data.phone ? [{ phone: data.phone }] : []),
                ],
            },
        });
        if (existing) {
            throw new errorHandler_1.AppError(409, 'Unable to create account. Please try a different email.', 'SIGNUP_FAILED');
        }
        const passwordHash = await bcryptjs_1.default.hash(data.password, 12);
        const user = await db_1.prisma.user.create({
            data: {
                email: data.email,
                phone: data.phone,
                name: data.name,
                passwordHash,
                utmSource: data.utmSource,
                utmMedium: data.utmMedium,
                utmCampaign: data.utmCampaign,
                profile: {
                    create: data.persona ? { persona: data.persona } : {},
                },
            },
            include: { profile: true },
        });
        const token = this.generateToken(user);
        if (user.phone) {
            Promise.resolve().then(() => __importStar(require('./gupshupService'))).then(({ gupshupService }) => {
                gupshupService.optInUser(user.phone).then((optInResult) => {
                    if (!optInResult?.success) {
                        console.warn(`[Auth] WhatsApp opt-in failed for ${user.id}, skipping welcome`);
                        return;
                    }
                    return db_1.prisma.user.update({
                        where: { id: user.id },
                        data: { whatsappOptedIn: true, whatsappPhone: user.phone },
                    }).then(() => {
                        return Promise.resolve().then(() => __importStar(require('./whatsappTemplates'))).then(({ whatsappTemplates }) => {
                            whatsappTemplates.triggerWelcome(user.id);
                        });
                    });
                }).catch((e) => console.error('[Auth] Welcome WhatsApp failed:', e));
            });
        }
        Promise.resolve().then(() => __importStar(require('./slackService'))).then(({ slackService }) => {
            slackService.notifyUserRegistered({ id: user.id, email: user.email, name: user.name || undefined }).catch((e) => console.log('[Auth] Slack notification failed:', e.message));
        });
        Promise.resolve().then(() => __importStar(require('./dripCampaignService'))).then(({ dripCampaignService }) => {
            dripCampaignService.enrollOnboarding(user.id).catch((e) => console.log('[Auth] Drip campaign enrollment failed:', e.message));
        });
        return {
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                phone: user.phone,
                role: user.role,
                emailVerified: user.emailVerified,
                profile: user.profile,
            },
            token,
        };
    }
    async login(data) {
        const user = await db_1.prisma.user.findUnique({
            where: { email: data.email },
            include: { profile: true },
        });
        if (!user) {
            throw new errorHandler_1.AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
        }
        const validPassword = await bcryptjs_1.default.compare(data.password, user.passwordHash);
        if (!validPassword) {
            throw new errorHandler_1.AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
        }
        if (!user.isActive) {
            throw new errorHandler_1.AppError(403, 'Account is disabled', 'ACCOUNT_DISABLED');
        }
        if (user.mfaEnabled && user.totpSecret) {
            const mfaToken = this.generateMfaToken(user);
            return {
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    phone: user.phone,
                    role: user.role,
                    emailVerified: user.emailVerified,
                    profile: user.profile,
                },
                token: mfaToken,
                mfaRequired: true,
            };
        }
        const token = this.generateToken(user);
        return {
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                phone: user.phone,
                role: user.role,
                emailVerified: user.emailVerified,
                profile: user.profile,
            },
            token,
            mfaRequired: false,
        };
    }
    async validateMfa(userId, totpCode) {
        const user = await db_1.prisma.user.findUnique({
            where: { id: userId },
            include: { profile: true },
        });
        if (!user || !user.mfaEnabled || !user.totpSecret) {
            throw new errorHandler_1.AppError(400, 'MFA not enabled for this account', 'MFA_NOT_ENABLED');
        }
        const otplib = await Promise.resolve().then(() => __importStar(require('otplib')));
        const result = otplib.verifySync({
            token: totpCode,
            secret: user.totpSecret,
            crypto: new otplib.NobleCryptoPlugin(),
            base32: new otplib.ScureBase32Plugin(),
        });
        if (!result.valid) {
            throw new errorHandler_1.AppError(401, 'Invalid MFA code', 'INVALID_MFA_CODE');
        }
        const token = this.generateToken(user);
        return {
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                phone: user.phone,
                role: user.role,
                emailVerified: user.emailVerified,
                profile: user.profile,
            },
            token,
        };
    }
    async setupMfa(userId) {
        const user = await db_1.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new errorHandler_1.AppError(404, 'User not found', 'USER_NOT_FOUND');
        }
        const otplib = await Promise.resolve().then(() => __importStar(require('otplib')));
        const secret = otplib.generateSecret();
        const otpauthUrl = otplib.generateURI({ issuer: 'Cleya.ai', label: user.email, secret });
        await db_1.prisma.user.update({
            where: { id: userId },
            data: { totpSecret: secret },
        });
        return { secret, otpauthUrl };
    }
    async verifyMfaSetup(userId, totpCode) {
        const user = await db_1.prisma.user.findUnique({ where: { id: userId } });
        if (!user || !user.totpSecret) {
            throw new errorHandler_1.AppError(400, 'MFA setup not initiated', 'MFA_NOT_SETUP');
        }
        const otplib = await Promise.resolve().then(() => __importStar(require('otplib')));
        const verifyResult = otplib.verifySync({
            token: totpCode,
            secret: user.totpSecret,
            crypto: new otplib.NobleCryptoPlugin(),
            base32: new otplib.ScureBase32Plugin(),
        });
        const isValid = verifyResult.valid;
        if (!isValid) {
            throw new errorHandler_1.AppError(400, 'Invalid TOTP code', 'INVALID_MFA_CODE');
        }
        await db_1.prisma.user.update({
            where: { id: userId },
            data: { mfaEnabled: true },
        });
        return { mfaEnabled: true };
    }
    async disableMfa(userId) {
        await db_1.prisma.user.update({
            where: { id: userId },
            data: { mfaEnabled: false, totpSecret: null },
        });
        return { mfaEnabled: false };
    }
    async getMe(userId) {
        const user = await db_1.prisma.user.findUnique({
            where: { id: userId },
            include: { profile: true },
        });
        if (!user) {
            throw new errorHandler_1.AppError(404, 'User not found', 'USER_NOT_FOUND');
        }
        return {
            id: user.id,
            email: user.email,
            name: user.name,
            phone: user.phone,
            role: user.role,
            emailVerified: user.emailVerified,
            mfaEnabled: user.mfaEnabled,
            profile: user.profile,
            createdAt: user.createdAt,
        };
    }
    async findOrCreateGoogleUser(googleProfile) {
        let user = await db_1.prisma.user.findUnique({
            where: { email: googleProfile.email },
            include: { profile: true },
        });
        if (user) {
            if (!user.isActive) {
                throw new errorHandler_1.AppError(403, 'Account is disabled', 'ACCOUNT_DISABLED');
            }
            if (!user.emailVerified) {
                user = await db_1.prisma.user.update({
                    where: { id: user.id },
                    data: { emailVerified: true },
                    include: { profile: true },
                });
            }
            const token = this.generateToken(user);
            return {
                user: {
                    id: user.id,
                    email: user.email,
                    phone: user.phone,
                    role: user.role,
                    emailVerified: user.emailVerified,
                    profile: user.profile,
                },
                token,
                isNew: false,
            };
        }
        user = await db_1.prisma.user.create({
            data: {
                email: googleProfile.email,
                passwordHash: '',
                emailVerified: true,
                profile: {
                    create: {
                        ...(googleProfile.name ? { currentRole: googleProfile.name } : {}),
                    },
                },
            },
            include: { profile: true },
        });
        Promise.resolve().then(() => __importStar(require('./dripCampaignService'))).then(({ dripCampaignService }) => {
            dripCampaignService.enrollOnboarding(user.id).catch((e) => console.log('[Auth] Drip campaign enrollment failed (Google):', e.message));
        });
        const token = this.generateToken(user);
        return {
            user: {
                id: user.id,
                email: user.email,
                phone: user.phone,
                role: user.role,
                emailVerified: user.emailVerified,
                profile: user.profile,
            },
            token,
            isNew: true,
        };
    }
    async findOrCreateLinkedInUser(linkedinProfile) {
        const safeLinkedinUrl = linkedinProfile.linkedinUrl && isValidHttpsUrl(linkedinProfile.linkedinUrl) ? linkedinProfile.linkedinUrl : undefined;
        const safeAvatarUrl = linkedinProfile.avatarUrl && isValidHttpsUrl(linkedinProfile.avatarUrl) ? linkedinProfile.avatarUrl : undefined;
        let user = await db_1.prisma.user.findUnique({
            where: { email: linkedinProfile.email },
            include: { profile: true },
        });
        if (user) {
            if (!user.isActive) {
                throw new errorHandler_1.AppError(403, 'Account is disabled', 'ACCOUNT_DISABLED');
            }
            const userUpdates = {};
            if (!user.emailVerified)
                userUpdates.emailVerified = true;
            if (!user.name && linkedinProfile.name)
                userUpdates.name = linkedinProfile.name;
            if (Object.keys(userUpdates).length > 0) {
                user = await db_1.prisma.user.update({
                    where: { id: user.id },
                    data: userUpdates,
                    include: { profile: true },
                });
            }
            if (user.profile) {
                const profileUpdates = {};
                if (!user.profile.linkedinUrl && safeLinkedinUrl)
                    profileUpdates.linkedinUrl = safeLinkedinUrl;
                if (!user.profile.avatarUrl && safeAvatarUrl)
                    profileUpdates.avatarUrl = safeAvatarUrl;
                if (!user.profile.headline && linkedinProfile.headline)
                    profileUpdates.headline = linkedinProfile.headline;
                if (!user.profile.currentRole && linkedinProfile.headline)
                    profileUpdates.currentRole = linkedinProfile.headline;
                if (!user.profile.location && linkedinProfile.location)
                    profileUpdates.location = linkedinProfile.location;
                if (!user.profile.linkedinVerified)
                    profileUpdates.linkedinVerified = true;
                if (linkedinProfile.industryName && user.profile.industries.length === 0) {
                    profileUpdates.industries = [linkedinProfile.industryName];
                }
                if (Object.keys(profileUpdates).length > 0) {
                    await db_1.prisma.profile.update({
                        where: { userId: user.id },
                        data: profileUpdates,
                    });
                    user = await db_1.prisma.user.findUnique({
                        where: { id: user.id },
                        include: { profile: true },
                    });
                }
            }
            const token = this.generateToken(user);
            return {
                user: {
                    id: user.id,
                    email: user.email,
                    phone: user.phone,
                    role: user.role,
                    emailVerified: user.emailVerified,
                    profile: user.profile,
                },
                token,
                isNew: false,
            };
        }
        const profileData = {
            linkedinVerified: true,
        };
        if (safeLinkedinUrl)
            profileData.linkedinUrl = safeLinkedinUrl;
        if (safeAvatarUrl)
            profileData.avatarUrl = safeAvatarUrl;
        if (linkedinProfile.headline) {
            profileData.headline = linkedinProfile.headline;
            profileData.currentRole = linkedinProfile.headline;
        }
        if (linkedinProfile.location)
            profileData.location = linkedinProfile.location;
        if (linkedinProfile.industryName)
            profileData.industries = [linkedinProfile.industryName];
        user = await db_1.prisma.user.create({
            data: {
                email: linkedinProfile.email,
                name: linkedinProfile.name || undefined,
                passwordHash: '',
                emailVerified: true,
                profile: {
                    create: profileData,
                },
            },
            include: { profile: true },
        });
        Promise.resolve().then(() => __importStar(require('./dripCampaignService'))).then(({ dripCampaignService }) => {
            dripCampaignService.enrollOnboarding(user.id).catch((e) => console.log('[Auth] Drip campaign enrollment failed (LinkedIn):', e.message));
        });
        const token = this.generateToken(user);
        return {
            user: {
                id: user.id,
                email: user.email,
                phone: user.phone,
                role: user.role,
                emailVerified: user.emailVerified,
                profile: user.profile,
            },
            token,
            isNew: true,
        };
    }
    async findUserByEmail(email) {
        return db_1.prisma.user.findUnique({ where: { email } });
    }
    async resetPassword(email, newPassword) {
        const passwordHash = await bcryptjs_1.default.hash(newPassword, 12);
        await db_1.prisma.user.update({
            where: { email },
            data: { passwordHash },
        });
    }
    async verifyEmail(userId) {
        await db_1.prisma.user.update({
            where: { id: userId },
            data: { emailVerified: true },
        });
    }
    async reauth(userId, password) {
        const user = await db_1.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new errorHandler_1.AppError(404, 'User not found', 'USER_NOT_FOUND');
        }
        const valid = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!valid) {
            throw new errorHandler_1.AppError(401, 'Invalid password', 'INVALID_CREDENTIALS');
        }
        const elevatedToken = jsonwebtoken_1.default.sign({ userId: user.id, elevated: true }, env_1.env.JWT_SECRET, { expiresIn: '15m' });
        return { elevatedToken };
    }
    generateToken(user) {
        const payload = {
            userId: user.id,
            email: user.email,
            role: user.role,
            issuedAt: Math.floor(Date.now() / 1000),
        };
        const expiresIn = user.role.toUpperCase() === 'ADMIN' ? '30m' : env_1.env.JWT_EXPIRES_IN;
        return jsonwebtoken_1.default.sign(payload, env_1.env.JWT_SECRET, {
            expiresIn,
        });
    }
    generateMfaToken(user) {
        const payload = {
            userId: user.id,
            email: user.email,
            role: user.role,
            mfaPending: true,
        };
        return jsonwebtoken_1.default.sign(payload, env_1.env.JWT_SECRET, {
            expiresIn: '5m',
        });
    }
}
exports.AuthService = AuthService;
exports.authService = new AuthService();
//# sourceMappingURL=authService.js.map