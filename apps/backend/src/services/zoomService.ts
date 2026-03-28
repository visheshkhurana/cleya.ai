import { env } from '../config/env';
import { prisma } from '@cleya/db';

const ZOOM_AUTH_URL = 'https://zoom.us/oauth/authorize';
const ZOOM_TOKEN_URL = 'https://zoom.us/oauth/token';
const ZOOM_API_BASE = 'https://api.zoom.us/v2';

export function isZoomConfigured(): boolean {
  return !!(env.ZOOM_CLIENT_ID && env.ZOOM_CLIENT_SECRET);
}

export function getZoomAuthUrl(state: string): string {
  const redirectUri = env.ZOOM_REDIRECT_URI || `${env.BACKEND_URL}/api/zoom/callback`;
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: env.ZOOM_CLIENT_ID || '',
    redirect_uri: redirectUri,
    state,
  });
  return `${ZOOM_AUTH_URL}?${params.toString()}`;
}

async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const redirectUri = env.ZOOM_REDIRECT_URI || `${env.BACKEND_URL}/api/zoom/callback`;
  const credentials = Buffer.from(`${env.ZOOM_CLIENT_ID}:${env.ZOOM_CLIENT_SECRET}`).toString('base64');

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

  return resp.json() as Promise<{ access_token: string; refresh_token: string; expires_in: number }>;
}

async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const credentials = Buffer.from(`${env.ZOOM_CLIENT_ID}:${env.ZOOM_CLIENT_SECRET}`).toString('base64');

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

  return resp.json() as Promise<{ access_token: string; refresh_token: string; expires_in: number }>;
}

async function getValidAccessToken(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { zoomAccessToken: true, zoomRefreshToken: true },
  });

  if (!user?.zoomAccessToken || !user?.zoomRefreshToken) return null;

  const testResp = await fetch(`${ZOOM_API_BASE}/users/me`, {
    headers: { Authorization: `Bearer ${user.zoomAccessToken}` },
  });

  if (testResp.ok) return user.zoomAccessToken;

  try {
    const tokens = await refreshAccessToken(user.zoomRefreshToken);
    await prisma.user.update({
      where: { id: userId },
      data: {
        zoomAccessToken: tokens.access_token,
        zoomRefreshToken: tokens.refresh_token,
      },
    });
    return tokens.access_token;
  } catch (err) {
    console.error(`Zoom token refresh failed for user ${userId}:`, err);
    await prisma.user.update({
      where: { id: userId },
      data: { zoomAccessToken: null, zoomRefreshToken: null, zoomUserId: null },
    });
    return null;
  }
}

export async function handleZoomCallback(userId: string, code: string): Promise<void> {
  const tokens = await exchangeCodeForTokens(code);

  const meResp = await fetch(`${ZOOM_API_BASE}/users/me`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  let zoomUserId: string | null = null;
  if (meResp.ok) {
    const meData = await meResp.json() as any;
    zoomUserId = meData.id || null;
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      zoomAccessToken: tokens.access_token,
      zoomRefreshToken: tokens.refresh_token,
      zoomUserId,
    },
  });
}

export async function createZoomMeeting(
  userId: string,
  topic: string,
  startTime: Date,
  durationMinutes: number = 30,
  agenda?: string
): Promise<{ joinUrl: string; meetingId: string; startUrl: string } | null> {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return null;

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

  const data = await resp.json() as any;
  return {
    joinUrl: data.join_url,
    meetingId: String(data.id),
    startUrl: data.start_url,
  };
}

export async function isUserZoomConnected(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { zoomAccessToken: true },
  });
  return !!user?.zoomAccessToken;
}

export async function disconnectZoom(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { zoomAccessToken: null, zoomRefreshToken: null, zoomUserId: null },
  });
}
