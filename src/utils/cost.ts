/**
 * Cost Estimation Module
 * 
 * Provides estimated API costs per provider and model.
 * Uses fixed estimates based on typical query sizes (not actual token counts).
 */

import type { Provider, ProviderResult } from '../types.js';

/**
 * Cost estimates per provider/model (in USD)
 * Based on typical research query (~1500 tokens combined input/output)
 */
const COST_ESTIMATES: Record<Provider, Record<string, number>> = {
  openai: {
    'gpt-5': 0.015,        // $1.25 input + $10 output per 1M tokens
    'gpt-5-mini': 0.003,   // $0.25 input + ~$2 output per 1M tokens
    'gpt-5-nano': 0.0006,  // $0.05 input per 1M tokens
    'gpt-4': 0.03,
    'gpt-4-turbo': 0.015,
    'gpt-3.5-turbo': 0.002
  },
  gemini: {
    'gemini-2.5-flash': 0.0001,
    'gemini-2.5-pro': 0.005,
    'gemini-pro': 0.001
  },
  perplexity: {
    'sonar-pro': 0.04,
    'sonar': 0.01,
    'sonar-medium': 0.02
  },
  deepseek: {
    'deepseek-chat': 0.001,
    'deepseek-coder': 0.001
  }
};

/**
 * Get estimated cost for a provider/model combination
 * 
 * @param provider Provider name
 * @param model Model identifier
 * @returns Estimated cost in USD
 */
export function getEstimatedCost(provider: Provider, model: string): number {
  const providerCosts = COST_ESTIMATES[provider];
  if (!providerCosts) {
    console.error(JSON.stringify({
      level: 'warn',
      event: 'unknown_provider',
      message: `Unknown provider for cost estimation: ${provider}`,
      provider,
      timestamp: new Date().toISOString()
    }));
    return 0.01; // Default fallback
  }

  const cost = providerCosts[model];
  if (cost === undefined) {
    console.error(JSON.stringify({
      level: 'warn',
      event: 'unknown_model',
      message: `Unknown model for cost estimation: ${model}`,
      provider,
      model,
      timestamp: new Date().toISOString()
    }));
    // Return average of known models for this provider
    const values = Object.values(providerCosts);
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  return cost;
}

/**
 * Calculate total cost from provider results
 * 
 * @param results Array of provider results
 * @returns Total estimated cost in USD
 */
export function calculateTotalCost(results: ProviderResult[]): number {
  return results.reduce((total, result) => {
    if (result.error) {
      return total; // Don't count failed requests
    }
    return total + getEstimatedCost(result.provider, result.model);
  }, 0);
}

/**
 * Calculate per-provider cost breakdown
 * 
 * @param results Array of provider results
 * @returns Cost breakdown by provider
 */
export function calculateCostBreakdown(
  results: ProviderResult[]
): Record<Provider, number> {
  const breakdown: Record<Provider, number> = {
    openai: 0,
    gemini: 0,
    perplexity: 0,
    deepseek: 0
  };

  for (const result of results) {
    if (!result.error) {
      breakdown[result.provider] += getEstimatedCost(result.provider, result.model);
    }
  }

  return breakdown;
}

/**
 * Format cost as USD string
 * 
 * @param cost Cost in USD
 * @returns Formatted string (e.g., "$0.03")
 */
export function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

/**
 * Get cost summary string for display
 * 
 * @param results Array of provider results
 * @returns Human-readable cost summary
 */
export function getCostSummary(results: ProviderResult[]): string {
  const total = calculateTotalCost(results);
  const breakdown = calculateCostBreakdown(results);
  
  const lines = [
    `Total estimated cost: ${formatCost(total)}`,
    '',
    'Breakdown by provider:'
  ];

  for (const [provider, cost] of Object.entries(breakdown)) {
    if (cost > 0) {
      lines.push(`  ${provider}: ${formatCost(cost)}`);
    }
  }

  return lines.join('\n');
}

/**
 * Check if cost exceeds a budget threshold
 * 
 * @param results Array of provider results
 * @param budgetUSD Budget threshold in USD
 * @returns True if cost exceeds budget
 */
export function exceedsBudget(
  results: ProviderResult[],
  budgetUSD: number
): boolean {
  return calculateTotalCost(results) > budgetUSD;
}

/**
 * Estimate cost before execution
 * 
 * @param providers List of providers
 * @param questionCount Number of questions
 * @param modelsPerProvider Optional model overrides
 * @returns Estimated total cost
 */
export function estimateCost(
  providers: Provider[],
  questionCount: number,
  modelsPerProvider?: Partial<Record<Provider, string>>
): number {
  let total = 0;

  for (const provider of providers) {
    const model = modelsPerProvider?.[provider] || getDefaultModel(provider);
    const costPerQuery = getEstimatedCost(provider, model);
    total += costPerQuery * questionCount;
  }

  return total;
}

/**
 * Get default model for a provider
 * 
 * @param provider Provider name
 * @returns Default model identifier
 */
function getDefaultModel(provider: Provider): string {
  const defaults: Record<Provider, string> = {
    openai: 'gpt-5-mini',
    gemini: 'gemini-2.5-flash',
    perplexity: 'sonar',
    deepseek: 'deepseek-chat'
  };
  return defaults[provider];
}