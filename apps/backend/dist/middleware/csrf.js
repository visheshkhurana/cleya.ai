"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.csrfTokenProvider = csrfTokenProvider;
exports.csrfProtection = csrfProtection;
const crypto_1 = __importDefault(require("crypto"));
const env_1 = require("../config/env");
const CSRF_HEADER = 'x-csrf-token';
const CSRF_COOKIE = 'cleo_csrf';
const TOKEN_EXPIRY = 8 * 60 * 60 * 1000;
function generateToken() {
    return crypto_1.default.randomBytes(32).toString('hex');
}
function signToken(token) {
    const hmac = crypto_1.default.createHmac('sha256', env_1.env.JWT_SECRET);
    hmac.update(token);
    return `${token}.${hmac.digest('hex')}`;
}
function verifySignature(signedToken) {
    const parts = signedToken.split('.');
    if (parts.length !== 2)
        return null;
    const [token, sig] = parts;
    if (!/^[0-9a-f]{64}$/i.test(token) || !/^[0-9a-f]{64}$/i.test(sig)) {
        return null;
    }
    const hmac = crypto_1.default.createHmac('sha256', env_1.env.JWT_SECRET);
    hmac.update(token);
    const expected = hmac.digest('hex');
    try {
        if (!crypto_1.default.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) {
            return null;
        }
    }
    catch {
        return null;
    }
    return token;
}
function csrfTokenProvider(_req, res) {
    const token = generateToken();
    const signed = signToken(token);
    const isProduction = env_1.env.NODE_ENV === 'production';
    res.cookie(CSRF_COOKIE, signed, {
        httpOnly: false,
        secure: isProduction,
        sameSite: isProduction ? 'strict' : 'lax',
        maxAge: TOKEN_EXPIRY,
        path: '/',
    });
    res.json({ success: true, data: { csrfToken: signed } });
}
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
function csrfProtection(req, res, next) {
    if (SAFE_METHODS.has(req.method)) {
        return next();
    }
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return next();
    }
    const headerToken = req.headers[CSRF_HEADER];
    const cookieToken = req.cookies?.[CSRF_COOKIE];
    if (!headerToken || !cookieToken) {
        res.status(403).json({
            success: false,
            error: { message: 'CSRF token missing', code: 'CSRF_MISSING' },
        });
        return;
    }
    if (headerToken !== cookieToken) {
        res.status(403).json({
            success: false,
            error: { message: 'CSRF token mismatch', code: 'CSRF_MISMATCH' },
        });
        return;
    }
    const token = verifySignature(headerToken);
    if (!token) {
        res.status(403).json({
            success: false,
            error: { message: 'Invalid CSRF token', code: 'CSRF_INVALID' },
        });
        return;
    }
    next();
}
//# sourceMappingURL=csrf.js.map