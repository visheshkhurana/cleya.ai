"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordProposalCreated = recordProposalCreated;
exports.recordProposalSkipped = recordProposalSkipped;
exports.recordNotificationSent = recordNotificationSent;
exports.recordNotificationSkipped = recordNotificationSkipped;
exports.snapshot = snapshot;
exports.diffSince = diffSince;
exports.formatSkipBreakdown = formatSkipBreakdown;
const emptyProposalCounters = () => ({
    DAILY_CAP: 0,
    COOLDOWN: 0,
    FREE_LIMIT: 0,
    SAME_PERSONA: 0,
    DUPLICATE: 0,
    CADENCE_GAP: 0,
    BLOCKED: 0,
    OTHER: 0,
});
const emptyNotificationCounters = () => ({
    QUIET_HOURS: 0,
    DAILY_CAP: 0,
});
const cumulative = {
    proposalsCreated: 0,
    proposalsSkipped: emptyProposalCounters(),
    notificationsSent: 0,
    notificationsSkipped: emptyNotificationCounters(),
};
function recordProposalCreated() {
    cumulative.proposalsCreated++;
}
function recordProposalSkipped(reason) {
    cumulative.proposalsSkipped[reason]++;
}
function recordNotificationSent() {
    cumulative.notificationsSent++;
}
function recordNotificationSkipped(reason) {
    cumulative.notificationsSkipped[reason]++;
}
function snapshot() {
    return {
        proposalsCreated: cumulative.proposalsCreated,
        proposalsSkipped: { ...cumulative.proposalsSkipped },
        notificationsSent: cumulative.notificationsSent,
        notificationsSkipped: { ...cumulative.notificationsSkipped },
    };
}
function diffSince(prev) {
    const cur = snapshot();
    const proposalsSkipped = emptyProposalCounters();
    for (const k of Object.keys(proposalsSkipped)) {
        proposalsSkipped[k] = cur.proposalsSkipped[k] - prev.proposalsSkipped[k];
    }
    const notificationsSkipped = emptyNotificationCounters();
    for (const k of Object.keys(notificationsSkipped)) {
        notificationsSkipped[k] = cur.notificationsSkipped[k] - prev.notificationsSkipped[k];
    }
    return {
        proposalsCreated: cur.proposalsCreated - prev.proposalsCreated,
        proposalsSkipped,
        notificationsSent: cur.notificationsSent - prev.notificationsSent,
        notificationsSkipped,
    };
}
function formatSkipBreakdown(m) {
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
//# sourceMappingURL=matchMetrics.js.map