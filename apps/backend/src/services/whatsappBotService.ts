import { prisma, Prisma } from '@cleya/db';
import { messagingService } from './messagingService';
import { conversationService } from './conversationService';
import { matchingService } from './matchingService';
import { chatWithCleo } from './ai';

type WhatsAppMode = 'onboarding' | 'match_response' | 'intro_feedback' | 'free_chat';

interface FormFieldDef {
  name: string;
  label?: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
  options?: Array<{ label: string; value: string } | string>;
}

interface ChoiceDef {
  label: string;
  value: string;
}

interface FlowNode {
  id?: string;
  type: string;
  content?: string;
  choices?: ChoiceDef[];
  formSchema?: FormFieldDef[];
}

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

  private async getUserMode(userId: string): Promise<WhatsAppMode> {
    const activeConvo = await prisma.conversation.findFirst({
      where: { userId, flowId: 'onboarding_v1', status: 'ACTIVE' },
    });
    if (activeConvo) return 'onboarding';

    const pendingIntro = await prisma.introductionRecord.findFirst({
      where: {
        OR: [{ userAId: userId }, { userBId: userId }],
        status: 'SENT',
        outcome: null,
      },
      orderBy: { createdAt: 'desc' },
    });
    if (pendingIntro) return 'intro_feedback';

    const pendingMatch = await this.checkPendingMatchResponse(userId);
    if (pendingMatch) return 'match_response';

    return 'free_chat';
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

    const hasCompletedOnboarding = user.profile?.isComplete || user.onboardingComplete;
    if (!hasCompletedOnboarding) {
      const activeConvo = await prisma.conversation.findFirst({
        where: { userId: user.id, flowId: 'onboarding_v1', status: 'ACTIVE' },
      });
      if (activeConvo) {
        await this.handleOnboardingMessage(user.id, from, cleanText, activeConvo.id);
        return;
      }
      await this.startOnboardingViaWhatsApp(user.id, from);
      return;
    }

    const mode = await this.getUserMode(user.id);
    console.log(`[WhatsApp Bot] User ${user.id} mode: ${mode}`);

    switch (mode) {
      case 'onboarding': {
        const activeConvo = await prisma.conversation.findFirst({
          where: { userId: user.id, flowId: 'onboarding_v1', status: 'ACTIVE' },
        });
        if (activeConvo) {
          await this.handleOnboardingMessage(user.id, from, cleanText, activeConvo.id);
        } else {
          await this.startOnboardingViaWhatsApp(user.id, from);
        }
        break;
      }
      case 'match_response': {
        const pendingMatch = await this.checkPendingMatchResponse(user.id);
        if (pendingMatch) {
          const handled = await this.handleMatchResponse(user.id, from, cleanText, pendingMatch);
          if (handled) break;
        }
        await this.handleAIChatMessage(user.id, from, cleanText);
        break;
      }
      case 'intro_feedback': {
        const handled = await this.handleIntroFeedback(user.id, from, cleanText);
        if (handled) break;
        await this.handleAIChatMessage(user.id, from, cleanText);
        break;
      }
      case 'free_chat':
      default:
        await this.handleAIChatMessage(user.id, from, cleanText);
        break;
    }
  }

  private async startOnboardingViaWhatsApp(userId: string, phone: string): Promise<void> {
    try {
      const result = await conversationService.startConversation(userId, 'onboarding_v1');
      let node = result.node as FlowNode;
      let conversationId = result.conversationId;

      if (node.type === 'message' && node.content) {
        await this.sendReply(phone, node.content);
        const advanced = await conversationService.processInput(conversationId, { textInput: '_auto_advance_' });
        if (!('errors' in advanced)) {
          node = advanced.node as FlowNode;
        }
      }

      let message = node.content || '';

      if (node.type === 'choices' && node.choices) {
        message += '\n\nPlease reply with a number:';
        node.choices.forEach((c: ChoiceDef, i: number) => {
          message += `\n${i + 1}. ${c.label.replace(/^[^\s]+\s/, '')}`;
        });
      }

      if (message.trim()) {
        await this.sendReply(phone, message);
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`[WhatsApp Bot] Failed to start onboarding for ${userId}:`, errMsg);
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

      const currentNode = flow.nodes[conversation.currentNode || ''] as FlowNode | undefined;
      if (!currentNode) {
        await this.sendReply(phone, `Something went wrong. Please continue at https://cleya.ai/chat`);
        return;
      }

      let input: Record<string, unknown> = {};

      if (currentNode.type === 'choices' && currentNode.choices) {
        const choiceValue = this.parseChoiceInput(currentNode.choices, text);
        if (choiceValue === null) {
          let hint = `Please reply with a number (1-${currentNode.choices.length}):`;
          currentNode.choices.forEach((c: ChoiceDef, i: number) => {
            hint += `\n${i + 1}. ${c.label.replace(/^[^\s]+\s/, '')}`;
          });
          await this.sendReply(phone, hint);
          return;
        }
        input.choiceValue = choiceValue;
      } else if (currentNode.type === 'form' && currentNode.formSchema) {
        const formResult = await this.handleFormInput(conversationId, conversation, currentNode, text, phone);
        if (formResult === null) return;
        input = formResult;
      } else {
        input.textInput = text;
      }

      const result = await conversationService.processInput(conversationId, input);

      if ('errors' in result && result.errors) {
        const errorMsg = Object.values(result.errors as Record<string, string>).join('\n');
        await this.sendReply(phone, `Please fix:\n${errorMsg}`);
        return;
      }

      const responseNode = result.node as FlowNode;
      let message = responseNode.content || '';

      if (responseNode.type === 'choices' && responseNode.choices) {
        message += '\n\nReply with a number:';
        responseNode.choices.forEach((c: ChoiceDef, i: number) => {
          message += `\n${i + 1}. ${c.label.replace(/^[^\s]+\s/, '')}`;
        });
      } else if (responseNode.type === 'form' && responseNode.formSchema) {
        const fieldsToAsk = responseNode.formSchema.filter((f: FormFieldDef) => f.required);
        const fields = fieldsToAsk.length > 0 ? fieldsToAsk : responseNode.formSchema.slice(0, 4);
        if (fields.length > 0) {
          message += `\n\n${this.buildFieldPrompt(fields[0])}`;

          const currentCtx = (await prisma.conversation.findUnique({ where: { id: conversationId } }))?.context as Record<string, unknown> || {};
          await prisma.conversation.update({
            where: { id: conversationId },
            data: {
              context: {
                ...currentCtx,
                [`_wa_form_field_idx_${responseNode.id}`]: 0,
              } as Prisma.InputJsonValue,
            },
          });
        }
      }

      if (result.isComplete) {
        message += `\n\n You're all set! I'll now start finding the best connections for you. You can chat with me here anytime.`;
      }

      if (message.trim()) {
        await this.sendReply(phone, message);
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`[WhatsApp Bot] Onboarding error for ${userId}:`, errMsg);
      await this.sendReply(phone, `Something went wrong. You can continue your onboarding at https://cleya.ai/chat`);
    }
  }

  private async handleFormInput(
    conversationId: string,
    conversation: { context: unknown; currentNode: string | null },
    currentNode: FlowNode,
    text: string,
    phone: string
  ): Promise<Record<string, unknown> | null> {
    const context = (conversation.context as Record<string, unknown>) || {};
    const waFormKey = `_wa_form_field_idx_${conversation.currentNode}`;
    const fieldIdx = (context[waFormKey] as number) || 0;

    const formSchema = currentNode.formSchema!;
    const requiredFields = formSchema.filter((f: FormFieldDef) => f.required);
    const fieldsToCollect = requiredFields.length > 0 ? requiredFields : formSchema.slice(0, 4);

    if (fieldIdx < fieldsToCollect.length) {
      const field = fieldsToCollect[fieldIdx];

      const parsedValue = this.parseFormFieldValue(field, text);
      if (parsedValue === null) {
        await this.sendReply(phone, this.buildFieldPrompt(field));
        return null;
      }

      const formData: Record<string, unknown> = {};
      formData[field.name] = parsedValue;

      const nextIdx = fieldIdx + 1;

      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          context: { ...context, ...formData, [waFormKey]: nextIdx } as Prisma.InputJsonValue,
        },
      });

      if (nextIdx < fieldsToCollect.length) {
        await this.sendReply(phone, this.buildFieldPrompt(fieldsToCollect[nextIdx]));
        return null;
      }

      const updatedContext = (await prisma.conversation.findUnique({ where: { id: conversationId } }))?.context as Record<string, unknown> || {};
      const allFormData: Record<string, unknown> = {};
      for (const f of fieldsToCollect) {
        if (updatedContext[f.name] !== undefined) allFormData[f.name] = updatedContext[f.name];
      }

      const cleanedContext = { ...context };
      for (const f of formSchema) {
        delete cleanedContext[`_wa_form_field_idx_${f.name}`];
      }
      delete cleanedContext[waFormKey];

      await prisma.conversation.update({
        where: { id: conversationId },
        data: { context: cleanedContext as Prisma.InputJsonValue },
      });

      return { formData: allFormData };
    }

    return { formData: { [formSchema[0].name]: text } };
  }

  private async checkPendingMatchResponse(userId: string) {
    return prisma.match.findFirst({
      where: {
        OR: [
          { userAId: userId, userAResponse: 'PENDING' },
          { userBId: userId, userBResponse: 'PENDING' },
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

  private async handleMatchResponse(
    userId: string,
    phone: string,
    text: string,
    match: Awaited<ReturnType<typeof this.checkPendingMatchResponse>>
  ): Promise<boolean> {
    if (!match) return false;

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
      const otherResponse = isUserA ? match.userBResponse : match.userAResponse;

      const response: 'ACCEPTED' | 'REJECTED' = isAccept ? 'ACCEPTED' : 'REJECTED';

      await matchingService.respondToMatch(match.id, userId, response);

      if (isAccept) {
        const bothAccepted = otherResponse === 'ACCEPTED';
        await this.sendReply(phone,
          `Great! I've noted your interest in connecting with *${otherName}*. ${
            bothAccepted ? "They're interested too! I'll make the intro." : "I'll let you know when they respond."
          }`
        );
      } else {
        await this.sendReply(phone, `No worries! I'll keep looking for better matches for you.`);
      }

      return true;
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`[WhatsApp Bot] Match response error:`, errMsg);
      return false;
    }
  }

  private async handleIntroFeedback(userId: string, phone: string, text: string): Promise<boolean> {
    const lower = text.toLowerCase().trim();

    const positiveWords = ['great', 'good', 'excellent', 'amazing', 'helpful', 'positive', 'connected', 'met', 'scheduled', 'call', 'meeting', 'yes', '1'];
    const negativeWords = ['bad', 'poor', 'negative', 'unresponsive', 'ghosted', 'no response', 'no', '2'];
    const neutralWords = ['okay', 'fine', 'neutral', 'pending', 'waiting', '3'];

    let outcome: string | null = null;
    if (positiveWords.some(w => lower.includes(w))) {
      outcome = 'POSITIVE';
    } else if (negativeWords.some(w => lower.includes(w))) {
      outcome = 'NEGATIVE';
    } else if (neutralWords.some(w => lower.includes(w))) {
      outcome = 'NEUTRAL';
    }

    if (!outcome) return false;

    try {
      const pendingIntro = await prisma.introductionRecord.findFirst({
        where: {
          OR: [{ userAId: userId }, { userBId: userId }],
          status: 'SENT',
          outcome: null,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!pendingIntro) return false;

      await prisma.introductionRecord.update({
        where: { id: pendingIntro.id },
        data: {
          outcome,
          outcomeNotes: text,
          status: 'RESPONDED',
        },
      });

      const feedbackMessages: Record<string, string> = {
        POSITIVE: `That's wonderful to hear! I'm glad the intro went well. I'll keep finding great connections for you.`,
        NEGATIVE: `Sorry to hear that. I'll take this into account for future matches. Let me know if there's anything specific I should look for.`,
        NEUTRAL: `Thanks for the update. I'll keep this in mind for future intros. Feel free to chat with me anytime.`,
      };

      await this.sendReply(phone, feedbackMessages[outcome]);
      return true;
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`[WhatsApp Bot] Intro feedback error:`, errMsg);
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
          role: m.content.startsWith('[INBOUND]') ? ('user' as const) : ('assistant' as const),
          content: m.content.replace(/^\[INBOUND\]\s*/, ''),
        }));

      const result = await chatWithCleo(userId, text, history);
      const reply = result.content || 'I couldn\'t process that right now. Please try again.';

      await this.sendReply(phone, reply);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`[WhatsApp Bot] AI chat error for ${userId}:`, errMsg);
      await this.sendReply(phone, `I'm having trouble processing that right now. You can also chat at https://cleya.ai/chat`);
    }
  }

  private parseChoiceInput(choices: ChoiceDef[], text: string): string | null {
    const num = parseInt(text);
    if (num >= 1 && num <= choices.length) {
      return choices[num - 1].value;
    }
    const lowerText = text.toLowerCase();
    const matched = choices.find((c) =>
      c.label.toLowerCase().includes(lowerText) || c.value.toLowerCase() === lowerText
    );
    return matched ? matched.value : null;
  }

  private getOptionValue(o: { label: string; value: string } | string): string {
    return typeof o === 'string' ? o : o.value;
  }

  private getOptionLabel(o: { label: string; value: string } | string): string {
    return typeof o === 'string' ? o : o.label;
  }

  private parseFormFieldValue(field: FormFieldDef, text: string): unknown {
    if (field.type === 'select' && field.options) {
      const num = parseInt(text);
      if (num >= 1 && num <= field.options.length) {
        return this.getOptionValue(field.options[num - 1]);
      }
      const lowerText = text.toLowerCase();
      const matched = field.options.find((o) =>
        this.getOptionLabel(o).toLowerCase().includes(lowerText) ||
        this.getOptionValue(o).toLowerCase() === lowerText
      );
      return matched ? this.getOptionValue(matched) : null;
    }

    if (field.type === 'multiselect' && field.options) {
      const parts = text.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
      const selected: string[] = [];
      for (const part of parts) {
        const num = parseInt(part);
        if (num >= 1 && num <= field.options.length) {
          selected.push(this.getOptionValue(field.options[num - 1]));
        } else {
          const lowerPart = part.toLowerCase();
          const matched = field.options.find((o) =>
            this.getOptionLabel(o).toLowerCase().includes(lowerPart) ||
            this.getOptionValue(o).toLowerCase() === lowerPart
          );
          if (matched) selected.push(this.getOptionValue(matched));
        }
      }
      return selected.length > 0 ? selected : null;
    }

    return text;
  }

  private buildFieldPrompt(field: FormFieldDef): string {
    let prompt = field.label || '';

    if (field.type === 'select' && field.options) {
      prompt += '\n\nReply with a number:';
      field.options.forEach((o, i) => {
        prompt += `\n${i + 1}. ${this.getOptionLabel(o)}`;
      });
    } else if (field.type === 'multiselect' && field.options) {
      prompt += '\n\nReply with numbers separated by commas (e.g. 1,3,5):';
      field.options.forEach((o, i) => {
        prompt += `\n${i + 1}. ${this.getOptionLabel(o)}`;
      });
    } else if (field.placeholder) {
      prompt += `\n(e.g. ${field.placeholder})`;
    }
    return prompt;
  }

  private async sendReply(phone: string, message: string): Promise<void> {
    if (messagingService.getActiveProvider() === 'none') {
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

    if (user) {
      await messagingService.sendWhatsApp(user.id, phone, message);
    } else {
      await messagingService.sendWhatsAppDirect(phone, message);
    }
  }

  private async logInboundMessage(userId: string, phone: string, content: string): Promise<void> {
    try {
      const provider = messagingService.getActiveProvider().toUpperCase() || 'WHATSAPP';
      await prisma.messageRecord.create({
        data: {
          userId,
          recipientPhone: phone,
          channel: 'WHATSAPP',
          content: `[INBOUND] ${content}`,
          status: 'DELIVERED',
          provider,
        },
      });
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error(`[WhatsApp Bot] Failed to log inbound message:`, errMsg);
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

  async getWhatsAppUsers() {
    const users = await prisma.user.findMany({
      where: { whatsappOptedIn: true },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        whatsappPhone: true,
        whatsappOptedIn: true,
        createdAt: true,
        messageRecords: {
          where: { channel: 'WHATSAPP' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { createdAt: true, status: true, content: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const usersWithCounts = await Promise.all(
      users.map(async (user) => {
        const messageCount = await prisma.messageRecord.count({
          where: { userId: user.id, channel: 'WHATSAPP' },
        });
        return { ...user, messageCount };
      })
    );

    return usersWithCounts;
  }
}

export const whatsappBotService = new WhatsAppBotService();
