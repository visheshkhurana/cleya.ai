"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
dotenv_1.default.config();
const envSchema = zod_1.z.object({
    DATABASE_URL: zod_1.z.string().url(),
    REDIS_URL: zod_1.z.string().default('redis://localhost:6379'),
    JWT_SECRET: zod_1.z.string().min(32),
    JWT_EXPIRES_IN: zod_1.z.string().default('7d'),
    OPENAI_API_KEY: zod_1.z.string().optional(),
    ANTHROPIC_API_KEY: zod_1.z.string().optional(),
    AI_PROVIDER: zod_1.z.enum(['openai', 'anthropic']).default('openai'),
    EMBEDDING_MODEL: zod_1.z.string().default('text-embedding-3-small'),
    GUPSHUP_API_KEY: zod_1.z.string().optional(),
    GUPSHUP_APP_NAME: zod_1.z.string().optional(),
    GUPSHUP_SOURCE_NUMBER: zod_1.z.string().optional(),
    GUPSHUP_TEMPLATE_NAMESPACE: zod_1.z.string().optional(),
    GUPSHUP_WEBHOOK_SECRET: zod_1.z.string().optional(),
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
    PORT: zod_1.z.coerce.number().default(3001),
    FRONTEND_URL: zod_1.z.string().default('http://localhost:3000'),
    BACKEND_URL: zod_1.z.string().default('http://localhost:3001'),
    WS_PORT: zod_1.z.coerce.number().default(3002),
    CORS_ORIGIN: zod_1.z.string().optional(),
    GOOGLE_CLIENT_ID: zod_1.z.string().optional(),
    GOOGLE_CLIENT_SECRET: zod_1.z.string().optional(),
    GOOGLE_REDIRECT_URI: zod_1.z.string().optional(),
    LINKEDIN_CLIENT_ID: zod_1.z.string().optional(),
    LINKEDIN_CLIENT_SECRET: zod_1.z.string().optional(),
    RESEND_API_KEY: zod_1.z.string().optional(),
    SMTP_HOST: zod_1.z.string().optional(),
    SMTP_PORT: zod_1.z.coerce.number().default(587),
    SMTP_USER: zod_1.z.string().optional(),
    SMTP_PASS: zod_1.z.string().optional(),
    FROM_EMAIL: zod_1.z.string().default('hello@cleya.ai'),
    ADMIN_EMAIL: zod_1.z.string().optional(),
    ADMIN_PASSWORD: zod_1.z.string().optional(),
    ZOOM_CLIENT_ID: zod_1.z.string().optional(),
    ZOOM_CLIENT_SECRET: zod_1.z.string().optional(),
    ZOOM_REDIRECT_URI: zod_1.z.string().optional(),
    SENTRY_DSN: zod_1.z.string().optional(),
    SENTRY_AUTH_TOKEN: zod_1.z.string().optional(),
    SENTRY_ORG: zod_1.z.string().optional(),
    SENTRY_PROJECT: zod_1.z.string().optional(),
    POSTHOG_KEY: zod_1.z.string().optional(),
    GA4_PROPERTY_ID: zod_1.z.string().optional(),
    GA4_SERVICE_ACCOUNT_KEY: zod_1.z.string().optional(),
    GA4_MEASUREMENT_ID: zod_1.z.string().optional(),
    GOOGLE_ANALYTICS_REFRESH_TOKEN: zod_1.z.string().optional(),
    GOOGLE_ADS_CLIENT_ID: zod_1.z.string().optional(),
    GOOGLE_ADS_CLIENT_SECRET: zod_1.z.string().optional(),
    INSTAGRAM_ACCESS_TOKEN: zod_1.z.string().optional(),
    INSTAGRAM_BUSINESS_ACCOUNT_ID: zod_1.z.string().optional(),
    POSTHOG_API_KEY: zod_1.z.string().optional(),
    POSTHOG_HOST: zod_1.z.string().optional(),
    POSTHOG_PROJECT_ID: zod_1.z.string().optional(),
    LINKEDIN_PAGE_ACCESS_TOKEN: zod_1.z.string().optional(),
    LINKEDIN_ORG_ID: zod_1.z.string().optional(),
    AYRSHARE_API_KEY: zod_1.z.string().optional(),
    META_ADS_ACCESS_TOKEN: zod_1.z.string().optional(),
    META_AD_ACCOUNT_ID: zod_1.z.string().optional(),
    LINKEDIN_AD_ACCOUNT_ID: zod_1.z.string().optional(),
    GOOGLE_ADS_DEVELOPER_TOKEN: zod_1.z.string().optional(),
    GOOGLE_ADS_CUSTOMER_ID: zod_1.z.string().optional(),
    RAZORPAY_KEY_ID: zod_1.z.string().optional(),
    RAZORPAY_KEY_SECRET: zod_1.z.string().optional(),
    RAZORPAY_PLAN_ID: zod_1.z.string().optional(),
    RAZORPAY_WEBHOOK_SECRET: zod_1.z.string().optional(),
});
function validateEnv() {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is required — set it as an environment variable (min 32 characters)');
    }
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
        console.error('❌ Invalid environment variables:');
        console.error(parsed.error.flatten().fieldErrors);
        process.exit(1);
    }
    return parsed.data;
}
exports.env = validateEnv();
//# sourceMappingURL=env.js.map