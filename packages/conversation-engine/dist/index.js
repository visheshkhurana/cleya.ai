"use strict";
// ============================================
// Cleya.ai — Conversation Engine
// JSON-driven state machine for onboarding flows
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.onboardingFlow = exports.engine = exports.ConversationEngine = void 0;
class ConversationEngine {
    flows = new Map();
    registerFlow(flow) {
        this.flows.set(flow.id, flow);
    }
    getFlow(flowId) {
        return this.flows.get(flowId);
    }
    // Start a new conversation
    start(flowId, conversationId) {
        const flow = this.flows.get(flowId);
        if (!flow)
            throw new Error(`Flow not found: ${flowId}`);
        const startNode = flow.nodes[flow.startNode];
        if (!startNode)
            throw new Error(`Start node not found: ${flow.startNode}`);
        const state = {
            conversationId,
            flowId,
            currentNodeId: flow.startNode,
            context: {},
            history: [flow.startNode],
            isComplete: false,
        };
        return { node: startNode, state, shouldSave: true };
    }
    // Process user input and advance the state machine
    advance(state, input) {
        const flow = this.flows.get(state.flowId);
        if (!flow)
            throw new Error(`Flow not found: ${state.flowId}`);
        const currentNode = flow.nodes[state.currentNodeId];
        if (!currentNode)
            throw new Error(`Node not found: ${state.currentNodeId}`);
        // Store input in context
        if (input.choiceValue) {
            state.context[`${state.currentNodeId}_choice`] = input.choiceValue;
        }
        if (input.formData) {
            Object.assign(state.context, input.formData);
        }
        if (input.textInput) {
            state.context[`${state.currentNodeId}_text`] = input.textInput;
        }
        // Determine next node
        let nextNodeId = null;
        switch (currentNode.type) {
            case 'message':
                nextNodeId = currentNode.next || null;
                break;
            case 'choices':
                if (input.choiceValue && currentNode.choices) {
                    const selectedChoice = currentNode.choices.find((c) => c.value === input.choiceValue);
                    nextNodeId = selectedChoice?.next || currentNode.next || null;
                }
                break;
            case 'form':
                nextNodeId = currentNode.next || null;
                break;
            case 'conditional':
                if (currentNode.condition) {
                    const fieldValue = state.context[currentNode.condition.field];
                    const matches = evaluateCondition(fieldValue, currentNode.condition.operator, currentNode.condition.value);
                    nextNodeId = matches
                        ? currentNode.condition.trueBranch
                        : currentNode.condition.falseBranch;
                }
                break;
            case 'ai_response':
                nextNodeId = currentNode.next || null;
                break;
        }
        // Check if conversation is complete
        if (!nextNodeId) {
            state.isComplete = true;
            return { node: currentNode, state, shouldSave: true };
        }
        const nextNode = flow.nodes[nextNodeId];
        if (!nextNode)
            throw new Error(`Next node not found: ${nextNodeId}`);
        state.currentNodeId = nextNodeId;
        state.history.push(nextNodeId);
        // Auto-advance through conditional nodes
        if (nextNode.type === 'conditional') {
            return this.advance(state, {});
        }
        return { node: nextNode, state, shouldSave: true };
    }
    // Validate form input against schema
    validateFormInput(formSchema, data) {
        const errors = {};
        for (const field of formSchema) {
            const value = data[field.name];
            // Check conditional visibility
            if (field.conditional) {
                const condValue = data[field.conditional.field];
                if (condValue !== field.conditional.value)
                    continue;
            }
            // Required check
            if (field.required && (value === undefined || value === null || value === '')) {
                errors[field.name] = `${field.label} is required`;
                continue;
            }
            if (value === undefined || value === null || value === '')
                continue;
            // Type-specific validation
            if (field.validation) {
                if (field.validation.min !== undefined && typeof value === 'string' && value.length < field.validation.min) {
                    errors[field.name] = field.validation.message || `Minimum ${field.validation.min} characters`;
                }
                if (field.validation.max !== undefined && typeof value === 'string' && value.length > field.validation.max) {
                    errors[field.name] = field.validation.message || `Maximum ${field.validation.max} characters`;
                }
                if (field.validation.pattern && !new RegExp(field.validation.pattern).test(String(value))) {
                    errors[field.name] = field.validation.message || `Invalid format`;
                }
            }
            // Email validation
            if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) {
                errors[field.name] = 'Invalid email address';
            }
            // URL validation
            if (field.type === 'url' && value) {
                try {
                    new URL(String(value));
                }
                catch {
                    errors[field.name] = 'Invalid URL';
                }
            }
        }
        return { valid: Object.keys(errors).length === 0, errors };
    }
}
exports.ConversationEngine = ConversationEngine;
function evaluateCondition(fieldValue, operator, compareValue) {
    switch (operator) {
        case 'eq':
            return fieldValue === compareValue;
        case 'neq':
            return fieldValue !== compareValue;
        case 'in':
            return Array.isArray(compareValue) && compareValue.includes(fieldValue);
        case 'gt':
            return Number(fieldValue) > Number(compareValue);
        case 'lt':
            return Number(fieldValue) < Number(compareValue);
        default:
            return false;
    }
}
// Export the engine singleton
exports.engine = new ConversationEngine();
// Re-export flows
var onboarding_1 = require("./flows/onboarding");
Object.defineProperty(exports, "onboardingFlow", { enumerable: true, get: function () { return onboarding_1.onboardingFlow; } });
//# sourceMappingURL=index.js.map