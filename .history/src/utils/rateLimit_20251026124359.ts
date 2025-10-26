/**
 * Rate Limiting Module
 * 
 * Provides global and per-provider rate limiting using p-limit and Bottleneck.
 * Ensures API rate limits are respected while maximizing throughput.
 */

import Bottleneck from 'bottleneck';
import pLimit from 'p-limit';
import type { Provider } from '../types.js';

/**
 * Global concurrency limit (max parallel requests across all providers)
 */
const GLOBAL_CONCURRENCY = 6;

/**
 * Per-provider rate limit (requests per second)
 */
const PROVIDER_MIN_TIME_MS = 500; // 2 requests per second

/**
 * Global limiter using p-limit
 */
export const globalLimit = pLimit(GLOBAL_CONCURRENCY);

/**
 * Per-provider Bottleneck limiters
 */
const providerLimiters: Record<Provider, Bottleneck> = {
  openai: new Bottleneck({
    minTime: PROVIDER_MIN_TIME_MS,
    maxConcurrent: 2
  }),
  gemini: new Bottleneck({
    minTime: PROVIDER_MIN_TIME_MS,
    maxConcurrent: 2
  }),
  perplexity: new Bottleneck({
    minTime: PROVIDER_MIN_TIME_MS,
    maxConcurrent: 2
  }),
  deepseek: new Bottleneck({
    minTime: PROVIDER_MIN_TIME_MS,
    maxConcurrent: 2
  })
};

/**
 * Get the rate limiter for a specific provider
 */
export function getProviderLimiter(provider: Provider): Bottleneck {
  return providerLimiters[provider];
}

/**
 * Execute a function with both global and provider-specific rate limiting
 * 
 * @param provider Provider identifier
 * @param fn Function to execute with rate limiting
 * @returns Promise resolving to function result
 */
export async function withRateLimit<T>(
  provider: Provider,
  fn: () => Promise<T>
): Promise<T> {
  // Apply global concurrency limit
  return globalLimit(async () => {
    // Apply provider-specific rate limit
    const limiter = getProviderLimiter(provider);
    return limiter.schedule(() => fn());
  });
}

/**
 * Get queue statistics for a provider
 */
export function getProviderQueueStats(provider: Provider): {
  queued: number;
  running: number;
} {
  const limiter = getProviderLimiter(provider);
  return {
    queued: limiter.counts().QUEUED,
    running: limiter.counts().RUNNING
  };
}

/**
 * Get statistics for all providers
 */
export function getAllQueueStats(): Record<Provider, {
  queued: number;
  running: number;
}> {
  return {
    openai: getProviderQueueStats('openai'),
    gemini: getProviderQueueStats('gemini'),
    perplexity: getProviderQueueStats('perplexity'),
    deepseek: getProviderQueueStats('deepseek')
  };
}

/**
 * Clear all rate limiter queues (for shutdown)
 */
export async function clearAllQueues(): Promise<void> {
  const promises = Object.values(providerLimiters).map(limiter => 
    limiter.stop({ dropWaitingJobs: true })
  );
  await Promise.all(promises);
}

/**
 * Update rate limit for a specific provider
 * Useful for dynamic adjustment based on API responses
 * 
 * @param provider Provider to update
 * @param minTimeMs New minimum time between requests
 */
export function updateProviderRateLimit(
  provider: Provider,
  minTimeMs: number
): void {
  const limiter = providerLimiters[provider];
  limiter.updateSettings({
    minTime: minTimeMs
  });
  
  console.error(JSON.stringify({
    level: 'info',
    event: 'rate_limit_updated',
    message: `Updated rate limit for ${provider}`,
    provider,
    minTimeMs,
    timestamp: new Date().toISOString()
  }));
}

/**
 * Handle 429 (Rate Limit) response by increasing backoff
 * 
 * @param provider Provider that returned 429
 */
export function handleRateLimitError(provider: Provider): void {
  const limiter = getProviderLimiter(provider);
  const currentMinTime = limiter.chain._store.clientOptions.minTime || PROVIDER_MIN_TIME_MS;
  
  // Double the wait time (up to 5 seconds)
  const newMinTime = Math.min(currentMinTime * 2, 5000);
  updateProviderRateLimit(provider, newMinTime);
}

/**
 * Reset a provider's rate limit to default
 * 
 * @param provider Provider to reset
 */
export function resetProviderRateLimit(provider: Provider): void {
  updateProviderRateLimit(provider, PROVIDER_MIN_TIME_MS);
}