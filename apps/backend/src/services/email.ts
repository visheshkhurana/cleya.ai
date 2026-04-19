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
      const from = `Cleya <${senderEmail}>`;

      const result = await client.emails.send({
        from,
        to: [to],
        subject,
        html,
      });

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
    const scorePercent = Math.round(matchScore * 100);

    let body = `<p>Hi ${firstName},</p>`;
    body += `<p>Wanted to put <strong>${matchName}</strong> on your radar`;

    if (matchDetails?.companyName && matchDetails?.raiseAmount) {
      body += ` — ${matchName.split(' ')[0]} is ${matchDetails.raiseAmount.toLowerCase().includes('raising') ? '' : 'raising '}${matchDetails.raiseAmount}`;
      if (matchDetails.companyName) body += ` for ${matchDetails.companyName}`;
      if (matchDetails.sector) body += `, building in ${matchDetails.sector.replace(/_/g, ' ').toLowerCase()}`;
      body += `.`;
    } else if (matchDetails?.companyName) {
      body += ` — ${matchPersona.toLowerCase()} at ${matchDetails.companyName}`;
      if (matchDetails.sector) body += ` in ${matchDetails.sector.replace(/_/g, ' ').toLowerCase()}`;
      body += `.`;
    } else {
      body += ` — ${matchPersona.toLowerCase()}.`;
    }
    body += `</p>`;

    if (matchDetails?.traction) {
      body += `<p>${matchDetails.traction}</p>`;
    }

    if (matchDetails?.bio && !matchDetails?.traction) {
      body += `<p>${matchDetails.bio}</p>`;
    }

    if (matchDetails?.matchReason) {
      body += `<p>${matchDetails.matchReason}</p>`;
    }

    if (matchDetails?.linkedinUrl) {
      body += `<p>Here's ${matchName.split(' ')[0]}'s LinkedIn if you want to take a closer look: ${link(matchDetails.linkedinUrl, matchDetails.linkedinUrl)}</p>`;
    }

    body += `<p>I matched you two at <strong>${scorePercent}%</strong> compatibility. ${link('Review this match →', `${env.FRONTEND_URL}/matches`)}</p>`;
    body += `<p>— Cleya</p>`;

    const html = plainEmailLayout(body);
    const subject = `${firstName}, ${matchDetails?.sector ? matchDetails.sector.replace(/_/g, ' ').toLowerCase() + ' ' : ''}connection for you`;
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
