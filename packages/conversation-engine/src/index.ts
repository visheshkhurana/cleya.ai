// ============================================
// Cleo.ai — Conversation Engine
// JSON-driven state machine for onboarding flows
// ============================================

import { ConversationFlow, FlowNode, FlowChoice, FormField } from '@boardy/types';

export interface ConversationState {
  conversationId: string;
  flowId: string;
  currentNodeId: string;
  context: Record<string, any>; // Accumulated user data
  history: string[];            // Node IDs visited
  isComplete: boolean;
}

export interface EngineResponse {
  node: FlowNode;
  state: ConversationState;
  shouldSave: boolean;
}

export class ConversationEngine {
  private flows: Map<string, ConversationFlow> = new Map();

  registerFlow(flow: ConversationFlow): void {
    this.flows.set(flow.id, flow);
  }

  getFlow(flowId: string): ConversationFlow | undefined {
    return this.flows.get(flowId);
  }

  // Start a new conversation
  start(flowId: string, conversationId: string): EngineResponse {
    const flow = this.flows.get(flowId);
    if (!flow) throw new Error(`Flow not found: ${flowId}`);

    const startNode = flow.nodes[flow.startNode];
    if (!startNode) throw new Error(`Start node not found: ${flow.startNode}`);

    const state: ConversationState = {
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
  advance(
    state: ConversationState,
    input: {
      choiceValue?: string;
      formData?: Record<string, any>;
      textInput?: string;
    }
  ): EngineResponse {
    const flow = this.flows.get(state.flowId);
    if (!flow) throw new Error(`Flow not found: ${state.flowId}`);

    const currentNode = flow.nodes[state.currentNodeId];
    if (!currentNode) throw new Error(`Node not found: ${state.currentNodeId}`);

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
    let nextNodeId: string | null = null;

    switch (currentNode.type) {
      case 'message':
        nextNodeId = currentNode.next || null;
        break;

      case 'choices':
        if (input.choiceValue && currentNode.choices) {
          const selectedChoice = currentNode.choices.find(
            (c: FlowChoice) => c.value === input.choiceValue
          );
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
    if (!nextNode) throw new Error(`Next node not found: ${nextNodeId}`);

    state.currentNodeId = nextNodeId;
    state.history.push(nextNodeId);

    // Auto-advance through conditional nodes
    if (nextNode.type === 'conditional') {
      return this.advance(state, {});
    }

    return { node: nextNode, state, shouldSave: true };
  }

  // Validate form input against schema
  validateFormInput(formSchema: FormField[], data: Record<string, any>): { valid: boolean; errors: Record<string, string> } {
    const errors: Record<string, string> = {};

    for (const field of formSchema) {
      const value = data[field.name];

      // Check conditional visibility
      if (field.conditional) {
        const condValue = data[field.conditional.field];
        if (condValue !== field.conditional.value) continue;
      }

      // Required check
      if (field.required && (value === undefined || value === null || value === '')) {
        errors[field.name] = `${field.label} is required`;
        continue;
      }

      if (value === undefined || value === null || value === '') continue;

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
        } catch {
          errors[field.name] = 'Invalid URL';
        }
      }
    }

    return { valid: Object.keys(errors).length === 0, errors };
  }
}

function evaluateCondition(fieldValue: any, operator: string, compareValue: any): boolean {
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
export const engine = new ConversationEngine();
