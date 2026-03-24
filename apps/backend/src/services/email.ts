import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { prisma } from '@boardy/db';

const brandColor = '#0D9488';
const bgColor = '#0D0B1A';
const cardBg = '#1a1230';

function emailLayout(content: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${bgColor};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${bgColor};padding:40px 20px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;">
<tr><td style="text-align:center;padding-bottom:30px;">
<div style="display:inline-block;width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,${brandColor},#0F766E);text-align:center;line-height:40px;color:#fff;font-weight:bold;font-size:18px;">C</div>
<span style="color:#fff;font-size:20px;font-weight:600;vertical-align:middle;margin-left:10px;">Cleya.ai</span>
</td></tr>
<tr><td style="background:${cardBg};border-radius:16px;padding:40px;border:1px solid rgba(255,255,255,0.05);">
${content}
</td></tr>
<tr><td style="text-align:center;padding-top:30px;">
<p style="color:rgba(255,255,255,0.2);font-size:12px;margin:0;">&copy; ${new Date().getFullYear()} Cleya.ai. All rights reserved.</p>
<p style="color:rgba(255,255,255,0.15);font-size:11px;margin:8px 0 0;">AI Superconnector — matching the right people, faster.</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

function btn(text: string, url: string): string {
  return `<a href="${url}" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,${brandColor},#0F766E);color:#fff;text-decoration:none;border-radius:12px;font-weight:600;font-size:14px;">${text}</a>`;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
      });
      console.log('📧 Email service configured');
    } else {
      console.log('📧 Email service: SMTP not configured (emails will be logged only)');
    }
  }

  private async send(to: string, subject: string, html: string): Promise<boolean> {
    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from: `"Cleya.ai" <${env.FROM_EMAIL}>`,
          to,
          subject,
          html,
        });
        console.log(`📧 Email sent to ${to}: ${subject}`);
        return true;
      } catch (err) {
        console.error(`📧 Email send failed to ${to}:`, err);
        return false;
      }
    } else {
      console.log(`📧 [DEV] Email to ${to}: ${subject}`);
      return true;
    }
  }

  async sendWelcome(email: string) {
    const html = emailLayout(`
      <h1 style="color:#fff;font-size:24px;margin:0 0 16px;">Welcome to Cleya.ai! 🎉</h1>
      <p style="color:rgba(255,255,255,0.6);font-size:15px;line-height:1.6;margin:0 0 24px;">
        You've just joined the smartest networking platform on the planet. Cleya uses AI to match you with founders, investors, talent, and partners who are the perfect fit for your goals.
      </p>
      <p style="color:rgba(255,255,255,0.6);font-size:15px;line-height:1.6;margin:0 0 24px;">
        <strong style="color:#fff;">Here's what happens next:</strong>
      </p>
      <ol style="color:rgba(255,255,255,0.5);font-size:14px;line-height:1.8;padding-left:20px;margin:0 0 24px;">
        <li>Tell Cleya about yourself in a quick chat</li>
        <li>Our AI finds your best matches</li>
        <li>Accept intros and start connecting</li>
      </ol>
      <div style="text-align:center;margin:32px 0 0;">
        ${btn('Start Your Profile →', `${env.FRONTEND_URL}/chat`)}
      </div>
    `);
    await this.send(email, 'Welcome to Cleya.ai — Your AI Superconnector', html);
  }

  async sendMatchProposed(email: string, matchName: string, matchPersona: string, matchScore: number) {
    const scorePercent = Math.round(matchScore * 100);
    const html = emailLayout(`
      <h1 style="color:#fff;font-size:24px;margin:0 0 16px;">New Match Found! 🎯</h1>
      <p style="color:rgba(255,255,255,0.6);font-size:15px;line-height:1.6;margin:0 0 24px;">
        Cleya found someone great for you to connect with.
      </p>
      <div style="background:rgba(108,71,255,0.08);border:1px solid rgba(108,71,255,0.15);border-radius:12px;padding:20px;margin:0 0 24px;">
        <p style="color:#fff;font-size:16px;font-weight:600;margin:0 0 4px;">${matchName}</p>
        <p style="color:#5EEAD4;font-size:13px;margin:0 0 8px;">${matchPersona}</p>
        <p style="color:rgba(255,255,255,0.4);font-size:13px;margin:0;">Match Score: <span style="color:${scorePercent >= 70 ? '#6ee7b7' : '#fbbf24'};font-weight:600;">${scorePercent}%</span></p>
      </div>
      <div style="text-align:center;margin:32px 0 0;">
        ${btn('Review Match →', `${env.FRONTEND_URL}/matches`)}
      </div>
    `);
    await this.send(email, `New Match: ${matchName} — ${scorePercent}% compatibility`, html);
  }

  async sendMatchAccepted(email: string, matchName: string, matchPersona: string, matchEmail: string) {
    const html = emailLayout(`
      <h1 style="color:#fff;font-size:24px;margin:0 0 16px;">It's a Match! 🤝</h1>
      <p style="color:rgba(255,255,255,0.6);font-size:15px;line-height:1.6;margin:0 0 24px;">
        Both you and <strong style="color:#fff;">${matchName}</strong> accepted the introduction. Time to connect!
      </p>
      <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.15);border-radius:12px;padding:20px;margin:0 0 24px;">
        <p style="color:#6ee7b7;font-size:14px;font-weight:600;margin:0 0 8px;">Contact Details Revealed</p>
        <p style="color:#fff;font-size:15px;margin:0 0 4px;">${matchName}</p>
        <p style="color:#5EEAD4;font-size:13px;margin:0 0 8px;">${matchPersona}</p>
        <p style="color:rgba(255,255,255,0.5);font-size:13px;margin:0;">📧 ${matchEmail}</p>
      </div>
      <p style="color:rgba(255,255,255,0.4);font-size:13px;line-height:1.6;margin:0 0 24px;">
        We recommend reaching out within 48 hours while the connection is fresh. Mention Cleya to break the ice!
      </p>
      <div style="text-align:center;margin:32px 0 0;">
        ${btn('View Connection →', `${env.FRONTEND_URL}/matches`)}
      </div>
    `);
    await this.send(email, `You matched with ${matchName}!`, html);
  }

  async sendPasswordReset(email: string, token: string) {
    const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${token}`;
    const html = emailLayout(`
      <h1 style="color:#fff;font-size:24px;margin:0 0 16px;">Reset Your Password</h1>
      <p style="color:rgba(255,255,255,0.6);font-size:15px;line-height:1.6;margin:0 0 24px;">
        We received a request to reset your password. Click the button below to create a new password. This link expires in 30 minutes.
      </p>
      <div style="text-align:center;margin:32px 0;">
        ${btn('Reset Password →', resetUrl)}
      </div>
      <p style="color:rgba(255,255,255,0.3);font-size:12px;line-height:1.6;margin:0;">
        If you didn't request this reset, you can safely ignore this email. Your password will remain unchanged.
      </p>
    `);
    await this.send(email, 'Reset Your Cleya.ai Password', html);
  }

  async sendEmailVerification(email: string, token: string) {
    const verifyUrl = `${env.FRONTEND_URL}/verify-email?token=${token}`;
    const html = emailLayout(`
      <h1 style="color:#fff;font-size:24px;margin:0 0 16px;">Verify Your Email</h1>
      <p style="color:rgba(255,255,255,0.6);font-size:15px;line-height:1.6;margin:0 0 24px;">
        Please verify your email address to complete your Cleya.ai account setup and unlock all features.
      </p>
      <div style="text-align:center;margin:32px 0;">
        ${btn('Verify Email →', verifyUrl)}
      </div>
      <p style="color:rgba(255,255,255,0.3);font-size:12px;line-height:1.6;margin:0;">
        This link expires in 24 hours. If you didn't create a Cleya.ai account, please ignore this email.
      </p>
    `);
    await this.send(email, 'Verify Your Cleya.ai Email', html);
  }

  async sendNewMatch(email: string, matchName: string, matchScore: number) {
    const scorePercent = Math.round(matchScore * 100);
    const html = emailLayout(`
      <h1 style="color:#fff;font-size:24px;margin:0 0 16px;">You Have a New Match! 🎯</h1>
      <p style="color:rgba(255,255,255,0.6);font-size:15px;line-height:1.6;margin:0 0 24px;">
        Cleya found a new connection for you — <strong style="color:#fff;">${matchName}</strong> with a <strong style="color:#6ee7b7;">${scorePercent}%</strong> compatibility score.
      </p>
      <div style="text-align:center;margin:32px 0;">
        ${btn('Review Match →', `${env.FRONTEND_URL}/matches`)}
      </div>
    `);
    await this.send(email, `New Match: ${matchName} (${scorePercent}%)`, html);
  }

  async sendWeeklyDigest(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user) return;

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [pendingMatches, newMatches, acceptedMatches] = await Promise.all([
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
    ]);

    const name = user.profile?.currentRole || user.email.split('@')[0];
    const html = emailLayout(`
      <h1 style="color:#fff;font-size:24px;margin:0 0 8px;">Your Weekly Update 📊</h1>
      <p style="color:rgba(255,255,255,0.4);font-size:13px;margin:0 0 24px;">Hi ${name}, here's what happened this week.</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
        <tr>
          <td style="background:rgba(108,71,255,0.08);border:1px solid rgba(108,71,255,0.12);border-radius:12px;padding:16px;text-align:center;width:33%;">
            <p style="color:#5EEAD4;font-size:24px;font-weight:700;margin:0;">${newMatches}</p>
            <p style="color:rgba(255,255,255,0.4);font-size:11px;margin:4px 0 0;">New Matches</p>
          </td>
          <td style="width:8px;"></td>
          <td style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.12);border-radius:12px;padding:16px;text-align:center;width:33%;">
            <p style="color:#fbbf24;font-size:24px;font-weight:700;margin:0;">${pendingMatches}</p>
            <p style="color:rgba(255,255,255,0.4);font-size:11px;margin:4px 0 0;">Pending Review</p>
          </td>
          <td style="width:8px;"></td>
          <td style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.12);border-radius:12px;padding:16px;text-align:center;width:33%;">
            <p style="color:#6ee7b7;font-size:24px;font-weight:700;margin:0;">${acceptedMatches}</p>
            <p style="color:rgba(255,255,255,0.4);font-size:11px;margin:4px 0 0;">Accepted</p>
          </td>
        </tr>
      </table>
      ${pendingMatches > 0 ? `<p style="color:rgba(255,255,255,0.5);font-size:14px;margin:0 0 24px;">You have <strong style="color:#fbbf24;">${pendingMatches} pending match${pendingMatches !== 1 ? 'es' : ''}</strong> waiting for your review.</p>` : ''}
      <div style="text-align:center;margin:32px 0 0;">
        ${btn('View Dashboard →', `${env.FRONTEND_URL}/dashboard`)}
      </div>
    `);
    await this.send(user.email, `Your Cleya.ai Weekly Update — ${newMatches} new match${newMatches !== 1 ? 'es' : ''}`, html);
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
