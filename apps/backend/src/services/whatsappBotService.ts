import { prisma } from '@cleya/db';
import { gupshupService } from './gupshupService';
import { conversationService } from './conversationService';
import { chatWithCleo } from './ai';

const recentlyProcessed = new Map<string, number>();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of recentlyProcessed) {
    if (now - v > 60_000) recentlyProcessed.delete(k);
  }
}, 30_000);

export class WhatsAppBotService {
  private formatPhone(phone: string): string {
    return phone.replace(/[\s\-()whatsapp:+]/g, '');
  }

  async handleInboundMessage(from: string, text: string, messageId?: string): Promise<void> {
    if (!text || !text.trim()) return;

    if (messageId) {
      if (recentlyProcessed.has(messageId)) return;
      recentlyProcessed.set(messageId, Date.now());
    }

    const cleanText = text.trim();
    const formattedFrom = this.formatPhone(from);

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { phone: { contains: formattedFrom.slice(-10) } },
          { whatsappPhone: { contains: formattedFrom.slice(-10) } },
        ],
      },
      include: { profile: true },
    });

    if (!user) {
      console.log(`[WhatsApp Bot] Message from unknown number ${from}: "${cleanText}"`);
      await this.sendReply(from, `Hi! I'm Cleya, an AI superconnector for India's startup ecosystem. To get started, please sign up at https://cleya.ai and add your phone number. I'll then be able to help you find the right connections!`);
      return;
    }

    if (!user.whatsappOptedIn) {
      await prisma.user.update({
        where: { id: user.id },
        data: { whatsappOptedIn: true, whatsappPhone: from },
      });
      console.log(`[WhatsApp Bot] Auto opted-in user ${user.id}`);
    }

    await this.logInboundMessage(user.id, from, cleanText);

    const pendingMatch = await this.checkPendingMatchResponse(user.id);
    if (pendingMatch) {
      const handled = await this.handleMatchResponse(user.id, from, cleanText, pendingMatch);
      if (handled) return;
    }

    const activeConversation = await prisma.conversation.findFirst({
      where: { userId: user.id, flowId: 'onboarding_v1', status: 'ACTIVE' },
    });

    if (activeConversation) {
      await this.handleOnboardingMessage(user.id, from, cleanText, activeConversation.id);
      return;
    }

    const hasCompletedOnboarding = user.profile?.isComplete || user.onboardingComplete;
    if (!hasCompletedOnboarding) {
      await this.startOnboardingViaWhatsApp(user.id, from);
      return;
    }

    await this.handleAIChatMessage(user.id, from, cleanText);
  }

  private async startOnboardingViaWhatsApp(userId: string, phone: string): Promise<void> {
    try {
      const result = await conversationService.startConversation(userId, 'onboarding_v1');
      const node = result.node;

      let message = node.content || '';

      if (node.type === 'choices' && node.choices) {
        message += '\n\nPlease reply with a number:';
        node.choices.forEach((c: any, i: number) => {
          message += `\n${i + 1}. ${c.label.replace(/^[^\s]+\s/, '')}`;
        });
      }

      await this.sendReply(phone, message);
    } catch (error: any) {
      console.error(`[WhatsApp Bot] Failed to start onboarding for ${userId}:`, error.message);
      await this.sendReply(phone, `Something went wrong starting your onboarding. Please try again at https://cleya.ai/chat`);
    }
  }

  private async handleOnboardingMessage(userId: string, phone: string, text: string, conversationId: string): Promise<void> {
    try {
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
      });
      if (!conversation || conversation.status !== 'ACTIVE') {
        await this.handleAIChatMessage(userId, phone, text);
        return;
      }

      const flow = conversationService.getFlow(conversation.flowId);
      if (!flow) {
        await this.sendReply(phone, `Something went wrong. Please continue at https://cleya.ai/chat`);
        return;
      }

      const currentNode = flow.nodes[conversation.currentNode || ''];
      if (!currentNode) {
        await this.sendReply(phone, `Something went wrong. Please continue at https://cleya.ai/chat`);
        return;
      }

      let input: any = {};

      if (currentNode.type === 'choices' && currentNode.choices) {
        const num = parseInt(text);
        if (num >= 1 && num <= currentNode.choices.length) {
          input.choiceValue = currentNode.choices[num - 1].value;
        } else {
          const lowerText = text.toLowerCase();
          const matched = currentNode.choices.find((c: any) =>
            c.label.toLowerCase().includes(lowerText) ||
            c.value.toLowerCase() === lowerText
          );
          if (matched) {
            input.choiceValue = matched.value;
          } else {
            let hint = `Please reply with a number (1-${currentNode.choices.length}):`;
            currentNode.choices.forEach((c: any, i: number) => {
              hint += `\n${i + 1}. ${c.label.replace(/^[^\s]+\s/, '')}`;
            });
            await this.sendReply(phone, hint);
            return;
          }
        }
      } else if (currentNode.type === 'form' && currentNode.formSchema) {
        const context = (conversation.context as Record<string, any>) || {};
        const waFormKey = `_wa_form_field_idx_${conversation.currentNode}`;
        const fieldIdx = (context[waFormKey] as number) || 0;

        const requiredFields = currentNode.formSchema.filter((f: any) => f.required);
        const allFields = currentNode.formSchema;
        const fieldsToCollect = requiredFields.length > 0 ? requiredFields : allFields.slice(0, 4);

        if (fieldIdx < fieldsToCollect.length) {
          const field = fieldsToCollect[fieldIdx];
          const formData: Record<string, any> = {};
          formData[field.name] = text;

          const nextIdx = fieldIdx + 1;

          await prisma.conversation.update({
            where: { id: conversationId },
            data: {
              context: { ...context, ...formData, [waFormKey]: nextIdx },
            },
          });

          if (nextIdx < fieldsToCollect.length) {
            const nextField = fieldsToCollect[nextIdx];
            let prompt = nextField.label;
            if (nextField.placeholder) prompt += `\n(e.g. ${nextField.placeholder})`;
            await this.sendReply(phone, prompt);
            return;
          }

          const allFormData: Record<string, any> = {};
          for (const f of fieldsToCollect) {
            if (context[f.name]) allFormData[f.name] = context[f.name];
          }
          allFormData[field.name] = text;

          const cleanedContext = { ...context };
          for (const f of allFields) {
            delete cleanedContext[`_wa_form_field_idx_${f.name}`];
          }
          delete cleanedContext[waFormKey];

          await prisma.conversation.update({
            where: { id: conversationId },
            data: { context: cleanedContext },
          });

          input.formData = allFormData;
        } else {
          input.formData = { [allFields[0].name]: text };
        }
      } else if (currentNode.type === 'message') {
        input.textInput = text;
      } else {
        input.textInput = text;
      }

      const result = await conversationService.processInput(conversationId, input);

      if ('errors' in result && result.errors) {
        const errorMsg = Object.values(result.errors).join('\n');
        await this.sendReply(phone, `Please fix:\n${errorMsg}`);
        return;
      }

      const responseNode = result.node;
      let message = responseNode.content || '';

      if (responseNode.type === 'choices' && responseNode.choices) {
        message += '\n\nReply with a number:';
        responseNode.choices.forEach((c: any, i: number) => {
          message += `\n${i + 1}. ${c.label.replace(/^[^\s]+\s/, '')}`;
        });
      } else if (responseNode.type === 'form' && responseNode.formSchema) {
        const fieldsToAsk = responseNode.formSchema.filter((f: any) => f.required);
        const fields = fieldsToAsk.length > 0 ? fieldsToAsk : responseNode.formSchema.slice(0, 4);
        if (fields.length > 0) {
          const firstField = fields[0];
          message += `\n\n${firstField.label}`;
          if (firstField.placeholder) message += `\n(e.g. ${firstField.placeholder})`;

          await prisma.conversation.update({
            where: { id: conversationId },
            data: {
              context: {
                ...(await prisma.conversation.findUnique({ where: { id: conversationId } }))?.context as any || {},
                [`_wa_form_field_idx_${responseNode.id}`]: 0,
              },
            },
          });
        }
      }

      if (result.isComplete) {
        message += `\n\n✅ You're all set! I'll now start finding the best connections for you. You can chat with me here anytime.`;
      }

      if (message.trim()) {
        await this.sendReply(phone, message);
      }
    } catch (error: any) {
      console.error(`[WhatsApp Bot] Onboarding error for ${userId}:`, error.message);
      await this.sendReply(phone, `Something went wrong. You can continue your onboarding at https://cleya.ai/chat`);
    }
  }

  private async checkPendingMatchResponse(userId: string) {
    return prisma.match.findFirst({
      where: {
        OR: [
          { userAId: userId, userAResponse: null },
          { userBId: userId, userBResponse: null },
        ],
        status: { in: ['PROPOSED', 'PENDING_A', 'PENDING_B'] },
      },
      include: {
        userA: { include: { profile: true } },
        userB: { include: { profile: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async handleMatchResponse(userId: string, phone: string, text: string, match: any): Promise<boolean> {
    const lower = text.toLowerCase().trim();
    const acceptWords = ['yes', 'accept', 'connect', 'sure', 'ok', 'okay', 'yeah', 'yep', 'y', '1'];
    const declineWords = ['no', 'decline', 'pass', 'skip', 'nah', 'nope', 'n', '2'];

    const isAccept = acceptWords.includes(lower);
    const isDecline = declineWords.includes(lower);

    if (!isAccept && !isDecline) return false;

    try {
      const isUserA = match.userAId === userId;
      const otherUser = isUserA ? match.userB : match.userA;
      const otherName = otherUser?.name || otherUser?.profile?.currentRole || 'your match';

      const response = isAccept ? 'ACCEPTED' : 'REJECTED';

      const updateData: any = {};
      if (isUserA) {
        updateData.userAResponse = response;
        updateData.userARespondedAt = new Date();
      } else {
        updateData.userBResponse = response;
        updateData.userBRespondedAt = new Date();
      }

      const otherResponse = isUserA ? match.userBResponse : match.userAResponse;

      if (isAccept && otherResponse === 'ACCEPTED') {
        updateData.status = 'ACCEPTED';
      } else if (isDecline) {
        updateData.status = 'REJECTED';
      } else if (isAccept) {
        updateData.status = isUserA ? 'PENDING_B' : 'PENDING_A';
      }

      await prisma.match.update({
        where: { id: match.id },
        data: updateData,
      });

      if (isAccept) {
        await this.sendReply(phone, `Great! I've noted your interest in connecting with *${otherName}*. ${otherResponse === 'ACCEPTED' ? "They're interested too! I'll make the intro." : "I'll let you know when they respond."}`);
      } else {
        await this.sendReply(phone, `No worries! I'll keep looking for better matches for you.`);
      }

      return true;
    } catch (error: any) {
      console.error(`[WhatsApp Bot] Match response error:`, error.message);
      return false;
    }
  }

  private async handleAIChatMessage(userId: string, phone: string, text: string): Promise<void> {
    try {
      const recentMessages = await prisma.messageRecord.findMany({
        where: { userId, channel: 'WHATSAPP' },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      const history = recentMessages
        .reverse()
        .map((m) => ({
          role: m.recipientPhone ? ('assistant' as const) : ('user' as const),
          content: m.content,
        }));

      const result = await chatWithCleo(userId, text, history);
      const reply = result.content || 'I couldn\'t process that right now. Please try again.';

      await this.sendReply(phone, reply);
    } catch (error: any) {
      console.error(`[WhatsApp Bot] AI chat error for ${userId}:`, error.message);
      await this.sendReply(phone, `I'm having trouble processing that right now. You can also chat at https://cleya.ai/chat`);
    }
  }

  private async sendReply(phone: string, message: string): Promise<void> {
    if (!gupshupService.isConfigured()) {
      console.log(`[WhatsApp Bot] Would send to ${phone}: ${message.substring(0, 100)}...`);
      return;
    }

    const formattedPhone = this.formatPhone(phone);

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { phone: { contains: formattedPhone.slice(-10) } },
          { whatsappPhone: { contains: formattedPhone.slice(-10) } },
        ],
      },
    });

    const userId = user?.id || 'system';

    await gupshupService.sendWhatsApp(userId, phone, message);
  }

  private async logInboundMessage(userId: string, phone: string, content: string): Promise<void> {
    try {
      await prisma.messageRecord.create({
        data: {
          userId,
          recipientPhone: phone,
          channel: 'WHATSAPP',
          content: `[INBOUND] ${content}`,
          status: 'DELIVERED',
          provider: 'GUPSHUP',
        },
      });
    } catch (e: any) {
      console.error(`[WhatsApp Bot] Failed to log inbound message:`, e.message);
    }
  }

  async getWhatsAppActivity(limit: number = 50) {
    const messages = await prisma.messageRecord.findMany({
      where: { channel: 'WHATSAPP' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            whatsappPhone: true,
            whatsappOptedIn: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const optedInUsers = await prisma.user.count({
      where: { whatsappOptedIn: true },
    });

    const totalWhatsAppMessages = await prisma.messageRecord.count({
      where: { channel: 'WHATSAPP' },
    });

    const inboundCount = await prisma.messageRecord.count({
      where: {
        channel: 'WHATSAPP',
        content: { startsWith: '[INBOUND]' },
      },
    });

    const outboundCount = totalWhatsAppMessages - inboundCount;

    const deliveredCount = await prisma.messageRecord.count({
      where: { channel: 'WHATSAPP', status: 'DELIVERED' },
    });

    const failedCount = await prisma.messageRecord.count({
      where: { channel: 'WHATSAPP', status: 'FAILED' },
    });

    const activeConversations = await prisma.user.count({
      where: {
        whatsappOptedIn: true,
        messageRecords: {
          some: {
            channel: 'WHATSAPP',
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        },
      },
    });

    return {
      messages,
      stats: {
        optedInUsers,
        totalMessages: totalWhatsAppMessages,
        inboundCount,
        outboundCount,
        deliveredCount,
        failedCount,
        activeConversations,
      },
    };
  }
}

export const whatsappBotService = new WhatsAppBotService();
