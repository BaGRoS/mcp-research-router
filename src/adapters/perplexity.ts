/**
 * Perplexity Provider Adapter
 * 
 * Implements the ProviderAdapter interface for Perplexity's Sonar API.
 * Supports Sonar and Sonar Pro models with citation extraction.
 */

import { httpPost } from '../utils/http.js';
import type { ProviderAdapter, ProviderResult, Citation, TokenUsage } from '../types.js';

/**
 * Perplexity API configuration
 */
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';
const API_KEY = process.env.PERPLEXITY_API_KEY;

/**
 * Available Perplexity models
 */
const MODELS = [
  'sonar-pro',
  'sonar',
  'sonar-medium'
];

/**
 * Default model
 */
const DEFAULT_MODEL = 'sonar';

/**
 * Perplexity API request body interface
 */
interface PerplexityRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
  return_citations?: boolean;
}

/**
 * Perplexity API response interface
 */
interface PerplexityResponse {
  id: string;
  model: string;
  created: number;
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
  citations?: string[];
}

/**
 * Perplexity provider adapter implementation
 */
class PerplexityAdapter implements ProviderAdapter {
  /**
   * Query Perplexity with a research question
   */
  async query(
    question: string,
    model: string,
    questionId: string
  ): Promise<ProviderResult> {
    if (!this.validateConfig()) {
      throw new Error('Perplexity API key not configured');
    }

    const startTime = Date.now();

    try {
      const requestBody: PerplexityRequest = {
        model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful research assistant. Provide accurate, detailed, and well-sourced information with citations.'
          },
          {
            role: 'user',
            content: question
          }
        ],
        temperature: 0.2,
        max_tokens: 4000,
        return_citations: true
      };

      const response = await httpPost<PerplexityResponse>(
        PERPLEXITY_API_URL,
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

      // Parse citations if available
      let citations: Citation[] | undefined;
      if (response.data.citations && response.data.citations.length > 0) {
        citations = response.data.citations.map((url, index) => ({
          title: url,
          url,
          index: index + 1
        }));
      }

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
        provider: 'perplexity',
        model,
        questionId,
        content,
        citations,
        usage,
        latencyMs,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      const latencyMs = Date.now() - startTime;
      
      return {
        provider: 'perplexity',
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
   * List available Perplexity models
   */
  listModels(): string[] {
    return [...MODELS];
  }

  /**
   * Validate Perplexity configuration
   */
  validateConfig(): boolean {
    return !!API_KEY && API_KEY.length > 0;
  }

  /**
   * Get default Perplexity model
   */
  getDefaultModel(): string {
    return DEFAULT_MODEL;
  }
}

/**
 * Export singleton instance
 */
export const perplexityAdapter = new PerplexityAdapter();

/**
 * Export class for testing
 */
export { PerplexityAdapter };