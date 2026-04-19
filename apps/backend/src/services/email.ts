import { env } from '../config/env';
import { prisma } from '@cleya/db';
import { getUncachableResendClient } from './resendClient';

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
<p style="color:#999;font-size:12px;margin:16px 0 0;">Cleya.ai — AI Superconnector for India's startup ecosystem</p>
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

  private async send(to: string, subject: string, html: string): Promise<boolean> {
    try {
      const { client, fromEmail } = await getUncachableResendClient();
      const senderEmail = fromEmail || env.FROM_EMAIL;
      // Personal-looking sender increases the chance Gmail files this in
      // Primary instead of Updates/Promotions.
      const from = `Cleya from Cleya.ai <${senderEmail}>`;
      const replyTo = process.env.REPLY_TO_EMAIL || senderEmail;

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

      console.log(`📧 Email sent to ${to}: ${subject} (id: ${result.data?.id})`);
      this.resendAvailable = true;
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

  async sendWelcome(email: string) {
    const html = plainEmailLayout(`
      <p>Hey there,</p>
      <p>Welcome to Cleya — I'm your AI superconnector for India's startup ecosystem.</p>
      <p>Here's how I work: I personally get to know everyone in the network — your story, what you've built, and what you're looking for. Then I make warm, specific introductions where there's a genuine fit.</p>
      <p>No spam. No random connects. Just the right people, at the right time.</p>
      <p><strong>Your next step:</strong> ${link('Tell me about yourself', `${env.FRONTEND_URL}/chat`)} in a quick chat so I can start finding your best matches.</p>
      <p>Looking forward to connecting you with some incredible people.</p>
      <p>— Cleya</p>
    `);
    await this.send(email, 'Welcome to Cleya — let\'s find your people', html);
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
    }
  ) {
    const firstName = recipientName?.split(' ')[0] || 'there';
    const matchFirst = matchName?.split(' ')[0] || 'them';
    const scorePercent = Math.round(matchScore * 100);
    const sectorPretty = matchDetails?.sector
      ? matchDetails.sector.replace(/_/g, ' ').toLowerCase()
      : '';
    const raiseFmt = formatMoney(matchDetails?.raiseAmount, { defaultCurrency: 'INR' });
    const personaPretty = (matchPersona || 'professional').toLowerCase().replace(/_/g, ' ');

    let body = `<p>Hi ${firstName},</p>`;

    // Lead paragraph — every sentence starts with a capital letter.
    body += `<p>Wanted to put <strong>${matchName}</strong> on your radar`;
    if (matchDetails?.companyName && raiseFmt) {
      body += ` — ${matchFirst} is raising <strong>${raiseFmt}</strong>`;
      if (matchDetails.companyName) body += ` for ${matchDetails.companyName}`;
      if (sectorPretty) body += `, building in ${sectorPretty}`;
      body += `.`;
    } else if (matchDetails?.companyName) {
      body += ` — ${personaPretty} at ${matchDetails.companyName}`;
      if (sectorPretty) body += ` in ${sectorPretty}`;
      body += `.`;
    } else {
      body += ` — ${personaPretty}.`;
    }
    body += `</p>`;

    // Second paragraph — capitalize the first letter of every sentence.
    const reasonText = matchDetails?.matchReason
      || matchDetails?.traction
      || matchDetails?.bio;
    if (reasonText) {
      const sentences = String(reasonText)
        .split(/(?<=[.!?])\s+/)
        .map(s => s.trim())
        .filter(Boolean)
        .map(cap);
      body += `<p>${sentences.join(' ')}</p>`;
    }

    // LinkedIn line — show the actual URL when we have it, otherwise offer to fetch it.
    if (matchDetails?.linkedinUrl) {
      body += `<p>Here is ${matchFirst}'s LinkedIn so you can take a closer look: ${link(matchDetails.linkedinUrl, matchDetails.linkedinUrl)}</p>`;
    } else {
      body += `<p>I'm pulling ${matchFirst}'s LinkedIn for you — reply "send LinkedIn" and I'll forward it right away.</p>`;
    }

    body += `<p>I matched you two at <strong>${scorePercent}%</strong> compatibility. ${link('Review this match →', `${env.FRONTEND_URL}/matches`)}</p>`;

    // Closer CTA — explicit consent gate before warm intro.
    body += `<p><strong>Want me to make the intro?</strong> Just reply "yes" (or hit Accept on the link above) and once I have ${matchFirst}'s confirmation, I'll send the warm intro to both of you over email.</p>`;
    body += `<p>— Cleya</p>`;

    const html = plainEmailLayout(body);

    // Punchy subject line built from the match's profile, not generic.
    let subject: string;
    const sectorBit = sectorPretty ? `${sectorPretty} ` : '';
    if (matchPersona === 'FOUNDER' && raiseFmt) {
      subject = `${firstName}, want to connect with ${matchFirst} — ${sectorBit}founder raising ${raiseFmt}?`;
    } else if (matchPersona === 'FOUNDER' && matchDetails?.companyName) {
      subject = `${firstName}, want to connect with ${matchFirst} — ${sectorBit}founder at ${matchDetails.companyName}?`;
    } else if (matchPersona === 'INVESTOR') {
      subject = `${firstName}, want to connect with ${matchFirst} — ${sectorBit}investor?`;
    } else if (sectorBit) {
      subject = `${firstName}, want to connect with ${matchFirst} (${sectorBit.trim()} ${personaPretty})?`;
    } else {
      subject = `${firstName}, want to connect with ${matchFirst} (${personaPretty})?`;
    }
    await this.send(recipientEmail, subject, html);
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
    await this.send(recipientEmail, `You and ${matchName} are connected!`, html);
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
    const scorePercent = Math.round(matchScore * 100);
    const html = plainEmailLayout(`
      <p>Hey,</p>
      <p>Found someone great for you — <strong>${matchName}</strong>, ${scorePercent}% compatibility.</p>
      <p>${link('Check them out →', `${env.FRONTEND_URL}/matches`)}</p>
      <p>— Cleya</p>
    `);
    await this.send(email, `New match: ${matchName} (${scorePercent}%)`, html);
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
    body += `<p>Here's your week in the Cleya network:</p>`;
    body += `<ul style="padding-left:20px;">`;
    body += `<li><strong>${newMatches}</strong> new match${newMatches !== 1 ? 'es' : ''} found</li>`;
    body += `<li><strong>${acceptedMatches}</strong> connection${acceptedMatches !== 1 ? 's' : ''} made</li>`;
    if (pendingMatches > 0) {
      body += `<li><strong>${pendingMatches}</strong> match${pendingMatches !== 1 ? 'es' : ''} waiting for your review</li>`;
    }
    body += `</ul>`;

    if (topMatches.length > 0) {
      body += `<p style="margin-top:24px;"><strong>Top ${topMatches.length} match${topMatches.length === 1 ? '' : 'es'} this week</strong></p>`;
      body += `<ul style="padding-left:20px;">`;
      for (const m of topMatches) {
        const isA = m.userAId === userId;
        const other = isA ? m.userB : m.userA;
        const headline = other?.profile?.headline || other?.profile?.companyName || other?.name || 'A new connection';
        const persona = other?.profile?.persona ? ` · ${other.profile.persona}` : '';
        const score = Math.round(m.score * 100);
        body += `<li>${headline}${persona} — <strong>${score}% fit</strong></li>`;
      }
      body += `</ul>`;
    }

    if (pendingMatches > 0) {
      body += `<p>Don't leave them hanging — ${link('review your matches →', `${env.FRONTEND_URL}/matches`)}</p>`;
    } else {
      body += `<p>${link('See your dashboard →', `${env.FRONTEND_URL}/dashboard`)}</p>`;
    }

    // Profile strength tip
    try {
      const score = (user.profile as any)?.profileScore ?? 0;
      if (score < 100) {
        body += `<p style="margin-top:24px;color:#555;"><strong>Profile tip:</strong> Your profile is ${score}% complete. ${link('Finish your profile →', `${env.FRONTEND_URL}/profile`)} for better matches.</p>`;
      }
    } catch {}

    body += `<p>— Cleya</p>`;

    const html = plainEmailLayout(body);
    await this.send(user.email, `Your week: ${newMatches} new match${newMatches !== 1 ? 'es' : ''} on Cleya`, html);
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

  async sendProfileNudge(email: string, name?: string) {
    const firstName = name?.split(' ')[0] || 'there';
    const html = plainEmailLayout(`
      <p>Hi ${firstName},</p>
      <p>Quick reminder — you signed up for Cleya but haven't finished your profile yet.</p>
      <p>The more I know about you, the better I can match you with the right people in the ecosystem. It takes about 2 minutes.</p>
      <p><strong>${link('Complete your profile →', `${env.FRONTEND_URL}/chat`)}</strong></p>
      <p>— Cleya</p>
    `);
    return this.send(email, `${firstName}, let's finish setting you up on Cleya`, html);
  }

  async sendHowMatchingWorks(email: string, name?: string) {
    const firstName = name?.split(' ')[0] || 'there';
    const html = plainEmailLayout(`
      <p>Hi ${firstName},</p>
      <p>Wanted to give you a quick peek behind the scenes of how Cleya matches work:</p>
      <ol style="padding-left:20px;line-height:2;">
        <li><strong>I learn about you</strong> — your story, what you've built, and what you're looking for</li>
        <li><strong>I find your people</strong> — using AI to surface the most relevant connections across the network</li>
        <li><strong>You review & accept</strong> — no spam intros, you choose who you connect with</li>
        <li><strong>I make the intro</strong> — once both sides say yes, I share contact details so you can take it from there</li>
      </ol>
      <p>The best matches happen when your profile is detailed and up to date.</p>
      <p>${link('Check your matches →', `${env.FRONTEND_URL}/matches`)}</p>
      <p>— Cleya</p>
    `);
    return this.send(email, 'How Cleya matching works — a quick explainer', html);
  }

  async sendMatchCheckIn(email: string, name?: string) {
    const firstName = name?.split(' ')[0] || 'there';
    const html = plainEmailLayout(`
      <p>Hi ${firstName},</p>
      <p>It's been a week since you joined Cleya — time flies!</p>
      <p>Have you checked your matches lately? I've been working behind the scenes to find the best people for you.</p>
      <p>${link('See your matches →', `${env.FRONTEND_URL}/matches`)}</p>
      <p>If you haven't received any matches yet, make sure your profile is complete — that's what powers my recommendations.</p>
      <p>— Cleya</p>
    `);
    return this.send(email, `${firstName}, your matches are waiting`, html);
  }

  async sendPostIntroFollowUp(email: string, name?: string, matchName?: string) {
    const firstName = name?.split(' ')[0] || 'there';
    const matchFirst = matchName?.split(' ')[0] || 'your match';
    const html = plainEmailLayout(`
      <p>Hi ${firstName},</p>
      <p>It's been a few days since I connected you with <strong>${matchFirst}</strong>. How did it go?</p>
      <p>Whether it was a great conversation or didn't quite click — I'd love to hear. Your feedback helps me find even better matches for you.</p>
      <p>${link('Share your feedback →', `${env.FRONTEND_URL}/matches`)}</p>
      <p>— Cleya</p>
    `);
    return this.send(email, `How was your intro with ${matchFirst}?`, html);
  }

  async sendFeedbackRequest(email: string, name?: string, matchName?: string) {
    const firstName = name?.split(' ')[0] || 'there';
    const matchFirst = matchName?.split(' ')[0] || 'your recent match';
    const html = plainEmailLayout(`
      <p>Hi ${firstName},</p>
      <p>Would you take 30 seconds to rate your connection with <strong>${matchFirst}</strong>?</p>
      <p>A quick rating and a line or two of feedback goes a long way — it helps me learn what works for you and makes future matches even better.</p>
      <p>${link('Rate this match →', `${env.FRONTEND_URL}/matches`)}</p>
      <p>Thanks for helping make Cleya better for everyone.</p>
      <p>— Cleya</p>
    `);
    return this.send(email, `Quick feedback on your match with ${matchFirst}?`, html);
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
        Hey — I've been using Cleya.ai (an AI superconnector for the Indian startup ecosystem). It quietly figures out who in the network you should actually talk to and makes the intros for you. No spam, no random adds. Worth 2 minutes to set up.<br/><br/>
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
