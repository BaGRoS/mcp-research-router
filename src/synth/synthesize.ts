/**
 * Synthesis Module
 *
 * Aggregates and synthesizes research results from multiple providers.
 * Performs deduplication, contradiction detection, and citation preservation.
 */

import { httpPost } from '../utils/http.js';
import { calculateTotalCost, calculateCostBreakdown } from '../utils/cost.js';
import { log } from '../utils/log.js';
import {
  logSynthesisRequest,
  logSynthesisResponse
} from '../utils/debug.js';
import type {
  ProviderResult,
  SynthesisResult,
  MetricsSummary
} from '../types.js';

/**
 * OpenAI API configuration for synthesis
 */
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const API_KEY = process.env.OPENAI_API_KEY;

/**
 * Default synthesis model
 */
const DEFAULT_SYNTHESIS_MODEL = 'gpt-5-mini';

/**
 * OpenAI Chat Completions API request interface
 */
interface SynthesisRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  max_completion_tokens?: number;
  // Note: GPT-5 models don't support custom temperature
}

/**
 * OpenAI Chat Completions API response interface
 */
interface SynthesisResponse {
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
 * Build synthesis prompt from provider results
 */
function buildSynthesisPrompt(results: ProviderResult[]): string {
  const sections: string[] = [
    '# Research Synthesis Task',
    '',
    'You are a research synthesizer. Analyze the following results from multiple AI providers and create a concise, unified summary.',
    '',
    '## Your Tasks:',
    '1. **Combine key findings** - Merge information into a coherent narrative',
    '2. **Remove duplicates** - Eliminate redundant information',
    '3. **Highlight contradictions** - Note any conflicting information if critical',
    '4. **Be concise** - Focus on essential information only',
    '5. **Maintain factual accuracy** - Do not add information not present in the sources',
    '',
    '## Format Requirements:',
    '- Keep the output concise and focused',
    '- Organize content by topic/theme, not by provider',
    '- Use markdown formatting for readability',
    '- Avoid excessive citations and URLs in the main text',
    '- If contradictions exist, briefly note them',
    '',
    '---',
    ''
  ];

  // Group results by question
  const byQuestion = new Map<string, ProviderResult[]>();
  for (const result of results) {
    if (!result.error) {
      const existing = byQuestion.get(result.questionId) || [];
      existing.push(result);
      byQuestion.set(result.questionId, existing);
    }
  }

  // Add results for each question
  let questionNum = 1;
  for (const [questionId, questionResults] of byQuestion) {
    sections.push(`## Question ${questionNum} (ID: ${questionId})`);
    sections.push('');

    for (const result of questionResults) {
      sections.push(`### Response from ${result.provider} (${result.model})`);
      sections.push('');
      sections.push(result.content);
      sections.push('');

      // Add citations if available
      if (result.citations && result.citations.length > 0) {
        sections.push('**Citations:**');
        for (const citation of result.citations) {
          if (citation.url) {
            sections.push(`- [${citation.title}](${citation.url})`);
          } else {
            sections.push(`- ${citation.title}`);
          }
        }
        sections.push('');
      }
    }

    questionNum++;
  }

  sections.push('---');
  sections.push('');
  sections.push('**Now, synthesize the above into a unified, comprehensive response.**');

  return sections.join('\n');
}

/**
 * Calculate metrics summary from provider results
 */
function calculateMetrics(
  results: ProviderResult[],
  synthesisLatencyMs: number
): MetricsSummary {
  const successful = results.filter(r => !r.error);
  const failed = results.filter(r => r.error);

  const totalLatencyMs = results.reduce((sum, r) => sum + r.latencyMs, 0) + synthesisLatencyMs;
  const avgLatencyMs = results.length > 0 ? totalLatencyMs / results.length : 0;

  const costEstimates = calculateCostBreakdown(results);
  const totalCostUSD = calculateTotalCost(results);

  return {
    totalQueries: results.length,
    successfulQueries: successful.length,
    failedQueries: failed.length,
    totalLatencyMs,
    avgLatencyMs,
    costEstimates,
    totalCostUSD
  };
}

/**
 * Synthesize multiple provider results into a unified response
 * 
 * @param results Array of provider results to synthesize
 * @param synthModel Model to use for synthesis (default: gpt-5-mini)
 * @returns Synthesized result with metadata
 */
export async function synthesize(
  results: ProviderResult[],
  synthModel: string = DEFAULT_SYNTHESIS_MODEL
): Promise<SynthesisResult> {
  if (!API_KEY) {
    throw new Error('OpenAI API key not configured for synthesis');
  }

  // Filter out failed results
  const successfulResults = results.filter(r => !r.error);

  if (successfulResults.length === 0) {
    throw new Error('No successful results to synthesize');
  }

  // If only one successful result, return it directly with metrics
  if (successfulResults.length === 1) {
    const result = successfulResults[0];
    return {
      synthesized: result.content,
      sources: [result],
      metrics: calculateMetrics(results, 0),
      timestamp: new Date().toISOString(),
      synthModel: 'none (single result)'
    };
  }

  const startTime = Date.now();

  try {
    // Build synthesis prompt
    const prompt = buildSynthesisPrompt(successfulResults);

    // Log synthesis attempt
    log('info', 'synthesis_started', `Starting synthesis with model ${synthModel}`, {
      promptLength: prompt.length,
      resultsCount: successfulResults.length,
      model: synthModel
    });

    // Debug: Log synthesis request
    logSynthesisRequest(synthModel, successfulResults.length, prompt);

    // Call OpenAI Chat Completions API
    const requestBody: SynthesisRequest = {
      model: synthModel,
      messages: [
        {
          role: 'system',
          content: 'You are a research synthesizer. Combine and deduplicate research results into a concise, unified summary. Focus on essential information only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_completion_tokens: 8000
      // Note: GPT-5 models don't support custom temperature - use default (1)
    };

    log('debug', 'synthesis_request', 'Sending request to OpenAI Chat Completions API', {
      url: OPENAI_API_URL,
      model: synthModel,
      requestBody: JSON.stringify(requestBody)
    });

    const response = await httpPost<SynthesisResponse>(
      OPENAI_API_URL,
      requestBody,
      {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      {
        timeoutMs: 90000,
        maxRetries: 3
      }
    );

    const synthesisLatencyMs = Date.now() - startTime;
    const synthesized = response.data.choices?.[0]?.message?.content || '';

    log('info', 'synthesis_success', 'Synthesis completed successfully', {
      latencyMs: synthesisLatencyMs,
      outputLength: synthesized.length
    });

    // Debug: Log synthesis response
    const usage = response.data.usage ? {
      promptTokens: response.data.usage.prompt_tokens,
      completionTokens: response.data.usage.completion_tokens,
      totalTokens: response.data.usage.total_tokens
    } : undefined;

    // Estimate synthesis cost (rough estimate: $0.000002 per token for gpt-5-mini)
    const synthesisCostUSD = usage ? (usage.totalTokens * 0.000002) : undefined;

    logSynthesisResponse(synthModel, synthesized, synthesisLatencyMs, synthesisCostUSD, usage);

    // Calculate metrics
    const metrics = calculateMetrics(results, synthesisLatencyMs);

    return {
      synthesized,
      sources: successfulResults,
      metrics,
      timestamp: new Date().toISOString(),
      synthModel
    };

  } catch (error) {
    const errorObj = error as any;
    const errorLatencyMs = Date.now() - startTime;

    // Log detailed error information
    log('error', 'synthesis_failed', 'Synthesis failed with error', {
      error: errorObj.message,
      errorName: errorObj.name,
      status: errorObj.status,
      url: errorObj.url,
      attempts: errorObj.attempts,
      totalTimeMs: errorObj.totalTimeMs,
      responseData: errorObj.data ? JSON.stringify(errorObj.data) : 'no data',
      originalError: errorObj.originalError?.message
    });

    // Debug: Log synthesis error
    logSynthesisResponse(synthModel, '', errorLatencyMs, undefined, undefined, errorObj.message);

    throw new Error(`Synthesis failed: ${errorObj.message}`);
  }
}

/**
 * Aggregate results without synthesis (just combine them)
 * Useful when synthesis is disabled or fails
 * 
 * @param results Array of provider results
 * @returns Aggregated result without LLM synthesis
 */
export function aggregateWithoutSynthesis(
  results: ProviderResult[]
): SynthesisResult {
  const successfulResults = results.filter(r => !r.error);

  // Build simple aggregation
  const sections: string[] = [
    '# Aggregated Research Results',
    '',
    'Results from multiple providers (no synthesis performed):',
    ''
  ];

  // Group by question
  const byQuestion = new Map<string, ProviderResult[]>();
  for (const result of successfulResults) {
    const existing = byQuestion.get(result.questionId) || [];
    existing.push(result);
    byQuestion.set(result.questionId, existing);
  }

  // Add results for each question
  let questionNum = 1;
  for (const [questionId, questionResults] of byQuestion) {
    sections.push(`## Question ${questionNum} (ID: ${questionId})`);
    sections.push('');

    for (const result of questionResults) {
      sections.push(`### ${result.provider} (${result.model})`);
      sections.push('');
      sections.push(result.content);
      sections.push('');

      // Add citations
      if (result.citations && result.citations.length > 0) {
        sections.push('**Citations:**');
        for (const citation of result.citations) {
          if (citation.url) {
            sections.push(`- [${citation.title}](${citation.url})`);
          } else {
            sections.push(`- ${citation.title}`);
          }
        }
        sections.push('');
      }
    }

    questionNum++;
  }

  const metrics = calculateMetrics(results, 0);

  return {
    synthesized: sections.join('\n'),
    sources: successfulResults,
    metrics,
    timestamp: new Date().toISOString(),
    synthModel: 'none (aggregation only)'
  };
}

/**
 * Get synthesis model name or default
 */
export function getSynthesisModel(model?: string): string {
  return model || DEFAULT_SYNTHESIS_MODEL;
}

/**
 * Validate synthesis configuration
 */
export function validateSynthesisConfig(): boolean {
  return !!API_KEY && API_KEY.length > 0;
}
