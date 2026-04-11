import { FlowNode } from '@cleya/types';
export declare class ConversationService {
    private engine;
    private ai;
    constructor();
    getFlow(flowId: string): import("@cleya/types").ConversationFlow | undefined;
    startConversation(userId: string, flowId?: string): Promise<{
        conversationId: string;
        node: FlowNode;
        messages: {
            sender: import(".prisma/client").$Enums.MessageSender;
            content: string;
            nodeId: string | null;
            createdAt: Date;
        }[];
    } | {
        conversationId: string;
        node: FlowNode;
        messages: {
            sender: string;
            content: string | undefined;
            nodeId: string;
        }[];
    }>;
    resumeConversation(conversationId: string): Promise<{
        conversationId: string;
        node: FlowNode;
        messages: {
            sender: import(".prisma/client").$Enums.MessageSender;
            content: string;
            nodeId: string | null;
            createdAt: Date;
        }[];
    }>;
    processInput(conversationId: string, input: {
        choiceValue?: string;
        formData?: Record<string, any>;
        textInput?: string;
    }): Promise<{
        errors: Record<string, string>;
        node?: undefined;
        isComplete?: undefined;
    } | {
        node: {
            content: string;
            id: string;
            type: import("@cleya/types").NodeType;
            choices?: import("@cleya/types").FlowChoice[];
            formSchema?: import("@cleya/types").FormField[];
            condition?: import("@cleya/types").FlowCondition;
            next?: string | null;
            metadata?: Record<string, any>;
        };
        isComplete: boolean;
        errors?: undefined;
    }>;
    private generateProfileSummary;
    private handleAction;
}
export declare const conversationService: ConversationService;
//# sourceMappingURL=conversationService.d.ts.map