/**
 * MCP Research Router - Core Type Definitions
 * 
 * This module defines all shared types and interfaces used throughout the application.
 */

// ============================================================================
// Provider Types
// ============================================================================

/**
 * Supported AI provider identifiers
 */
export type Provider = 'openai' | 'gemini' | 'perplexity' | 'deepseek';

/**
 * Output format options for research results
 */
export type OutputFormat = 'json' | 'markdown' | 'file';

/**
 * Log levels for structured logging
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Event types for MCP notifications
 */
export type EventType = 
  | 'provider_started'
  | 'provider_finished'
  | 'provider_failed'
  | 'synthesis_started'
  | 'synthesis_finished'
  | 'synthesis_failed'
  | 'file_saved';

// ============================================================================
// Research Query Types
// ============================================================================

/**
 * A single research question with unique identifier
 */
export interface ResearchQuery {
  /** Unique identifier for the question */
  id: string;
  /** The actual question text */
  text: string;
}

/**
 * Configuration for a research run
 */
export interface ResearchRunConfig {
  /** List of providers to query */
  providers: Provider[];
  /** List of questions to ask */
  questions: ResearchQuery[];
  /** Whether to synthesize results */
  synthesis: boolean;
  /** Model to use for synthesis (default: gpt-5-mini) */
  synthModel?: string;
  /** Include raw provider responses in output (in addition to synthesis). Only applies when synthesis is enabled. */
  includeRawResults?: boolean;
  /** Include cost estimates, latency, and query statistics in output. Defaults to false to save tokens. */
  includeMetrics?: boolean;
  /** Output format */
  return: OutputFormat;
  /** Request timeout in milliseconds */
  timeoutMs?: number;
  /** Maximum number of retries per provider */
  maxRetries?: number;
}

// ============================================================================
// Provider Response Types
// ============================================================================

/**
 * Citation information from provider responses
 */
export interface Citation {
  /** Citation title or text */
  title: string;
  /** URL if available */
  url?: string;
  /** Citation number/index */
  index?: number;
}

/**
 * Token usage information
 */
export interface TokenUsage {
  /** Input/prompt tokens */
  promptTokens: number;
  /** Output/completion tokens */
  completionTokens: number;
  /** Total tokens used */
  totalTokens: number;
}

/**
 * Result from a single provider query
 */
export interface ProviderResult {
  /** Provider that generated this result */
  provider: Provider;
  /** Model used for generation */
  model: string;
  /** Question ID this result corresponds to */
  questionId: string;
  /** Response content */
  content: string;
  /** Citations if available (mainly from Perplexity) */
  citations?: Citation[];
  /** Token usage if available */
  usage?: TokenUsage;
  /** Time taken in milliseconds */
  latencyMs: number;
  /** ISO timestamp of when result was generated */
  timestamp: string;
  /** Error message if request failed */
  error?: string;
}

/**
 * Aggregated results from all providers
 */
export interface AggregatedResults {
  /** All provider results */
  results: ProviderResult[];
  /** Successful results only */
  successful: ProviderResult[];
  /** Failed attempts */
  failed: Array<{
    provider: Provider;
    questionId: string;
    error: string;
  }>;
}

// ============================================================================
// Synthesis Types
// ============================================================================

/**
 * Metrics summary for synthesis
 */
export interface MetricsSummary {
  /** Total queries executed */
  totalQueries: number;
  /** Successful queries */
  successfulQueries: number;
  /** Failed queries */
  failedQueries: number;
  /** Total latency across all queries */
  totalLatencyMs: number;
  /** Average latency per query */
  avgLatencyMs: number;
  /** Cost estimates per provider */
  costEstimates: Record<Provider, number>;
  /** Total estimated cost in USD */
  totalCostUSD: number;
}

/**
 * Result of synthesis operation
 */
export interface SynthesisResult {
  /** Synthesized content */
  synthesized: string;
  /** Source results used for synthesis */
  sources: ProviderResult[];
  /** Metrics summary */
  metrics: MetricsSummary;
  /** Synthesis timestamp */
  timestamp: string;
  /** Model used for synthesis */
  synthModel: string;
}

// ============================================================================
// Provider Adapter Interface
// ============================================================================

/**
 * Common interface that all provider adapters must implement
 */
export interface ProviderAdapter {
  /**
   * Query the provider with a question
   * @param question The question text
   * @param model Model to use for this provider
   * @param questionId Unique identifier for the question
   * @returns Provider result
   */
  query(question: string, model: string, questionId: string): Promise<ProviderResult>;
  
  /**
   * List available models for this provider
   * @returns Array of model identifiers
   */
  listModels(): string[];
  
  /**
   * Validate that provider configuration is complete
   * @returns True if API key is configured
   */
  validateConfig(): boolean;
  
  /**
   * Get default model for this provider
   * @returns Default model identifier
   */
  getDefaultModel(): string;
}

// ============================================================================
// Markdown Report Types
// ============================================================================

/**
 * YAML front matter for Markdown reports
 */
export interface ReportFrontMatter {
  /** Report title */
  title: string;
  /** Report generation date */
  date: string;
  /** Providers used */
  providers: Array<{
    name: Provider;
    model: string;
  }>;
  /** Summary of questions */
  summary: {
    questions: Array<{
      id: string;
      text: string;
    }>;
  };
  /** Metrics */
  metrics: {
    totalLatencyMs: number;
    costEstimateUSD: Record<Provider, number>;
  };
}

// ============================================================================
// Logging Types
// ============================================================================

/**
 * Structured log entry
 */
export interface LogEntry {
  /** Log level */
  level: LogLevel;
  /** Event type */
  event: EventType;
  /** Log message */
  message: string;
  /** ISO timestamp */
  timestamp: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Event notification for MCP
 */
export interface MCPNotification {
  /** Event type */
  type: EventType;
  /** Provider name if applicable */
  provider?: Provider;
  /** Model name if applicable */
  model?: string;
  /** Question ID if applicable */
  questionId?: string;
  /** Latency in ms if applicable */
  latencyMs?: number;
  /** Cost estimate if applicable */
  costUSD?: number;
  /** Error message if applicable */
  error?: string;
  /** Timestamp */
  timestamp: string;
}

// ============================================================================
// HTTP Request Types
// ============================================================================

/**
 * Configuration for HTTP requests
 */
export interface HTTPRequestConfig {
  /** Request URL */
  url: string;
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** Request headers */
  headers?: Record<string, string>;
  /** Request body */
  body?: unknown;
  /** Timeout in milliseconds */
  timeoutMs?: number;
  /** Maximum number of retries */
  maxRetries?: number;
  /** Exponential backoff base in ms */
  backoffBase?: number;
}

/**
 * HTTP response wrapper
 */
export interface HTTPResponse<T = unknown> {
  /** Response status code */
  status: number;
  /** Response data */
  data: T;
  /** Response headers */
  headers: Record<string, string>;
  /** Request latency in ms */
  latencyMs: number;
}

// ============================================================================
// Status Tracking Types
// ============================================================================

/**
 * Provider status metrics
 */
export interface ProviderStatus {
  /** Provider name */
  provider: Provider;
  /** Total queries executed */
  totalQueries: number;
  /** Successful queries */
  successfulQueries: number;
  /** Failed queries */
  failedQueries: number;
  /** Success rate (0-1) */
  successRate: number;
  /** Average latency in ms */
  avgLatencyMs: number;
  /** Total estimated cost */
  totalCostUSD: number;
}

/**
 * Overall system status
 */
export interface SystemStatus {
  /** Per-provider status */
  providers: ProviderStatus[];
  /** Last run timestamp */
  lastRunTimestamp?: string;
  /** Total queries across all providers */
  totalQueries: number;
  /** Total cost across all providers */
  totalCostUSD: number;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Custom error for provider failures
 */
export class ProviderError extends Error {
  constructor(
    public provider: Provider,
    public statusCode: number | undefined,
    message: string
  ) {
    super(`[${provider}] ${message}`);
    this.name = 'ProviderError';
  }
}

/**
 * Custom error for synthesis failures
 */
export class SynthesisError extends Error {
  constructor(
    public model: string,
    message: string
  ) {
    super(`[Synthesis:${model}] ${message}`);
    this.name = 'SynthesisError';
  }
}