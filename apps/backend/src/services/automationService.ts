import { prisma } from '@boardy/db';
import { callService } from './voice/callService';
import { messagingService } from './messagingService';
import { matchingService } from './matchingService';

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

    if (persona === 'DEAL_PARTNER') {
      this.scheduleDealPartnerScout(userId);
    } else if (persona === 'VENTURE_PARTNER') {
      this.scheduleVenturePartnerMatch(userId);
    } else if (persona === 'EVENT_PARTICIPANT') {
      this.scheduleEventRegistration(userId, context);
      this.scheduleAutoMatch(userId);
    } else {
      this.scheduleAutoMatch(userId);
    }

    if (!phoneNumber) {
      console.log(`No phone number for user ${userId}, skipping call/messaging automation`);
      return;
    }

    this.scheduleCall(userId, phoneNumber);
    this.sendWelcomeMessages(userId, phoneNumber, userName);
  }

  private scheduleAutoMatch(userId: string) {
    setTimeout(async () => {
      try {
        console.log(`[AutoMatch] Finding matches for user ${userId}`);
        const proposed = await matchingService.findAndAutoPropose(userId, 5);
        console.log(`[AutoMatch] Proposed ${proposed.length} matches for ${userId}`);
      } catch (error) {
        console.error(`[AutoMatch] Failed for user ${userId}:`, error);
      }
    }, 5000);
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

  private scheduleVenturePartnerMatch(userId: string) {
    setTimeout(async () => {
      try {
        console.log(`[VPFlow] Finding thesis-matched founders for venture partner ${userId}`);
        const proposed = await matchingService.findAndAutoPropose(userId, 5);
        console.log(`[VPFlow] Proposed ${proposed.length} thesis-matched founders for VP ${userId}`);
      } catch (error) {
        console.error(`[VPFlow] Auto-match failed for venture partner ${userId}:`, error);
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
    const welcomeMessage = messagingService.getWelcomeMessage(userName);

    const whatsappResult = await messagingService.sendWhatsApp(userId, phoneNumber, welcomeMessage);

    if (whatsappResult.status === 'FAILED') {
      console.log(`WhatsApp failed for ${userId}, falling back to SMS`);
      await messagingService.sendSMS(userId, phoneNumber, welcomeMessage);
    }
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
