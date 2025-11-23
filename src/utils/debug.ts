/**
 * Debug Logging Module
 *
 * Provides detailed debug logging for MCP Research Router when DEBUG=1 is set.
 * Generates human-readable Markdown files with full request/response details.
 */

import { appendFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';
import type { Provider, ProviderResult, TokenUsage } from '../types.js';
import { appendSessionDetail, type SessionDetailOptions } from './log.js';

/**
 * Debug log directory path
 * Can be customized via DEBUG_LOG_DIR environment variable
 */
function getDebugDirectory(): string {
  const customDir = process.env.DEBUG_LOG_DIR;
  if (customDir) {
    return join(customDir, 'debug');
  }
  return join(process.cwd(), 'logs', 'debug');
}

const DEBUG_DIR = getDebugDirectory();

/**
 * Maximum number of debug files to keep
 */
const MAX_DEBUG_FILES = 20;

/**
 * Content truncation limits for readability
 */
const TRUNCATE_PROVIDER_CONTENT = 2000;
const TRUNCATE_SYNTHESIS_PROMPT = 1500;
const TRUNCATE_SYNTHESIS_CONTENT = 3000;

/**
 * Check if debug mode is enabled
 */
let debugEnabled: boolean = false;
let currentDebugFile: string | null = null;
let sessionStartTime: Date | null = null;

/**
 * Session statistics for summary
 */
interface SessionStats {
  totalProviderCalls: number;
  successfulCalls: number;
  failedCalls: number;
  totalLatencyMs: number;
  totalCostUSD: number;
  providerStats: Map<Provider, {
    calls: number;
    success: number;
    failed: number;
    totalLatency: number;
    totalCost: number;
  }>;
}

const sessionStats: SessionStats = {
  totalProviderCalls: 0,
  successfulCalls: 0,
  failedCalls: 0,
  totalLatencyMs: 0,
  totalCostUSD: 0,
  providerStats: new Map()
};

/**
 * Initialize provider stats
 */
function initProviderStats(provider: Provider) {
  if (!sessionStats.providerStats.has(provider)) {
    sessionStats.providerStats.set(provider, {
      calls: 0,
      success: 0,
      failed: 0,
      totalLatency: 0,
      totalCost: 0
    });
  }
}

/**
 * Ensure debug directory exists
 */
function ensureDebugDirectory(): void {
  if (!existsSync(DEBUG_DIR)) {
    mkdirSync(DEBUG_DIR, { recursive: true });
  }
}

/**
 * Get current debug file path with timestamp
 */
function getDebugFilePath(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, -5);
  const filename = `debug-session-${timestamp}.md`;
  return join(DEBUG_DIR, filename);
}

/**
 * Rotate debug files - keep only the most recent MAX_DEBUG_FILES
 */
function rotateDebugFiles(): void {
  try {
    if (!existsSync(DEBUG_DIR)) {
      return;
    }

    // Get all debug files sorted by modification time (newest first)
    const files = readdirSync(DEBUG_DIR)
      .filter(f => f.startsWith('debug-session-') && f.endsWith('.md'))
      .map(f => ({
        name: f,
        path: join(DEBUG_DIR, f),
        mtime: statSync(join(DEBUG_DIR, f)).mtime.getTime()
      }))
      .sort((a, b) => b.mtime - a.mtime); // Sort newest first

    // Delete files beyond MAX_DEBUG_FILES
    if (files.length > MAX_DEBUG_FILES) {
      const filesToDelete = files.slice(MAX_DEBUG_FILES);
      for (const file of filesToDelete) {
        try {
          unlinkSync(file.path);
          console.error(JSON.stringify({
            level: 'info',
            event: 'debug_file_rotated',
            message: `Deleted old debug file: ${file.name}`,
            timestamp: new Date().toISOString()
          }));
        } catch (err) {
          console.error(JSON.stringify({
            level: 'warn',
            event: 'debug_rotation_failed',
            message: `Failed to delete debug file: ${file.name}`,
            timestamp: new Date().toISOString()
          }));
        }
      }
    }
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      event: 'debug_rotation_error',
      message: `Debug rotation failed: ${(error as Error).message}`,
      timestamp: new Date().toISOString()
    }));
  }
}

/**
 * Initialize debug logging
 */
export function initDebugLogging(): void {
  debugEnabled = process.env.DEBUG === '1' || process.env.MCP_DEBUG === '1';

  if (!debugEnabled) {
    // Log that debug mode is not enabled (helpful for troubleshooting)
    console.error(JSON.stringify({
      level: 'info',
      event: 'debug_mode_disabled',
      message: 'Debug mode is disabled. Set DEBUG=1 or MCP_DEBUG=1 to enable.',
      timestamp: new Date().toISOString()
    }));
    return;
  }

  try {
    ensureDebugDirectory();
    rotateDebugFiles();

    currentDebugFile = getDebugFilePath();
    sessionStartTime = new Date();

    // Write header
    const header = `# 🔍 MCP Research Router - Debug Log

**Session Start:** ${sessionStartTime.toISOString()}
**Debug Mode:** Enabled
**PID:** ${process.pid}
**Log Directory:** ${DEBUG_DIR}
**Log File:** ${currentDebugFile}
**Current Working Directory:** ${process.cwd()}

---

`;

    appendFileSync(currentDebugFile, header, 'utf-8');

    console.error(JSON.stringify({
      level: 'info',
      event: 'debug_mode_enabled',
      message: `Debug logging enabled`,
      debugDirectory: DEBUG_DIR,
      debugFile: currentDebugFile,
      cwd: process.cwd(),
      timestamp: new Date().toISOString()
    }));
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      event: 'debug_init_failed',
      message: `Failed to initialize debug logging: ${(error as Error).message}`,
      debugDirectory: DEBUG_DIR,
      error: (error as Error).stack,
      timestamp: new Date().toISOString()
    }));
    // Disable debug mode if initialization fails
    debugEnabled = false;
  }
}

/**
 * Check if debug mode is enabled
 */
export function isDebugEnabled(): boolean {
  return debugEnabled;
}

/**
 * Append to debug log file
 */
function appendDebugLog(content: string): void {
  if (!debugEnabled || !currentDebugFile) {
    return;
  }

  try {
    appendFileSync(currentDebugFile, content, 'utf-8');
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      event: 'debug_write_failed',
      message: `Failed to write to debug file: ${(error as Error).message}`,
      timestamp: new Date().toISOString()
    }));
  }
}

/**
 * Format timestamp for display
 */
function formatTime(date: Date): string {
  return date.toISOString();
}

/**
 * Format duration in milliseconds
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms.toFixed(0)}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Format cost in USD
 */
function formatCost(usd: number): string {
  return `$${usd.toFixed(4)}`;
}

/**
 * Format large numbers with commas
 */
function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

/**
 * Prettify JSON with syntax highlighting markers
 */
function prettifyJSON(obj: unknown): string {
  return JSON.stringify(obj, null, 2);
}

/**
 * Log provider request details
 */
export function logProviderRequest(
  provider: Provider,
  model: string,
  questionId: string,
  questionText: string,
  requestPayload?: unknown
): void {
  if (!debugEnabled) {
    return;
  }

  initProviderStats(provider);
  sessionStats.totalProviderCalls++;
  const stats = sessionStats.providerStats.get(provider)!;
  stats.calls++;

  const timestamp = new Date();

  const content = `
## 📝 Question: \`${questionId}\`

### 🤖 Provider: **${provider.toUpperCase()}** (\`${model}\`)

**Request Time:** ${formatTime(timestamp)}

**Question Text:**
\`\`\`
${questionText}
\`\`\`

${requestPayload ? `**Request Payload:**
\`\`\`json
${prettifyJSON(requestPayload)}
\`\`\`
` : ''}`;

  appendDebugLog(content);

  appendSessionDetail({
    title: `Request to ${provider.toUpperCase()} (${questionId})`,
    emoji: '🛰️',
    timestamp,
    metadata: [
      `**Provider:** ${provider}`,
      `**Model:** ${model}`,
      `**Question:** ${questionId}`
    ],
    sections: [
      {
        title: 'Prompt',
        content: questionText,
        language: 'text'
      },
      ...(requestPayload
        ? [{
            title: 'Request Payload',
            content: prettifyJSON(requestPayload),
            language: 'json'
          }]
        : [])
    ]
  });
}

/**
 * Log provider response details
 */
export function logProviderResponse(
  provider: Provider,
  model: string,
  questionId: string,
  result: ProviderResult,
  costUSD?: number
): void {
  if (!debugEnabled) {
    return;
  }

  const stats = sessionStats.providerStats.get(provider)!;

  const timestamp = new Date();
  const success = !result.error;

  if (success) {
    sessionStats.successfulCalls++;
    stats.success++;
  } else {
    sessionStats.failedCalls++;
    stats.failed++;
  }

  sessionStats.totalLatencyMs += result.latencyMs;
  stats.totalLatency += result.latencyMs;

  if (costUSD) {
    sessionStats.totalCostUSD += costUSD;
    stats.totalCost += costUSD;
  }

  const statusEmoji = success ? '✅' : '❌';
  const statusText = success ? 'Success' : 'Failed';

  // Build metadata items array for better readability
  const metadataItems = [`- ⏱️ **Latency:** ${formatDuration(result.latencyMs)}`];

  if (costUSD !== undefined) {
    metadataItems.push(`- 💰 **Cost:** ${formatCost(costUSD)}`);
  }

  if (result.usage) {
    metadataItems.push(
      `- 📊 **Tokens:** input=${formatNumber(result.usage.promptTokens)}, output=${formatNumber(result.usage.completionTokens)}, total=${formatNumber(result.usage.totalTokens)}`
    );
  }

  if (result.citations && result.citations.length > 0) {
    metadataItems.push(`- 📚 **Citations:** ${result.citations.length} sources`);
  }

  const content = `
**Response Time:** ${formatTime(timestamp)}

**Status:** ${statusEmoji} ${statusText}

${success ? `**Response Content:**
\`\`\`
${result.content.substring(0, TRUNCATE_PROVIDER_CONTENT)}${result.content.length > TRUNCATE_PROVIDER_CONTENT ? '\n... (truncated)' : ''}
\`\`\`
` : ''}

${result.error ? `**Error:**
\`\`\`
${result.error}
\`\`\`
` : ''}

**Metadata:**
${metadataItems.join('\n')}

${result.citations && result.citations.length > 0 ? `**Citations:**
${result.citations.map((c, i) => `${i + 1}. ${c.title}${c.url ? ` - ${c.url}` : ''}`).join('\n')}
` : ''}
---

`;

  appendDebugLog(content);

  const sections: NonNullable<SessionDetailOptions['sections']> = [];
  if (!result.error && result.content) {
    sections.push({
      title: 'Response',
      content: result.content,
      language: 'markdown'
    });
  }

  if (result.error) {
    sections.push({
      title: 'Error',
      content: result.error,
      format: 'text'
    });
  }

  if (result.citations && result.citations.length > 0) {
    sections.push({
      title: 'Citations',
      content: result.citations
        .map((citation, index) => `${index + 1}. ${citation.title}${citation.url ? ` - ${citation.url}` : ''}`)
        .join('\n'),
      format: 'text'
    });
  }

  appendSessionDetail({
    title: `${success ? 'Response' : 'Response Failed'} from ${provider.toUpperCase()} (${questionId})`,
    emoji: success ? '✅' : '⚠️',
    timestamp,
    metadata: [
      `**Provider:** ${provider}`,
      `**Model:** ${model}`,
      `**Question:** ${questionId}`,
      `**Status:** ${statusText}`,
      `**Latency:** ${formatDuration(result.latencyMs)}`,
      ...(costUSD !== undefined ? [`**Cost:** ${formatCost(costUSD)}`] : []),
      ...(result.usage
        ? [`**Tokens:** in ${formatNumber(result.usage.promptTokens)}, out ${formatNumber(result.usage.completionTokens)}, total ${formatNumber(result.usage.totalTokens)}`]
        : []),
      ...(result.citations && result.citations.length > 0 ? [`**Citations:** ${result.citations.length}`] : [])
    ],
    sections
  });
}

/**
 * Log synthesis request details
 */
export function logSynthesisRequest(
  model: string,
  sourceCount: number,
  synthesisPrompt?: string
): void {
  if (!debugEnabled) {
    return;
  }

  const timestamp = new Date();

  const content = `
## 🔄 SYNTHESIS

### 🧠 Synthesis Model: **${model}**

**Synthesis Start:** ${formatTime(timestamp)}
**Source Results:** ${sourceCount} provider responses

${synthesisPrompt ? `**Synthesis Prompt:**
\`\`\`
${synthesisPrompt.substring(0, TRUNCATE_SYNTHESIS_PROMPT)}${synthesisPrompt.length > TRUNCATE_SYNTHESIS_PROMPT ? '\n... (truncated)' : ''}
\`\`\`
` : ''}
`;

  appendDebugLog(content);

  appendSessionDetail({
    title: `Synthesis Request (${model})`,
    emoji: '🧪',
    timestamp,
    metadata: [
      `**Model:** ${model}`,
      `**Sources:** ${sourceCount}`
    ],
    sections: synthesisPrompt
      ? [{
          title: 'Prompt',
          content: synthesisPrompt,
          language: 'markdown'
        }]
      : []
  });
}

/**
 * Log synthesis response details
 */
export function logSynthesisResponse(
  model: string,
  synthesizedContent: string,
  latencyMs: number,
  costUSD?: number,
  usage?: TokenUsage,
  error?: string
): void {
  if (!debugEnabled) {
    return;
  }

  const timestamp = new Date();
  const success = !error;
  const statusEmoji = success ? '✅' : '❌';
  const statusText = success ? 'Success' : 'Failed';

  // Build metadata items array for better readability
  const metadataItems = [`- ⏱️ **Latency:** ${formatDuration(latencyMs)}`];

  if (costUSD !== undefined) {
    metadataItems.push(`- 💰 **Cost:** ${formatCost(costUSD)}`);
  }

  if (usage) {
    metadataItems.push(
      `- 📊 **Tokens:** input=${formatNumber(usage.promptTokens)}, output=${formatNumber(usage.completionTokens)}, total=${formatNumber(usage.totalTokens)}`
    );
  }

  const content = `
**Synthesis Complete:** ${formatTime(timestamp)}
**Model:** ${model}

**Status:** ${statusEmoji} ${statusText}

${success ? `**Synthesized Content:**
\`\`\`markdown
${synthesizedContent.substring(0, TRUNCATE_SYNTHESIS_CONTENT)}${synthesizedContent.length > TRUNCATE_SYNTHESIS_CONTENT ? '\n... (truncated)' : ''}
\`\`\`
` : ''}

${error ? `**Error:**
\`\`\`
${error}
\`\`\`
` : ''}

**Synthesis Metadata:**
${metadataItems.join('\n')}
---

`;

  appendDebugLog(content);

  const sections: NonNullable<SessionDetailOptions['sections']> = [];
  if (success && synthesizedContent) {
    sections.push({
      title: 'Synthesis Output',
      content: synthesizedContent,
      language: 'markdown'
    });
  }

  if (error) {
    sections.push({
      title: 'Error',
      content: error,
      format: 'text'
    });
  }

  appendSessionDetail({
    title: `${success ? 'Synthesis Complete' : 'Synthesis Failed'} (${model})`,
    emoji: success ? '🧬' : '⚠️',
    timestamp,
    metadata: [
      `**Model:** ${model}`,
      `**Latency:** ${formatDuration(latencyMs)}`,
      ...(costUSD !== undefined ? [`**Cost:** ${formatCost(costUSD)}`] : []),
      ...(usage
        ? [`**Tokens:** input ${formatNumber(usage.promptTokens)}, output ${formatNumber(usage.completionTokens)}, total ${formatNumber(usage.totalTokens)}`]
        : [])
    ],
    sections
  });
}

/**
 * Write session summary at the end
 */
export function closeDebugLog(): void {
  if (!debugEnabled || !currentDebugFile || !sessionStartTime) {
    return;
  }

  const sessionEndTime = new Date();
  const sessionDurationMs = sessionEndTime.getTime() - sessionStartTime.getTime();

  const summary = `
---

## 📊 SESSION SUMMARY

**Session Duration:** ${formatDuration(sessionDurationMs)}
**Session End:** ${formatTime(sessionEndTime)}

### Overall Statistics
- **Total Provider Calls:** ${sessionStats.totalProviderCalls}
- **Successful:** ${sessionStats.successfulCalls} (${sessionStats.totalProviderCalls > 0 ? ((sessionStats.successfulCalls / sessionStats.totalProviderCalls) * 100).toFixed(1) : 0}%)
- **Failed:** ${sessionStats.failedCalls} (${sessionStats.totalProviderCalls > 0 ? ((sessionStats.failedCalls / sessionStats.totalProviderCalls) * 100).toFixed(1) : 0}%)
- **Total Latency:** ${formatDuration(sessionStats.totalLatencyMs)}
- **Average Latency:** ${sessionStats.totalProviderCalls > 0 ? formatDuration(sessionStats.totalLatencyMs / sessionStats.totalProviderCalls) : '0ms'}
- **Total Cost:** ${formatCost(sessionStats.totalCostUSD)}

### Per-Provider Statistics

${Array.from(sessionStats.providerStats.entries()).map(([provider, stats]) => `
#### ${provider.toUpperCase()}
- Calls: ${stats.calls} (${stats.success} success, ${stats.failed} failed)
- Success Rate: ${stats.calls > 0 ? ((stats.success / stats.calls) * 100).toFixed(1) : 0}%
- Total Latency: ${formatDuration(stats.totalLatency)}
- Average Latency: ${stats.calls > 0 ? formatDuration(stats.totalLatency / stats.calls) : '0ms'}
- Total Cost: ${formatCost(stats.totalCost)}
`).join('\n')}

---

**Debug log closed successfully**
`;

  appendDebugLog(summary);

  console.error(JSON.stringify({
    level: 'info',
    event: 'debug_session_completed',
    message: `Debug session closed: ${currentDebugFile}`,
    timestamp: new Date().toISOString(),
    metadata: {
      totalCalls: sessionStats.totalProviderCalls,
      successful: sessionStats.successfulCalls,
      failed: sessionStats.failedCalls,
      totalCostUSD: sessionStats.totalCostUSD
    }
  }));
}
