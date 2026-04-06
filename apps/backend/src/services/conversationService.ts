import { prisma } from '@cleya/db';
import { ConversationEngine } from '@cleya/conversation-engine';
import { onboardingFlow } from '@cleya/conversation-engine';
import { createAIService, AIService } from '@cleya/ai';
import { FlowNode } from '@cleya/types';
import { sendToUser } from '../websocket/server';
import { profileService } from './profileService';
import { automationService } from './automationService';

export class ConversationService {
  private engine: ConversationEngine;
  private ai: AIService;

  constructor() {
    this.engine = new ConversationEngine();
    this.engine.registerFlow(onboardingFlow);
    this.ai = createAIService();
  }

  getFlow(flowId: string) {
    return this.engine.getFlow(flowId);
  }

  async startConversation(userId: string, flowId: string = 'onboarding_v1') {
    // Check if user already has an active conversation for this flow
    const existing = await prisma.conversation.findFirst({
      where: { userId, flowId, status: 'ACTIVE' },
    });

    if (existing) {
      return this.resumeConversation(existing.id);
    }

    const result = this.engine.start(flowId, '');

    const conversation = await prisma.conversation.create({
      data: {
        userId,
        flowId,
        status: 'ACTIVE',
        currentNode: result.state.currentNodeId,
        context: {},
      },
    });

    // Save AI's first message
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        sender: 'AI',
        content: result.node.content || '',
        nodeId: result.node.id,
      },
    });

    return {
      conversationId: conversation.id,
      node: result.node,
      messages: [
        {
          sender: 'AI',
          content: result.node.content,
          nodeId: result.node.id,
        },
      ],
    };
  }

  async resumeConversation(conversationId: string) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!conversation) throw new Error('Conversation not found');

    const flow = this.engine.getFlow(conversation.flowId);
    if (!flow) throw new Error('Flow not found');

    const currentNode = flow.nodes[conversation.currentNode || ''];

    return {
      conversationId: conversation.id,
      node: currentNode,
      messages: conversation.messages.map((m) => ({
        sender: m.sender,
        content: m.content,
        nodeId: m.nodeId,
        createdAt: m.createdAt,
      })),
    };
  }

  async processInput(
    conversationId: string,
    input: {
      choiceValue?: string;
      formData?: Record<string, any>;
      textInput?: string;
    }
  ) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) throw new Error('Conversation not found');
    if (conversation.status !== 'ACTIVE') throw new Error('Conversation is not active');

    const currentContext = (conversation.context as Record<string, any>) || {};

    // Build engine state from DB
    const state = {
      conversationId,
      flowId: conversation.flowId,
      currentNodeId: conversation.currentNode || '',
      context: currentContext,
      history: [],
      isComplete: false,
    };

    // Validate form data if current node is a form
    const flow = this.engine.getFlow(conversation.flowId);
    if (flow && input.formData) {
      const currentNode = flow.nodes[state.currentNodeId];
      if (currentNode?.type === 'form' && currentNode.formSchema) {
        const validation = this.engine.validateFormInput(currentNode.formSchema, input.formData);
        if (!validation.valid) {
          return { errors: validation.errors };
        }
      }
    }

    // Save user message
    const userContent = input.textInput || input.choiceValue || JSON.stringify(input.formData || {});
    await prisma.message.create({
      data: {
        conversationId,
        sender: 'USER',
        content: userContent,
        nodeId: state.currentNodeId,
        metadata: input.formData ? { formData: input.formData } : undefined,
      },
    });

    // Advance the state machine
    const result = this.engine.advance(state, input);

    // Update conversation in DB
    const updatedContext = { ...currentContext, ...result.state.context };

    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        currentNode: result.state.currentNodeId,
        context: updatedContext,
        status: result.state.isComplete ? 'COMPLETED' : 'ACTIVE',
        completedAt: result.state.isComplete ? new Date() : undefined,
      },
    });

    let nodeContent = result.node.content || '';

    if (result.node.id === 'profile_confirmation') {
      nodeContent = this.generateProfileSummary(updatedContext);
    }

    if (nodeContent) {
      await prisma.message.create({
        data: {
          conversationId,
          sender: 'AI',
          content: nodeContent,
          nodeId: result.node.id,
        },
      });
    }

    if (result.node.metadata?.action) {
      await this.handleAction(
        result.node.metadata.action,
        conversation.userId,
        updatedContext
      );
    }

    sendToUser(conversation.userId, 'chat:response', {
      conversationId,
      node: { ...result.node, content: nodeContent },
    });

    return {
      node: { ...result.node, content: nodeContent },
      isComplete: result.state.isComplete,
    };
  }

  private generateProfileSummary(context: Record<string, any>): string {
    const persona = context.persona_select_choice || context.persona_select || 'user';
    const name = context.companyName || '';
    const role = context.currentRole || '';
    const headline = context.headline || '';
    const location = context.location || '';
    const industries = context.industries || [];
    const companyStage = context.companyStage || context.founder_stage_choice || context.event_stage_choice || context.investor_stage_choice || '';
    const investorType = context.investorType || context.investor_type_choice || '';
    const workStyle = context.workStyle || context.talent_work_style_choice || '';
    const targetRole = context.talent_target_role_choice || '';

    const personaLabels: Record<string, string> = {
      FOUNDER: 'Founder',
      INVESTOR: 'Investor',
      TALENT: 'Job Seeker',
      DEAL_PARTNER: 'Deal Partner',
      EVENT_PARTICIPANT: 'Event Participant',
      OTHER: 'Professional',
    };

    const personaLabel = personaLabels[persona] || 'Professional';
    let summary = `here's what i've got on you — let me know if anything's off:\n\n`;
    summary += `📋 **Your Profile**\n\n`;
    summary += `**Type:** ${personaLabel}\n`;
    if (role) summary += `**Role:** ${role}\n`;
    if (name) summary += `**Company/Fund:** ${name}\n`;
    if (headline) summary += `**Focus:** ${headline}\n`;
    if (companyStage) summary += `**Stage:** ${companyStage.replace(/_/g, ' ')}\n`;
    if (location) summary += `**Location:** ${location}\n`;
    if (industries.length > 0) {
      const industryLabels = industries.map((i: string) => i.replace(/_/g, ' ').replace(/\b[a-z]/g, (c: string) => c.toUpperCase()));
      summary += `**Industries:** ${industryLabels.join(', ')}\n`;
    }

    if (persona === 'FOUNDER') {
      if (context.businessDescription) summary += `**About:** ${context.businessDescription}\n`;
      if (context.raiseAmount) summary += `**Raising:** ${context.raiseAmount}\n`;
      if (context.keyTractionPoints) summary += `**Traction:** ${context.keyTractionPoints}\n`;
      const priority = context.founder_priority_choice;
      if (priority) summary += `**Priority:** ${priority.replace(/_/g, ' ')}\n`;
    } else if (persona === 'INVESTOR') {
      if (investorType) summary += `**Investor type:** ${investorType}\n`;
      if (context.investmentAmount) summary += `**Check size:** ${context.investmentAmount}\n`;
      if (context.portfolioCompanies) summary += `**Portfolio:** ${context.portfolioCompanies}\n`;
    } else if (persona === 'TALENT') {
      if (targetRole) summary += `**Target role:** ${targetRole.replace(/_/g, ' ')}\n`;
      if (workStyle) summary += `**Work style:** ${workStyle.replace(/_/g, ' ')}\n`;
    }

    summary += `\ndoes this capture you well? if it looks good, let's go find your matches! you can always tweak things later from your dashboard.`;
    return summary;
  }

  private async handleAction(action: string, userId: string, context: Record<string, any>) {
    switch (action) {
      case 'schedule_call':
        // Trigger voice call service
        console.log(`📞 Scheduling call for user ${userId}`);
        break;

      case 'complete_onboarding':
        await profileService.updateFromConversation(userId, context);
        console.log(`Onboarding complete for user ${userId}`);
        automationService.onOnboardingComplete(userId, context).catch((err) => {
          console.error(`Post-onboarding automation failed for ${userId}:`, err);
        });
        break;
    }
  }
}

export const conversationService = new ConversationService();
