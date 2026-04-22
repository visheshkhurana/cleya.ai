/**
 * Return a SAFE display name for describing a user to OTHER users.
 *
 * Rule: never invent a "name" out of role, company, or email-prefix —
 * that surfaces the same person under different labels across notifications
 * (the "bot referred to me by a different name" bug). When the user genuinely
 * has no `name` on file, return a persona-based descriptor instead.
 *
 * Use this anywhere we render a person's name to someone OTHER than themselves
 * (match emails, intro emails, WhatsApp matchFound/matchAccepted, in-app
 * notifications about another user, AI prompts that name a counterparty).
 *
 * For greeting a user with their OWN name (e.g. "Hi Rahul") it's acceptable
 * to keep the email-prefix fallback since they recognise their own address;
 * use `safeFirstName` below for that case.
 */
export function safeDisplayName(u: {
  name?: string | null;
  profile?: { persona?: string | null } | null;
}): string {
  const n = (u?.name || '').trim();
  if (n) return n;
  const persona = u?.profile?.persona;
  switch (persona) {
    case 'FOUNDER':           return 'this founder';
    case 'INVESTOR':          return 'this investor';
    case 'TALENT':            return 'this candidate';
    case 'DEAL_PARTNER':      return 'this deal partner';
    case 'EVENT_PARTICIPANT': return 'this attendee';
    default:                  return 'this person';
  }
}

/** First-name variant of safeDisplayName, for warmer phrasing in emails/WA. */
export function safeFirstName(u: {
  name?: string | null;
  profile?: { persona?: string | null } | null;
}): string {
  const n = (u?.name || '').trim();
  if (n) return n.split(/\s+/)[0] || n;
  return safeDisplayName(u);
}
