/**
 * Research Run Tool
 * 
 * Main MCP tool for executing parallel research queries across multiple providers.
 * Supports multi-question execution, result synthesis, and various output formats.
 */

import { openaiAdapter } from '../adapters/openai.js';
import { geminiAdapter } from '../adapters/gemini.js';
import { perplexityAdapter } from '../adapters/perplexity.js';
import { deepseekAdapter } from '../adapters/deepseek.js';
import { synthesize, aggregateWithoutSynthesis } from '../synth/synthesize.js';
import { withRateLimit } from '../utils/rateLimit.js';
import { getEstimatedCost } from '../utils/cost.js';
import { saveMarkdownReport, previewMarkdownReport } from '../utils/md.js';
import {
  log,
  notifyProviderStarted,
  notifyProviderFinished,
  notifyProviderFailed,
  notifySynthesisStarted,
  notifySynthesisFinished,
  notifySynthesisFailed,
  notifyFileSaved
} from '../utils/log.js';
import {
  logProviderRequest,
  logProviderResponse
} from '../utils/debug.js';
import type { 
  Provider, 
  ProviderAdapter, 
  ProviderResult, 
  ResearchQuery,
  ResearchRunConfig,
  OutputFormat,
  SynthesisResult,
  SystemStatus,
  ProviderStatus
} from '../types.js';

/**
 * Provider adapter registry
 */
const ADAPTERS: Record<Provider, ProviderAdapter> = {
  openai: openaiAdapter,
  gemini: geminiAdapter,
  perplexity: perplexityAdapter,
  deepseek: deepseekAdapter
};

/**
 * Global status tracking
 */
let lastRunStatus: SystemStatus | null = null;

/**
 * Execute a single provider query with rate limiting and logging
 */
async function executeProviderQuery(
  provider: Provider,
  question: ResearchQuery,
  model?: string
): Promise<ProviderResult> {
  const adapter = ADAPTERS[provider];
  
  if (!adapter.validateConfig()) {
    return {
      provider,
      model: model || adapter.getDefaultModel(),
      questionId: question.id,
      content: '',
      latencyMs: 0,
      timestamp: new Date().toISOString(),
      error: `${provider} API key not configured`
    };
  }

  const selectedModel = model || adapter.getDefaultModel();

  // Notify start
  notifyProviderStarted(provider, selectedModel, question.id);

  // Debug: Log request
  logProviderRequest(provider, selectedModel, question.id, question.text);

  try {
    // Execute with rate limiting
    const result = await withRateLimit(provider, async () => {
      return adapter.query(question.text, selectedModel, question.id);
    });

    // Notify completion
    const cost = getEstimatedCost(provider, selectedModel);
    if (!result.error) {
      notifyProviderFinished(provider, selectedModel, question.id, result.latencyMs, cost);
    } else {
      notifyProviderFailed(provider, question.id, result.error);
    }

    // Debug: Log response
    logProviderResponse(provider, selectedModel, question.id, result, cost);

    return result;

  } catch (error) {
    const errorMsg = (error as Error).message;
    notifyProviderFailed(provider, question.id, errorMsg);

    const errorResult: ProviderResult = {
      provider,
      model: selectedModel,
      questionId: question.id,
      content: '',
      latencyMs: 0,
      timestamp: new Date().toISOString(),
      error: errorMsg
    };

    // Debug: Log error response
    logProviderResponse(provider, selectedModel, question.id, errorResult);

    return errorResult;
  }
}

/**
 * Execute research run across multiple providers and questions
 */
export async function researchRun(
  config: ResearchRunConfig
): Promise<{
  content: string;
  format: OutputFormat;
  filepath?: string;
}> {
  const {
    providers,
    questions,
    synthesis,
    synthModel = 'gpt-5-mini',
    includeRawResults = false,
    includeMetrics = false,
    return: outputFormat,
    timeoutMs: _timeoutMs = 60000,
    maxRetries: _maxRetries = 3
  } = config;

  // Validate inputs
  if (providers.length === 0) {
    throw new Error('At least one provider must be specified');
  }

  if (questions.length === 0) {
    throw new Error('At least one question must be specified');
  }

  // Create task matrix (providers × questions)
  const tasks: Array<{ provider: Provider; question: ResearchQuery }> = [];
  for (const provider of providers) {
    for (const question of questions) {
      tasks.push({ provider, question });
    }
  }

  // Execute all tasks in parallel with Promise.allSettled
  const taskPromises = tasks.map(task =>
    executeProviderQuery(task.provider, task.question)
  );

  const results = await Promise.allSettled(taskPromises);

  // Extract successful results
  const providerResults: ProviderResult[] = results
    .filter((r): r is PromiseFulfilledResult<ProviderResult> => r.status === 'fulfilled')
    .map(r => r.value);

  // Update status tracking
  updateSystemStatus(providerResults);

  // Perform synthesis if requested
  let synthesisResult: SynthesisResult;

  if (synthesis) {
    try {
      notifySynthesisStarted(synthModel, providerResults.filter(r => !r.error).length);
      
      synthesisResult = await synthesize(providerResults, synthModel);
      
      notifySynthesisFinished(
        synthModel,
        Date.now() - new Date(synthesisResult.timestamp).getTime(),
        0.003 // Estimated synthesis cost
      );
    } catch (error) {
      const errorObj = error as any;
      const errorMsg = errorObj.message;

      // Log detailed catch block error
      log('error', 'synthesis_catch_block', 'Caught synthesis error in researchRun', {
        error: errorMsg,
        errorName: errorObj.name,
        stack: errorObj.stack
      });

      notifySynthesisFailed(synthModel, errorMsg);

      // Fall back to aggregation without synthesis
      log('warn', 'synthesis_fallback', 'Falling back to aggregation without synthesis', {
        providersCount: providerResults.filter(r => !r.error).length
      });

      synthesisResult = aggregateWithoutSynthesis(providerResults);
    }
  } else {
    // No synthesis - just aggregate
    synthesisResult = aggregateWithoutSynthesis(providerResults);
  }

  // Format output based on requested format
  switch (outputFormat) {
    case 'json':
      // Build JSON output respecting includeRawResults and includeMetrics flags
      const jsonOutput: any = {
        synthesized: synthesisResult.synthesized,
        timestamp: synthesisResult.timestamp,
        synthModel: synthesisResult.synthModel
      };

      // Include raw provider results only if requested
      if (includeRawResults && synthesis) {
        jsonOutput.sources = synthesisResult.sources;
      }

      // Include metrics only if requested
      if (includeMetrics) {
        jsonOutput.metrics = synthesisResult.metrics;
      }

      return {
        content: JSON.stringify(jsonOutput, null, 2),
        format: 'json'
      };

    case 'markdown':
      return {
        content: previewMarkdownReport(
          synthesisResult,
          questions,
          includeRawResults && synthesis,
          includeMetrics
        ),
        format: 'markdown'
      };

    case 'file':
      const filepath = saveMarkdownReport(
        synthesisResult,
        questions,
        includeRawResults && synthesis,
        includeMetrics
      );
      const fileSize = Buffer.byteLength(
        previewMarkdownReport(
          synthesisResult,
          questions,
          includeRawResults && synthesis,
          includeMetrics
        ),
        'utf8'
      );
      notifyFileSaved(filepath, fileSize);

      return {
        content: `Report saved to: ${filepath}`,
        format: 'file',
        filepath
      };

    default:
      throw new Error(`Unknown output format: ${outputFormat}`);
  }
}

/**
 * Update system status tracking
 */
function updateSystemStatus(results: ProviderResult[]): void {
  const providerStats: Record<Provider, ProviderStatus> = {
    openai: createProviderStatus('openai', []),
    gemini: createProviderStatus('gemini', []),
    perplexity: createProviderStatus('perplexity', []),
    deepseek: createProviderStatus('deepseek', [])
  };

  // Group results by provider
  for (const result of results) {
    const providerResults = results.filter(r => r.provider === result.provider);
    providerStats[result.provider] = createProviderStatus(result.provider, providerResults);
  }

  const totalQueries = results.length;
  const totalCostUSD = results.reduce((sum, r) => {
    if (r.error) return sum;
    return sum + getEstimatedCost(r.provider, r.model);
  }, 0);

  lastRunStatus = {
    providers: Object.values(providerStats).filter(p => p.totalQueries > 0),
    lastRunTimestamp: new Date().toISOString(),
    totalQueries,
    totalCostUSD
  };
}

/**
 * Create provider status from results
 */
function createProviderStatus(
  provider: Provider,
  results: ProviderResult[]
): ProviderStatus {
  const successful = results.filter(r => !r.error);
  const failed = results.filter(r => r.error);

  const avgLatencyMs = successful.length > 0
    ? successful.reduce((sum, r) => sum + r.latencyMs, 0) / successful.length
    : 0;

  const totalCostUSD = successful.reduce((sum, r) => {
    return sum + getEstimatedCost(r.provider, r.model);
  }, 0);

  return {
    provider,
    totalQueries: results.length,
    successfulQueries: successful.length,
    failedQueries: failed.length,
    successRate: results.length > 0 ? successful.length / results.length : 0,
    avgLatencyMs,
    totalCostUSD
  };
}

/**
 * Get last run status
 */
export function getLastRunStatus(): SystemStatus | null {
  return lastRunStatus;
}