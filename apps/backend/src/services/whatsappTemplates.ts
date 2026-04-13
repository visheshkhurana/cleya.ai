import { messagingService } from './messagingService';
import { gupshupService } from './gupshupService';
import { prisma } from '@cleya/db';

export interface TemplateConfig {
  id: string;
  name: string;
  description: string;
  buildMessage: (params: Record<string, string>) => string;
  gupshupTemplateId?: string;
  gupshupParamOrder?: string[];
}

const templates: Record<string, TemplateConfig> = {
  welcome: {
    id: 'welcome',
    name: 'Welcome Message',
    description: 'Sent when a new user signs up',
    gupshupTemplateId: 'cleya_welcome',
    gupshupParamOrder: ['name', 'profileUrl'],
    buildMessage: (p) =>
      `Hey! Welcome to Cleya 👋 I'm your AI superconnector. I personally talk to everyone in the network, learn their story, and then make warm introductions where there's a genuine fit.\n\nThe next step is a quick chat where I get to know you — what you've built, and what you're looking for. From there I can start matching you with the right people.\n\nReady? Tap here to get started: ${p.profileUrl || 'https://cleya.ai/chat'}`,
  },

  match_found: {
    id: 'match_found',
    name: 'Match Found',
    description: 'Sent when AI finds a new match for the user',
    gupshupTemplateId: 'cleya_match_found',
    gupshupParamOrder: ['name', 'matchName', 'matchRole', 'matchCompany', 'matchUrl'],
    buildMessage: (p) => {
      let msg = `Hey ${p.name || 'there'}! I found someone great for you.\n\n`;
      msg += `*${p.matchName}*`;
      if (p.matchRole) msg += ` — ${p.matchRole}`;
      if (p.matchCompany) msg += ` at ${p.matchCompany}`;
      msg += `\n\n`;
      if (p.matchReason) {
        msg += `${p.matchReason}\n\n`;
      }
      if (p.matchLinkedin) {
        msg += `Here's their LinkedIn: ${p.matchLinkedin}\n\n`;
      }
      msg += `Want me to make the intro? Check your matches: ${p.matchUrl || 'https://cleya.ai/matches'}`;
      return msg;
    },
  },

  match_accepted: {
    id: 'match_accepted',
    name: 'Match Accepted',
    description: 'Sent when the other person accepts a match',
    gupshupTemplateId: 'cleya_match_accepted',
    gupshupParamOrder: ['name', 'matchName', 'chatUrl'],
    buildMessage: (p) => {
      let msg = `Great news, ${p.name || 'there'}! 🤝\n\n*${p.matchName}* wants to connect with you too.\n\n`;
      if (p.reason) msg += `Why I matched you: ${p.reason}\n\n`;
      if (p.linkedin) msg += `🔗 LinkedIn: ${p.linkedin}\n\n`;
      msg += `Start chatting now: ${p.chatUrl || 'https://cleya.ai/messages'}\n\nPro tip: reach out within 48 hours while the connection is fresh.`;
      return msg;
    },
  },

  intro_sent: {
    id: 'intro_sent',
    name: 'Introduction Sent',
    description: 'Sent when an introduction email is facilitated',
    gupshupTemplateId: 'cleya_intro_sent',
    gupshupParamOrder: ['name', 'introName', 'introRole', 'introUrl'],
    buildMessage: (p) => {
      let msg = `Hey ${p.name || 'there'}! Wanted to put *${p.introName}* on your radar`;
      if (p.introRole) msg += ` — ${p.introRole}`;
      msg += `.\n\n`;
      if (p.introReason) msg += `${p.introReason}\n\n`;
      msg += `I've sent the intro. Check it out: ${p.introUrl || 'https://cleya.ai/introductions'}`;
      return msg;
    },
  },

  intro_accepted: {
    id: 'intro_accepted',
    name: 'Introduction Accepted',
    description: 'Sent when an introduction is accepted by the other party',
    gupshupTemplateId: 'cleya_intro_accepted',
    gupshupParamOrder: ['name', 'introName', 'meetingUrl'],
    buildMessage: (p) =>
      `Hey ${p.name || 'there'}! *${p.introName}* accepted the intro and wants to connect. 🎉\n\nYou can reach out directly now: ${p.meetingUrl || 'https://cleya.ai/meetings'}\n\nA simple "Hey, Cleya connected us — would love to chat" works great.`,
  },

  meeting_scheduled: {
    id: 'meeting_scheduled',
    name: 'Meeting Scheduled',
    description: 'Sent when a meeting is proposed',
    gupshupTemplateId: 'cleya_meeting_reminder',
    gupshupParamOrder: ['meetingTitle', 'withName', 'proposedTime'],
    buildMessage: (p) =>
      `Heads up — you have a meeting coming up!\n\n📅 *${p.meetingTitle}*\n👤 With ${p.withName}\n🕐 ${p.proposedTime || 'Time pending'}\n\nI'll send you a reminder before it starts.`,
  },

  meeting_confirmed: {
    id: 'meeting_confirmed',
    name: 'Meeting Confirmed',
    description: 'Sent when a meeting is confirmed',
    gupshupTemplateId: 'cleya_meeting_reminder',
    gupshupParamOrder: ['meetingTitle', 'withName', 'confirmedTime'],
    buildMessage: (p) =>
      `Your meeting is confirmed! ✅\n\n📅 *${p.meetingTitle}*\n👤 With ${p.withName}\n🕐 ${p.confirmedTime}${p.location ? `\n📍 ${p.location}` : ''}\n\nI'll remind you an hour before.`,
  },

  meeting_reminder: {
    id: 'meeting_reminder',
    name: 'Meeting Reminder',
    description: 'Sent 1 hour before a scheduled meeting',
    gupshupTemplateId: 'cleya_meeting_reminder',
    gupshupParamOrder: ['meetingTitle', 'withName', 'timeUntil'],
    buildMessage: (p) =>
      `Quick reminder — your meeting starts in *${p.timeUntil || '1 hour'}*!\n\n📅 *${p.meetingTitle}*\n👤 With ${p.withName}${p.location ? `\n📍 ${p.location}` : ''}${p.meetingLink ? `\n🔗 Join: ${p.meetingLink}` : ''}`,
  },

  profile_incomplete: {
    id: 'profile_incomplete',
    name: 'Profile Incomplete Nudge',
    description: 'Sent 24h after signup if profile is incomplete',
    gupshupTemplateId: 'cleya_reengagement',
    gupshupParamOrder: ['name', 'profileUrl'],
    buildMessage: (p) =>
      `Hey ${p.name || 'there'}! Just checking in — I noticed you haven't finished telling me about yourself yet.\n\nOnce I know your story, I can start finding the right people for you. It only takes a few minutes: ${p.profileUrl || 'https://cleya.ai/chat'}`,
  },

  weekly_digest: {
    id: 'weekly_digest',
    name: 'Weekly Digest',
    description: 'Weekly summary of matches and activity',
    gupshupTemplateId: 'cleya_reengagement',
    gupshupParamOrder: ['name', 'dashboardUrl'],
    buildMessage: (p) =>
      `Hey ${p.name || 'there'}! Here's your week in the Cleya network:\n\n• ${p.newMatches || '0'} new matches found\n• ${p.introsSent || '0'} intros made\n• ${p.meetingsScheduled || '0'} meetings scheduled\n\nCheck your dashboard: ${p.dashboardUrl || 'https://cleya.ai/dashboard'}`,
  },

  event_registration: {
    id: 'event_registration',
    name: 'Event Registration Confirmed',
    description: 'Sent when user registers for an event',
    gupshupTemplateId: 'cleya_meeting_reminder',
    gupshupParamOrder: ['eventName', 'eventDate', 'eventLocation'],
    buildMessage: (p) =>
      `You're in! 🎟️\n\n📅 *${p.eventName}*\n🕐 ${p.eventDate}${p.eventLocation ? `\n📍 ${p.eventLocation}` : ''}\n\nI'll be working behind the scenes to find the best people for you to meet at the event.`,
  },

  event_followup: {
    id: 'event_followup',
    name: 'Post-Event Follow-up',
    description: 'Sent after an event with match results',
    gupshupTemplateId: 'cleya_followup',
    gupshupParamOrder: ['name', 'eventName', 'matchesUrl'],
    buildMessage: (p) =>
      `Hey ${p.name || 'there'}! Hope you had a great time at *${p.eventName}*.\n\nI found some people from the event you should connect with. Check your matches: ${p.matchesUrl || 'https://cleya.ai/matches'}`,
  },

  follow_up: {
    id: 'follow_up',
    name: 'General Follow-up',
    description: 'Periodic check-in with inactive users',
    gupshupTemplateId: 'cleya_reengagement',
    gupshupParamOrder: ['name', 'dashboardUrl'],
    buildMessage: (p) => {
      let msg = `Hey ${p.name || 'there'}! It's been a bit — just wanted to check in.`;
      if (p.pendingMatches && parseInt(p.pendingMatches) > 0) {
        msg += `\n\nYou have *${p.pendingMatches} match${parseInt(p.pendingMatches) !== 1 ? 'es' : ''}* waiting for your review. Don't leave them hanging!`;
      } else {
        msg += `\n\nI've been finding new people in the network who could be a great fit for you.`;
      }
      msg += `\n\nTake a look: ${p.dashboardUrl || 'https://cleya.ai/matches'}`;
      return msg;
    },
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
        let orderedParams: string[];
        if (template.gupshupParamOrder) {
          orderedParams = template.gupshupParamOrder.map(key => params[key] || '');
        } else {
          orderedParams = Object.values(params);
        }
        console.log(`WhatsAppTemplateService.sendTemplate: template=${templateId}, gupshupId=${template.gupshupTemplateId}, paramOrder=${JSON.stringify(template.gupshupParamOrder)}, orderedParams=${JSON.stringify(orderedParams)}`);
        const result = await gupshupService.sendTemplate(userId, resolvedPhone, template.gupshupTemplateId, orderedParams);
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
      name: user.name?.split(' ')[0] || user.profile?.currentRole || user.email.split('@')[0],
      profileUrl: 'https://cleya.ai/chat',
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

    const matchName = matchUser.name || matchUser.profile?.currentRole || 'A professional';
    const matchRole = matchUser.profile?.headline || matchUser.profile?.currentRole || '';
    const matchCompany = matchUser.profile?.companyName || '';
    const matchLinkedin = matchUser.profile?.linkedinUrl || '';

    let matchReason = '';
    if (matchUser.profile?.raiseAmount && matchUser.profile?.companyName) {
      matchReason = `${matchName.split(' ')[0]} is raising ${matchUser.profile.raiseAmount} for ${matchUser.profile.companyName}.`;
      if (matchUser.profile?.keyTractionPoints) {
        matchReason += ` ${matchUser.profile.keyTractionPoints}`;
      }
    } else if (matchUser.profile?.bio) {
      matchReason = matchUser.profile.bio.slice(0, 200);
    }

    return this.sendTemplate(userId, user.phone!, 'match_found', {
      name: user.name?.split(' ')[0] || user.profile?.currentRole || user.email.split('@')[0],
      matchName,
      matchRole,
      matchCompany,
      matchLinkedin,
      matchReason,
      matchScore: matchScore?.toString() || '90',
      matchUrl: 'https://cleya.ai/matches',
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

    const matchName = matchUser.name || matchUser.profile?.currentRole || 'Your match';
    const matchRole = matchUser.profile?.headline || matchUser.profile?.currentRole || '';
    const matchCompany = matchUser.profile?.companyName || '';
    const matchSector = (matchUser.profile?.industries as string[] | undefined)?.[0]?.replace(/_/g, ' ') || '';
    const descParts = [matchRole, matchCompany, matchSector].filter(Boolean);
    const matchDesc = descParts.join(', ');

    const match = await prisma.match.findFirst({
      where: {
        status: 'ACCEPTED',
        OR: [
          { userAId: userId, userBId: matchUserId },
          { userAId: matchUserId, userBId: userId },
        ],
      },
      select: { reason: true },
    });
    const reason = match?.reason || '';

    return this.sendTemplate(userId, user.phone!, 'match_accepted', {
      name: user.name?.split(' ')[0] || user.email.split('@')[0],
      matchName: matchDesc ? `${matchName} — ${matchDesc}` : matchName,
      chatUrl: `https://cleya.ai/messages?partner=${matchUserId}`,
      reason: reason,
      linkedin: matchUser.profile?.linkedinUrl || '',
    });
  }

  async triggerIntroSent(userId: string, introName: string, introRole?: string, introReason?: string) {
    const user = await this.getUserWithPhone(userId);
    if (!user) return null;

    return this.sendTemplate(userId, user.phone!, 'intro_sent', {
      name: user.name?.split(' ')[0] || user.email.split('@')[0],
      introName,
      introRole: introRole || '',
      introReason: introReason || '',
      introUrl: 'https://cleya.ai/introductions',
    });
  }

  async triggerIntroAccepted(userId: string, introName: string) {
    const user = await this.getUserWithPhone(userId);
    if (!user) return null;

    return this.sendTemplate(userId, user.phone!, 'intro_accepted', {
      name: user.name?.split(' ')[0] || user.email.split('@')[0],
      introName,
      meetingUrl: 'https://cleya.ai/meetings',
    });
  }

  async triggerMeetingScheduled(userId: string, meetingTitle: string, withName: string, proposedTime?: string) {
    const user = await this.getUserWithPhone(userId);
    if (!user) return null;

    return this.sendTemplate(userId, user.phone!, 'meeting_scheduled', {
      meetingTitle,
      withName,
      proposedTime: proposedTime || 'Time pending',
      meetingUrl: 'https://cleya.ai/meetings',
    });
  }

  async triggerMeetingConfirmed(userId: string, meetingTitle: string, withName: string, confirmedTime: string, location?: string) {
    const user = await this.getUserWithPhone(userId);
    if (!user) return null;

    return this.sendTemplate(userId, user.phone!, 'meeting_confirmed', {
      meetingTitle,
      withName,
      confirmedTime,
      location: location || '',
    });
  }

  async triggerMeetingReminder(userId: string, meetingTitle: string, withName: string, timeUntil: string, location?: string, meetingLink?: string) {
    const user = await this.getUserWithPhone(userId);
    if (!user) return null;

    return this.sendTemplate(userId, user.phone!, 'meeting_reminder', {
      meetingTitle,
      withName,
      timeUntil,
      location: location || '',
      meetingLink: meetingLink || '',
    });
  }

  async triggerProfileIncomplete(userId: string, completionPct: number) {
    const user = await this.getUserWithPhone(userId);
    if (!user) return null;

    return this.sendTemplate(userId, user.phone!, 'profile_incomplete', {
      name: user.name?.split(' ')[0] || user.email.split('@')[0],
      completionPct: completionPct.toString(),
      profileUrl: 'https://cleya.ai/chat',
    });
  }

  async triggerEventRegistration(userId: string, eventName: string, eventDate: string, eventLocation?: string) {
    const user = await this.getUserWithPhone(userId);
    if (!user) return null;

    return this.sendTemplate(userId, user.phone!, 'event_registration', {
      eventName,
      eventDate,
      eventLocation: eventLocation || '',
    });
  }

  async triggerEventFollowup(userId: string, eventName: string, matchList: string) {
    const user = await this.getUserWithPhone(userId);
    if (!user) return null;

    return this.sendTemplate(userId, user.phone!, 'event_followup', {
      name: user.name?.split(' ')[0] || user.email.split('@')[0],
      eventName,
      matchList,
      matchesUrl: 'https://cleya.ai/matches',
    });
  }

  async triggerWeeklyDigest(userId: string, stats: { newMatches: number; introsSent: number; meetingsScheduled: number }) {
    const user = await this.getUserWithPhone(userId);
    if (!user) return null;

    return this.sendTemplate(userId, user.phone!, 'weekly_digest', {
      name: user.name?.split(' ')[0] || user.email.split('@')[0],
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
      name: user.name?.split(' ')[0] || user.email.split('@')[0],
      pendingMatches: pendingCount.toString(),
      dashboardUrl: 'https://cleya.ai/matches',
    });
  }

  private async getUserWithPhone(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true, communicationPreference: true },
    });

    if (!user) {
      console.warn(`User ${userId} not found for WhatsApp template`);
      return null;
    }

    const phone = user.whatsappPhone || user.phone || (user.profile as any)?.phoneNumber;
    if (!phone) {
      console.warn(`User ${userId} has no phone number, skipping WhatsApp`);
      return null;
    }

    if (!user.whatsappOptedIn) {
      console.warn(`User ${userId} has not opted in to WhatsApp, skipping`);
      return null;
    }

    return { ...user, phone };
  }
}

export const whatsappTemplates = new WhatsAppTemplateService();
