/**
 * Research Status Tool
 * 
 * MCP tool for retrieving runtime metrics and status information
 * from the last research run.
 */

import { getLastRunStatus } from './researchRun.js';
import type { SystemStatus } from '../types.js';

/**
 * Get current system status and metrics
 * 
 * Returns information about the last research run including:
 * - Per-provider statistics (success rate, latency, cost)
 * - Total queries executed
 * - Total estimated cost
 * - Last run timestamp
 * 
 * @returns System status object or null if no runs have been executed
 */
export function researchStatus(): SystemStatus | { message: string } {
  const status = getLastRunStatus();

  if (!status) {
    return {
      message: 'No research runs have been executed yet'
    };
  }

  return status;
}

/**
 * Get formatted status summary as markdown
 * 
 * @returns Human-readable status summary
 */
export function researchStatusFormatted(): string {
  const status = getLastRunStatus();

  if (!status) {
    return '# Research Status\n\nNo research runs have been executed yet.';
  }

  const lines = [
    '# Research Status',
    '',
    `**Last Run**: ${new Date(status.lastRunTimestamp!).toLocaleString()}`,
    `**Total Queries**: ${status.totalQueries}`,
    `**Total Cost**: $${status.totalCostUSD.toFixed(4)}`,
    '',
    '## Provider Statistics',
    ''
  ];

  for (const provider of status.providers) {
    lines.push(`### ${provider.provider.charAt(0).toUpperCase() + provider.provider.slice(1)}`);
    lines.push('');
    lines.push(`- **Queries**: ${provider.totalQueries}`);
    lines.push(`- **Success Rate**: ${(provider.successRate * 100).toFixed(1)}%`);
    lines.push(`- **Avg Latency**: ${provider.avgLatencyMs.toFixed(0)}ms`);
    lines.push(`- **Total Cost**: $${provider.totalCostUSD.toFixed(4)}`);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Get provider-specific status
 * 
 * @param providerName Provider to get status for
 * @returns Provider status or error message
 */
export function getProviderStatus(providerName: string): any {
  const status = getLastRunStatus();

  if (!status) {
    return { error: 'No research runs have been executed yet' };
  }

  const provider = status.providers.find(p => p.provider === providerName);

  if (!provider) {
    return { error: `Provider '${providerName}' not found in last run` };
  }

  return provider;
}