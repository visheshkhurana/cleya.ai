import { ConversationFlow, FlowNode, FormField } from '@cleya/types';
export interface ConversationState {
    conversationId: string;
    flowId: string;
    currentNodeId: string;
    context: Record<string, any>;
    history: string[];
    isComplete: boolean;
}
export interface EngineResponse {
    node: FlowNode;
    state: ConversationState;
    shouldSave: boolean;
}
export declare class ConversationEngine {
    private flows;
    registerFlow(flow: ConversationFlow): void;
    getFlow(flowId: string): ConversationFlow | undefined;
    start(flowId: string, conversationId: string): EngineResponse;
    advance(state: ConversationState, input: {
        choiceValue?: string;
        formData?: Record<string, any>;
        textInput?: string;
    }): EngineResponse;
    validateFormInput(formSchema: FormField[], data: Record<string, any>): {
        valid: boolean;
        errors: Record<string, string>;
    };
}
export declare const engine: ConversationEngine;
export { onboardingFlow } from './flows/onboarding';
//# sourceMappingURL=index.d.ts.map