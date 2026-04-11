"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_HIERARCHY = void 0;
exports.authenticate = authenticate;
exports.requireRole = requireRole;
exports.requireAdmin = requireAdmin;
exports.requireReauth = requireReauth;
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
        throw new errorHandler_1.AppError(401, 'Missing or invalid authorization', 'UNAUTHORIZED');
    }
    try {
        const payload = jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET);
        if (payload.mfaPending) {
            throw new errorHandler_1.AppError(401, 'MFA verification required', 'MFA_REQUIRED');
        }
        const role = (payload.role || 'VIEWER').toUpperCase();
        if (role === 'ADMIN') {
            const iat = payload.issuedAt || payload.iat;
            if (iat) {
                const now = Math.floor(Date.now() / 1000);
                const ADMIN_TIMEOUT = 30 * 60;
                if (now - iat > ADMIN_TIMEOUT) {
                    throw new errorHandler_1.AppError(401, 'Admin session expired due to inactivity', 'SESSION_EXPIRED');
                }
            }
        }
        req.user = { ...payload, role };
        next();
    }
    catch (err) {
        if (err instanceof errorHandler_1.AppError)
            throw err;
        securityLogger_1.securityLogger.authEvent(req, 'TOKEN_INVALID', 'FAILURE', null, { reason: 'invalid_or_expired' });
        throw new errorHandler_1.AppError(401, 'Invalid or expired token', 'TOKEN_EXPIRED');
    }
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
//# sourceMappingURL=auth.js.map