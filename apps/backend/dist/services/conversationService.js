"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.conversationService = exports.ConversationService = void 0;
const db_1 = require("@cleya/db");
const conversation_engine_1 = require("@cleya/conversation-engine");
const conversation_engine_2 = require("@cleya/conversation-engine");
const ai_1 = require("@cleya/ai");
const server_1 = require("../websocket/server");
const profileService_1 = require("./profileService");
const automationService_1 = require("./automationService");
class ConversationService {
    engine;
    ai;
    constructor() {
        this.engine = new conversation_engine_1.ConversationEngine();
        this.engine.registerFlow(conversation_engine_2.onboardingFlow);
        this.ai = (0, ai_1.createAIService)();
    }
    getFlow(flowId) {
        return this.engine.getFlow(flowId);
    }
    async startConversation(userId, flowId = 'onboarding_v1') {
        // Check if user already has an active conversation for this flow
        const existing = await db_1.prisma.conversation.findFirst({
            where: { userId, flowId, status: 'ACTIVE' },
        });
        if (existing) {
            // Recovery: if the saved currentNode no longer exists in the (possibly updated) flow,
            // OR is a stale transition like an investor message that was renamed, abandon the
            // stale conversation and start fresh so the user is never stuck on a missing node.
            const flow = this.engine.getFlow(flowId);
            const stillValid = !!(flow && existing.currentNode && flow.nodes[existing.currentNode]);
            if (stillValid) {
                return this.resumeConversation(existing.id);
            }
            console.log(`[Conversation] Stale node "${existing.currentNode}" for user ${userId}; abandoning conversation ${existing.id} and restarting.`);
            await db_1.prisma.conversation.update({
                where: { id: existing.id },
                data: { status: 'ABANDONED', completedAt: new Date() },
            });
            // Fall through to start a brand-new conversation.
        }
        const result = this.engine.start(flowId, '');
        const conversation = await db_1.prisma.conversation.create({
            data: {
                userId,
                flowId,
                status: 'ACTIVE',
                currentNode: result.state.currentNodeId,
                context: {},
            },
        });
        // Save AI's first message
        await db_1.prisma.message.create({
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
    async resumeConversation(conversationId) {
        const conversation = await db_1.prisma.conversation.findUnique({
            where: { id: conversationId },
            include: {
                messages: { orderBy: { createdAt: 'asc' } },
            },
        });
        if (!conversation)
            throw new Error('Conversation not found');
        const flow = this.engine.getFlow(conversation.flowId);
        if (!flow)
            throw new Error('Flow not found');
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
    async processInput(conversationId, input) {
        const conversation = await db_1.prisma.conversation.findUnique({
            where: { id: conversationId },
        });
        if (!conversation)
            throw new Error('Conversation not found');
        if (conversation.status !== 'ACTIVE')
            throw new Error('Conversation is not active');
        const currentContext = conversation.context || {};
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
        await db_1.prisma.message.create({
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
        await db_1.prisma.conversation.update({
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
            await db_1.prisma.message.create({
                data: {
                    conversationId,
                    sender: 'AI',
                    content: nodeContent,
                    nodeId: result.node.id,
                },
            });
        }
        if (result.node.metadata?.action) {
            await this.handleAction(result.node.metadata.action, conversation.userId, updatedContext);
        }
        (0, server_1.sendToUser)(conversation.userId, 'chat:response', {
            conversationId,
            node: { ...result.node, content: nodeContent },
        });
        return {
            node: { ...result.node, content: nodeContent },
            isComplete: result.state.isComplete,
        };
    }
    generateProfileSummary(context) {
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
        const personaLabels = {
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
        if (role)
            summary += `**Role:** ${role}\n`;
        if (name)
            summary += `**Company/Fund:** ${name}\n`;
        if (headline)
            summary += `**Focus:** ${headline}\n`;
        if (companyStage)
            summary += `**Stage:** ${companyStage.replace(/_/g, ' ')}\n`;
        if (location)
            summary += `**Location:** ${location}\n`;
        if (industries.length > 0) {
            const industryLabels = industries.map((i) => i.replace(/_/g, ' ').replace(/\b[a-z]/g, (c) => c.toUpperCase()));
            summary += `**Industries:** ${industryLabels.join(', ')}\n`;
        }
        if (persona === 'FOUNDER') {
            if (context.businessDescription)
                summary += `**About:** ${context.businessDescription}\n`;
            if (context.raiseAmount)
                summary += `**Raising:** ${context.raiseAmount}\n`;
            if (context.keyTractionPoints)
                summary += `**Traction:** ${context.keyTractionPoints}\n`;
            const priority = context.founder_priority_choice;
            if (priority)
                summary += `**Priority:** ${priority.replace(/_/g, ' ')}\n`;
        }
        else if (persona === 'INVESTOR') {
            if (investorType)
                summary += `**Investor type:** ${investorType}\n`;
            if (context.investmentAmount)
                summary += `**Check size:** ${context.investmentAmount}\n`;
            if (context.portfolioCompanies)
                summary += `**Portfolio:** ${context.portfolioCompanies}\n`;
        }
        else if (persona === 'TALENT') {
            if (targetRole)
                summary += `**Target role:** ${targetRole.replace(/_/g, ' ')}\n`;
            if (workStyle)
                summary += `**Work style:** ${workStyle.replace(/_/g, ' ')}\n`;
        }
        summary += `\ndoes this capture you well? if it looks good, let's go find your matches! you can always tweak things later from your dashboard.`;
        return summary;
    }
    async handleAction(action, userId, context) {
        switch (action) {
            case 'schedule_call':
                // Trigger voice call service
                console.log(`📞 Scheduling call for user ${userId}`);
                break;
            case 'complete_onboarding':
                await profileService_1.profileService.updateFromConversation(userId, context);
                console.log(`Onboarding complete for user ${userId}`);
                automationService_1.automationService.onOnboardingComplete(userId, context).catch((err) => {
                    console.error(`Post-onboarding automation failed for ${userId}:`, err);
                });
                break;
        }
    }
}
exports.ConversationService = ConversationService;
exports.conversationService = new ConversationService();
//# sourceMappingURL=conversationService.js.map