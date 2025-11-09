/**
 * Logging Module
 *
 * Provides structured JSONL logging to stderr and rotating log files.
 * Emits MCP notifications for important events.
 */

import { appendFileSync, existsSync, mkdirSync, statSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import type { LogLevel, EventType, LogEntry, MCPNotification, Provider } from '../types.js';

/**
 * Log directory path
 */
const LOG_DIR = join(process.cwd(), 'logs');

/**
 * Maximum log file size (1MB)
 */
const MAX_LOG_SIZE = 1 * 1024 * 1024; // 1MB in bytes

/**
 * Maximum number of log files to keep
 */
const MAX_LOG_FILES = 10;

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
 * Get current log file path with timestamp
 */
function getCurrentLogFile(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, -5);
  const filename = `research-router-${timestamp}.jsonl`;
  return join(LOG_DIR, filename);
}

/**
 * Get file size in bytes
 */
function getFileSize(filepath: string): number {
  try {
    if (existsSync(filepath)) {
      const stats = statSync(filepath);
      return stats.size;
    }
  } catch (error) {
    // File doesn't exist or can't be accessed
  }
  return 0;
}

/**
 * Rotate log files - keep only the most recent MAX_LOG_FILES
 */
function rotateLogFiles(): void {
  try {
    if (!existsSync(LOG_DIR)) {
      return;
    }

    // Get all log files sorted by modification time (newest first)
    const files = readdirSync(LOG_DIR)
      .filter(f => f.startsWith('research-router-') && f.endsWith('.jsonl'))
      .map(f => ({
        name: f,
        path: join(LOG_DIR, f),
        mtime: statSync(join(LOG_DIR, f)).mtime.getTime()
      }))
      .sort((a, b) => b.mtime - a.mtime); // Sort newest first

    // Delete files beyond MAX_LOG_FILES
    if (files.length > MAX_LOG_FILES) {
      const filesToDelete = files.slice(MAX_LOG_FILES);
      for (const file of filesToDelete) {
        try {
          unlinkSync(file.path);
          console.error(JSON.stringify({
            level: 'info',
            event: 'log_rotated',
            message: `Deleted old log file: ${file.name}`,
            timestamp: new Date().toISOString()
          }));
        } catch (err) {
          console.error(JSON.stringify({
            level: 'warn',
            event: 'log_rotation_failed',
            message: `Failed to delete log file: ${file.name}`,
            timestamp: new Date().toISOString()
          }));
        }
      }
    }
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      event: 'log_rotation_error',
      message: `Log rotation failed: ${(error as Error).message}`,
      timestamp: new Date().toISOString()
    }));
  }
}

/**
 * Initialize logging system
 */
export function initLogging(): void {
  ensureLogDirectory();
  currentLogFile = getCurrentLogFile();

  // Rotate old log files
  rotateLogFiles();

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

    // Check if current log file exceeds size limit
    let logFile = currentLogFile || getCurrentLogFile();
    const currentSize = getFileSize(logFile);

    if (currentSize >= MAX_LOG_SIZE) {
      // Create new log file
      logFile = getCurrentLogFile();
      currentLogFile = logFile;

      // Rotate old files
      rotateLogFiles();

      // Log rotation event
      console.error(JSON.stringify({
        level: 'info',
        event: 'log_file_rotated',
        message: `Created new log file (previous exceeded ${MAX_LOG_SIZE} bytes)`,
        timestamp: new Date().toISOString()
      }));
    }

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