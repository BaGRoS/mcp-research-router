/**
 * OpenAI Provider Adapter
 * 
 * Implements the ProviderAdapter interface for OpenAI's Chat Completions API.
 * Supports GPT-5, GPT-5-mini, GPT-5-nano, GPT-4, and GPT-3.5-turbo models.
 */

import { httpPost } from '../utils/http.js';
import type { ProviderAdapter, ProviderResult, TokenUsage } from '../types.js';

/**
 * OpenAI API configuration
 */
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const API_KEY = process.env.OPENAI_API_KEY;

/**
 * Available OpenAI models
 */
const MODELS = [
  'gpt-5',
  'gpt-5-mini',
  'gpt-5-nano',
  'gpt-4',
  'gpt-4-turbo',
  'gpt-3.5-turbo'
];

/**
 * Default model
 */
const DEFAULT_MODEL = 'gpt-5-mini';

/**
 * OpenAI API request body interface
 */
interface OpenAIRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
}

/**
 * OpenAI API response interface
 */
interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * OpenAI provider adapter implementation
 */
class OpenAIAdapter implements ProviderAdapter {
  /**
   * Query OpenAI with a research question
   */
  async query(
    question: string,
    model: string,
    questionId: string
  ): Promise<ProviderResult> {
    if (!this.validateConfig()) {
      throw new Error('OpenAI API key not configured');
    }

    const startTime = Date.now();

    try {
      const requestBody: OpenAIRequest = {
        model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful research assistant. Provide accurate, detailed, and well-sourced information.'
          },
          {
            role: 'user',
            content: question
          }
        ],
        temperature: 0.7,
        max_tokens: 4000
      };

      const response = await httpPost<OpenAIResponse>(
        OPENAI_API_URL,
        requestBody,
        {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        {
          timeoutMs: 60000,
          maxRetries: 3
        }
      );

      const latencyMs = Date.now() - startTime;
      const content = response.data.choices[0]?.message?.content || '';

      // Parse token usage if available
      let usage: TokenUsage | undefined;
      if (response.data.usage) {
        usage = {
          promptTokens: response.data.usage.prompt_tokens,
          completionTokens: response.data.usage.completion_tokens,
          totalTokens: response.data.usage.total_tokens
        };
      }

      return {
        provider: 'openai',
        model,
        questionId,
        content,
        usage,
        latencyMs,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      const latencyMs = Date.now() - startTime;
      
      return {
        provider: 'openai',
        model,
        questionId,
        content: '',
        latencyMs,
        timestamp: new Date().toISOString(),
        error: (error as Error).message
      };
    }
  }

  /**
   * List available OpenAI models
   */
  listModels(): string[] {
    return [...MODELS];
  }

  /**
   * Validate OpenAI configuration
   */
  validateConfig(): boolean {
    return !!API_KEY && API_KEY.length > 0;
  }

  /**
   * Get default OpenAI model
   */
  getDefaultModel(): string {
    return DEFAULT_MODEL;
  }
}

/**
 * Export singleton instance
 */
export const openaiAdapter = new OpenAIAdapter();

/**
 * Export class for testing
 */
export { OpenAIAdapter };