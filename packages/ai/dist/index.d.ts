export interface LLMMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}
export interface LLMResponse {
    content: string;
    model?: string;
    provider?: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}
export interface EmbeddingResponse {
    vector: number[];
    model: string;
}
export type LLMProvider = 'openai' | 'anthropic' | 'google';
export interface LLMConfig {
    provider: LLMProvider;
    openaiKey?: string;
    anthropicKey?: string;
    googleKey?: string;
    model?: string;
    embeddingModel?: string;
    temperature?: number;
    maxTokens?: number;
}
export declare const MODEL_PROVIDER_MAP: Record<string, LLMProvider>;
export declare function getProviderForModel(model: string): LLMProvider;
export declare const MODEL_COST_PER_1K_TOKENS: Record<string, {
    input: number;
    output: number;
}>;
export declare function estimateCostUSD(model: string, promptTokens: number, completionTokens: number): number;
export declare class AIService {
    private openai?;
    private anthropic?;
    private google?;
    private config;
    constructor(config: LLMConfig);
    chat(messages: LLMMessage[], options?: Partial<LLMConfig>): Promise<LLMResponse>;
    private chatOpenAI;
    private chatAnthropic;
    private chatGoogle;
    embed(text: string): Promise<EmbeddingResponse>;
    embedBatch(texts: string[]): Promise<EmbeddingResponse[]>;
    chatJSON<T = any>(messages: LLMMessage[], options?: Partial<LLMConfig>): Promise<T>;
}
export declare function createAIService(config?: Partial<LLMConfig>): AIService;
//# sourceMappingURL=index.d.ts.map