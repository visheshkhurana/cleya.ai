"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIService = exports.MODEL_COST_PER_1K_TOKENS = exports.MODEL_PROVIDER_MAP = void 0;
exports.getProviderForModel = getProviderForModel;
exports.estimateCostUSD = estimateCostUSD;
exports.setUsageReporter = setUsageReporter;
exports.createAIService = createAIService;
const openai_1 = __importDefault(require("openai"));
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const generative_ai_1 = require("@google/generative-ai");
exports.MODEL_PROVIDER_MAP = {
    'gpt-4o': 'openai',
    'gpt-4o-mini': 'openai',
    'gpt-4-turbo-preview': 'openai',
    'claude-sonnet-4-20250514': 'anthropic',
    'claude-3-5-sonnet-20241022': 'anthropic',
    'claude-3-haiku-20240307': 'anthropic',
    'gemini-1.5-pro': 'google',
    'gemini-1.5-flash': 'google',
    'gemini-2.0-flash': 'google',
};
function getProviderForModel(model) {
    if (exports.MODEL_PROVIDER_MAP[model])
        return exports.MODEL_PROVIDER_MAP[model];
    if (model.startsWith('gpt-') || model.startsWith('o1') || model.startsWith('o3'))
        return 'openai';
    if (model.startsWith('claude-'))
        return 'anthropic';
    if (model.startsWith('gemini-'))
        return 'google';
    return 'openai';
}
exports.MODEL_COST_PER_1K_TOKENS = {
    'gpt-4o': { input: 0.0025, output: 0.01 },
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'gpt-4-turbo-preview': { input: 0.01, output: 0.03 },
    'claude-sonnet-4-20250514': { input: 0.003, output: 0.015 },
    'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
    'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 },
    'gemini-1.5-pro': { input: 0.00125, output: 0.005 },
    'gemini-1.5-flash': { input: 0.000075, output: 0.0003 },
    'gemini-2.0-flash': { input: 0.0001, output: 0.0004 },
};
function estimateCostUSD(model, promptTokens, completionTokens) {
    const rates = exports.MODEL_COST_PER_1K_TOKENS[model];
    if (!rates)
        return 0;
    return (promptTokens / 1000) * rates.input + (completionTokens / 1000) * rates.output;
}
let _usageReporter = null;
function setUsageReporter(reporter) {
    _usageReporter = reporter;
}
function reportSuccess(provider, model, usage) {
    try {
        _usageReporter?.onSuccess(provider, model, usage);
    }
    catch {
        /* never let telemetry break the caller */
    }
}
function reportError(provider, model, err) {
    try {
        _usageReporter?.onError(provider, model, err);
    }
    catch {
        /* never let telemetry break the caller */
    }
}
class AIService {
    openai;
    anthropic;
    google;
    config;
    constructor(config) {
        this.config = config;
        if (config.openaiKey) {
            this.openai = new openai_1.default({ apiKey: config.openaiKey });
        }
        if (config.anthropicKey) {
            this.anthropic = new sdk_1.default({ apiKey: config.anthropicKey });
        }
        if (config.googleKey) {
            this.google = new generative_ai_1.GoogleGenerativeAI(config.googleKey);
        }
    }
    async chat(messages, options) {
        const model = options?.model || this.config.model || 'gpt-4o-mini';
        const provider = options?.provider || getProviderForModel(model);
        if (provider === 'anthropic') {
            return this.chatAnthropic(messages, options);
        }
        if (provider === 'google') {
            return this.chatGoogle(messages, options);
        }
        return this.chatOpenAI(messages, options);
    }
    async chatOpenAI(messages, options) {
        if (!this.openai)
            throw new Error('OpenAI client not initialized — set OPENAI_API_KEY');
        const model = options?.model || this.config.model || 'gpt-4o-mini';
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        try {
            const response = await this.openai.chat.completions.create({
                model,
                messages: messages.map((m) => ({ role: m.role, content: m.content })),
                temperature: options?.temperature ?? this.config.temperature ?? 0.7,
                max_tokens: options?.maxTokens ?? this.config.maxTokens ?? 2048,
            }, { signal: controller.signal });
            const usage = response.usage
                ? {
                    promptTokens: response.usage.prompt_tokens,
                    completionTokens: response.usage.completion_tokens,
                    totalTokens: response.usage.total_tokens,
                }
                : undefined;
            reportSuccess('openai', model, usage);
            return {
                content: response.choices[0]?.message?.content || '',
                model,
                provider: 'openai',
                usage,
            };
        }
        catch (err) {
            reportError('openai', model, err);
            throw err;
        }
        finally {
            clearTimeout(timeout);
        }
    }
    async chatAnthropic(messages, options) {
        if (!this.anthropic)
            throw new Error('Anthropic client not initialized — set ANTHROPIC_API_KEY');
        const model = options?.model || this.config.model || 'claude-sonnet-4-20250514';
        const systemMsg = messages.find((m) => m.role === 'system');
        const chatMessages = messages
            .filter((m) => m.role !== 'system')
            .map((m) => ({
            role: m.role,
            content: m.content,
        }));
        try {
            const response = await this.anthropic.messages.create({
                model,
                max_tokens: options?.maxTokens ?? this.config.maxTokens ?? 2048,
                system: systemMsg?.content,
                messages: chatMessages,
            });
            const textBlock = response.content.find((b) => b.type === 'text');
            const usage = {
                promptTokens: response.usage.input_tokens,
                completionTokens: response.usage.output_tokens,
                totalTokens: response.usage.input_tokens + response.usage.output_tokens,
            };
            reportSuccess('anthropic', model, usage);
            return {
                content: textBlock?.text || '',
                model,
                provider: 'anthropic',
                usage,
            };
        }
        catch (err) {
            reportError('anthropic', model, err);
            throw err;
        }
    }
    async chatGoogle(messages, options) {
        if (!this.google)
            throw new Error('Google AI client not initialized — set GOOGLE_AI_API_KEY');
        const model = options?.model || this.config.model || 'gemini-1.5-flash';
        const systemMsg = messages.find((m) => m.role === 'system');
        const chatMessages = messages.filter((m) => m.role !== 'system');
        const genModel = this.google.getGenerativeModel({
            model,
            systemInstruction: systemMsg?.content,
            generationConfig: {
                temperature: options?.temperature ?? this.config.temperature ?? 0.7,
                maxOutputTokens: options?.maxTokens ?? this.config.maxTokens ?? 2048,
            },
        });
        const contents = chatMessages.map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
        }));
        try {
            const result = await genModel.generateContent({ contents });
            const response = result.response;
            const text = response.text();
            const usageMetadata = response.usageMetadata;
            const usage = usageMetadata
                ? {
                    promptTokens: usageMetadata.promptTokenCount || 0,
                    completionTokens: usageMetadata.candidatesTokenCount || 0,
                    totalTokens: usageMetadata.totalTokenCount || 0,
                }
                : undefined;
            reportSuccess('google', model, usage);
            return {
                content: text || '',
                model,
                provider: 'google',
                usage,
            };
        }
        catch (err) {
            reportError('google', model, err);
            throw err;
        }
    }
    async embed(text) {
        if (!this.openai)
            throw new Error('OpenAI client required for embeddings');
        const response = await this.openai.embeddings.create({
            model: this.config.embeddingModel || 'text-embedding-3-small',
            input: text,
        });
        return {
            vector: response.data[0].embedding,
            model: response.model,
        };
    }
    async embedBatch(texts) {
        if (!this.openai)
            throw new Error('OpenAI client required for embeddings');
        const response = await this.openai.embeddings.create({
            model: this.config.embeddingModel || 'text-embedding-3-small',
            input: texts,
        });
        return response.data.map((d) => ({
            vector: d.embedding,
            model: response.model,
        }));
    }
    async chatJSON(messages, options) {
        const response = await this.chat([
            ...messages,
            {
                role: 'system',
                content: 'You MUST respond with valid JSON only. No markdown, no explanation, just the JSON object.',
            },
        ], options);
        try {
            let cleaned = response.content.trim();
            if (cleaned.startsWith('```')) {
                cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
            }
            return JSON.parse(cleaned);
        }
        catch {
            throw new Error(`Failed to parse AI JSON response: ${response.content.substring(0, 200)}`);
        }
    }
}
exports.AIService = AIService;
function createAIService(config) {
    return new AIService({
        provider: process.env.AI_PROVIDER || 'openai',
        openaiKey: process.env.OPENAI_API_KEY,
        anthropicKey: process.env.ANTHROPIC_API_KEY,
        googleKey: process.env.GOOGLE_AI_API_KEY,
        embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
        ...config,
    });
}
//# sourceMappingURL=index.js.map