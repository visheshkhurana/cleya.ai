import { env } from '../config/env';
import { prisma } from '@cleya/db';
import { getUncachableResendClient } from './resendClient';
import { toDisplayPercent } from '@cleya/matching';
import { createMatchActionToken, createInboundReplyLocalPart } from './matchActionToken';

const brandColor = '#0D9488';

function plainEmailLayout(content: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;padding:40px 20px;">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;text-align:left;">
<tr><td style="padding-bottom:24px;">
<span style="color:#111;font-size:16px;font-weight:600;">Cleya.ai</span>
</td></tr>
<tr><td style="color:#1a1a1a;font-size:15px;line-height:1.7;">
${content}
</td></tr>
<tr><td style="padding-top:32px;border-top:1px solid #eee;margin-top:32px;">
<p style="color:#999;font-size:12px;margin:16px 0 0;">Cleya.ai — Your AI Networker for India's startup ecosystem</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

function link(text: string, url: string): string {
  return `<a href="${url}" style="color:${brandColor};text-decoration:underline;">${text}</a>`;
}

// Capitalize the first character of a string (for sentence-start safety).
function cap(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Escape user-derived strings before injecting them into HTML email bodies.
function escapeHtml(s: string): string {
  if (!s) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Strip HTML tags then convert to a plain-text body. Keeps line breaks for <p>.
function htmlToPlainText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Smart money formatter. Detects INR-style raw rupee values and renders both
// INR (Cr/L) and a USD approximation. Keeps any pre-formatted strings the user
// already wrote (e.g. "$2M Seed", "₹3 Cr") almost as-is, only normalizing case
// of "INR" and adding a USD hint where helpful. ~₹83 = $1 USD as of 2026.
const INR_PER_USD = 83;
function formatMoney(raw: string | undefined | null, opts?: { defaultCurrency?: 'INR' | 'USD' }): string {
  if (!raw) return '';
  const trimmed = String(raw).trim();
  if (!trimmed) return '';

  // Already has a currency symbol or unit — normalize INR casing and return.
  const hasUnit = /(₹|\$|inr|usd|cr|crore|lakh|lac|\bl\b|\bk\b|\bm\b|\bb\b)/i.test(trimmed);
  if (hasUnit) {
    return trimmed
      .replace(/\binr\b/gi, 'INR')
      .replace(/\busd\b/gi, 'USD')
      .replace(/\b(\d)\s*cr\b/gi, '$1 Cr')
      .replace(/\b(\d)\s*l\b(?!ak)/gi, '$1 L')
      .replace(/\b(\d)\s*lakh(s)?\b/gi, '$1 Lakh$2');
  }

  // Pure number — guess currency from defaults (Indian users default to INR).
  const num = Number(trimmed.replace(/,/g, ''));
  if (!Number.isFinite(num) || num <= 0) return trimmed;

  const currency = opts?.defaultCurrency || 'INR';
  if (currency === 'INR') {
    const inrPart = num >= 1e7
      ? `INR ${(num / 1e7).toFixed(num % 1e7 === 0 ? 0 : 1)} Cr`
      : num >= 1e5
        ? `INR ${(num / 1e5).toFixed(num % 1e5 === 0 ? 0 : 1)} L`
        : `INR ${num.toLocaleString('en-IN')}`;
    const usd = num / INR_PER_USD;
    const usdPart = usd >= 1e6
      ? `~$${(usd / 1e6).toFixed(usd >= 1e7 ? 0 : 1)}M`
      : usd >= 1e3
        ? `~$${Math.round(usd / 1e3)}k`
        : `~$${Math.round(usd)}`;
    return `${inrPart} (${usdPart})`;
  }

  // USD pure number
  return num >= 1e6
    ? `$${(num / 1e6).toFixed(num >= 1e7 ? 0 : 1)}M`
    : num >= 1e3
      ? `$${Math.round(num / 1e3)}k`
      : `$${Math.round(num)}`;
}

class EmailService {
  private resendAvailable: boolean | null = null;

  async sendRaw(opts: { to: string; subject: string; html: string; replyTo?: string }): Promise<boolean> {
    try {
      const { client, fromEmail } = await getUncachableResendClient();
      const senderEmail = fromEmail || env.FROM_EMAIL;
      const from = `Cleya <${senderEmail}>`;
      const payload: {
        from: string;
        to: string[];
        subject: string;
        html: string;
        reply_to?: string;
      } = { from, to: [opts.to], subject: opts.subject, html: opts.html };
      if (opts.replyTo) payload.reply_to = opts.replyTo;
      const result = await client.emails.send(payload);
      if (result.error) {
        console.error(`📧 Resend error to ${opts.to}:`, result.error);
        return false;
      }
      this.resendAvailable = true;
      return true;
    } catch (err: any) {
      console.error(`📧 Email send failed to ${opts.to}:`, err?.message || err);
      return false;
    }
  }

  private async send(
    to: string,
    subject: string,
    html: string,
    opts?: { replyTo?: string; userId?: string | null; emailKey?: string }
  ): Promise<boolean> {
    try {
      const { client, fromEmail } = await getUncachableResendClient();
      const senderEmail = fromEmail || env.FROM_EMAIL;
      // Personal-looking sender increases the chance Gmail files this in
      // Primary instead of Updates/Promotions.
      const from = `Cleya from Cleya.ai <${senderEmail}>`;
      // Caller-supplied reply-to wins (used by sendMatchProposed for the
      // signed per-match address). Otherwise fall back to the configured
      // monitored mailbox — never the unprovisioned FROM_EMAIL.
      const replyTo = opts?.replyTo || env.REPLY_TO_EMAIL || senderEmail;

      // Plain-text fallback materially helps deliverability + Primary placement.
      const text = htmlToPlainText(html);

      // RFC 8058 one-click unsubscribe headers tell mailbox providers that
      // the sender follows best practice — without classifying the message
      // as a "list" mailing (we don't set List-ID or Precedence:bulk).
      const unsubscribeUrl = `${env.FRONTEND_URL}/unsubscribe?email=${encodeURIComponent(to)}`;

      const result = await client.emails.send({
        from,
        to: [to],
        subject,
        html,
        text,
        reply_to: replyTo,
        headers: {
          'List-Unsubscribe': `<${unsubscribeUrl}>, <mailto:unsubscribe@cleya.ai?subject=unsubscribe>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      } as any);

      if (result.error) {
        console.error(`📧 Resend error to ${to}:`, result.error);
        return false;
      }

      const resendId = result.data?.id || null;
      console.log(`📧 Email sent to ${to}: ${subject} (id: ${resendId})`);
      this.resendAvailable = true;

      // Stamp a 'sent' EmailEvent immediately if the caller passed an
      // emailKey. This is what powers the kill-switch + funnel: webhook
      // events ('delivered'/'opened'/'clicked'/'bounced') arrive later
      // and are joinable by resendId. Without this row we'd only see
      // delivered/opened — never the full funnel denominator.
      if (opts?.emailKey) {
        prisma.emailEvent.create({
          data: {
            userId: opts.userId ?? null,
            emailKey: opts.emailKey,
            resendId,
            toEmail: to,
            event: 'sent',
            subject,
            metadata: {},
          },
        }).catch((err: any) => console.warn('[Email] sent-event log failed:', err?.message || err));
      }
      return true;
    } catch (err: any) {
      if (this.resendAvailable === null) {
        console.log('📧 Resend not available, falling back to log-only mode');
        this.resendAvailable = false;
      }
      console.error(`📧 Email send failed to ${to}:`, err?.message || err);
      console.log(`📧 [FALLBACK] Email to ${to}: ${subject}`);
      return false;
    }
  }

  async sendAdminAlert(to: string, subject: string, html: string) {
    const wrapped = `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#0F1629;color:#fff;border-radius:12px">${html}<hr style="border-color:rgba(255,255,255,0.1);margin:24px 0"/><p style="color:rgba(255,255,255,0.4);font-size:12px">Cleya Moderation — automated alert</p></div>`;
    return this.send(to, subject, wrapped);
  }

  async sendNewSignupNotification(opts: {
    email: string;
    name?: string | null;
    provider: 'email' | 'google' | 'linkedin' | 'clerk';
    userId?: string;
  }) {
    const recipients = (env.SIGNUP_NOTIFY_TO || 'jivraj@cleya.ai')
      .split(',').map(s => s.trim()).filter(Boolean);
    if (recipients.length === 0) return;
    const when = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
    const safe = (s: string) => s.replace(/[<>&"']/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;' }[c] as string));
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0F1629;color:#fff;border-radius:12px">
        <h2 style="margin:0 0 12px;color:#9B95FF">New Cleya signup</h2>
        <p style="margin:0 0 16px;color:rgba(255,255,255,0.7)">A new user just joined the network.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:6px 0;color:rgba(255,255,255,0.5);width:110px">Email</td><td style="padding:6px 0"><strong>${safe(opts.email)}</strong></td></tr>
          ${opts.name ? `<tr><td style="padding:6px 0;color:rgba(255,255,255,0.5)">Name</td><td style="padding:6px 0">${safe(opts.name)}</td></tr>` : ''}
          <tr><td style="padding:6px 0;color:rgba(255,255,255,0.5)">Provider</td><td style="padding:6px 0">${opts.provider}</td></tr>
          ${opts.userId ? `<tr><td style="padding:6px 0;color:rgba(255,255,255,0.5)">User ID</td><td style="padding:6px 0;font-family:monospace;font-size:12px">${safe(opts.userId)}</td></tr>` : ''}
          <tr><td style="padding:6px 0;color:rgba(255,255,255,0.5)">When</td><td style="padding:6px 0">${when}</td></tr>
        </table>
        <hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:20px 0"/>
        <p style="color:rgba(255,255,255,0.4);font-size:12px;margin:0">Cleya — automated signup notification</p>
      </div>`;
    const subject = `New signup: ${opts.email}${opts.provider !== 'email' ? ` (via ${opts.provider})` : ''}`;
    await Promise.all(recipients.map(to => this.send(to, subject, html).catch(() => false)));
  }

  async sendWelcome(email: string): Promise<boolean> {
    const html = plainEmailLayout(`
      <p>Hey there,</p>
      <p>I'm Cleya — your AI Networker for India's startup ecosystem.</p>
      <p>Here's the deal: every week I talk to thousands of founders, investors, operators and builders on your behalf. I learn what each of them is working on, what they're looking for, and where the real fit is. Then I curate the handful of conversations that are actually worth your time and make the warm intro myself.</p>
      <p>No cold spam. No random "let's connect". Just the right people, at the right moment, with context already built in.</p>
      <p><strong>Your one next step:</strong> ${link('tell me about yourself', `${env.FRONTEND_URL}/chat`)} in a 3-minute chat. The richer your profile, the sharper my introductions get.</p>
      <p>Talk soon — I'm already looking for the first few people you should meet.</p>
      <p>— Cleya</p>
    `);
    const ok = await this.send(email, "Welcome to Cleya — let's find your people", html);
    if (ok) {
      console.log(`[welcome.sent ok] ${email}`);
    } else {
      console.error(`[welcome.sent fail] ${email}`);
    }
    return ok;
  }

  async sendMatchProposed(
    recipientEmail: string,
    recipientName: string,
    matchName: string,
    matchPersona: string,
    matchScore: number,
    matchDetails?: {
      companyName?: string;
      headline?: string;
      raiseAmount?: string;
      sector?: string;
      stage?: string;
      traction?: string;
      linkedinUrl?: string;
      location?: string;
      bio?: string;
      matchReason?: string;
      matchId?: string;
      recipientUserId?: string;
    }
  ) {
    const firstName = recipientName?.split(' ')[0] || 'there';
    const matchFirst = matchName?.split(' ')[0] || 'them';
    // Use the displayed compatibility band (72-96%) — the raw score is still
    // the source of truth for ranking. See toDisplayPercent in @cleya/matching.
    const scorePercent = toDisplayPercent(matchScore);
    const sectorPretty = matchDetails?.sector
      ? matchDetails.sector.replace(/_/g, ' ').toLowerCase()
      : '';
    const personaPretty = (matchPersona || 'professional').toLowerCase().replace(/_/g, ' ');
    // Stage label — used in subject lines and the lead paragraph instead of
    // disclosing the actual fundraising amount.
    const stagePretty = matchDetails?.stage
      ? matchDetails.stage.replace(/_/g, ' ').toLowerCase()
      : '';

    let body = `<p>Hi ${firstName},</p>`;

    // Lead paragraph — every sentence starts with a capital letter. We do
    // NOT disclose specific fundraising amounts here; users have told us it
    // feels intrusive. Stage and sector tell the same story without numbers.
    body += `<p>Wanted to put <strong>${matchName}</strong> on your radar`;
    if (matchDetails?.companyName) {
      body += ` — ${personaPretty} at ${matchDetails.companyName}`;
      if (sectorPretty) body += ` (${sectorPretty})`;
      if (stagePretty && matchPersona === 'FOUNDER') body += `, ${stagePretty}`;
      body += `.`;
    } else if (sectorPretty) {
      body += ` — ${sectorPretty} ${personaPretty}.`;
    } else {
      body += ` — ${personaPretty}.`;
    }
    body += `</p>`;

    // Second paragraph — the AI-generated reason or traction line.
    // Capitalize the first letter of every sentence and ensure terminal
    // punctuation so the email reads polished, not auto-generated.
    const reasonText = matchDetails?.matchReason
      || matchDetails?.traction
      || matchDetails?.bio;
    if (reasonText) {
      const sentences = String(reasonText)
        .split(/(?<=[.!?])\s+/)
        .map(s => s.trim())
        .filter(Boolean)
        .map(cap)
        .map(s => /[.!?]$/.test(s) ? s : `${s}.`);
      body += `<p>${sentences.join(' ')}</p>`;
    }

    // Compute the reply-to override UP FRONT so the email body never makes a
    // "just reply yes" promise that the system can't actually keep. We only
    // route inbound replies back into respondToMatch when Resend Inbound is
    // configured (REPLY_INBOUND_DOMAIN + RESEND_INBOUND_SECRET). Without it,
    // a reply lands in REPLY_TO_EMAIL (a human inbox) and never auto-accepts
    // the match — so we must NOT tell the user to "just reply yes".
    let replyToOverride: string | undefined;
    const inboundReplyEnabled = !!(
      env.REPLY_INBOUND_DOMAIN &&
      matchDetails?.matchId &&
      matchDetails?.recipientUserId
    );
    if (inboundReplyEnabled && matchDetails?.matchId && matchDetails?.recipientUserId) {
      const localPart = createInboundReplyLocalPart(matchDetails.matchId, matchDetails.recipientUserId);
      replyToOverride = `${localPart}@${env.REPLY_INBOUND_DOMAIN}`;
    }

    // LinkedIn line. The "reply 'send LinkedIn'" prompt is also gated on
    // inbound replies being wired up — otherwise it's another broken promise.
    if (matchDetails?.linkedinUrl) {
      body += `<p>Here's ${matchFirst}'s LinkedIn so you can take a closer look: ${link(matchDetails.linkedinUrl, matchDetails.linkedinUrl)}.</p>`;
    } else if (inboundReplyEnabled) {
      body += `<p>I'm pulling ${matchFirst}'s LinkedIn for you — reply "send LinkedIn" and I'll forward it right away.</p>`;
    } else {
      body += `<p>I'll surface ${matchFirst}'s LinkedIn on your matches page once I have it.</p>`;
    }

    body += `<p>I matched you two at <strong>${scorePercent}%</strong> compatibility based on what each of you is looking for.</p>`;

    // One-click Accept / Decline buttons. If we have a matchId + recipient
    // userId we generate signed tokens so the user can respond without ever
    // logging in. Falls back to the dashboard link if those are missing
    // (legacy callers that don't pass matchId yet).
    if (matchDetails?.matchId && matchDetails?.recipientUserId) {
      const acceptToken = createMatchActionToken({
        matchId: matchDetails.matchId,
        userId: matchDetails.recipientUserId,
        action: 'accept',
      });
      const declineToken = createMatchActionToken({
        matchId: matchDetails.matchId,
        userId: matchDetails.recipientUserId,
        action: 'decline',
      });
      const acceptUrl = `${env.BACKEND_URL}/api/match/respond?token=${acceptToken}`;
      const declineUrl = `${env.BACKEND_URL}/api/match/respond?token=${declineToken}`;
      body += `<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td align="center">`;
      body += `<a href="${acceptUrl}" style="display:inline-block;padding:12px 28px;background:${brandColor};color:#fff;font-weight:600;font-size:15px;border-radius:8px;text-decoration:none;margin:4px 8px;">Yes, make the intro →</a>`;
      body += `<a href="${declineUrl}" style="display:inline-block;padding:12px 28px;background:#f1f5f9;color:#475569;font-weight:600;font-size:15px;border-radius:8px;text-decoration:none;margin:4px 8px;">Not this one</a>`;
      body += `</td></tr></table>`;
      if (inboundReplyEnabled) {
        body += `<p style="font-size:13px;color:#64748b;">One click — no login needed. Or just reply "yes" to this email and I'll handle the rest.</p>`;
      } else {
        body += `<p style="font-size:13px;color:#64748b;">One click — no login needed.</p>`;
      }
    } else {
      body += `<p>${link('Review this introduction →', `${env.FRONTEND_URL}/matches`)}</p>`;
      if (inboundReplyEnabled) {
        body += `<p><strong>Want me to make the intro?</strong> Just reply "yes" and once I have ${matchFirst}'s confirmation, I'll send the warm intro to both of you over email.</p>`;
      } else {
        body += `<p><strong>Want me to make the intro?</strong> Open your matches page and tap accept — once I have ${matchFirst}'s confirmation, I'll send the warm intro to both of you over email.</p>`;
      }
    }

    body += `<p>— Cleya</p>`;

    const html = plainEmailLayout(body);

    // Hooky subject line — always describes the person, never discloses
    // money. Order of preference: company + sector → company → sector +
    // persona → persona alone.
    let subject: string;
    const sectorBit = sectorPretty ? `${sectorPretty} ` : '';
    if (matchPersona === 'FOUNDER' && matchDetails?.companyName && sectorPretty) {
      subject = `${firstName}, you should meet ${matchFirst} — ${sectorPretty} founder at ${matchDetails.companyName}`;
    } else if (matchPersona === 'FOUNDER' && matchDetails?.companyName) {
      subject = `${firstName}, you should meet ${matchFirst} — founder at ${matchDetails.companyName}`;
    } else if (matchPersona === 'INVESTOR' && sectorPretty) {
      subject = `${firstName}, you should meet ${matchFirst} — ${sectorPretty} investor`;
    } else if (matchPersona === 'INVESTOR') {
      subject = `${firstName}, you should meet ${matchFirst} — investor`;
    } else if (sectorBit) {
      subject = `${firstName}, you should meet ${matchFirst} — ${sectorBit.trim()} ${personaPretty}`;
    } else {
      subject = `${firstName}, you should meet ${matchFirst} — ${personaPretty}`;
    }
    await this.send(recipientEmail, subject, html, {
      ...(replyToOverride ? { replyTo: replyToOverride } : {}),
      userId: matchDetails?.recipientUserId ?? null,
      emailKey: 'match_proposed',
    });
  }

  /**
   * Instant acknowledgement when a user accepts or declines via email.
   * Fired from the one-click match action route AND from the Resend Inbound
   * webhook so both paths give the same "OK, I have conveyed your message"
   * confirmation the user expects.
   */
  async sendIntroResponseAck(opts: {
    to: string;
    responderName: string;
    partnerName: string;
    action: 'accept' | 'decline';
    bothAccepted: boolean;
  }): Promise<boolean> {
    const first = opts.responderName?.split(' ')[0] || 'there';
    const partnerFirst = opts.partnerName?.split(' ')[0] || opts.partnerName;
    let body = `<p>Hi ${first},</p>`;

    if (opts.action === 'decline') {
      body += `<p>Got it — I won't push this one through. Thanks for the quick reply; it helps me curate sharper introductions for you next time.</p>`;
      body += `<p>— Cleya</p>`;
      return await this.send(
        opts.to,
        `Noted — passing on the intro with ${partnerFirst}`,
        plainEmailLayout(body),
      );
    }

    if (opts.bothAccepted) {
      body += `<p>${opts.partnerName} also said yes. The warm introduction is hitting both your inboxes right now — one shared thread, contacts already exchanged. Take it from there.</p>`;
      body += `<p>— Cleya</p>`;
      return await this.send(
        opts.to,
        `You're connected with ${partnerFirst} — intro sent`,
        plainEmailLayout(body),
      );
    }

    body += `<p>OK, I've conveyed your interest to <strong>${opts.partnerName}</strong>. The moment they say yes too, I'll send the warm intro to both of you over email so you can take it from there.</p>`;
    body += `<p>I'll keep you posted.</p>`;
    body += `<p>— Cleya</p>`;
    return await this.send(
      opts.to,
      `Got it — I'll reach out to ${partnerFirst}`,
      plainEmailLayout(body),
    );
  }

  /**
   * Joint introduction email.
   *
   * Fires ONE email with BOTH parties on To:, so they share a single thread
   * (a shared "to person-a, me" pattern). Reply-To is set
   * to both addresses so a Reply naturally lands in the OTHER person's inbox
   * — no more bouncing off hello@cleya.ai because hitting Reply replies to
   * the partner's mailbox, not to a non-existent Cleya alias.
   *
   * This is what should fire automatically the moment the second person
   * accepts a match — it is the actual "warm intro" that makes the network
   * worth being in.
   */
  async sendMatchIntroJoint(opts: {
    emailA: string;
    nameA: string;
    emailB: string;
    nameB: string;
    personaA?: string;
    personaB?: string;
    headlineA?: string;
    headlineB?: string;
    companyA?: string;
    companyB?: string;
    sectorA?: string;
    sectorB?: string;
    locationA?: string;
    locationB?: string;
    tractionA?: string;
    tractionB?: string;
    linkedinA?: string;
    linkedinB?: string;
    matchReason?: string;
    talkingPoints?: string[];
  }): Promise<boolean> {
    // HTML-escape every user-controlled field. Names, headlines, company
    // names, match reason, talking points and even sector strings can all
    // contain characters that would otherwise inject markup or scripts
    // into the recipient's mail client.
    const esc = (s: string) =>
      s.replace(/[<>&"']/g, (c) => (
        { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] as string
      ));
    const escOpt = (s?: string) => (s ? esc(s) : undefined);

    const firstA = esc((opts.nameA || '').split(' ')[0] || 'there');
    const firstB = esc((opts.nameB || '').split(' ')[0] || 'there');

    const personMeta = (
      persona?: string,
      company?: string,
      sector?: string,
      location?: string
    ) => {
      const parts: string[] = [];
      if (persona) parts.push(esc(persona.replace(/_/g, ' ').toLowerCase()));
      if (company) parts.push(esc(company));
      if (sector) parts.push(esc(sector.replace(/_/g, ' ').toLowerCase()));
      if (location) parts.push(esc(location));
      return parts.join(' · ');
    };

    const personCard = (
      name: string,
      headline?: string,
      meta?: string,
      traction?: string,
      email?: string,
      linkedin?: string
    ) => {
      let card = `<table width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;"><tr><td style="padding:18px;">`;
      card += `<p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#1e293b;">${esc(name)}</p>`;
      if (headline) card += `<p style="margin:0 0 4px;font-size:13px;color:#64748b;">${esc(headline)}</p>`;
      if (meta) card += `<p style="margin:0 0 8px;font-size:12px;color:#94a3b8;">${meta}</p>`;
      if (traction) card += `<p style="margin:0 0 8px;font-size:13px;color:#334155;">📈 ${esc(traction)}</p>`;
      const links: string[] = [];
      if (email) links.push(`📧 <a href="mailto:${encodeURIComponent(email)}" style="color:${brandColor};">${esc(email)}</a>`);
      if (linkedin) {
        // Only allow http(s) URLs in href to block javascript: payloads.
        const safeUrl = /^https?:\/\//i.test(linkedin) ? linkedin : '#';
        links.push(`🔗 <a href="${esc(safeUrl)}" style="color:${brandColor};">LinkedIn</a>`);
      }
      if (links.length) card += `<p style="margin:0;font-size:13px;">${links.join(' &nbsp;·&nbsp; ')}</p>`;
      card += `</td></tr></table>`;
      return card;
    };

    let body = `<p>Hi ${firstA} and ${firstB},</p>`;
    body += `<p>Excited to introduce you two — I think there's a real reason for this conversation to happen.</p>`;
    if (opts.matchReason) {
      body += `<p style="line-height:1.6;">${esc(opts.matchReason)}</p>`;
    }

    body += personCard(
      opts.nameA,
      escOpt(opts.headlineA),
      personMeta(opts.personaA, opts.companyA, opts.sectorA, opts.locationA),
      escOpt(opts.tractionA),
      opts.emailA,
      opts.linkedinA
    );
    body += personCard(
      opts.nameB,
      escOpt(opts.headlineB),
      personMeta(opts.personaB, opts.companyB, opts.sectorB, opts.locationB),
      escOpt(opts.tractionB),
      opts.emailB,
      opts.linkedinB
    );

    if (opts.talkingPoints && opts.talkingPoints.length > 0) {
      body += `<p style="margin-top:20px;font-weight:600;color:#1e293b;">A few things you could dig into:</p>`;
      body += `<ul style="margin:0 0 16px;padding-left:20px;color:#334155;line-height:1.6;">`;
      for (const tp of opts.talkingPoints.slice(0, 5)) {
        body += `<li style="margin-bottom:6px;">${esc(tp)}</li>`;
      }
      body += `</ul>`;
    }

    body += `<p style="margin-top:20px;">I'll let you two take it from here — just hit Reply All and pick a time that works.</p>`;
    body += `<p style="font-size:13px;color:#94a3b8;">Tip: first impressions matter — try to reply within 24 hours while this is top-of-mind.</p>`;
    body += `<p>Cheers,<br>Cleya</p>`;

    const html = plainEmailLayout(body);
    const subject = `Cleya intro: ${opts.nameA} ↔ ${opts.nameB}`;

    try {
      const { client, fromEmail } = await getUncachableResendClient();
      const senderEmail = fromEmail || env.FROM_EMAIL;
      const from = `Cleya from Cleya.ai <${senderEmail}>`;
      const text = htmlToPlainText(html);

      // Both recipients on To: + Reply-To set to both, so a Reply-All
      // naturally CCs the partner and a plain Reply still lands in a real
      // mailbox (never on the unprovisioned hello@cleya.ai alias).
      // Resend SDK accepts string | string[] for reply_to.
      // List-Unsubscribe headers retained for Gmail/Yahoo 2024 deliverability.
      const unsubscribeUrlA = `${env.FRONTEND_URL}/unsubscribe?email=${encodeURIComponent(opts.emailA)}`;
      const result = await client.emails.send({
        from,
        to: [opts.emailA, opts.emailB],
        subject,
        html,
        text,
        reply_to: [opts.emailA, opts.emailB],
        headers: {
          'List-Unsubscribe': `<${unsubscribeUrlA}>, <mailto:unsubscribe@cleya.ai?subject=unsubscribe>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      } as any);

      if (result.error) {
        console.error(`📧 Joint intro email error to ${opts.emailA},${opts.emailB}:`, result.error);
        return false;
      }
      console.log(`📧 Joint intro sent: ${opts.emailA} ↔ ${opts.emailB} (id: ${result.data?.id})`);
      return true;
    } catch (err: any) {
      console.error(`📧 Joint intro email failed:`, err?.message || err);
      return false;
    }
  }

  async sendMatchAccepted(
    recipientEmail: string,
    recipientName: string,
    matchName: string,
    matchPersona: string,
    matchEmail: string,
    matchLinkedin?: string,
    matchDetails?: {
      headline?: string;
      companyName?: string;
      sector?: string;
      location?: string;
      traction?: string;
      matchReason?: string;
      matchUserId?: string;
    }
  ) {
    const firstName = recipientName?.split(' ')[0] || 'there';
    const matchFirstName = matchName?.split(' ')[0] || 'your match';
    let body = `<p>Hi ${firstName},</p>`;
    body += `<p>Great news — both you and <strong>${matchName}</strong> want to connect!</p>`;

    body += `<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">`;
    body += `<tr><td style="padding:20px;">`;
    body += `<p style="margin:0 0 4px;font-size:18px;font-weight:600;color:#1e293b;">${matchName}</p>`;
    if (matchDetails?.headline) {
      body += `<p style="margin:0 0 4px;font-size:14px;color:#64748b;">${matchDetails.headline}</p>`;
    }
    const meta: string[] = [];
    if (matchPersona) meta.push(matchPersona);
    if (matchDetails?.companyName) meta.push(matchDetails.companyName);
    if (matchDetails?.sector) meta.push(matchDetails.sector.replace(/_/g, ' '));
    if (matchDetails?.location) meta.push(matchDetails.location);
    if (meta.length) {
      body += `<p style="margin:0 0 12px;font-size:13px;color:#94a3b8;">${meta.join(' · ')}</p>`;
    }
    if (matchDetails?.traction) {
      body += `<p style="margin:0 0 8px;font-size:13px;color:#334155;">📈 ${matchDetails.traction}</p>`;
    }
    if (matchDetails?.matchReason) {
      body += `<p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.5;">${matchDetails.matchReason}</p>`;
    }
    body += `<p style="margin:0;font-size:13px;">📧 <a href="mailto:${matchEmail}" style="color:${brandColor};">${matchEmail}</a>`;
    if (matchLinkedin) {
      body += `<br>🔗 ${link(matchLinkedin, matchLinkedin)}`;
    }
    body += `</p>`;
    body += `</td></tr></table>`;

    const chatUrl = matchDetails?.matchUserId
      ? `${env.FRONTEND_URL}/messages?partner=${matchDetails.matchUserId}`
      : `${env.FRONTEND_URL}/messages`;
    body += `<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;"><tr><td align="center">`;
    body += `<a href="${chatUrl}" style="display:inline-block;padding:12px 32px;background:${brandColor};color:#fff;font-weight:600;font-size:15px;border-radius:8px;text-decoration:none;">Start Chatting →</a>`;
    body += `</td></tr></table>`;

    body += `<p style="font-size:13px;color:#94a3b8;">Pro tip: reach out within 48 hours while the connection is fresh.</p>`;
    body += `<p>— Cleya</p>`;

    const html = plainEmailLayout(body);
    await this.send(recipientEmail, `You and ${matchName} are connected!`, html, {
      emailKey: 'match_accepted',
    });
  }

  async sendPasswordReset(email: string, token: string) {
    const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${token}`;
    const html = plainEmailLayout(`
      <p>Hi,</p>
      <p>We received a request to reset your password. Click below to create a new one:</p>
      <p>${link('Reset your password →', resetUrl)}</p>
      <p>This link expires in 30 minutes. If you didn't request this, you can safely ignore this email.</p>
      <p>— Cleya</p>
    `);
    await this.send(email, 'Reset your Cleya password', html);
  }

  async sendEmailVerification(email: string, token: string) {
    const verifyUrl = `${env.FRONTEND_URL}/verify-email?token=${token}`;
    const html = plainEmailLayout(`
      <p>Hi,</p>
      <p>Quick one — please verify your email to finish setting up your Cleya account:</p>
      <p>${link('Verify email →', verifyUrl)}</p>
      <p>This link expires in 24 hours.</p>
      <p>— Cleya</p>
    `);
    await this.send(email, 'Verify your email — Cleya', html);
  }

  async sendNewMatch(email: string, matchName: string, matchScore: number) {
    const scorePercent = toDisplayPercent(matchScore);
    const matchFirst = matchName?.split(' ')[0] || matchName;
    const html = plainEmailLayout(`
      <p>Hey,</p>
      <p>I'd like to introduce you to <strong>${matchName}</strong> — ${scorePercent}% fit. They're worth your time.</p>
      <p>${link('See the introduction →', `${env.FRONTEND_URL}/matches`)}</p>
      <p>— Cleya</p>
    `);
    await this.send(email, `You should meet ${matchFirst}`, html);
  }

  async sendWeeklyDigest(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user) return;

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [pendingMatches, newMatches, acceptedMatches, topMatches] = await Promise.all([
      prisma.match.count({
        where: {
          OR: [
            { userAId: userId, userAResponse: 'PENDING' },
            { userBId: userId, userBResponse: 'PENDING' },
          ],
          status: { notIn: ['REJECTED', 'EXPIRED'] },
        },
      }),
      prisma.match.count({
        where: {
          OR: [{ userAId: userId }, { userBId: userId }],
          createdAt: { gte: oneWeekAgo },
        },
      }),
      prisma.match.count({
        where: {
          OR: [{ userAId: userId }, { userBId: userId }],
          status: 'ACCEPTED',
          updatedAt: { gte: oneWeekAgo },
        },
      }),
      prisma.match.findMany({
        where: {
          OR: [{ userAId: userId }, { userBId: userId }],
          createdAt: { gte: oneWeekAgo },
          status: { notIn: ['REJECTED', 'EXPIRED'] },
        },
        include: {
          userA: { select: { id: true, name: true, profile: { select: { headline: true, companyName: true, persona: true } } } },
          userB: { select: { id: true, name: true, profile: { select: { headline: true, companyName: true, persona: true } } } },
        },
        orderBy: { score: 'desc' },
        take: 5,
      }),
    ]);

    const name = user.name?.split(' ')[0] || user.profile?.currentRole || user.email.split('@')[0];
    let body = `<p>Hi ${name},</p>`;
    body += `<p>Here's your week with your AI Networker:</p>`;
    body += `<ul style="padding-left:20px;">`;
    body += `<li><strong>${newMatches}</strong> new introduction${newMatches !== 1 ? 's' : ''} curated for you</li>`;
    body += `<li><strong>${acceptedMatches}</strong> conversation${acceptedMatches !== 1 ? 's' : ''} started</li>`;
    if (pendingMatches > 0) {
      body += `<li><strong>${pendingMatches}</strong> introduction${pendingMatches !== 1 ? 's' : ''} waiting for your review</li>`;
    }
    body += `</ul>`;

    if (topMatches.length > 0) {
      body += `<p style="margin-top:24px;"><strong>Top ${topMatches.length} introduction${topMatches.length === 1 ? '' : 's'} this week</strong></p>`;
      body += `<ul style="padding-left:20px;">`;
      for (const m of topMatches) {
        const isA = m.userAId === userId;
        const other = isA ? m.userB : m.userA;
        const headline = other?.profile?.headline || other?.profile?.companyName || other?.name || 'A new connection';
        const persona = other?.profile?.persona ? ` · ${other.profile.persona}` : '';
        const score = toDisplayPercent(m.score);
        body += `<li>${headline}${persona} — <strong>${score}% fit</strong></li>`;
      }
      body += `</ul>`;
    }

    // One-click magic-login CTA — the audit's #1 ask for the digest. With
    // a 15-min TTL session token in the URL, the user lands inside the app
    // logged in. No password screen, no friction — that's what the data
    // says converts the comeback click into an actual return visit.
    let magicCta: string;
    try {
      const { authService } = await import('./authService');
      const magicToken = authService.generateMagicLinkToken(userId);
      const nextPath = pendingMatches > 0 ? '/matches' : '/dashboard';
      const magicUrl = `${env.FRONTEND_URL}/api/auth/magic?token=${encodeURIComponent(magicToken)}&next=${encodeURIComponent(nextPath)}`;
      magicCta = pendingMatches > 0
        ? `<p>Don't leave them hanging — <a href="${magicUrl}" style="color:${brandColor};font-weight:600;">review your introductions (one click, no login) →</a></p>`
        : `<p><a href="${magicUrl}" style="color:${brandColor};font-weight:600;">See your dashboard (one click, no login) →</a></p>`;
    } catch {
      magicCta = pendingMatches > 0
        ? `<p>Don't leave them hanging — ${link('review your introductions →', `${env.FRONTEND_URL}/matches`)}</p>`
        : `<p>${link('See your dashboard →', `${env.FRONTEND_URL}/dashboard`)}</p>`;
    }
    body += magicCta;

    // Profile strength tip
    try {
      const score = (user.profile as any)?.profileScore ?? 0;
      if (score < 100) {
        body += `<p style="margin-top:24px;color:#555;"><strong>Profile tip:</strong> Your profile is ${score}% complete. ${link('Finish your profile →', `${env.FRONTEND_URL}/profile`)} so I can curate sharper introductions.</p>`;
      }
    } catch {}

    body += `<p>— Cleya</p>`;

    const html = plainEmailLayout(body);
    const subject = `Your week: ${newMatches} new introduction${newMatches !== 1 ? 's' : ''} from Cleya`;
    const ok = await this.send(user.email, subject, html, { userId, emailKey: 'weekly_digest' });
    if (ok) {
      // Mirror to in-app notifications so the bell shows the digest too.
      const { recordEmailSent } = await import('./notificationMirror');
      recordEmailSent({ userId, emailKey: 'weekly_digest', subject, metadata: { newMatches, pendingMatches, acceptedMatches } }).catch(() => {});
    }
  }

  async sendMeetingInvite(
    to: string,
    otherName: string,
    title: string,
    meetingTime: Date,
    duration: number,
    meetingUrl: string | null
  ) {
    const timeStr = meetingTime.toLocaleDateString('en-IN', {
      weekday: 'long', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata',
    });
    let body = `<p>Hi,</p>`;
    body += `<p>You have a meeting coming up with <strong>${otherName}</strong>:</p>`;
    body += `<p>📅 <strong>${title}</strong><br>`;
    body += `🕐 ${timeStr} IST<br>`;
    body += `⏱ ${duration} minutes`;
    if (meetingUrl) {
      body += `<br>🔗 ${link('Join meeting', meetingUrl)}`;
    }
    body += `</p>`;
    body += `<p>— Cleya</p>`;

    const html = plainEmailLayout(body);
    await this.send(to, `Meeting with ${otherName} — ${timeStr}`, html);
  }

  async sendFollowup(to: string, subject: string, body: string) {
    const html = plainEmailLayout(`
      <div style="white-space:pre-line;line-height:1.7;">${body}</div>
      <p style="margin-top:16px;">— Cleya</p>
    `);
    await this.send(to, subject, html);
  }

  async sendDailyDigest(to: string, digestContent: string) {
    const html = plainEmailLayout(`
      <p>Hey,</p>
      <p>Here's what's new in your Cleya network today:</p>
      <div style="white-space:pre-line;line-height:1.7;">${digestContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</div>
      <p>${link('Open your dashboard →', `${env.FRONTEND_URL}/dashboard`)}</p>
      <p>— Cleya</p>
    `);
    await this.send(to, `What's new in your network — Cleya`, html);
  }

  async sendIntroductionEmail(
    recipientEmail: string,
    recipientName: string,
    introPersonName: string,
    introBody: string,
    linkedinUrl?: string,
    introDetails?: {
      headline?: string;
      companyName?: string;
      sector?: string;
      location?: string;
      traction?: string;
      matchReason?: string;
      partnerUserId?: string;
    }
  ) {
    let body = `<p>Hi ${recipientName?.split(' ')[0] || 'there'},</p>`;
    body += `<div style="white-space:pre-line;line-height:1.7;">${introBody}</div>`;

    body += `<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">`;
    body += `<tr><td style="padding:20px;">`;
    body += `<p style="margin:0 0 4px;font-size:18px;font-weight:600;color:#1e293b;">${introPersonName}</p>`;
    if (introDetails?.headline) {
      body += `<p style="margin:0 0 4px;font-size:14px;color:#64748b;">${introDetails.headline}</p>`;
    }
    const meta: string[] = [];
    if (introDetails?.companyName) meta.push(introDetails.companyName);
    if (introDetails?.sector) meta.push(introDetails.sector.replace(/_/g, ' '));
    if (introDetails?.location) meta.push(introDetails.location);
    if (meta.length) {
      body += `<p style="margin:0 0 8px;font-size:13px;color:#94a3b8;">${meta.join(' · ')}</p>`;
    }
    if (introDetails?.traction) {
      body += `<p style="margin:0 0 8px;font-size:13px;color:#334155;">${introDetails.traction}</p>`;
    }
    if (introDetails?.matchReason) {
      body += `<p style="margin:0 0 8px;font-size:14px;color:#334155;line-height:1.5;">${introDetails.matchReason}</p>`;
    }
    if (linkedinUrl) {
      body += `<p style="margin:0;font-size:13px;">🔗 ${link(linkedinUrl, linkedinUrl)}</p>`;
    }
    body += `</td></tr></table>`;

    const chatUrl = introDetails?.partnerUserId
      ? `${env.FRONTEND_URL}/messages?partner=${introDetails.partnerUserId}`
      : `${env.FRONTEND_URL}/messages`;
    body += `<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;"><tr><td align="center">`;
    body += `<a href="${chatUrl}" style="display:inline-block;padding:12px 32px;background:${brandColor};color:#fff;font-weight:600;font-size:15px;border-radius:8px;text-decoration:none;">Start Chatting →</a>`;
    body += `</td></tr></table>`;

    body += `<p>— Cleya</p>`;

    const html = plainEmailLayout(body);
    await this.send(recipientEmail, `${recipientName?.split(' ')[0] || 'Hey'}, putting ${introPersonName.split(' ')[0]} on your radar`, html);
  }

  private generateICS(title: string, start: Date, durationMin: number, url: string | null): string {
    const end = new Date(start.getTime() + durationMin * 60000);
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    return [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Cleya.ai//Meeting//EN',
      'BEGIN:VEVENT',
      `DTSTART:${fmt(start)}`, `DTEND:${fmt(end)}`,
      `SUMMARY:${title}`,
      `DESCRIPTION:Scheduled via Cleya.ai`,
      url ? `URL:${url}` : '',
      'END:VEVENT', 'END:VCALENDAR',
    ].filter(Boolean).join('\r\n');
  }

  async sendProfileNudge(email: string, name?: string, teasers?: string[]) {
    const firstName = name?.split(' ')[0] || 'there';

    // Anonymized teaser cards: a tiny, trust-building "look who's already
    // here" preview. Render only when we have at least one teaser; never
    // fall back to fake placeholders.
    const teaserHtml = (teasers && teasers.length > 0)
      ? `
      <p style="margin-bottom:8px;">A peek at the kind of people I'd line up for you:</p>
      <div style="margin:0 0 16px 0;">
        ${teasers.slice(0, 3).map(t => `
          <div style="background:rgba(108,99,255,0.08);border:1px solid rgba(108,99,255,0.25);border-radius:10px;padding:12px 14px;margin-bottom:8px;color:#E5E7EB;font-size:14px;">
            • ${escapeHtml(t)}
          </div>
        `).join('')}
      </div>
      `
      : '';

    const html = plainEmailLayout(`
      <p>Hi ${firstName},</p>
      <p>Quick reminder — you signed up for Cleya but haven't finished your profile yet.</p>
      <p>The more I know about you, the better I can match you with the right people in the ecosystem. It takes about 2 minutes.</p>
      ${teaserHtml}
      <p><strong>${link('Complete your profile →', `${env.FRONTEND_URL}/chat`)}</strong></p>
      <p>— Cleya</p>
    `);
    return this.send(email, `${firstName}, let's finish setting you up on Cleya`, html);
  }

  async sendHowMatchingWorks(email: string, name?: string) {
    const firstName = name?.split(' ')[0] || 'there';
    const html = plainEmailLayout(`
      <p>Hi ${firstName},</p>
      <p>Wanted to give you a quick peek behind the scenes of how I work as your AI Networker:</p>
      <ol style="padding-left:20px;line-height:2;">
        <li><strong>I learn about you</strong> — your story, what you've built, and what you're looking for</li>
        <li><strong>I meet people on your behalf</strong> — quietly scanning the ecosystem to find the few worth your time</li>
        <li><strong>You review & accept</strong> — no spam introductions, you choose who you want to meet</li>
        <li><strong>I make the introduction</strong> — once both sides say yes, I share contact details so the conversation can start</li>
      </ol>
      <p>The best introductions happen when your profile is detailed and up to date.</p>
      <p>${link('See your introductions →', `${env.FRONTEND_URL}/matches`)}</p>
      <p>— Cleya</p>
    `);
    return this.send(email, 'How your AI Networker works — a quick explainer', html);
  }

  /**
   * Dormant comeback email with a one-click magic-login button.
   *
   * Issues a short-TTL JWT, embeds it in a magic-link URL pointing at
   * `/api/auth/magic`. Lands the user in `/matches` with a fresh
   * session — no password, no friction. Sent on day 30 by the
   * ONBOARDING drip if the user has not logged in since signup.
   */
  async sendDormantMagicLink(userId: string, email: string, name?: string): Promise<boolean> {
    const firstName = name?.split(' ')[0] || 'there';
    let magicUrl: string;
    try {
      const { authService } = await import('./authService');
      const token = authService.generateMagicLinkToken(userId);
      magicUrl = `${env.FRONTEND_URL}/api/auth/magic?token=${encodeURIComponent(token)}&next=${encodeURIComponent('/matches')}`;
    } catch (err) {
      console.error('[Email] sendDormantMagicLink token error:', err);
      magicUrl = `${env.FRONTEND_URL}/login`;
    }

    const html = plainEmailLayout(`
      <p>Hi ${firstName},</p>
      <p>Your network on Cleya kept growing while you were away.</p>
      <p>I've been quietly meeting founders, investors and operators in the ecosystem on your behalf. Some of them I'd really like you to see.</p>
      <p style="margin-top:20px;">
        <a href="${magicUrl}" style="display:inline-block;background:${brandColor};color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;">Open Cleya — no password needed →</a>
      </p>
      <p style="color:#666;font-size:13px;margin-top:14px;">This link signs you in for 15 minutes, then expires. If it wasn't you, ignore this email.</p>
      <p>— Cleya</p>
    `);
    return this.send(email, `${firstName}, your network grew while you were away`, html, {
      userId, emailKey: 'dormant_magic_30d',
    });
  }

  /**
   * Day 2: user signed up but stalled mid-onboarding. Drops them straight
   * back into the chat to finish the remaining questions. Hard-skip if
   * profile.isComplete by the time the drip ticks.
   */
  async sendPartialOnboardingNudge(userId: string, email: string, name?: string | null): Promise<boolean> {
    const firstName = (name || '').split(' ')[0] || 'there';
    let url: string;
    try {
      const { authService } = await import('./authService');
      const token = authService.generateMagicLinkToken(userId);
      url = `${env.FRONTEND_URL}/api/auth/magic?token=${encodeURIComponent(token)}&next=${encodeURIComponent('/chat')}`;
    } catch {
      url = `${env.FRONTEND_URL}/chat`;
    }
    const html = plainEmailLayout(`
      <p>Hi ${firstName},</p>
      <p>You're partway through setting up your Cleya profile — just a couple of questions left.</p>
      <p>Every additional answer sharpens the introductions I curate for you. The difference between a 30%-complete profile and a 100%-complete one is the difference between generic suggestions and the right person at the right moment.</p>
      <p style="margin-top:20px;">
        <a href="${url}" style="display:inline-block;background:${brandColor};color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;">Pick up where you left off →</a>
      </p>
      <p style="color:#666;font-size:13px;margin-top:14px;">This link signs you straight in — no password needed.</p>
      <p>— Cleya</p>
    `);
    return this.send(email, `${firstName}, two questions away from your first introductions`, html, {
      userId, emailKey: 'partial_onboarding_2d',
    });
  }

  /**
   * Day 10: user has gone quiet, but new founders / investors have joined
   * since they last visited. Lightweight social-proof pull rather than
   * another "finish your profile" nudge — they've already seen that.
   */
  async sendNewFoundersNudge(userId: string, email: string, name?: string | null, joinedCount?: number): Promise<boolean> {
    const firstName = (name || '').split(' ')[0] || 'there';
    let url: string;
    try {
      const { authService } = await import('./authService');
      const token = authService.generateMagicLinkToken(userId);
      url = `${env.FRONTEND_URL}/api/auth/magic?token=${encodeURIComponent(token)}&next=${encodeURIComponent('/matches')}`;
    } catch {
      url = `${env.FRONTEND_URL}/matches`;
    }
    const headline = joinedCount && joinedCount > 0
      ? `${joinedCount} new founders, investors and operators just joined Cleya`
      : `New founders, investors and operators just joined Cleya`;
    const html = plainEmailLayout(`
      <p>Hi ${firstName},</p>
      <p>${headline} — and a few of them look like a strong fit for what you're working on.</p>
      <p>Take 30 seconds to glance at your queue. If something catches your eye, accept the intro and I'll handle the rest.</p>
      <p style="margin-top:20px;">
        <a href="${url}" style="display:inline-block;background:${brandColor};color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;">See who joined →</a>
      </p>
      <p style="color:#666;font-size:13px;margin-top:14px;">One-click sign-in, no password.</p>
      <p>— Cleya</p>
    `);
    return this.send(email, `${firstName}, new people in your network worth a look`, html, {
      userId, emailKey: 'new_founders_10d',
    });
  }

  /**
   * Generic magic-link email used by the on-demand `/api/auth/magic-link`
   * route. Same look as the dormant email but with neutral copy.
   */
  async sendMagicLink(email: string, magicUrl: string, name?: string | null): Promise<boolean> {
    const firstName = name?.split(' ')[0] || 'there';
    const html = plainEmailLayout(`
      <p>Hi ${firstName},</p>
      <p>Click the button below to sign in to Cleya. This link is valid for 15 minutes and can only be used once.</p>
      <p style="margin-top:20px;">
        <a href="${magicUrl}" style="display:inline-block;background:${brandColor};color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;">Sign in to Cleya →</a>
      </p>
      <p style="color:#666;font-size:13px;margin-top:14px;">If you didn't request this, you can safely ignore this email.</p>
      <p>— Cleya</p>
    `);
    return this.send(email, 'Your Cleya sign-in link', html, { emailKey: 'magic_link' });
  }

  async sendMatchCheckIn(email: string, name?: string) {
    const firstName = name?.split(' ')[0] || 'there';
    const html = plainEmailLayout(`
      <p>Hi ${firstName},</p>
      <p>It's been a week since you joined Cleya — time flies!</p>
      <p>Have you checked your introductions lately? I've been quietly meeting people on your behalf and curating the few worth your time.</p>
      <p>${link('See your introductions →', `${env.FRONTEND_URL}/matches`)}</p>
      <p>If you haven't received any introductions yet, make sure your profile is complete — that's what helps me curate sharper picks for you.</p>
      <p>— Cleya</p>
    `);
    return this.send(email, `${firstName}, your introductions are waiting`, html);
  }

  /**
   * Interim "still working on your matches" email.
   *
   * Sent when a freshly onboarded user still has zero matches after a couple
   * of hours. Matches usually land within 2 hours, so this only fires for
   * users who would otherwise sit on an empty dashboard wondering whether
   * the product is broken. Setting expectations beats silence.
   */
  async sendMatchInterim(email: string, name?: string) {
    const firstName = name?.split(' ')[0] || 'there';
    const html = plainEmailLayout(`
      <p>Hi ${firstName},</p>
      <p>Quick note from me — I'm still meeting people on your behalf to curate your first introductions.</p>
      <p>The right introduction is worth more than a fast one, so I'd rather take a little longer and get it right. I'll be in touch the moment your first introductions are ready.</p>
      <p>In the meantime, anything else I should know about who you'd love to meet? Just hit reply and tell me — I read every response.</p>
      <p>${link('Open your dashboard →', `${env.FRONTEND_URL}/dashboard`)}</p>
      <p>— Cleya</p>
    `);
    return this.send(email, `${firstName}, still curating your first introductions`, html);
  }

  /**
   * Day-1 follow-up: still no matches 24h after onboarding.
   *
   * Fires if the user is *still* sitting on zero matches a day in
   * (gated independently of the 2h send — the only condition is
   * matchCount === 0 at trigger time). Tone matches sendMatchInterim:
   * keep expectations honest, encourage a reply with more context.
   */
  async sendMatchInterimDay1(email: string, name?: string) {
    const firstName = name?.split(' ')[0] || 'there';
    const html = plainEmailLayout(`
      <p>Hi ${firstName},</p>
      <p>Quick update — I'm still meeting people across the ecosystem on your behalf, looking for the right ones to introduce you to.</p>
      <p>I don't yet have an introduction I'd stake my name on, and I'd rather wait for someone genuinely worth your time than send a weak intro just to fill your inbox.</p>
      <p>If there's anything you'd like to add about who you'd love to meet — a specific role, sector, stage, or even a name — just hit reply. Every detail helps me narrow it down.</p>
      <p>${link('Open your dashboard →', `${env.FRONTEND_URL}/dashboard`)}</p>
      <p>— Cleya</p>
    `);
    return this.send(email, `${firstName}, still searching for the right introduction`, html);
  }

  /**
   * Day-2 follow-up: still no matches 48h after onboarding.
   *
   * Polite, confidence-preserving update. Frames the wait as careful
   * curation rather than a shortfall, and sets the expectation that we'll
   * reach out the moment a strong match is ready. After this we go quiet
   * until matches actually appear.
   */
  async sendMatchInterimDay2(email: string, name?: string) {
    const firstName = name?.split(' ')[0] || 'there';
    const html = plainEmailLayout(`
      <p>Hi ${firstName},</p>
      <p>Just a quick note to keep you in the loop — I'm still curating your introductions with care.</p>
      <p>Great introductions take a little time, and I want every one I send you to be genuinely worth your while. Your profile is active, and I'm meeting new people joining Cleya every day with you in mind.</p>
      <p>The moment I find someone truly worth meeting, you'll be the first to know.</p>
      <p>If anything has shifted about who you'd love to meet — a role, a sector, a stage, even a specific name — just hit reply. A small detail often opens the door to a great introduction.</p>
      <p>${link('Open your dashboard →', `${env.FRONTEND_URL}/dashboard`)}</p>
      <p>— Cleya</p>
    `);
    return this.send(email, `${firstName}, a quick update on your introductions`, html);
  }

  /**
   * Onboarding email for someone introduced to Cleya via a referral
   * (typically forwarded an invite or emailed hello@cleya.ai directly).
   * Goal: minimum-friction first response — they can either reply with
   * a quick blurb (and Cleya matches them manually), or tap through to
   * sign up themselves. No sales tone, no list of features. Just a
   * warm "hi, here's the easiest path forward."
   */
  async sendReferralOnboarding(
    email: string,
    opts?: { name?: string; referrerName?: string }
  ) {
    const firstName = opts?.name?.trim().split(/\s+/)[0];
    const greeting = firstName ? `Hi ${firstName},` : `Hi there,`;
    const referrerLine = opts?.referrerName
      ? `<strong>${opts.referrerName}</strong> thought we should meet — and they were right.`
      : `Someone in your corner thought we should meet — and they were right.`;
    const subjectName = firstName ? `${firstName}, ` : '';

    const html = plainEmailLayout(`
      <p>${greeting}</p>
      <p>${referrerLine} I'm Cleya — your AI Networker for India's startup ecosystem. My job is to quietly meet thousands of people on your behalf and introduce you to the few worth your time. No spam, no cold DMs, no random connects.</p>
      <p>To start curating introductions for you, I just need a quick sense of who you are and who you'd like to meet. <strong>Two ways to do this — pick whichever is easier:</strong></p>
      <p style="margin:20px 0;padding:16px 20px;background:#f5f7fb;border-left:3px solid ${brandColor};border-radius:6px;">
        <strong>1. Just hit reply.</strong> Tell me in 2–3 lines:<br/>
        &nbsp;&nbsp;• What you do (role, company, or what you're building)<br/>
        &nbsp;&nbsp;• Who you'd love to meet (a founder, an investor, an operator, a hire — be as specific as you want)<br/>
        I'll take it from there and start curating introductions for you this week.
      </p>
      <p style="margin:20px 0;padding:16px 20px;background:#f5f7fb;border-left:3px solid ${brandColor};border-radius:6px;">
        <strong>2. Or set yourself up in 2 minutes.</strong> ${link('Sign up at cleya.ai →', `${env.FRONTEND_URL}/?action=signup`)} and chat with me directly. I'll learn your story and start curating introductions automatically.
      </p>
      <p>Either path works. Whatever takes the least effort on your end.</p>
      <p>Looking forward to it.</p>
      <p>— Cleya<br/><span style="color:#888;font-style:italic;">Your AI Networker, on call.</span></p>
    `);
    return this.send(email, `${subjectName}welcome to Cleya — let's get you introduced`, html);
  }

  async sendPostIntroFollowUp(email: string, name?: string, matchName?: string) {
    const firstName = name?.split(' ')[0] || 'there';
    const matchFirst = matchName?.split(' ')[0] || 'the person I introduced you to';
    const html = plainEmailLayout(`
      <p>Hi ${firstName},</p>
      <p>It's been a few days since I introduced you to <strong>${matchFirst}</strong>. How did it go?</p>
      <p>Whether it was a great conversation or didn't quite click — I'd love to hear. Your feedback helps me curate sharper introductions for you.</p>
      <p>${link('Share your feedback →', `${env.FRONTEND_URL}/matches`)}</p>
      <p>— Cleya</p>
    `);
    return this.send(email, `How was your intro with ${matchFirst}?`, html);
  }

  /**
   * Sent 72h after a match is proposed if the recipient has neither
   * accepted nor declined. We give them four single-tap reasons so we
   * can quietly improve future curation. Each button is a signed
   * feedback URL that records a MatchFeedback row server-side.
   */
  async sendNonResponseFeedback(opts: {
    to: string;
    recipientName: string;
    partnerName: string;
    matchId: string;
    recipientUserId: string;
  }): Promise<boolean> {
    const { createFeedbackToken, FEEDBACK_REASONS, FEEDBACK_REASON_LABELS } =
      await import('./matchActionToken');
    const firstName = opts.recipientName?.split(' ')[0] || 'there';
    const partnerFirst = opts.partnerName?.split(' ')[0] || 'them';
    const base = env.BACKEND_URL || `http://localhost:${env.PORT || 3001}`;

    const buttons = FEEDBACK_REASONS.map((reason) => {
      const token = createFeedbackToken({
        matchId: opts.matchId,
        userId: opts.recipientUserId,
        reason,
      });
      const url = `${base}/api/match/feedback?token=${encodeURIComponent(token)}`;
      return `<a href="${url}" style="display:inline-block;margin:4px 6px 4px 0;padding:10px 16px;background:rgba(108,99,255,0.1);border:1px solid rgba(108,99,255,0.4);color:#ffffff;text-decoration:none;border-radius:8px;font-size:13px;">${escapeHtml(FEEDBACK_REASON_LABELS[reason])}</a>`;
    }).join('');

    const html = plainEmailLayout(`
      <p>Hi ${escapeHtml(firstName)},</p>
      <p>I sent over an introduction to <strong>${escapeHtml(partnerFirst)}</strong> a few days ago and hadn't heard back. No pressure either way — but a single tap below would help me curate sharper picks for you next time.</p>
      <p style="margin:8px 0 4px;font-weight:600;">Why didn't this one land?</p>
      <div style="margin:8px 0 16px;">${buttons}</div>
      <p style="font-size:13px;color:#9CA3AF;">If you'd still like to say yes, ${link('open the introduction', `${env.FRONTEND_URL}/matches`)} — it's still waiting.</p>
      <p>— Cleya</p>
    `);
    return this.send(opts.to, `Quick tap: was ${partnerFirst} the wrong fit?`, html);
  }

  async sendFeedbackRequest(email: string, name?: string, matchName?: string) {
    const firstName = name?.split(' ')[0] || 'there';
    const matchFirst = matchName?.split(' ')[0] || 'your recent introduction';
    const html = plainEmailLayout(`
      <p>Hi ${firstName},</p>
      <p>Would you take 30 seconds to rate your conversation with <strong>${matchFirst}</strong>?</p>
      <p>A quick rating and a line or two of feedback goes a long way — it helps me learn what works for you and makes future introductions even sharper.</p>
      <p>${link('Rate this introduction →', `${env.FRONTEND_URL}/matches`)}</p>
      <p>Thanks for helping make Cleya better for everyone.</p>
      <p>— Cleya</p>
    `);
    return this.send(email, `Quick feedback on your introduction with ${matchFirst}?`, html);
  }

  async sendReferralInvite(userId: string, opts?: { earlyAccessBonus?: boolean; force?: boolean }) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true, referralCode: true, isActive: true, role: true, referralInviteSentAt: true },
    });
    if (!user || !user.email || !user.isActive) return false;
    // Dedup: skip if we already sent this campaign within the last 7 days,
    // unless explicitly forced (e.g. admin re-test for a single user).
    if (!opts?.force && user.referralInviteSentAt) {
      const ageDays = (Date.now() - user.referralInviteSentAt.getTime()) / 86400000;
      if (ageDays < 7) {
        console.log(`📧 Referral invite skipped (sent ${ageDays.toFixed(1)}d ago) for ${user.email}`);
        return false;
      }
    }
    const firstName = user.name?.split(' ')[0] || 'there';
    let code = user.referralCode;
    if (!code) {
      // Persist a unique referralCode before sending. Retry on @unique collision.
      const base = (user.name || 'cleya').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'cleya';
      let saved: string | null = null;
      for (let attempt = 0; attempt < 5 && !saved; attempt++) {
        const candidate = `${base}${Math.random().toString(36).slice(2, 7)}`;
        try {
          await prisma.user.update({ where: { id: userId }, data: { referralCode: candidate } });
          saved = candidate;
        } catch (err: any) {
          if (err?.code !== 'P2002') {
            console.error(`📧 Referral code persist failed for ${userId}:`, err?.message || err);
            return false;
          }
          // unique collision — try again
        }
      }
      if (!saved) {
        console.error(`📧 Could not assign a unique referral code for ${userId} after retries`);
        return false;
      }
      code = saved;
    }
    const link = `${env.FRONTEND_URL}/?ref=${code}`;
    const bonus = opts?.earlyAccessBonus ? 10 : 5;
    const bonusLine = opts?.earlyAccessBonus
      ? `As an early member, you get <strong>${bonus} bonus intros per friend</strong> (double the usual) when they finish their profile — only this week.`
      : `You'll get <strong>${bonus} bonus intros</strong> for each friend who joins and completes their profile.`;

    const html = plainEmailLayout(`
      <p>Hi ${firstName},</p>
      <p>Quick ask — if there are 1 or 2 people in your circle who'd genuinely benefit from warm intros in the Indian startup ecosystem, would you forward this to them?</p>
      <p>${bonusLine}</p>
      <p>The easiest way: <strong>just forward this email</strong> and tell them what you're getting out of Cleya. Or share your link directly:</p>
      <p style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;font-family:monospace;font-size:13px;word-break:break-all;">${link}</p>
      <p style="color:#64748b;font-size:13px;">Manage referrals: ${link.replace('/?ref=' + code, '/referral')}</p>
      <p>— Cleya</p>
      <hr style="border:none;border-top:1px solid #eee;margin:28px 0 16px;"/>
      <p style="color:#64748b;font-size:13px;margin:0 0 8px;"><em>Forward-friendly note you can copy:</em></p>
      <blockquote style="margin:0;padding:12px 16px;border-left:3px solid ${brandColor};background:#f8fafc;color:#334155;font-size:14px;line-height:1.6;">
        Hey — I've been using Cleya.ai. It's basically an AI Networker for the Indian startup ecosystem: it quietly meets thousands of founders, investors, and operators on your behalf and only introduces you to the few worth your time. No spam, no random adds. Worth 2 minutes to set up.<br/><br/>
        Sign up here: ${link}
      </blockquote>
    `);
    const result = await this.send(user.email, `${firstName}, a small favour (and ${bonus} bonus intros)`, html);
    if (result) {
      await prisma.user.update({ where: { id: userId }, data: { referralInviteSentAt: new Date() } }).catch(() => null);
    }
    return result;
  }

  async sendReferralInviteToAll(opts?: { earlyAccessBonus?: boolean; limit?: number; dryRun?: boolean }) {
    const users = await prisma.user.findMany({
      where: { role: 'USER', isActive: true },
      select: { id: true, email: true },
      orderBy: { createdAt: 'asc' },
      ...(opts?.limit ? { take: opts.limit } : {}),
    });
    if (opts?.dryRun) return { sent: 0, failed: 0, total: users.length, dryRun: true };
    let sent = 0, failed = 0;
    for (const u of users) {
      try {
        const ok = await this.sendReferralInvite(u.id, { earlyAccessBonus: opts?.earlyAccessBonus });
        if (ok) sent++; else failed++;
      } catch (err) {
        console.error(`Referral invite failed for ${u.id}:`, err);
        failed++;
      }
      // Gentle pacing to respect Resend rate limits
      await new Promise(r => setTimeout(r, 250));
    }
    return { sent, failed, total: users.length };
  }

  async sendDigestToAll() {
    const users = await prisma.user.findMany({
      where: { role: 'USER', isActive: true },
      select: { id: true },
    });
    let sent = 0;
    let failed = 0;
    for (const u of users) {
      try {
        await this.sendWeeklyDigest(u.id);
        sent++;
      } catch (err) {
        console.error(`Digest failed for ${u.id}:`, err);
        failed++;
      }
    }
    return { sent, failed, total: users.length };
  }
}

export const emailService = new EmailService();
