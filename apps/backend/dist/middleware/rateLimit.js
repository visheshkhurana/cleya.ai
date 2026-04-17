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
Object.defineProperty(exports, "__esModule", { value: true });
exports.passwordResetLimiter = exports.adminLoginLimiter = exports.matchProposalLimiter = exports.verificationResendLimiter = exports.loginLimiter = exports.signupLimiter = exports.authLimiter = exports.generalLimiter = void 0;
const express_rate_limit_1 = __importStar(require("express-rate-limit"));
const securityLogger_1 = require("../services/securityLogger");
const onRateLimitHit = (req, limiterName) => {
    securityLogger_1.securityLogger.suspiciousEvent(req, 'RATE_LIMIT_HIT', {
        limiter: limiterName,
        path: req.path,
        method: req.method,
    });
};
exports.generalLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { message: 'Too many requests. Please try again later.', code: 'RATE_LIMITED' } },
});
exports.authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { message: 'Too many authentication attempts. Please wait a minute and try again.', code: 'RATE_LIMITED' } },
});
const authKeyGenerator = (req) => {
    const ipKey = (0, express_rate_limit_1.ipKeyGenerator)(req.ip ?? '');
    const email = (req.body?.email || '').toString().trim().toLowerCase();
    return email ? `${ipKey}:${email}` : ipKey;
};
exports.signupLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: authKeyGenerator,
    message: { success: false, error: { message: 'Too many signup attempts. Please try again in 15 minutes.', code: 'RATE_LIMITED' } },
    handler: (req, res, _next, options) => {
        onRateLimitHit(req, 'signup');
        res.status(options.statusCode).json(options.message);
    },
});
exports.loginLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: authKeyGenerator,
    message: { success: false, error: { message: 'Too many login attempts. Please try again in 15 minutes.', code: 'RATE_LIMITED' } },
    handler: (req, res, _next, options) => {
        onRateLimitHit(req, 'login');
        res.status(options.statusCode).json(options.message);
    },
});
exports.verificationResendLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: authKeyGenerator,
    message: { success: false, error: { message: 'Too many verification email requests. Please try again later.', code: 'RATE_LIMITED' } },
});
exports.matchProposalLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 50,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { message: 'Too many match proposals. Please try again later.', code: 'RATE_LIMITED' } },
});
exports.adminLoginLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { message: 'Too many admin login attempts. Please try again later.', code: 'RATE_LIMITED' } },
    handler: (req, res, _next, options) => {
        onRateLimitHit(req, 'adminLogin');
        res.status(options.statusCode).json(options.message);
    },
});
exports.passwordResetLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 3,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { message: 'Too many password reset attempts. Please try again later.', code: 'RATE_LIMITED' } },
});
//# sourceMappingURL=rateLimit.js.map