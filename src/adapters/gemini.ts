/**
 * Google Gemini Provider Adapter
 * 
 * Implements the ProviderAdapter interface for Google's Gemini API.
 * Supports Gemini 2.5 Flash and Pro models.
 */

import { httpPost } from '../utils/http.js';
import type { ProviderAdapter, ProviderResult, TokenUsage } from '../types.js';

/**
 * Gemini API configuration
 */
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1/models';
const API_KEY = process.env.GOOGLE_API_KEY;

/**
 * Available Gemini models
 */
const MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-pro'
];

/**
 * Default model
 */
const DEFAULT_MODEL = 'gemini-2.5-flash';

/**
 * Gemini API request body interface
 */
interface GeminiRequest {
  contents: Array<{
    parts: Array<{
      text: string;
    }>;
    role?: string;
  }>;
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
  };
}

/**
 * Gemini API response interface
 */
interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
      role: string;
    };
    finishReason: string;
    index: number;
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

/**
 * Gemini provider adapter implementation
 */
class GeminiAdapter implements ProviderAdapter {
  /**
   * Query Gemini with a research question
   */
  async query(
    question: string,
    model: string,
    questionId: string
  ): Promise<ProviderResult> {
    if (!this.validateConfig()) {
      throw new Error('Google API key not configured');
    }

    const startTime = Date.now();

    try {
      const requestBody: GeminiRequest = {
        contents: [
          {
            parts: [
              {
                text: `You are a helpful research assistant. Provide accurate, detailed, and well-sourced information.\n\nQuestion: ${question}`
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4000
        }
      };

      const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${API_KEY}`;

      const response = await httpPost<GeminiResponse>(
        url,
        requestBody,
        {
          'Content-Type': 'application/json'
        },
        {
          timeoutMs: 60000,
          maxRetries: 3
        }
      );

      const latencyMs = Date.now() - startTime;
      const content = response.data.candidates[0]?.content?.parts[0]?.text || '';

      // Parse token usage if available
      let usage: TokenUsage | undefined;
      if (response.data.usageMetadata) {
        usage = {
          promptTokens: response.data.usageMetadata.promptTokenCount,
          completionTokens: response.data.usageMetadata.candidatesTokenCount,
          totalTokens: response.data.usageMetadata.totalTokenCount
        };
      }

      return {
        provider: 'gemini',
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
        provider: 'gemini',
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
   * List available Gemini models
   */
  listModels(): string[] {
    return [...MODELS];
  }

  /**
   * Validate Gemini configuration
   */
  validateConfig(): boolean {
    return !!API_KEY && API_KEY.length > 0;
  }

  /**
   * Get default Gemini model
   */
  getDefaultModel(): string {
    return DEFAULT_MODEL;
  }
}

/**
 * Export singleton instance
 */
export const geminiAdapter = new GeminiAdapter();

/**
 * Export class for testing
 */
export { GeminiAdapter };