import { prisma } from '@cleya/db';
import { callService } from './voice/callService';
import { messagingService } from './messagingService';
import { matchingService } from './matchingService';
import { whatsappTemplates } from './whatsappTemplates';
import { matchScheduler } from './matchScheduler';

export class AutomationService {
  async onOnboardingComplete(userId: string, context: Record<string, any>) {
    console.log(`Running post-onboarding automation for user ${userId}`);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      console.error(`User ${userId} not found for automation`);
      return;
    }

    const phoneNumber = user.phone || (user.profile as any)?.phoneNumber;
    const userName = user.profile?.currentRole || user.email.split('@')[0];
    const persona = (user.profile as any)?.persona;

    matchScheduler.enqueueUserCheck(userId);
    matchScheduler.enqueueRecheckPeers(userId).catch((err) =>
      console.log(`[AutoMatch] Peer re-queue failed for ${userId}:`, err)
    );

    if (persona === 'DEAL_PARTNER') {
      this.scheduleDealPartnerScout(userId);
    } else if (persona === 'EVENT_PARTICIPANT') {
      this.scheduleEventRegistration(userId, context);
    }

    if (!phoneNumber) {
      console.log(`No phone number for user ${userId}, skipping call/messaging automation`);
      return;
    }

    this.scheduleCall(userId, phoneNumber);
    this.sendWelcomeMessages(userId, phoneNumber, userName);
  }

  private scheduleDealPartnerScout(userId: string) {
    setTimeout(async () => {
      try {
        console.log(`[DealFlow] Starting auto-scout for deal partner ${userId}`);
        const scouted = await matchingService.autoScoutFounders(userId, 5);
        console.log(`[DealFlow] Auto-scouted ${scouted.length} founders for deal partner ${userId}`);
      } catch (error) {
        console.error(`[DealFlow] Auto-scout failed for deal partner ${userId}:`, error);
      }
    }, 5000);
  }

  private scheduleEventRegistration(userId: string, context: Record<string, any>) {
    setTimeout(async () => {
      try {
        console.log(`[EventFlow] Auto-registering EVENT_PARTICIPANT ${userId} for upcoming Pitch by Deel`);

        const upcomingEvent = await prisma.event.findFirst({
          where: {
            status: 'UPCOMING',
            date: { gte: new Date() },
          },
          orderBy: { date: 'asc' },
          include: { _count: { select: { participants: true } } },
        });

        if (!upcomingEvent) {
          console.log(`[EventFlow] No upcoming events found for auto-registration`);
          return;
        }

        const isAtCapacity = upcomingEvent.maxCapacity && upcomingEvent._count.participants >= upcomingEvent.maxCapacity;

        const participant = await prisma.eventParticipant.create({
          data: {
            eventId: upcomingEvent.id,
            userId,
            status: isAtCapacity ? 'WAITLISTED' : 'REGISTERED',
            eventCode: 'PITCH_BY_DEEL',
            eventName: upcomingEvent.name,
            pitchTopic: context.businessDescription || context.pitchTopic || null,
            preferredMentors: context.preferredMentors || [],
            registeredAt: new Date(),
          },
        });

        console.log(`[EventFlow] Auto-registered ${userId} for event ${upcomingEvent.name} (status: ${participant.status})`);
      } catch (error: any) {
        if (error.code === 'P2002') {
          console.log(`[EventFlow] User ${userId} already registered for event`);
        } else {
          console.error(`[EventFlow] Auto-registration failed for ${userId}:`, error);
        }
      }
    }, 3000);
  }

  private scheduleCall(userId: string, phoneNumber: string) {
    setTimeout(async () => {
      try {
        console.log(`Initiating post-onboarding call to ${phoneNumber}`);
        await callService.initiateCall(userId, phoneNumber);
      } catch (error) {
        console.error(`Failed to initiate call for user ${userId}:`, error);
      }
    }, 30000);
  }

  private async sendWelcomeMessages(userId: string, phoneNumber: string, userName?: string) {
    const result = await whatsappTemplates.triggerWelcome(userId);

    if (!result || result.status === 'FAILED') {
      console.log(`WhatsApp template failed for ${userId}, falling back to plain SMS`);
      const welcomeMessage = messagingService.getWelcomeMessage(userName);
      await messagingService.sendSMS(userId, phoneNumber, welcomeMessage);
    }
  }

  async schedulePostEventFollowUp(eventId: string, delayMs = 24 * 60 * 60 * 1000) {
    console.log(`[EventFlow] Scheduling post-event follow-up for event ${eventId} in ${delayMs / 1000}s`);

    setTimeout(async () => {
      try {
        console.log(`[EventFlow] Running post-event follow-up for event ${eventId}`);

        const event = await prisma.event.findUnique({
          where: { id: eventId },
          include: {
            participants: {
              where: { status: { in: ['REGISTERED', 'CONFIRMED', 'ATTENDED'] } },
              include: {
                user: {
                  select: { id: true, email: true, phone: true, profile: { select: { currentRole: true, phoneNumber: true } } },
                },
              },
            },
          },
        });

        if (!event) {
          console.log(`[EventFlow] Event ${eventId} not found for follow-up`);
          return;
        }

        let sent = 0;
        for (const participant of event.participants) {
          const phone = participant.user.phone || (participant.user.profile as any)?.phoneNumber;
          if (!phone) continue;

          const matches = await prisma.match.findMany({
            where: {
              OR: [{ userAId: participant.userId }, { userBId: participant.userId }],
              eventId: eventId,
              status: { in: ['PROPOSED', 'PENDING_A', 'PENDING_B', 'ACCEPTED'] },
            },
            include: {
              userA: { select: { profile: { select: { headline: true, companyName: true } } } },
              userB: { select: { profile: { select: { headline: true, companyName: true } } } },
            },
            take: 5,
          });

          const matchNames = matches.map(m => {
            const other = m.userAId === participant.userId ? m.userB : m.userA;
            return `${other.profile?.headline || 'Professional'} at ${other.profile?.companyName || 'a company'}`;
          });

          const userName = (participant.user.profile as any)?.currentRole || participant.user.email.split('@')[0];
          const message = matchNames.length > 0
            ? `Hi ${userName}! Thanks for attending "${event.name}"! Your top matches:\n\n${matchNames.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nOpen Cleya.ai to review and accept introductions!`
            : `Hi ${userName}! Thanks for attending "${event.name}"! We're finding connections for you — check Cleya.ai soon!`;

          try {
            const result = await messagingService.sendWhatsApp(participant.userId, phone, message);
            if (result && result.status === 'FAILED') {
              await messagingService.sendSMS(participant.userId, phone, message);
            }
            sent++;
          } catch (err) {
            console.error(`[EventFlow] Follow-up failed for ${participant.userId}:`, err);
          }
        }

        console.log(`[EventFlow] Post-event follow-up sent to ${sent}/${event.participants.length} participants`);
      } catch (error) {
        console.error(`[EventFlow] Post-event follow-up failed for event ${eventId}:`, error);
      }
    }, delayMs);
  }

  async triggerCallForUser(userId: string, phoneNumber: string) {
    return callService.initiateCall(userId, phoneNumber);
  }

  async triggerMessageForUser(
    userId: string,
    phoneNumber: string,
    channel: 'SMS' | 'WHATSAPP',
    message: string
  ) {
    if (channel === 'WHATSAPP') {
      return messagingService.sendWhatsApp(userId, phoneNumber, message);
    }
    return messagingService.sendSMS(userId, phoneNumber, message);
  }
}

export const automationService = new AutomationService();
