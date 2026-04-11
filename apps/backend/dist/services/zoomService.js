"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isZoomConfigured = isZoomConfigured;
exports.createZoomOAuthState = createZoomOAuthState;
exports.validateZoomState = validateZoomState;
exports.getZoomAuthUrl = getZoomAuthUrl;
exports.handleZoomCallback = handleZoomCallback;
exports.createZoomMeeting = createZoomMeeting;
exports.isUserZoomConnected = isUserZoomConnected;
exports.disconnectZoom = disconnectZoom;
// Zoom OAuth Setup:
// 1. Create a "General App" at https://marketplace.zoom.us/
// 2. Add required OAuth scopes: meeting:write:meeting
// 3. Set redirect URL to: <BACKEND_URL>/api/zoom/callback
// 4. Set env vars: ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, and optionally ZOOM_REDIRECT_URI
const env_1 = require("../config/env");
const db_1 = require("@cleya/db");
const crypto_1 = __importDefault(require("crypto"));
const ZOOM_AUTH_URL = 'https://zoom.us/oauth/authorize';
const ZOOM_TOKEN_URL = 'https://zoom.us/oauth/token';
const ZOOM_API_BASE = 'https://api.zoom.us/v2';
function isZoomConfigured() {
    return !!(env_1.env.ZOOM_CLIENT_ID && env_1.env.ZOOM_CLIENT_SECRET);
}
async function createZoomOAuthState(userId) {
    const state = crypto_1.default.randomBytes(32).toString('hex');
    await db_1.prisma.oAuthState.create({
        data: {
            state,
            userId,
            provider: 'zoom',
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        },
    });
    return state;
}
async function validateZoomState(state) {
    const entry = await db_1.prisma.oAuthState.findUnique({ where: { state } });
    if (!entry || entry.provider !== 'zoom')
        return null;
    await db_1.prisma.oAuthState.delete({ where: { state } });
    if (new Date() > entry.expiresAt)
        return null;
    return entry.userId;
}
function getZoomAuthUrl(state) {
    const redirectUri = env_1.env.ZOOM_REDIRECT_URI || `${env_1.env.BACKEND_URL}/api/zoom/callback`;
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: env_1.env.ZOOM_CLIENT_ID || '',
        redirect_uri: redirectUri,
        state,
    });
    return `${ZOOM_AUTH_URL}?${params.toString()}`;
}
async function exchangeCodeForTokens(code) {
    const redirectUri = env_1.env.ZOOM_REDIRECT_URI || `${env_1.env.BACKEND_URL}/api/zoom/callback`;
    const credentials = Buffer.from(`${env_1.env.ZOOM_CLIENT_ID}:${env_1.env.ZOOM_CLIENT_SECRET}`).toString('base64');
    const resp = await fetch(ZOOM_TOKEN_URL, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
        }),
    });
    if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Zoom token exchange failed: ${resp.status} ${errText}`);
    }
    return resp.json();
}
async function refreshAccessToken(refreshToken) {
    const credentials = Buffer.from(`${env_1.env.ZOOM_CLIENT_ID}:${env_1.env.ZOOM_CLIENT_SECRET}`).toString('base64');
    const resp = await fetch(ZOOM_TOKEN_URL, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
        }),
    });
    if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Zoom token refresh failed: ${resp.status} ${errText}`);
    }
    return resp.json();
}
async function getValidAccessToken(userId) {
    const user = await db_1.prisma.user.findUnique({
        where: { id: userId },
        select: { zoomAccessToken: true, zoomRefreshToken: true },
    });
    if (!user?.zoomAccessToken || !user?.zoomRefreshToken)
        return null;
    const testResp = await fetch(`${ZOOM_API_BASE}/users/me`, {
        headers: { Authorization: `Bearer ${user.zoomAccessToken}` },
    });
    if (testResp.ok)
        return user.zoomAccessToken;
    try {
        const tokens = await refreshAccessToken(user.zoomRefreshToken);
        await db_1.prisma.user.update({
            where: { id: userId },
            data: {
                zoomAccessToken: tokens.access_token,
                zoomRefreshToken: tokens.refresh_token,
            },
        });
        return tokens.access_token;
    }
    catch (err) {
        console.error(`Zoom token refresh failed for user ${userId}:`, err);
        await db_1.prisma.user.update({
            where: { id: userId },
            data: { zoomAccessToken: null, zoomRefreshToken: null, zoomUserId: null },
        });
        return null;
    }
}
async function handleZoomCallback(userId, code) {
    const tokens = await exchangeCodeForTokens(code);
    const meResp = await fetch(`${ZOOM_API_BASE}/users/me`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    let zoomUserId = null;
    if (meResp.ok) {
        const meData = await meResp.json();
        zoomUserId = meData.id || null;
    }
    await db_1.prisma.user.update({
        where: { id: userId },
        data: {
            zoomAccessToken: tokens.access_token,
            zoomRefreshToken: tokens.refresh_token,
            zoomUserId,
        },
    });
}
async function createZoomMeeting(userId, topic, startTime, durationMinutes = 30, agenda) {
    const accessToken = await getValidAccessToken(userId);
    if (!accessToken)
        return null;
    const resp = await fetch(`${ZOOM_API_BASE}/users/me/meetings`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            topic,
            type: 2,
            start_time: startTime.toISOString(),
            duration: durationMinutes,
            agenda: agenda || `Meeting scheduled via Cleya.ai`,
            settings: {
                join_before_host: true,
                waiting_room: false,
                auto_recording: 'none',
                meeting_authentication: false,
            },
        }),
    });
    if (!resp.ok) {
        const errText = await resp.text();
        console.error('Zoom meeting creation failed:', resp.status, errText);
        return null;
    }
    const data = await resp.json();
    return {
        joinUrl: data.join_url,
        meetingId: String(data.id),
        startUrl: data.start_url,
    };
}
async function isUserZoomConnected(userId) {
    const user = await db_1.prisma.user.findUnique({
        where: { id: userId },
        select: { zoomAccessToken: true },
    });
    return !!user?.zoomAccessToken;
}
async function disconnectZoom(userId) {
    await db_1.prisma.user.update({
        where: { id: userId },
        data: { zoomAccessToken: null, zoomRefreshToken: null, zoomUserId: null },
    });
}
//# sourceMappingURL=zoomService.js.map