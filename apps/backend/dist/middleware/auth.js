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
exports.ROLE_HIERARCHY = void 0;
exports.authenticate = authenticate;
exports.requireRole = requireRole;
exports.requireAdmin = requireAdmin;
exports.requireReauth = requireReauth;
exports.requireEmailVerified = requireEmailVerified;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const errorHandler_1 = require("./errorHandler");
const securityLogger_1 = require("../services/securityLogger");
const ROLE_HIERARCHY = {
    VIEWER: 0,
    USER: 1,
    MANAGER: 2,
    ADMIN: 3,
};
exports.ROLE_HIERARCHY = ROLE_HIERARCHY;
// Express 4 doesn't auto-forward rejected promises from async middleware,
// so this is a sync wrapper that calls next(err) explicitly.
function authenticate(req, _res, next) {
    let token;
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
        token = header.split(' ')[1];
    }
    if (!token && req.cookies?.cleo_auth) {
        token = req.cookies.cleo_auth;
    }
    if (!token) {
        return next(new errorHandler_1.AppError(401, 'Missing or invalid authorization', 'UNAUTHORIZED'));
    }
    let payload;
    try {
        payload = jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET);
    }
    catch {
        securityLogger_1.securityLogger.authEvent(req, 'TOKEN_INVALID', 'FAILURE', null, { reason: 'invalid_or_expired' });
        return next(new errorHandler_1.AppError(401, 'Invalid or expired token', 'TOKEN_EXPIRED'));
    }
    if (payload.mfaPending) {
        return next(new errorHandler_1.AppError(401, 'MFA verification required', 'MFA_REQUIRED'));
    }
    const role = (payload.role || 'VIEWER').toUpperCase();
    if (role === 'ADMIN') {
        const iat = payload.issuedAt || payload.iat;
        if (iat) {
            const now = Math.floor(Date.now() / 1000);
            const ADMIN_TIMEOUT = 12 * 60 * 60;
            if (now - iat > ADMIN_TIMEOUT) {
                return next(new errorHandler_1.AppError(401, 'Admin session expired due to inactivity', 'SESSION_EXPIRED'));
            }
        }
    }
    // Self-service auth routes an unverified user must still be able to call.
    const AUTH_FLOW_ALLOWLIST = new Set([
        '/me',
        '/logout',
        '/verify-email',
        '/resend-verification',
        '/refresh',
    ]);
    if (AUTH_FLOW_ALLOWLIST.has(req.path)) {
        req.user = { ...payload, role };
        return next();
    }
    (async () => {
        try {
            const { prisma } = await Promise.resolve().then(() => __importStar(require('@cleya/db')));
            const u = await prisma.user.findUnique({
                where: { id: payload.userId },
                select: { isActive: true, emailVerified: true },
            });
            if (!u) {
                return next(new errorHandler_1.AppError(401, 'Account not found', 'UNAUTHORIZED'));
            }
            if (!u.isActive && !u.emailVerified) {
                return next(new errorHandler_1.AppError(403, 'Please verify your email to activate your account.', 'EMAIL_NOT_VERIFIED'));
            }
            if (!u.isActive) {
                return next(new errorHandler_1.AppError(403, 'Account is disabled', 'ACCOUNT_DISABLED'));
            }
            req.user = { ...payload, role };
            next();
        }
        catch (err) {
            console.error('[authenticate] account-state lookup failed:', err);
            next(new errorHandler_1.AppError(503, 'Authentication service unavailable', 'AUTH_UNAVAILABLE'));
        }
    })();
}
function requireRole(minimumRole) {
    return (req, _res, next) => {
        const userRole = (req.user?.role || 'VIEWER').toUpperCase();
        const requiredLevel = ROLE_HIERARCHY[minimumRole];
        const userLevel = ROLE_HIERARCHY[userRole] ?? -1;
        if (userLevel < requiredLevel) {
            securityLogger_1.securityLogger.authEvent(req, 'ROLE_CHECK_FAILURE', 'FAILURE', req.user?.userId ?? null, {
                requiredRole: minimumRole,
                actualRole: userRole,
            });
            throw new errorHandler_1.AppError(403, `${minimumRole} access required`, 'FORBIDDEN');
        }
        next();
    };
}
function requireAdmin(req, _res, next) {
    if ((req.user?.role || '').toUpperCase() !== 'ADMIN') {
        securityLogger_1.securityLogger.authEvent(req, 'ROLE_CHECK_FAILURE', 'FAILURE', req.user?.userId ?? null, { requiredRole: 'ADMIN', actualRole: req.user?.role });
        throw new errorHandler_1.AppError(403, 'Admin access required', 'FORBIDDEN');
    }
    next();
}
function requireReauth(req, _res, next) {
    let elevatedToken;
    const header = req.headers['x-elevated-token'];
    if (header) {
        elevatedToken = header;
    }
    if (!elevatedToken) {
        throw new errorHandler_1.AppError(403, 'Re-authentication required for this operation', 'REAUTH_REQUIRED');
    }
    try {
        const payload = jsonwebtoken_1.default.verify(elevatedToken, env_1.env.JWT_SECRET);
        if (!payload.elevated || payload.userId !== req.user?.userId) {
            throw new errorHandler_1.AppError(403, 'Invalid elevated session', 'REAUTH_REQUIRED');
        }
        req.isElevated = true;
        next();
    }
    catch (err) {
        if (err instanceof errorHandler_1.AppError)
            throw err;
        throw new errorHandler_1.AppError(403, 'Elevated session expired, please re-authenticate', 'REAUTH_REQUIRED');
    }
}
/**
 * Requires the authenticated user's email to be verified before running the
 * downstream handler. Use on actions that send outbound communication or
 * create user-visible records (match requests, direct messages, etc.).
 *
 * Must be mounted after `authenticate`. Looks the user up fresh so a recent
 * verification is reflected without forcing a token refresh.
 */
function requireEmailVerified(req, _res, next) {
    if (!req.user?.userId) {
        return next(new errorHandler_1.AppError(401, 'Authentication required', 'UNAUTHORIZED'));
    }
    (async () => {
        try {
            const { prisma } = await Promise.resolve().then(() => __importStar(require('@cleya/db')));
            const u = await prisma.user.findUnique({
                where: { id: req.user.userId },
                select: { emailVerified: true },
            });
            if (!u?.emailVerified) {
                return next(new errorHandler_1.AppError(403, 'Please verify your email before performing this action.', 'EMAIL_NOT_VERIFIED'));
            }
            next();
        }
        catch (err) {
            console.error('[requireEmailVerified] lookup failed:', err);
            next(new errorHandler_1.AppError(503, 'Verification service unavailable', 'AUTH_UNAVAILABLE'));
        }
    })();
}
//# sourceMappingURL=auth.js.map