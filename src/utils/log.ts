/**
 * Logging Module
 *
 * Provides structured logging with both machine-readable (JSONL) and human-readable (Markdown) formats.
 * Organizes logs into directories by date and type for better organization.
 * Emits MCP notifications for important events.
 */

import { appendFileSync, existsSync, mkdirSync, statSync, readdirSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { LogLevel, EventType, LogEntry, MCPNotification, Provider } from '../types.js';

/**
 * Log directory structure
 */
const BASE_LOG_DIR = join(process.cwd(), 'logs');
const JSONL_LOG_DIR = join(BASE_LOG_DIR, 'jsonl');  // Machine-readable JSONL logs
const SESSION_LOG_DIR = join(BASE_LOG_DIR, 'sessions');  // Human-readable session logs

/**
 * Maximum log file size (1MB)
 */
const MAX_LOG_SIZE = 1 * 1024 * 1024; // 1MB in bytes

/**
 * Maximum number of log directories to keep per type
 */
const MAX_LOG_DIRS = 30; // Keep 30 days of logs

/**
 * Current log files
 */
let currentJsonlFile: string | null = null;
let currentSessionFile: string | null = null;
let sessionStartTime: Date | null = null;

/**
 * Ensure log directories exist
 */
function ensureLogDirectories(): void {
  [BASE_LOG_DIR, JSONL_LOG_DIR, SESSION_LOG_DIR].forEach(dir => {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  });
}

/**
 * Get directory path for today's logs
 */
function getTodayLogDir(baseDir: string): string {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
  const dir = join(baseDir, dateStr);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  return dir;
}

/**
 * Get current JSONL log file path with timestamp
 */
function getCurrentJsonlFile(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, -5);
  const filename = `session-${timestamp}.jsonl`;
  const dir = getTodayLogDir(JSONL_LOG_DIR);
  return join(dir, filename);
}

/**
 * Get current session log file path with timestamp
 */
function getCurrentSessionFile(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, -5);
  const filename = `session-${timestamp}.md`;
  const dir = getTodayLogDir(SESSION_LOG_DIR);
  return join(dir, filename);
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
 * Rotate log directories - keep only the most recent MAX_LOG_DIRS
 */
function rotateLogDirectories(baseDir: string): void {
  try {
    if (!existsSync(baseDir)) {
      return;
    }

    // Get all date directories sorted by name (which is YYYY-MM-DD, so sorts chronologically)
    const dirs = readdirSync(baseDir)
      .filter(f => {
        const fullPath = join(baseDir, f);
        return statSync(fullPath).isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(f);
      })
      .map(f => ({
        name: f,
        path: join(baseDir, f)
      }))
      .sort((a, b) => b.name.localeCompare(a.name)); // Sort newest first

    // Delete directories beyond MAX_LOG_DIRS
    if (dirs.length > MAX_LOG_DIRS) {
      const dirsToDelete = dirs.slice(MAX_LOG_DIRS);
      for (const dir of dirsToDelete) {
        try {
          // Delete all files in the directory first
          const files = readdirSync(dir.path);
          for (const file of files) {
            unlinkSync(join(dir.path, file));
          }
          // Then delete the directory
          unlinkSync(dir.path);

          console.error(JSON.stringify({
            level: 'info',
            event: 'log_rotated',
            message: `Deleted old log directory: ${dir.name}`,
            timestamp: new Date().toISOString()
          }));
        } catch (err) {
          console.error(JSON.stringify({
            level: 'warn',
            event: 'log_rotation_failed',
            message: `Failed to delete log directory: ${dir.name}`,
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
 * Format helpers for human-readable logs
 */
function formatTime(date: Date): string {
  return date.toISOString();
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms.toFixed(0)}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatCost(usd: number): string {
  return `$${usd.toFixed(4)}`;
}

/**
 * Initialize logging system
 */
export function initLogging(): void {
  ensureLogDirectories();

  currentJsonlFile = getCurrentJsonlFile();
  currentSessionFile = getCurrentSessionFile();
  sessionStartTime = new Date();

  // Rotate old log directories
  rotateLogDirectories(JSONL_LOG_DIR);
  rotateLogDirectories(SESSION_LOG_DIR);

  // Write session header to Markdown log
  if (currentSessionFile) {
    const header = `# 📊 MCP Research Router - Session Log

**Session Start:** ${formatTime(sessionStartTime)}
**Session ID:** ${sessionStartTime.getTime()}
**Process ID:** ${process.pid}
**Working Directory:** ${process.cwd()}

---

## Session Events

`;

    try {
      writeFileSync(currentSessionFile, header, 'utf-8');
    } catch (error) {
      console.error(JSON.stringify({
        level: 'error',
        event: 'session_log_init_failed',
        message: `Failed to initialize session log: ${(error as Error).message}`,
        timestamp: new Date().toISOString()
      }));
    }
  }

  // Write startup log entry
  log('info', 'system_started', 'MCP Research Router started');
}

/**
 * Write human-readable entry to session log
 */
function writeSessionLog(entry: LogEntry): void {
  if (!currentSessionFile) {
    return;
  }

  try {
    const timestamp = new Date(entry.timestamp);
    const timeStr = timestamp.toLocaleTimeString('en-US', { hour12: false });

    // Determine emoji based on level and event
    let emoji = '📝';
    if (entry.level === 'error') emoji = '❌';
    else if (entry.level === 'warn') emoji = '⚠️';
    else if (entry.event === 'provider_started') emoji = '🚀';
    else if (entry.event === 'provider_finished') emoji = '✅';
    else if (entry.event === 'provider_failed') emoji = '❌';
    else if (entry.event === 'synthesis_started') emoji = '🔄';
    else if (entry.event === 'synthesis_finished') emoji = '✨';
    else if (entry.event === 'file_saved') emoji = '💾';

    let sessionEntry = `### ${emoji} [${timeStr}] ${entry.message}\n\n`;

    // Add formatted metadata if present
    if (entry.metadata) {
      const meta = entry.metadata;
      const items: string[] = [];

      if (meta.provider) items.push(`**Provider:** ${meta.provider}`);
      if (meta.model) items.push(`**Model:** ${meta.model}`);
      if (meta.questionId) items.push(`**Question:** ${meta.questionId}`);
      if (meta.latencyMs !== undefined) items.push(`**Latency:** ${formatDuration(meta.latencyMs as number)}`);
      if (meta.costUSD !== undefined) items.push(`**Cost:** ${formatCost(meta.costUSD as number)}`);
      if (meta.sourceCount !== undefined) items.push(`**Sources:** ${meta.sourceCount}`);
      if (meta.filepath) items.push(`**File:** ${meta.filepath}`);
      if (meta.sizeBytes !== undefined) items.push(`**Size:** ${(meta.sizeBytes as number / 1024).toFixed(2)} KB`);
      if (meta.error) items.push(`**Error:** \`${meta.error}\``);

      if (items.length > 0) {
        sessionEntry += items.join(' • ') + '\n\n';
      }
    }

    sessionEntry += '---\n\n';

    appendFileSync(currentSessionFile, sessionEntry, 'utf-8');
  } catch (error) {
    // Silent fail for session log (we still have JSONL)
  }
}

/**
 * Write log entry to stderr, JSONL file, and human-readable session log
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

  // Write to JSONL log file
  try {
    ensureLogDirectories();

    // Check if current log file exceeds size limit
    let jsonlFile = currentJsonlFile || getCurrentJsonlFile();
    const currentSize = getFileSize(jsonlFile);

    if (currentSize >= MAX_LOG_SIZE) {
      // Create new log file
      jsonlFile = getCurrentJsonlFile();
      currentJsonlFile = jsonlFile;

      // Rotate old directories
      rotateLogDirectories(JSONL_LOG_DIR);

      // Log rotation event
      console.error(JSON.stringify({
        level: 'info',
        event: 'log_file_rotated',
        message: `Created new log file (previous exceeded ${MAX_LOG_SIZE} bytes)`,
        timestamp: new Date().toISOString()
      }));
    }

    appendFileSync(jsonlFile, line + '\n', 'utf-8');

    // Also write to human-readable session log
    writeSessionLog(entry);
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
 * Close session log and write summary
 */
export function closeSessionLog(): void {
  if (!currentSessionFile || !sessionStartTime) {
    return;
  }

  try {
    const endTime = new Date();
    const duration = endTime.getTime() - sessionStartTime.getTime();

    const footer = `
---

## Session Summary

**Session End:** ${formatTime(endTime)}
**Duration:** ${formatDuration(duration)}
**Total Events:** Logged throughout session

---

*Session log closed successfully*
`;

    appendFileSync(currentSessionFile, footer, 'utf-8');
  } catch (error) {
    // Silent fail
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