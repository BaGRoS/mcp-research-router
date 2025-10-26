/**
 * OpenAI Provider Adapter
 *
 * Implements the ProviderAdapter interface for OpenAI's Responses API.
 * Supports GPT-5, GPT-5-mini, and GPT-5-nano with web search capabilities.
 */

import { httpPost } from '../utils/http.js';
import type { ProviderAdapter, ProviderResult, TokenUsage, Citation } from '../types.js';

/**
 * OpenAI API configuration
 */
const OPENAI_API_URL = 'https://api.openai.com/v1/responses';
const API_KEY = process.env.OPENAI_API_KEY;

/**
 * Available OpenAI models (Frontier models only)
 */
const MODELS = [
  'gpt-5',
  'gpt-5-mini',
  'gpt-5-nano'
];

/**
 * Default model
 */
const DEFAULT_MODEL = 'gpt-5-mini';

/**
 * OpenAI Responses API request body interface
 */
interface OpenAIRequest {
  model: string;
  input: string;
  tools?: Array<{
    type: 'web_search';
    search_context_size?: 'low' | 'medium' | 'high';
    user_location?: {
      type: 'approximate';
      country?: string;
    };
  }>;
  temperature?: number;
  max_output_tokens?: number;
}

/**
 * OpenAI Responses API response interface
 */
interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  output_text: string;
  tool_outputs?: {
    web_search?: Array<{
      url: string;
      title: string;
      snippet?: string;
    }>;
  };
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
        input: question,
        tools: [
          {
            type: 'web_search',
            search_context_size: 'high',
            user_location: {
              type: 'approximate',
              country: 'US'
            }
          }
        ],
        temperature: 0.2,
        max_output_tokens: 4000
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
      const content = response.data.output_text || '';

      // Parse citations from web search results
      let citations: Citation[] | undefined;
      if (response.data.tool_outputs?.web_search) {
        citations = response.data.tool_outputs.web_search.map((result, index) => ({
          title: result.title,
          url: result.url,
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
        provider: 'openai',
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