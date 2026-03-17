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
