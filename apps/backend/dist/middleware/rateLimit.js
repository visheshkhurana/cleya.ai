"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.passwordResetLimiter = exports.adminLoginLimiter = exports.matchProposalLimiter = exports.loginLimiter = exports.signupLimiter = exports.authLimiter = exports.generalLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
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
exports.signupLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { message: 'Too many signup attempts. Please try again later.', code: 'RATE_LIMITED' } },
});
exports.loginLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { message: 'Too many login attempts. Please wait a minute and try again.', code: 'RATE_LIMITED' } },
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