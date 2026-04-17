import { prisma } from '@cleya/db';

const num = (v: string | undefined, d: number) => {
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : d;
};

export const ANTI_SPAM = {
  dailyProposalCap: num(process.env.MATCH_DAILY_PROPOSAL_CAP, 3),
  proposalCooldownMs: num(process.env.MATCH_PROPOSAL_COOLDOWN_MS_HOURS, 4) * 60 * 60 * 1000,
  dailyNotificationCap: num(process.env.MATCH_DAILY_NOTIFICATION_CAP, 5),
  quietHoursStart: num(process.env.MATCH_QUIET_HOURS_START, 22),
  quietHoursEnd: num(process.env.MATCH_QUIET_HOURS_END, 8),
  defaultTimezone: process.env.MATCH_DEFAULT_TIMEZONE || 'Asia/Kolkata',
};

export type GuardrailReason =
  | 'OK'
  | 'DAILY_CAP'
  | 'COOLDOWN'
  | 'FREE_LIMIT';

export interface GuardrailDecision {
  allowed: boolean;
  reason: GuardrailReason;
  blockingUserId?: string;
}

function startOfLocalDayMs(timezone: string): number {
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const parts = fmt.formatToParts(new Date());
    const get = (t: string) => parts.find(p => p.type === t)?.value ?? '00';
    const localMs = Date.UTC(
      Number(get('year')),
      Number(get('month')) - 1,
      Number(get('day')),
      0, 0, 0, 0,
    );
    const observedUtc = Date.UTC(
      Number(get('year')),
      Number(get('month')) - 1,
      Number(get('day')),
      Number(get('hour') === '24' ? '0' : get('hour')),
      Number(get('minute')),
      Number(get('second')),
    );
    const offsetMs = observedUtc - Date.now();
    return localMs - offsetMs;
  } catch {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
}

const serverStartOfDayMs = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

async function userProposalStats(userId: string) {
  const since = new Date(serverStartOfDayMs());
  const [todayCount, lastMatch] = await Promise.all([
    prisma.match.count({
      where: {
        OR: [{ userAId: userId }, { userBId: userId }],
        createdAt: { gte: since },
      },
    }),
    prisma.match.findFirst({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ]);
  return { todayCount, lastMatchAt: lastMatch?.createdAt ?? null };
}

export async function checkProposalGuardrails(
  userAId: string,
  userBId: string
): Promise<GuardrailDecision> {
  for (const userId of [userAId, userBId]) {
    const { todayCount, lastMatchAt } = await userProposalStats(userId);
    if (todayCount >= ANTI_SPAM.dailyProposalCap) {
      return { allowed: false, reason: 'DAILY_CAP', blockingUserId: userId };
    }
    if (
      lastMatchAt &&
      Date.now() - lastMatchAt.getTime() < ANTI_SPAM.proposalCooldownMs
    ) {
      return { allowed: false, reason: 'COOLDOWN', blockingUserId: userId };
    }
  }
  return { allowed: true, reason: 'OK' };
}

function getUserHourInTz(timezone: string): number {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: timezone,
    });
    const parts = fmt.formatToParts(new Date());
    const h = parts.find(p => p.type === 'hour')?.value ?? '0';
    const n = Number(h);
    return Number.isFinite(n) ? (n === 24 ? 0 : n) : new Date().getUTCHours();
  } catch {
    return new Date().getUTCHours();
  }
}

function parseHour(v: string | null | undefined, fallback: number): number {
  if (!v) return fallback;
  const m = v.match(/^(\d{1,2})/);
  if (!m) return fallback;
  const h = Number(m[1]);
  return Number.isFinite(h) && h >= 0 && h < 24 ? h : fallback;
}

export interface NotificationPolicy {
  inQuietHours: boolean;
  overDailyCap: boolean;
  shouldSend: boolean;
  reason?: 'QUIET_HOURS' | 'DAILY_CAP';
  hour: number;
  timezone: string;
}

export async function evaluateNotificationPolicy(
  userId: string
): Promise<NotificationPolicy> {
  const pref = await prisma.communicationPreference.findUnique({
    where: { userId },
  });
  const timezone = pref?.timezone || ANTI_SPAM.defaultTimezone;
  const startH = parseHour(pref?.quietHoursStart, ANTI_SPAM.quietHoursStart);
  const endH = parseHour(pref?.quietHoursEnd, ANTI_SPAM.quietHoursEnd);
  const hour = getUserHourInTz(timezone);

  const inQuiet =
    startH === endH
      ? false
      : startH < endH
        ? hour >= startH && hour < endH
        : hour >= startH || hour < endH;

  const since = new Date(startOfLocalDayMs(timezone));
  const sentToday = await prisma.notification.count({
    where: {
      userId,
      event: 'MATCH_FOUND',
      sentAt: { gte: since },
    },
  });
  const overCap = sentToday >= ANTI_SPAM.dailyNotificationCap;

  return {
    inQuietHours: inQuiet,
    overDailyCap: overCap,
    shouldSend: !inQuiet && !overCap,
    reason: inQuiet ? 'QUIET_HOURS' : overCap ? 'DAILY_CAP' : undefined,
    hour,
    timezone,
  };
}

export async function recordMatchNotification(
  userId: string,
  channel: 'WHATSAPP' | 'EMAIL' | 'SMS' | 'IN_APP',
  matchId: string,
  body: string
) {
  try {
    await prisma.notification.create({
      data: {
        userId,
        channel,
        event: 'MATCH_FOUND',
        title: 'New match',
        body,
        sentAt: new Date(),
        metadata: { matchId },
      },
    });
  } catch (e) {
    console.log('[MatchAntiSpam] Failed to log notification:', (e as Error).message);
  }
}
