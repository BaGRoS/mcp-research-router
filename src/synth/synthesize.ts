/**
 * Synthesis Module
 * 
 * Aggregates and synthesizes research results from multiple providers.
 * Performs deduplication, contradiction detection, and citation preservation.
 */

import { httpPost } from '../utils/http.js';
import { calculateTotalCost, calculateCostBreakdown } from '../utils/cost.js';
import type { 
  ProviderResult, 
  SynthesisResult, 
  MetricsSummary 
} from '../types.js';

/**
 * OpenAI API configuration for synthesis
 */
const OPENAI_API_URL = 'https://api.openai.com/v1/responses';
const API_KEY = process.env.OPENAI_API_KEY;

/**
 * Default synthesis model
 */
const DEFAULT_SYNTHESIS_MODEL = 'gpt-5-mini';

/**
 * OpenAI Responses API request interface
 */
interface SynthesisRequest {
  model: string;
  input: string;
  temperature?: number;
  max_output_tokens?: number;
}

/**
 * OpenAI Responses API response interface
 */
interface SynthesisResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  output_text: string;
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
    'You are a research synthesizer. Analyze the following results from multiple AI providers and create a comprehensive, unified summary.',
    '',
    '## Your Tasks:',
    '1. **Combine key findings** - Merge information from all sources into a coherent narrative',
    '2. **Remove duplicates** - Eliminate redundant information across providers',
    '3. **Highlight contradictions** - Explicitly note any conflicting information',
    '4. **Preserve citations** - Keep all URLs and sources intact',
    '5. **Maintain factual accuracy** - Do not add information not present in the sources',
    '',
    '## Format Requirements:',
    '- Start with a brief executive summary',
    '- Organize content by topic/theme, not by provider',
    '- Use markdown formatting for readability',
    '- Include a "Sources" section at the end with all citations',
    '- If contradictions exist, create a "Discrepancies" section',
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

    // Call OpenAI Responses API
    const requestBody: SynthesisRequest = {
      model: synthModel,
      input: prompt,
      temperature: 0.3,
      max_output_tokens: 8000
    };

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
    const synthesized = response.data.output_text || '';

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
    throw new Error(`Synthesis failed: ${(error as Error).message}`);
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