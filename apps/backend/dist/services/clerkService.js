"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clerkService = void 0;
const backend_1 = require("@clerk/backend");
const env_1 = require("../config/env");
const authService_1 = require("./authService");
const errorHandler_1 = require("../middleware/errorHandler");
let clerkClientInstance = null;
function getClerkClient() {
    if (!env_1.env.CLERK_SECRET_KEY)
        return null;
    if (!clerkClientInstance) {
        clerkClientInstance = (0, backend_1.createClerkClient)({
            secretKey: env_1.env.CLERK_SECRET_KEY,
            publishableKey: env_1.env.CLERK_PUBLISHABLE_KEY,
        });
    }
    return clerkClientInstance;
}
exports.clerkService = {
    isConfigured() {
        return !!env_1.env.CLERK_SECRET_KEY;
    },
    /**
     * Verify a Clerk session token and return the resolved Clerk profile.
     * Caller should pass the result to authService.findOrCreateClerkUser.
     */
    async verifySessionToken(sessionToken) {
        if (!env_1.env.CLERK_SECRET_KEY) {
            throw new errorHandler_1.AppError(503, 'Clerk authentication is not configured', 'CLERK_NOT_CONFIGURED');
        }
        let clerkUserId;
        try {
            const payload = await (0, backend_1.verifyToken)(sessionToken, {
                secretKey: env_1.env.CLERK_SECRET_KEY,
            });
            clerkUserId = payload.sub;
        }
        catch {
            throw new errorHandler_1.AppError(401, 'Invalid Clerk session token', 'INVALID_CLERK_TOKEN');
        }
        if (!clerkUserId) {
            throw new errorHandler_1.AppError(401, 'Clerk token missing user id', 'INVALID_CLERK_TOKEN');
        }
        const client = getClerkClient();
        if (!client) {
            throw new errorHandler_1.AppError(503, 'Clerk authentication is not configured', 'CLERK_NOT_CONFIGURED');
        }
        const user = await client.users.getUser(clerkUserId);
        const primaryEmailId = user.primaryEmailAddressId;
        const primary = user.emailAddresses.find((e) => e.id === primaryEmailId) || user.emailAddresses[0];
        if (!primary?.emailAddress) {
            throw new errorHandler_1.AppError(400, 'Clerk account has no email address', 'CLERK_NO_EMAIL');
        }
        if (primary.verification?.status !== 'verified') {
            throw new errorHandler_1.AppError(400, 'Clerk email is not verified', 'CLERK_EMAIL_UNVERIFIED');
        }
        const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || undefined;
        return {
            email: primary.emailAddress,
            name: fullName,
            clerkUserId,
        };
    },
    /**
     * Convenience: verify the Clerk token and provision the Cleya user via authService.
     */
    async exchangeSessionToken(sessionToken) {
        const profile = await this.verifySessionToken(sessionToken);
        return authService_1.authService.findOrCreateClerkUser(profile);
    },
};
//# sourceMappingURL=clerkService.js.map