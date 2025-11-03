/**
 * HTTP Utility Module
 * 
 * Provides a fetch wrapper with retry logic, exponential backoff,
 * timeout support, and structured error handling.
 */

import type { HTTPRequestConfig, HTTPResponse } from '../types.js';

/**
 * Default configuration values
 */
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BACKOFF_BASE = 250;

/**
 * Sleep utility for backoff delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 */
function calculateBackoff(attempt: number, baseMs: number): number {
  // Exponential backoff: 250ms, 500ms, 1000ms, 2000ms (capped)
  const delay = Math.min(baseMs * Math.pow(2, attempt), 2000);
  // Add jitter to prevent thundering herd
  return delay + Math.random() * 100;
}

/**
 * Execute HTTP request with retry logic and timeout
 */
export async function fetchWithRetry<T = unknown>(
  config: HTTPRequestConfig
): Promise<HTTPResponse<T>> {
  const {
    url,
    method,
    headers = {},
    body,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxRetries = DEFAULT_MAX_RETRIES,
    backoffBase = DEFAULT_BACKOFF_BASE
  } = config;

  let lastError: Error | null = null;
  const startTime = Date.now();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      // Execute fetch
      const requestStart = Date.now();
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - requestStart;

      // Parse response
      let data: T;
      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        data = await response.json() as T;
      } else {
        data = await response.text() as T;
      }

      // Check for HTTP errors
      if (!response.ok) {
        const error = new Error(
          `HTTP ${response.status}: ${response.statusText}`
        );
        (error as any).status = response.status;
        (error as any).data = data;
        throw error;
      }

      // Success - return response
      return {
        status: response.status,
        data,
        headers: Object.fromEntries(response.headers.entries()),
        latencyMs
      };

    } catch (error) {
      lastError = error as Error;

      // Check if error is retryable
      const isTimeout = (error as Error).name === 'AbortError';
      const isNetworkError = (error as Error).message.includes('fetch failed');
      const is5xxError = (error as any).status >= 500 && (error as any).status < 600;
      const is429Error = (error as any).status === 429;

      const shouldRetry = isTimeout || isNetworkError || is5xxError || is429Error;

      // If not retryable or last attempt, throw
      if (!shouldRetry || attempt === maxRetries) {
        throw enrichError(error as Error, url, attempt, Date.now() - startTime);
      }

      // Wait before retry with exponential backoff
      const backoffMs = calculateBackoff(attempt, backoffBase);
      await sleep(backoffMs);

      // Log retry attempt to stderr
      console.error(JSON.stringify({
        level: 'warn',
        event: 'http_retry',
        message: `Retrying request to ${url} (attempt ${attempt + 1}/${maxRetries})`,
        error: (error as Error).message,
        backoffMs,
        timestamp: new Date().toISOString()
      }));
    }
  }

  // Should never reach here, but TypeScript needs it
  throw enrichError(
    lastError || new Error('Unknown error'),
    url,
    maxRetries,
    Date.now() - startTime
  );
}

/**
 * Enrich error with additional context
 */
function enrichError(
  error: Error,
  url: string,
  attempts: number,
  totalTimeMs: number
): Error {
  const enriched = new Error(
    `HTTP request failed after ${attempts} attempts (${totalTimeMs}ms): ${error.message}`
  );
  enriched.name = 'HTTPError';
  (enriched as any).originalError = error;
  (enriched as any).url = url;
  (enriched as any).attempts = attempts;
  (enriched as any).totalTimeMs = totalTimeMs;
  (enriched as any).status = (error as any).status;
  (enriched as any).data = (error as any).data;
  return enriched;
}

/**
 * Convenience method for GET requests
 */
export async function httpGet<T = unknown>(
  url: string,
  headers?: Record<string, string>,
  options?: Partial<HTTPRequestConfig>
): Promise<HTTPResponse<T>> {
  return fetchWithRetry<T>({
    url,
    method: 'GET',
    headers,
    ...options
  });
}

/**
 * Convenience method for POST requests
 */
export async function httpPost<T = unknown>(
  url: string,
  body: unknown,
  headers?: Record<string, string>,
  options?: Partial<HTTPRequestConfig>
): Promise<HTTPResponse<T>> {
  return fetchWithRetry<T>({
    url,
    method: 'POST',
    body,
    headers,
    ...options
  });
}