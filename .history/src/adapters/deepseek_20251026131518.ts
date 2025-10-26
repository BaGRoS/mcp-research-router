/**
 * DeepSeek Provider Adapter
 * 
 * Implements the ProviderAdapter interface for DeepSeek's Chat API.
 * Supports DeepSeek Chat and Coder models.
 */

import { httpPost } from '../utils/http.js';
import type { ProviderAdapter, ProviderResult, TokenUsage } from '../types.js';

/**
 * DeepSeek API configuration
 */
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const API_KEY = process.env.DEEPSEEK_API_KEY;

/**
 * Available DeepSeek models
 */
const MODELS = [
  'deepseek-chat',
  'deepseek-coder'
];

/**
 * Default model
 */
const DEFAULT_MODEL = 'deepseek-chat';

/**
 * DeepSeek API request body interface
 */
interface DeepSeekRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
}

/**
 * DeepSeek API response interface
 */
interface DeepSeekResponse {
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
 * DeepSeek provider adapter implementation
 */
class DeepSeekAdapter implements ProviderAdapter {
  /**
   * Query DeepSeek with a research question
   */
  async query(
    question: string,
    model: string,
    questionId: string
  ): Promise<ProviderResult> {
    if (!this.validateConfig()) {
      throw new Error('DeepSeek API key not configured');
    }

    const startTime = Date.now();

    try {
      const requestBody: DeepSeekRequest = {
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

      const response = await httpPost<DeepSeekResponse>(
        DEEPSEEK_API_URL,
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
        provider: 'deepseek',
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
        provider: 'deepseek',
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
   * List available DeepSeek models
   */
  listModels(): string[] {
    return [...MODELS];
  }

  /**
   * Validate DeepSeek configuration
   */
  validateConfig(): boolean {
    return !!API_KEY && API_KEY.length > 0;
  }

  /**
   * Get default DeepSeek model
   */
  getDefaultModel(): string {
    return DEFAULT_MODEL;
  }
}

/**
 * Export singleton instance
 */
export const deepseekAdapter = new DeepSeekAdapter();

/**
 * Export class for testing
 */
export { DeepSeekAdapter };