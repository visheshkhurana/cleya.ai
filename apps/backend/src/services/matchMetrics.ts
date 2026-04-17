export type ProposalSkipReason =
  | 'DAILY_CAP'
  | 'COOLDOWN'
  | 'FREE_LIMIT'
  | 'SAME_PERSONA'
  | 'DUPLICATE'
  | 'OTHER';

export type NotificationSkipReason = 'QUIET_HOURS' | 'DAILY_CAP';

export interface MatchMetrics {
  proposalsCreated: number;
  proposalsSkipped: Record<ProposalSkipReason, number>;
  notificationsSent: number;
  notificationsSkipped: Record<NotificationSkipReason, number>;
}

const emptyProposalCounters = (): Record<ProposalSkipReason, number> => ({
  DAILY_CAP: 0,
  COOLDOWN: 0,
  FREE_LIMIT: 0,
  SAME_PERSONA: 0,
  DUPLICATE: 0,
  OTHER: 0,
});

const emptyNotificationCounters = (): Record<NotificationSkipReason, number> => ({
  QUIET_HOURS: 0,
  DAILY_CAP: 0,
});

const cumulative: MatchMetrics = {
  proposalsCreated: 0,
  proposalsSkipped: emptyProposalCounters(),
  notificationsSent: 0,
  notificationsSkipped: emptyNotificationCounters(),
};

export function recordProposalCreated(): void {
  cumulative.proposalsCreated++;
}

export function recordProposalSkipped(reason: ProposalSkipReason): void {
  cumulative.proposalsSkipped[reason]++;
}

export function recordNotificationSent(): void {
  cumulative.notificationsSent++;
}

export function recordNotificationSkipped(reason: NotificationSkipReason): void {
  cumulative.notificationsSkipped[reason]++;
}

export function snapshot(): MatchMetrics {
  return {
    proposalsCreated: cumulative.proposalsCreated,
    proposalsSkipped: { ...cumulative.proposalsSkipped },
    notificationsSent: cumulative.notificationsSent,
    notificationsSkipped: { ...cumulative.notificationsSkipped },
  };
}

export function diffSince(prev: MatchMetrics): MatchMetrics {
  const cur = snapshot();
  const proposalsSkipped = emptyProposalCounters();
  for (const k of Object.keys(proposalsSkipped) as ProposalSkipReason[]) {
    proposalsSkipped[k] = cur.proposalsSkipped[k] - prev.proposalsSkipped[k];
  }
  const notificationsSkipped = emptyNotificationCounters();
  for (const k of Object.keys(notificationsSkipped) as NotificationSkipReason[]) {
    notificationsSkipped[k] = cur.notificationsSkipped[k] - prev.notificationsSkipped[k];
  }
  return {
    proposalsCreated: cur.proposalsCreated - prev.proposalsCreated,
    proposalsSkipped,
    notificationsSent: cur.notificationsSent - prev.notificationsSent,
    notificationsSkipped,
  };
}

export function formatSkipBreakdown(m: MatchMetrics): string {
  const ps = Object.entries(m.proposalsSkipped)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${k}=${n}`)
    .join(',') || 'none';
  const ns = Object.entries(m.notificationsSkipped)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${k}=${n}`)
    .join(',') || 'none';
  return `proposalSkips[${ps}] notifSkips[${ns}]`;
}
