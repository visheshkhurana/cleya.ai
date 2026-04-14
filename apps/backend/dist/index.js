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
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const compression_1 = __importDefault(require("compression"));
const Sentry = __importStar(require("@sentry/node"));
const env_1 = require("./config/env");
const errorHandler_1 = require("./middleware/errorHandler");
const server_1 = require("./websocket/server");
const auth_1 = require("./routes/auth");
const user_1 = require("./routes/user");
const conversation_1 = require("./routes/conversation");
const match_1 = require("./routes/match");
const call_1 = require("./routes/call");
const notification_1 = require("./routes/notification");
const search_1 = require("./routes/search");
const admin_1 = require("./routes/admin");
const analytics_1 = require("./routes/analytics");
const event_1 = require("./routes/event");
const introduction_1 = require("./routes/introduction");
const meeting_1 = require("./routes/meeting");
const messaging_1 = require("./routes/messaging");
const referral_1 = require("./routes/referral");
const affiliateReferral_1 = require("./routes/affiliateReferral");
const verification_1 = require("./routes/verification");
const directMessage_1 = require("./routes/directMessage");
const invite_1 = require("./routes/invite");
const activity_1 = require("./routes/activity");
const secretary_1 = require("./routes/secretary");
const zoom_1 = require("./routes/zoom");
const deal_1 = require("./routes/deal");
const aiChat_1 = require("./routes/aiChat");
const twilio_1 = require("./routes/twilio");
const whatsapp_1 = require("./routes/whatsapp");
const gupshup_1 = require("./routes/gupshup");
const calendar_1 = require("./routes/calendar");
const agent_chat_1 = require("./routes/agent-chat");
const health_1 = require("./routes/health");
const subscription_1 = require("./routes/subscription");
const matchScheduler_1 = require("./services/matchScheduler");
const agentScheduler_1 = require("./services/agentScheduler");
if (env_1.env.SENTRY_DSN) {
    Sentry.init({
        dsn: env_1.env.SENTRY_DSN,
        environment: env_1.env.NODE_ENV,
        tracesSampleRate: env_1.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    });
}
const app = (0, express_1.default)();
app.set('trust proxy', 1);
const ALLOWED_HOSTS = [
    env_1.env.FRONTEND_URL,
    env_1.env.CORS_ORIGIN,
    'https://cleya.ai',
    'https://www.cleya.ai',
    'https://boardy-ai-platform.replit.app',
].filter(Boolean);
const REPLIT_DEV_DOMAIN = process.env.REPLIT_DEV_DOMAIN;
const REPLIT_DOMAINS = process.env.REPLIT_DOMAINS;
const BACKEND_URL = process.env.BACKEND_URL;
if (REPLIT_DEV_DOMAIN)
    ALLOWED_HOSTS.push(`https://${REPLIT_DEV_DOMAIN}`);
if (BACKEND_URL)
    ALLOWED_HOSTS.push(BACKEND_URL);
if (REPLIT_DOMAINS) {
    REPLIT_DOMAINS.split(',').forEach(d => {
        const trimmed = d.trim();
        if (trimmed)
            ALLOWED_HOSTS.push(`https://${trimmed}`);
    });
}
const allowedOrigins = new Set(ALLOWED_HOSTS);
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.has(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
}));
app.use((0, helmet_1.default)({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
}));
app.use((0, compression_1.default)());
app.use((0, morgan_1.default)(env_1.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express_1.default.json({
    limit: '10mb',
    verify: (req, _res, buf) => {
        // Preserve raw body for Razorpay webhook signature verification
        if (req.originalUrl === '/api/subscription/webhook') {
            req.rawBody = buf.toString();
        }
    },
}));
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, cookie_parser_1.default)());
app.use('/api/auth', auth_1.authRouter);
app.use('/api/users', user_1.userRouter);
app.use('/api/conversations', conversation_1.conversationRouter);
app.use('/api/matches', match_1.matchRouter);
app.use('/api/calls', call_1.callRouter);
app.use('/api/notifications', notification_1.notificationRouter);
app.use('/api/search', search_1.searchRouter);
app.use('/api/admin', admin_1.adminRouter);
app.use('/api/analytics', analytics_1.analyticsRouter);
app.use('/api/events', event_1.eventRouter);
app.use('/api/introductions', introduction_1.introductionRouter);
app.use('/api/meetings', meeting_1.meetingRouter);
app.use('/api/messaging', messaging_1.messagingRouter);
app.use('/api/referrals', referral_1.referralRouter);
app.use('/api/referral', affiliateReferral_1.affiliateReferralRouter);
app.use('/api/verification', verification_1.verificationRouter);
app.use('/api/direct-messages', directMessage_1.directMessageRouter);
app.use('/api/dm', directMessage_1.directMessageRouter);
app.use('/api/invites', invite_1.inviteRouter);
app.use('/api/activity', activity_1.activityRouter);
app.use('/api/secretary', secretary_1.secretaryRouter);
app.use('/api/zoom', zoom_1.zoomRouter);
app.use('/api/deals', deal_1.dealRouter);
app.use('/api/ai-chat', aiChat_1.aiChatRouter);
app.use('/api/twilio', twilio_1.twilioRouter);
app.use('/api/whatsapp', whatsapp_1.whatsappRouter);
app.use('/api/gupshup', gupshup_1.gupshupRouter);
app.use('/api/calendar', calendar_1.calendarRouter);
app.use('/api/agent-chat', agent_chat_1.agentChatRouter);
app.use('/api/health', health_1.healthRouter);
app.use('/api/subscription', subscription_1.subscriptionRouter);
if (env_1.env.SENTRY_DSN) {
    Sentry.setupExpressErrorHandler(app);
}
app.use(errorHandler_1.errorHandler);
const PORT = env_1.env.PORT;
const server = (0, http_1.createServer)(app);
(0, server_1.setupWebSocket)(server);
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Cleya.ai backend running on port ${PORT}`);
    console.log(`   Environment: ${env_1.env.NODE_ENV}`);
    matchScheduler_1.matchScheduler.start();
    agentScheduler_1.agentScheduler.start().catch(err => console.error('[AgentScheduler] Failed to start:', err));
});
exports.default = app;
//# sourceMappingURL=index.js.map