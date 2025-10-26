/**
 * Logging Module
 * 
 * Provides structured JSONL logging to stderr and rotating log files.
 * Emits MCP notifications for important events.
 */

import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { LogLevel, EventType, LogEntry, MCPNotification, Provider } from '../types.js';

/**
 * Log directory path
 */
const LOG_DIR = join(process.cwd(), 'logs');

/**
 * Current log file path
 */
let currentLogFile: string | null = null;

/**
 * Ensure log directory exists
 */
function ensureLogDirectory(): void {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }
}

/**
 * Get current log file path (creates new file daily)
 */
function getCurrentLogFile(): string {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const filename = `research-router-${date}.jsonl`;
  return join(LOG_DIR, filename);
}

/**
 * Initialize logging system
 */
export function initLogging(): void {
  ensureLogDirectory();
  currentLogFile = getCurrentLogFile();
  
  // Write startup log entry
  log('info', 'system_started', 'MCP Research Router started');
}

/**
 * Write log entry to both stderr and file
 */
export function log(
  level: LogLevel,
  event: EventType | string,
  message: string,
  metadata?: Record<string, unknown>
): void {
  const entry: LogEntry = {
    level,
    event: event as EventType,
    message,
    timestamp: new Date().toISOString(),
    metadata
  };

  const line = JSON.stringify(entry);

  // Write to stderr (visible in MCP clients)
  console.error(line);

  // Write to log file
  try {
    ensureLogDirectory();
    const logFile = currentLogFile || getCurrentLogFile();
    appendFileSync(logFile, line + '\n', 'utf-8');
  } catch (error) {
    // If file logging fails, only log to stderr
    console.error(JSON.stringify({
      level: 'error',
      event: 'log_write_failed',
      message: `Failed to write to log file: ${(error as Error).message}`,
      timestamp: new Date().toISOString()
    }));
  }
}

/**
 * Log provider started event
 */
export function logProviderStarted(
  provider: Provider,
  model: string,
  questionId: string
): void {
  log('info', 'provider_started', `Starting ${provider} query`, {
    provider,
    model,
    questionId
  });
}

/**
 * Log provider finished event
 */
export function logProviderFinished(
  provider: Provider,
  model: string,
  questionId: string,
  latencyMs: number,
  costUSD: number
): void {
  log('info', 'provider_finished', `Completed ${provider} query`, {
    provider,
    model,
    questionId,
    latencyMs,
    costUSD
  });
}

/**
 * Log provider failed event
 */
export function logProviderFailed(
  provider: Provider,
  questionId: string,
  error: string
): void {
  log('error', 'provider_failed', `Failed ${provider} query: ${error}`, {
    provider,
    questionId,
    error
  });
}

/**
 * Log synthesis started event
 */
export function logSynthesisStarted(
  model: string,
  sourceCount: number
): void {
  log('info', 'synthesis_started', `Starting synthesis with ${model}`, {
    model,
    sourceCount
  });
}

/**
 * Log synthesis finished event
 */
export function logSynthesisFinished(
  model: string,
  latencyMs: number,
  costUSD: number
): void {
  log('info', 'synthesis_finished', `Completed synthesis with ${model}`, {
    model,
    latencyMs,
    costUSD
  });
}

/**
 * Log synthesis failed event
 */
export function logSynthesisFailed(
  model: string,
  error: string
): void {
  log('error', 'synthesis_failed', `Synthesis failed with ${model}: ${error}`, {
    model,
    error
  });
}

/**
 * Log file saved event
 */
export function logFileSaved(
  filepath: string,
  sizeBytes: number
): void {
  log('info', 'file_saved', `Saved report to ${filepath}`, {
    filepath,
    sizeBytes
  });
}

/**
 * Create MCP notification from log entry
 * 
 * This can be sent via MCP server.sendNotification()
 */
export function createMCPNotification(
  type: EventType,
  provider?: Provider,
  model?: string,
  questionId?: string,
  latencyMs?: number,
  costUSD?: number,
  error?: string
): MCPNotification {
  return {
    type,
    provider,
    model,
    questionId,
    latencyMs,
    costUSD,
    error,
    timestamp: new Date().toISOString()
  };
}

/**
 * Log and emit MCP notification for provider started
 */
export function notifyProviderStarted(
  provider: Provider,
  model: string,
  questionId: string
): MCPNotification {
  logProviderStarted(provider, model, questionId);
  return createMCPNotification('provider_started', provider, model, questionId);
}

/**
 * Log and emit MCP notification for provider finished
 */
export function notifyProviderFinished(
  provider: Provider,
  model: string,
  questionId: string,
  latencyMs: number,
  costUSD: number
): MCPNotification {
  logProviderFinished(provider, model, questionId, latencyMs, costUSD);
  return createMCPNotification(
    'provider_finished',
    provider,
    model,
    questionId,
    latencyMs,
    costUSD
  );
}

/**
 * Log and emit MCP notification for provider failed
 */
export function notifyProviderFailed(
  provider: Provider,
  questionId: string,
  error: string
): MCPNotification {
  logProviderFailed(provider, questionId, error);
  return createMCPNotification(
    'provider_failed',
    provider,
    undefined,
    questionId,
    undefined,
    undefined,
    error
  );
}

/**
 * Log and emit MCP notification for synthesis started
 */
export function notifySynthesisStarted(
  model: string,
  sourceCount: number
): MCPNotification {
  logSynthesisStarted(model, sourceCount);
  return createMCPNotification('synthesis_started', undefined, model);
}

/**
 * Log and emit MCP notification for synthesis finished
 */
export function notifySynthesisFinished(
  model: string,
  latencyMs: number,
  costUSD: number
): MCPNotification {
  logSynthesisFinished(model, latencyMs, costUSD);
  return createMCPNotification(
    'synthesis_finished',
    undefined,
    model,
    undefined,
    latencyMs,
    costUSD
  );
}

/**
 * Log and emit MCP notification for synthesis failed
 */
export function notifySynthesisFailed(
  model: string,
  error: string
): MCPNotification {
  logSynthesisFailed(model, error);
  return createMCPNotification(
    'synthesis_failed',
    undefined,
    model,
    undefined,
    undefined,
    undefined,
    error
  );
}

/**
 * Log and emit MCP notification for file saved
 */
export function notifyFileSaved(
  filepath: string,
  sizeBytes: number
): MCPNotification {
  logFileSaved(filepath, sizeBytes);
  return createMCPNotification('file_saved');
}

/**
 * Rotate log files (cleanup old logs)
 * Keeps logs for last 30 days
 */
export function rotateLogFiles(): void {
  // TODO: Implement log rotation if needed
  // For now, we create daily files which can be manually cleaned
}