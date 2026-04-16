export const statusStyles: Record<string, { bg: string; text: string; labelKey: string; icon: string }> = {
  PENDING_APPROVAL: { bg: 'rgba(245,158,11,0.15)', text: '#fbbf24', labelKey: 'intro.statusReview', icon: '⏳' },
  APPROVED: { bg: 'rgba(108,99,255,0.15)', text: '#93c5fd', labelKey: 'intro.statusApproved', icon: '✅' },
  SENT: { bg: 'rgba(108,99,255,0.15)', text: '#9B95FF', labelKey: 'intro.statusSent', icon: '📤' },
  VIEWED: { bg: 'rgba(108,99,255,0.15)', text: '#93c5fd', labelKey: 'intro.statusViewed', icon: '👀' },
  RESPONDED: { bg: 'rgba(16,185,129,0.15)', text: '#6ee7b7', labelKey: 'intro.statusResponded', icon: '💬' },
  FOLLOWED_UP: { bg: 'rgba(245,158,11,0.15)', text: '#fbbf24', labelKey: 'intro.statusFollowedUp', icon: '🔔' },
  COMPLETED: { bg: 'rgba(16,185,129,0.2)', text: '#10B981', labelKey: 'intro.statusCompleted', icon: '🎉' },
  CANCELLED: { bg: 'rgba(239,68,68,0.15)', text: '#f87171', labelKey: 'intro.statusCancelled', icon: '✖' },
};

export const outcomeKeys: Record<string, { labelKey: string; icon: string; color: string }> = {
  GREAT_MEETING: { labelKey: 'intro.greatMeeting', icon: '🎉', color: '#10B981' },
  GOOD_CHAT: { labelKey: 'intro.goodChat', icon: '👍', color: '#6C63FF' },
  DIDNT_MEET: { labelKey: 'intro.didntMeet', icon: '😕', color: '#f59e0b' },
  NOT_A_FIT: { labelKey: 'intro.notAFit', icon: '🤷', color: '#ef4444' },
};
