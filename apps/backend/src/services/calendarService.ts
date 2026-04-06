import { google, calendar_v3 } from 'googleapis';
import { prisma } from '@cleya/db';
import { env } from '../config/env';
import crypto from 'crypto';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
];

function getOAuth2Client() {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI) {
    throw new Error('Google Calendar is not configured');
  }
  return new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI,
  );
}

export function isCalendarConfigured(): boolean {
  return !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URI);
}

export async function getAuthUrl(userId: string): Promise<string> {
  const oauth2Client = getOAuth2Client();
  const state = crypto.randomBytes(32).toString('hex');

  await prisma.oAuthState.create({
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

export async function validateState(state: string): Promise<string | null> {
  const entry = await prisma.oAuthState.findUnique({ where: { state } });
  if (!entry || entry.provider !== 'google_calendar') return null;

  await prisma.oAuthState.delete({ where: { state } });

  if (new Date() > entry.expiresAt) return null;
  return entry.userId;
}

export async function cleanupExpiredStates(): Promise<void> {
  await prisma.oAuthState.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
}

export async function handleCallback(code: string, userId: string): Promise<void> {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error('Failed to obtain tokens from Google');
  }

  oauth2Client.setCredentials(tokens);
  let email: string | undefined;
  try {
    const cal = google.calendar({ version: 'v3', auth: oauth2Client });
    const calList = await cal.calendarList.get({ calendarId: 'primary' });
    email = calList.data.summary || undefined;
  } catch {}

  const expiresAt = tokens.expiry_date
    ? new Date(tokens.expiry_date)
    : new Date(Date.now() + 3600 * 1000);

  await prisma.googleCalendarToken.upsert({
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

async function getAuthenticatedClient(userId: string) {
  const tokenRecord = await prisma.googleCalendarToken.findUnique({
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

      await prisma.googleCalendarToken.update({
        where: { userId },
        data: {
          accessToken: credentials.access_token || tokenRecord.accessToken,
          refreshToken: credentials.refresh_token || tokenRecord.refreshToken,
          expiresAt: newExpiry,
        },
      });

      oauth2Client.setCredentials(credentials);
    } catch (err) {
      console.error('Failed to refresh Google token:', err);
      await prisma.googleCalendarToken.delete({ where: { userId } });
      throw new Error('Google Calendar session expired. Please reconnect your calendar.');
    }
  }

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

export async function isUserCalendarConnected(userId: string): Promise<boolean> {
  const token = await prisma.googleCalendarToken.findUnique({
    where: { userId },
    select: { id: true, email: true },
  });
  return !!token;
}

export async function getCalendarStatus(userId: string): Promise<{ connected: boolean; email?: string }> {
  const token = await prisma.googleCalendarToken.findUnique({
    where: { userId },
    select: { email: true },
  });
  return token
    ? { connected: true, email: token.email || undefined }
    : { connected: false };
}

export async function getEvents(
  userId: string,
  timeMin?: Date,
  timeMax?: Date,
): Promise<calendar_v3.Schema$Event[]> {
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

export async function createEvent(
  userId: string,
  event: {
    summary: string;
    description?: string;
    start: Date;
    end: Date;
    attendees?: string[];
  },
): Promise<calendar_v3.Schema$Event> {
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

export async function checkAvailability(
  userId: string,
  date: Date,
): Promise<{ busy: Array<{ start: string; end: string }>; free: boolean }> {
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

export async function disconnect(userId: string): Promise<void> {
  await prisma.googleCalendarToken.deleteMany({ where: { userId } });
}
