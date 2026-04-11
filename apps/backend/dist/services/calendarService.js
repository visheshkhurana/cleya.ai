"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCalendarConfigured = isCalendarConfigured;
exports.getAuthUrl = getAuthUrl;
exports.validateState = validateState;
exports.cleanupExpiredStates = cleanupExpiredStates;
exports.handleCallback = handleCallback;
exports.isUserCalendarConnected = isUserCalendarConnected;
exports.getCalendarStatus = getCalendarStatus;
exports.getEvents = getEvents;
exports.createEvent = createEvent;
exports.checkAvailability = checkAvailability;
exports.disconnect = disconnect;
const googleapis_1 = require("googleapis");
const db_1 = require("@cleya/db");
const env_1 = require("../config/env");
const crypto_1 = __importDefault(require("crypto"));
const SCOPES = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
];
function getOAuth2Client() {
    if (!env_1.env.GOOGLE_CLIENT_ID || !env_1.env.GOOGLE_CLIENT_SECRET || !env_1.env.GOOGLE_REDIRECT_URI) {
        throw new Error('Google Calendar is not configured');
    }
    return new googleapis_1.google.auth.OAuth2(env_1.env.GOOGLE_CLIENT_ID, env_1.env.GOOGLE_CLIENT_SECRET, env_1.env.GOOGLE_REDIRECT_URI);
}
function isCalendarConfigured() {
    return !!(env_1.env.GOOGLE_CLIENT_ID && env_1.env.GOOGLE_CLIENT_SECRET && env_1.env.GOOGLE_REDIRECT_URI);
}
async function getAuthUrl(userId) {
    const oauth2Client = getOAuth2Client();
    const state = crypto_1.default.randomBytes(32).toString('hex');
    await db_1.prisma.oAuthState.create({
        data: {
            state,
            userId,
            provider: 'google_calendar',
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        },
    });
    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: SCOPES,
        state,
    });
}
async function validateState(state) {
    const entry = await db_1.prisma.oAuthState.findUnique({ where: { state } });
    if (!entry || entry.provider !== 'google_calendar')
        return null;
    await db_1.prisma.oAuthState.delete({ where: { state } });
    if (new Date() > entry.expiresAt)
        return null;
    return entry.userId;
}
async function cleanupExpiredStates() {
    await db_1.prisma.oAuthState.deleteMany({
        where: { expiresAt: { lt: new Date() } },
    });
}
async function handleCallback(code, userId) {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    if (!tokens.access_token || !tokens.refresh_token) {
        throw new Error('Failed to obtain tokens from Google');
    }
    oauth2Client.setCredentials(tokens);
    let email;
    try {
        const cal = googleapis_1.google.calendar({ version: 'v3', auth: oauth2Client });
        const calList = await cal.calendarList.get({ calendarId: 'primary' });
        email = calList.data.summary || undefined;
    }
    catch { }
    const expiresAt = tokens.expiry_date
        ? new Date(tokens.expiry_date)
        : new Date(Date.now() + 3600 * 1000);
    await db_1.prisma.googleCalendarToken.upsert({
        where: { userId },
        create: {
            userId,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiresAt,
            email,
        },
        update: {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiresAt,
            email,
        },
    });
}
async function getAuthenticatedClient(userId) {
    const tokenRecord = await db_1.prisma.googleCalendarToken.findUnique({
        where: { userId },
    });
    if (!tokenRecord) {
        throw new Error('Google Calendar not connected. Please connect your calendar first.');
    }
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({
        access_token: tokenRecord.accessToken,
        refresh_token: tokenRecord.refreshToken,
        expiry_date: tokenRecord.expiresAt.getTime(),
    });
    if (tokenRecord.expiresAt.getTime() < Date.now() + 60000) {
        try {
            const { credentials } = await oauth2Client.refreshAccessToken();
            const newExpiry = credentials.expiry_date
                ? new Date(credentials.expiry_date)
                : new Date(Date.now() + 3600 * 1000);
            await db_1.prisma.googleCalendarToken.update({
                where: { userId },
                data: {
                    accessToken: credentials.access_token || tokenRecord.accessToken,
                    refreshToken: credentials.refresh_token || tokenRecord.refreshToken,
                    expiresAt: newExpiry,
                },
            });
            oauth2Client.setCredentials(credentials);
        }
        catch (err) {
            console.error('Failed to refresh Google token:', err);
            await db_1.prisma.googleCalendarToken.delete({ where: { userId } });
            throw new Error('Google Calendar session expired. Please reconnect your calendar.');
        }
    }
    return googleapis_1.google.calendar({ version: 'v3', auth: oauth2Client });
}
async function isUserCalendarConnected(userId) {
    const token = await db_1.prisma.googleCalendarToken.findUnique({
        where: { userId },
        select: { id: true, email: true },
    });
    return !!token;
}
async function getCalendarStatus(userId) {
    const token = await db_1.prisma.googleCalendarToken.findUnique({
        where: { userId },
        select: { email: true },
    });
    return token
        ? { connected: true, email: token.email || undefined }
        : { connected: false };
}
async function getEvents(userId, timeMin, timeMax) {
    const cal = await getAuthenticatedClient(userId);
    const now = new Date();
    const res = await cal.events.list({
        calendarId: 'primary',
        timeMin: (timeMin || now).toISOString(),
        timeMax: (timeMax || new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)).toISOString(),
        maxResults: 50,
        singleEvents: true,
        orderBy: 'startTime',
    });
    return res.data.items || [];
}
async function createEvent(userId, event) {
    const cal = await getAuthenticatedClient(userId);
    const res = await cal.events.insert({
        calendarId: 'primary',
        requestBody: {
            summary: event.summary,
            description: event.description,
            start: {
                dateTime: event.start.toISOString(),
                timeZone: 'Asia/Kolkata',
            },
            end: {
                dateTime: event.end.toISOString(),
                timeZone: 'Asia/Kolkata',
            },
            attendees: event.attendees?.map((email) => ({ email })),
            reminders: {
                useDefault: false,
                overrides: [
                    { method: 'popup', minutes: 15 },
                    { method: 'email', minutes: 30 },
                ],
            },
        },
        sendUpdates: 'all',
    });
    return res.data;
}
async function checkAvailability(userId, date) {
    const cal = await getAuthenticatedClient(userId);
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    const res = await cal.freebusy.query({
        requestBody: {
            timeMin: dayStart.toISOString(),
            timeMax: dayEnd.toISOString(),
            timeZone: 'Asia/Kolkata',
            items: [{ id: 'primary' }],
        },
    });
    const busy = (res.data.calendars?.primary?.busy || []).map((b) => ({
        start: b.start || '',
        end: b.end || '',
    }));
    return { busy, free: busy.length === 0 };
}
async function disconnect(userId) {
    await db_1.prisma.googleCalendarToken.deleteMany({ where: { userId } });
}
//# sourceMappingURL=calendarService.js.map