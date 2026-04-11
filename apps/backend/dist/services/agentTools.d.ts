/**
 * Agent Tools — bridges agent LLM responses to real actions (social posting, ads, analytics).
 *
 * Each agent has a permitted set of tools. When the LLM returns a tool_call,
 * the system validates access and executes via the underlying service.
 */
export declare const AGENT_TOOLS: Record<string, string[]>;
export interface ToolDefinition {
    name: string;
    description: string;
    parameters: Record<string, any>;
}
export declare const TOOL_DEFINITIONS: Record<string, ToolDefinition>;
export declare function getToolsForAgent(agentId: string): ToolDefinition[];
export declare function getOpenAIToolSchemas(agentId: string): Array<{
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: Record<string, any>;
    };
}>;
export interface ToolCallResult {
    success: boolean;
    toolName: string;
    result?: any;
    error?: string;
}
export declare function executeTool(agentId: string, toolName: string, params: Record<string, any>): Promise<ToolCallResult>;
export interface ParsedToolCall {
    id: string;
    name: string;
    arguments: Record<string, any>;
}
export declare function parseToolCallsFromResponse(response: any): ParsedToolCall[];
//# sourceMappingURL=agentTools.d.ts.map