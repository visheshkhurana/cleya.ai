// ============================================
// Cleo.ai — LLM Abstraction Layer
// Supports OpenAI and Anthropic with unified interface
// ============================================

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
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

export interface LLMConfig {
  provider: 'openai' | 'anthropic';
  openaiKey?: string;
  anthropicKey?: string;
  model?: string;
  embeddingModel?: string;
  temperature?: number;
  maxTokens?: number;
}

export class AIService {
  private openai?: OpenAI;
  private anthropic?: Anthropic;
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;

    if (config.openaiKey) {
      this.openai = new OpenAI({ apiKey: config.openaiKey });
    }
    if (config.anthropicKey) {
      this.anthropic = new Anthropic({ apiKey: config.anthropicKey });
    }
  }

  async chat(messages: LLMMessage[], options?: Partial<LLMConfig>): Promise<LLMResponse> {
    const provider = options?.provider || this.config.provider;

    if (provider === 'anthropic') {
      return this.chatAnthropic(messages, options);
    }
    return this.chatOpenAI(messages, options);
  }

  private async chatOpenAI(messages: LLMMessage[], options?: Partial<LLMConfig>): Promise<LLMResponse> {
    if (!this.openai) throw new Error('OpenAI client not initialized');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await this.openai.chat.completions.create({
        model: options?.model || this.config.model || 'gpt-4-turbo-preview',
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: options?.temperature ?? this.config.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? this.config.maxTokens ?? 2048,
      }, { signal: controller.signal as any });

      return {
        content: response.choices[0]?.message?.content || '',
        usage: response.usage
          ? {
              promptTokens: response.usage.prompt_tokens,
              completionTokens: response.usage.completion_tokens,
              totalTokens: response.usage.total_tokens,
            }
          : undefined,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async chatAnthropic(messages: LLMMessage[], options?: Partial<LLMConfig>): Promise<LLMResponse> {
    if (!this.anthropic) throw new Error('Anthropic client not initialized');

    // Extract system message
    const systemMsg = messages.find((m) => m.role === 'system');
    const chatMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const response = await this.anthropic.messages.create({
      model: options?.model || this.config.model || 'claude-sonnet-4-20250514',
      max_tokens: options?.maxTokens ?? this.config.maxTokens ?? 2048,
      system: systemMsg?.content,
      messages: chatMessages,
    });

    const textBlock = response.content.find((b) => b.type === 'text');

    return {
      content: textBlock?.text || '',
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    };
  }

  async embed(text: string): Promise<EmbeddingResponse> {
    if (!this.openai) throw new Error('OpenAI client required for embeddings');

    const response = await this.openai.embeddings.create({
      model: this.config.embeddingModel || 'text-embedding-3-small',
      input: text,
    });

    return {
      vector: response.data[0].embedding,
      model: response.model,
    };
  }

  async embedBatch(texts: string[]): Promise<EmbeddingResponse[]> {
    if (!this.openai) throw new Error('OpenAI client required for embeddings');

    const response = await this.openai.embeddings.create({
      model: this.config.embeddingModel || 'text-embedding-3-small',
      input: texts,
    });

    return response.data.map((d) => ({
      vector: d.embedding,
      model: response.model,
    }));
  }

  // Structured output: ask AI to return JSON
  async chatJSON<T = any>(messages: LLMMessage[], options?: Partial<LLMConfig>): Promise<T> {
    const response = await this.chat(
      [
        ...messages,
        {
          role: 'system',
          content: 'You MUST respond with valid JSON only. No markdown, no explanation, just the JSON object.',
        },
      ],
      options
    );

    try {
      // Strip markdown code fences if present
      let cleaned = response.content.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      return JSON.parse(cleaned);
    } catch {
      throw new Error(`Failed to parse AI JSON response: ${response.content.substring(0, 200)}`);
    }
  }
}

// Factory function
export function createAIService(config?: Partial<LLMConfig>): AIService {
  return new AIService({
    provider: (process.env.AI_PROVIDER as 'openai' | 'anthropic') || 'openai',
    openaiKey: process.env.OPENAI_API_KEY,
    anthropicKey: process.env.ANTHROPIC_API_KEY,
    embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
    ...config,
  });
}
