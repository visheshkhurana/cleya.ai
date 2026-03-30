import { messagingService } from './messagingService';
import { gupshupService } from './gupshupService';
import { prisma } from '@cleya/db';

export interface TemplateConfig {
  id: string;
  name: string;
  description: string;
  buildMessage: (params: Record<string, string>) => string;
  gupshupTemplateId?: string;
}

const templates: Record<string, TemplateConfig> = {
  welcome: {
    id: 'welcome',
    name: 'Welcome Message',
    description: 'Sent when a new user signs up',
    gupshupTemplateId: 'welcome',
    buildMessage: (p) =>
      `Hey ${p.name || 'there'}! 👋 Welcome to Cleya.ai — India's AI-powered networking platform. We're already finding the best people for you to connect with. Complete your profile to get matched faster: ${p.profileUrl || 'https://cleya.ai/dashboard'}`,
  },

  match_found: {
    id: 'match_found',
    name: 'Match Found',
    description: 'Sent when AI finds a new match for the user',
    gupshupTemplateId: 'match_found',
    buildMessage: (p) =>
      `Great news! Cleya.ai found a match for you: *${p.matchName}* — ${p.matchRole || 'Professional'}${p.matchCompany ? ` at ${p.matchCompany}` : ''}. Match score: ${p.matchScore || '90'}%. Review and accept: ${p.matchUrl || 'https://cleya.ai/dashboard/matches'}`,
  },

  match_accepted: {
    id: 'match_accepted',
    name: 'Match Accepted',
    description: 'Sent when the other person accepts a match',
    gupshupTemplateId: 'match_accepted',
    buildMessage: (p) =>
      `${p.matchName} accepted your match on Cleya.ai! You can now start a conversation or schedule a meeting. Open the app: ${p.chatUrl || 'https://cleya.ai/dashboard/matches'}`,
  },

  intro_sent: {
    id: 'intro_sent',
    name: 'Introduction Sent',
    description: 'Sent when an introduction email is facilitated',
    gupshupTemplateId: 'intro_sent',
    buildMessage: (p) =>
      `Cleya.ai just made an introduction for you! We've connected you with *${p.introName}*${p.introRole ? ` (${p.introRole})` : ''}. Check your email for the intro message, and keep the conversation going: ${p.introUrl || 'https://cleya.ai/dashboard/introductions'}`,
  },

  intro_accepted: {
    id: 'intro_accepted',
    name: 'Introduction Accepted',
    description: 'Sent when an introduction is accepted by the other party',
    gupshupTemplateId: 'intro_accepted',
    buildMessage: (p) =>
      `${p.introName} responded to your introduction on Cleya.ai! They're interested in connecting. Schedule a meeting: ${p.meetingUrl || 'https://cleya.ai/dashboard/meetings'}`,
  },

  meeting_scheduled: {
    id: 'meeting_scheduled',
    name: 'Meeting Scheduled',
    description: 'Sent when a meeting is proposed',
    gupshupTemplateId: 'meeting_scheduled',
    buildMessage: (p) =>
      `A meeting has been proposed on Cleya.ai!\n\n📅 *${p.meetingTitle}*\n👤 With: ${p.withName}\n⏰ ${p.proposedTime || 'Pending confirmation'}\n\nConfirm or suggest a new time: ${p.meetingUrl || 'https://cleya.ai/dashboard/meetings'}`,
  },

  meeting_confirmed: {
    id: 'meeting_confirmed',
    name: 'Meeting Confirmed',
    description: 'Sent when a meeting is confirmed',
    gupshupTemplateId: 'meeting_confirmed',
    buildMessage: (p) =>
      `Your meeting is confirmed! 🎉\n\n📅 *${p.meetingTitle}*\n👤 With: ${p.withName}\n⏰ ${p.confirmedTime}\n📍 ${p.location || 'Virtual'}\n\nWe'll send you a reminder before it starts.`,
  },

  meeting_reminder: {
    id: 'meeting_reminder',
    name: 'Meeting Reminder',
    description: 'Sent 1 hour before a scheduled meeting',
    gupshupTemplateId: 'meeting_reminder',
    buildMessage: (p) =>
      `Reminder: You have a meeting in ${p.timeUntil || '1 hour'}!\n\n📅 *${p.meetingTitle}*\n👤 With: ${p.withName}\n📍 ${p.location || 'Virtual'}\n${p.meetingLink ? `🔗 Join: ${p.meetingLink}` : ''}`,
  },

  profile_incomplete: {
    id: 'profile_incomplete',
    name: 'Profile Incomplete Nudge',
    description: 'Sent 24h after signup if profile is incomplete',
    gupshupTemplateId: 'profile_incomplete',
    buildMessage: (p) =>
      `Hi ${p.name || 'there'}! Your Cleya.ai profile is ${p.completionPct || '0'}% complete. A complete profile gets 3x more matches. Finish it now: ${p.profileUrl || 'https://cleya.ai/onboarding'}`,
  },

  weekly_digest: {
    id: 'weekly_digest',
    name: 'Weekly Digest',
    description: 'Weekly summary of matches and activity',
    gupshupTemplateId: 'weekly_digest',
    buildMessage: (p) =>
      `Your weekly Cleya.ai update:\n\n🤝 ${p.newMatches || '0'} new matches\n📨 ${p.introsSent || '0'} introductions made\n📅 ${p.meetingsScheduled || '0'} meetings scheduled\n\nSee who's waiting to connect: ${p.dashboardUrl || 'https://cleya.ai/dashboard'}`,
  },

  event_registration: {
    id: 'event_registration',
    name: 'Event Registration Confirmed',
    description: 'Sent when user registers for an event',
    gupshupTemplateId: 'event_registration',
    buildMessage: (p) =>
      `You're registered for *${p.eventName}*! 🎫\n\n📅 ${p.eventDate}\n📍 ${p.eventLocation || 'TBD'}\n\nWe'll match you with other attendees before the event. Stay tuned!`,
  },

  event_followup: {
    id: 'event_followup',
    name: 'Post-Event Follow-up',
    description: 'Sent after an event with match results',
    gupshupTemplateId: 'event_followup',
    buildMessage: (p) =>
      `Thanks for attending *${p.eventName}*! 🎉\n\nYour top matches from the event:\n${p.matchList || 'We\'re still processing — check back soon!'}\n\nReview and connect: ${p.matchesUrl || 'https://cleya.ai/dashboard/matches'}`,
  },

  follow_up: {
    id: 'follow_up',
    name: 'General Follow-up',
    description: 'Periodic check-in with inactive users',
    gupshupTemplateId: 'follow_up',
    buildMessage: (p) =>
      `Hi ${p.name || 'there'}! Just checking in from Cleya.ai. You have ${p.pendingMatches || 'new'} matches waiting for you. Don't miss out — review them now: ${p.dashboardUrl || 'https://cleya.ai/dashboard/matches'}`,
  },
};

export class WhatsAppTemplateService {
  getTemplate(templateId: string): TemplateConfig | undefined {
    return templates[templateId];
  }

  getAllTemplates(): TemplateConfig[] {
    return Object.values(templates);
  }

  async sendTemplate(
    userId: string,
    phoneNumber: string,
    templateId: string,
    params: Record<string, string>
  ) {
    const template = templates[templateId];
    if (!template) {
      console.error(`Template ${templateId} not found`);
      return null;
    }

    const message = template.buildMessage(params);

    let resolvedPhone = phoneNumber;
    if (!resolvedPhone && userId && userId !== 'admin') {
      const user = await this.getUserWithPhone(userId);
      if (!user) return null;
      resolvedPhone = user.phone;
    }
    if (!resolvedPhone) {
      console.warn(`No phone number for template ${templateId}`);
      return null;
    }

    if (gupshupService.isConfigured() && template.gupshupTemplateId) {
      try {
        const result = await gupshupService.sendTemplate(userId, resolvedPhone, template.gupshupTemplateId, Object.values(params));
        if (result.status !== 'FAILED') return result;
        console.warn(`Gupshup template ${template.gupshupTemplateId} failed, falling back to plain text`);
      } catch (error) {
        console.error(`Gupshup template send failed, using plain text:`, error);
      }
    }

    return messagingService.sendWhatsApp(userId, resolvedPhone, message);
  }

  async triggerWelcome(userId: string) {
    const user = await this.getUserWithPhone(userId);
    if (!user) return null;

    return this.sendTemplate(userId, user.phone!, 'welcome', {
      name: user.profile?.currentRole || user.name || user.email.split('@')[0],
      profileUrl: 'https://cleya.ai/onboarding',
    });
  }

  async triggerMatchFound(userId: string, matchUserId: string, matchScore?: number) {
    const [user, matchUser] = await Promise.all([
      this.getUserWithPhone(userId),
      prisma.user.findUnique({
        where: { id: matchUserId },
        include: { profile: true },
      }),
    ]);
    if (!user || !matchUser) return null;

    return this.sendTemplate(userId, user.phone!, 'match_found', {
      matchName: matchUser.name || matchUser.profile?.currentRole || 'A professional',
      matchRole: matchUser.profile?.headline || matchUser.profile?.currentRole || '',
      matchCompany: matchUser.profile?.companyName || '',
      matchScore: matchScore?.toString() || '90',
      matchUrl: 'https://cleya.ai/dashboard/matches',
    });
  }

  async triggerMatchAccepted(userId: string, matchUserId: string) {
    const [user, matchUser] = await Promise.all([
      this.getUserWithPhone(userId),
      prisma.user.findUnique({
        where: { id: matchUserId },
        include: { profile: true },
      }),
    ]);
    if (!user || !matchUser) return null;

    return this.sendTemplate(userId, user.phone!, 'match_accepted', {
      matchName: matchUser.name || matchUser.profile?.currentRole || 'Your match',
      chatUrl: 'https://cleya.ai/dashboard/matches',
    });
  }

  async triggerIntroSent(userId: string, introName: string, introRole?: string) {
    const user = await this.getUserWithPhone(userId);
    if (!user) return null;

    return this.sendTemplate(userId, user.phone!, 'intro_sent', {
      introName,
      introRole: introRole || '',
      introUrl: 'https://cleya.ai/dashboard/introductions',
    });
  }

  async triggerIntroAccepted(userId: string, introName: string) {
    const user = await this.getUserWithPhone(userId);
    if (!user) return null;

    return this.sendTemplate(userId, user.phone!, 'intro_accepted', {
      introName,
      meetingUrl: 'https://cleya.ai/dashboard/meetings',
    });
  }

  async triggerMeetingScheduled(userId: string, meetingTitle: string, withName: string, proposedTime?: string) {
    const user = await this.getUserWithPhone(userId);
    if (!user) return null;

    return this.sendTemplate(userId, user.phone!, 'meeting_scheduled', {
      meetingTitle,
      withName,
      proposedTime: proposedTime || 'Pending confirmation',
      meetingUrl: 'https://cleya.ai/dashboard/meetings',
    });
  }

  async triggerMeetingConfirmed(userId: string, meetingTitle: string, withName: string, confirmedTime: string, location?: string) {
    const user = await this.getUserWithPhone(userId);
    if (!user) return null;

    return this.sendTemplate(userId, user.phone!, 'meeting_confirmed', {
      meetingTitle,
      withName,
      confirmedTime,
      location: location || 'Virtual',
    });
  }

  async triggerMeetingReminder(userId: string, meetingTitle: string, withName: string, timeUntil: string, location?: string, meetingLink?: string) {
    const user = await this.getUserWithPhone(userId);
    if (!user) return null;

    return this.sendTemplate(userId, user.phone!, 'meeting_reminder', {
      meetingTitle,
      withName,
      timeUntil,
      location: location || 'Virtual',
      meetingLink: meetingLink || '',
    });
  }

  async triggerProfileIncomplete(userId: string, completionPct: number) {
    const user = await this.getUserWithPhone(userId);
    if (!user) return null;

    return this.sendTemplate(userId, user.phone!, 'profile_incomplete', {
      name: user.name || user.email.split('@')[0],
      completionPct: completionPct.toString(),
      profileUrl: 'https://cleya.ai/onboarding',
    });
  }

  async triggerEventRegistration(userId: string, eventName: string, eventDate: string, eventLocation?: string) {
    const user = await this.getUserWithPhone(userId);
    if (!user) return null;

    return this.sendTemplate(userId, user.phone!, 'event_registration', {
      eventName,
      eventDate,
      eventLocation: eventLocation || 'TBD',
    });
  }

  async triggerEventFollowup(userId: string, eventName: string, matchList: string) {
    const user = await this.getUserWithPhone(userId);
    if (!user) return null;

    return this.sendTemplate(userId, user.phone!, 'event_followup', {
      eventName,
      matchList,
      matchesUrl: 'https://cleya.ai/dashboard/matches',
    });
  }

  async triggerWeeklyDigest(userId: string, stats: { newMatches: number; introsSent: number; meetingsScheduled: number }) {
    const user = await this.getUserWithPhone(userId);
    if (!user) return null;

    return this.sendTemplate(userId, user.phone!, 'weekly_digest', {
      newMatches: stats.newMatches.toString(),
      introsSent: stats.introsSent.toString(),
      meetingsScheduled: stats.meetingsScheduled.toString(),
      dashboardUrl: 'https://cleya.ai/dashboard',
    });
  }

  async triggerFollowUp(userId: string) {
    const user = await this.getUserWithPhone(userId);
    if (!user) return null;

    const pendingCount = await prisma.match.count({
      where: {
        OR: [{ userAId: userId }, { userBId: userId }],
        status: { in: ['PROPOSED', 'PENDING_A', 'PENDING_B'] },
      },
    });

    return this.sendTemplate(userId, user.phone!, 'follow_up', {
      name: user.name || user.email.split('@')[0],
      pendingMatches: pendingCount.toString(),
      dashboardUrl: 'https://cleya.ai/dashboard/matches',
    });
  }

  private async getUserWithPhone(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      console.warn(`User ${userId} not found for WhatsApp template`);
      return null;
    }

    const phone = user.phone || (user.profile as any)?.phoneNumber;
    if (!phone) {
      console.warn(`User ${userId} has no phone number, skipping WhatsApp`);
      return null;
    }

    return { ...user, phone };
  }
}

export const whatsappTemplates = new WhatsAppTemplateService();
