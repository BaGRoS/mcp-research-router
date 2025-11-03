/**
 * Markdown Report Writer Module
 * 
 * Generates Markdown reports with YAML front matter from synthesis results.
 * Saves reports to the reports/ directory with timestamped filenames.
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { 
  SynthesisResult, 
  ReportFrontMatter, 
  ProviderResult,
  Provider,
  ResearchQuery
} from '../types.js';

/**
 * Reports directory path
 */
const REPORTS_DIR = join(process.cwd(), 'reports');

/**
 * Ensure reports directory exists
 */
function ensureReportsDirectory(): void {
  if (!existsSync(REPORTS_DIR)) {
    mkdirSync(REPORTS_DIR, { recursive: true });
  }
}

/**
 * Generate filename with timestamp
 */
function generateFilename(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `research-${timestamp}.md`;
}

/**
 * Convert object to YAML front matter
 */
function objectToYAML(obj: Record<string, any>, indent = 0): string {
  const spaces = '  '.repeat(indent);
  const lines: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      lines.push(`${spaces}${key}:`);
      for (const item of value) {
        if (typeof item === 'object' && item !== null) {
          lines.push(`${spaces}  -`);
          const subYaml = objectToYAML(item, indent + 2);
          lines.push(subYaml.split('\n').map(l => `  ${l}`).join('\n'));
        } else {
          lines.push(`${spaces}  - ${item}`);
        }
      }
    } else if (typeof value === 'object' && value !== null) {
      lines.push(`${spaces}${key}:`);
      lines.push(objectToYAML(value, indent + 1));
    } else if (typeof value === 'string' && (value.includes(':') || value.includes('\n'))) {
      lines.push(`${spaces}${key}: "${value.replace(/"/g, '\\"')}"`);
    } else {
      lines.push(`${spaces}${key}: ${value}`);
    }
  }

  return lines.join('\n');
}

/**
 * Generate YAML front matter from synthesis result
 */
function generateFrontMatter(
  synthesis: SynthesisResult,
  questions: ResearchQuery[]
): string {
  // Extract unique provider/model combinations
  const providers = Array.from(
    new Set(
      synthesis.sources.map(s => `${s.provider}:${s.model}`)
    )
  ).map(combo => {
    const [name, model] = combo.split(':');
    return { name: name as Provider, model };
  });

  const frontMatter: ReportFrontMatter = {
    title: `Research Summary: ${questions[0]?.text.substring(0, 50) || 'Multi-Question Research'}`,
    date: synthesis.timestamp,
    providers,
    summary: {
      questions: questions.map(q => ({
        id: q.id,
        text: q.text
      }))
    },
    metrics: {
      totalLatencyMs: synthesis.metrics.totalLatencyMs,
      costEstimateUSD: synthesis.metrics.costEstimates
    }
  };

  return '---\n' + objectToYAML(frontMatter) + '\n---\n';
}

/**
 * Format citations section
 */
function formatCitations(sources: ProviderResult[]): string {
  const citations: Array<{ title: string; url?: string; provider: Provider }> = [];

  for (const source of sources) {
    if (source.citations && source.citations.length > 0) {
      for (const citation of source.citations) {
        citations.push({
          title: citation.title,
          url: citation.url,
          provider: source.provider
        });
      }
    }
  }

  if (citations.length === 0) {
    return '';
  }

  const lines = [
    '',
    '## Citations',
    ''
  ];

  citations.forEach((citation, idx) => {
    const num = idx + 1;
    if (citation.url) {
      lines.push(`${num}. [${citation.title}](${citation.url}) _(${citation.provider})_`);
    } else {
      lines.push(`${num}. ${citation.title} _(${citation.provider})_`);
    }
  });

  return lines.join('\n');
}

/**
 * Format metrics section
 */
function formatMetrics(synthesis: SynthesisResult): string {
  const lines = [
    '',
    '## Metrics',
    '',
    `- **Total Queries**: ${synthesis.metrics.totalQueries}`,
    `- **Successful**: ${synthesis.metrics.successfulQueries}`,
    `- **Failed**: ${synthesis.metrics.failedQueries}`,
    `- **Total Latency**: ${synthesis.metrics.totalLatencyMs}ms`,
    `- **Average Latency**: ${synthesis.metrics.avgLatencyMs.toFixed(0)}ms`,
    `- **Total Cost**: $${synthesis.metrics.totalCostUSD.toFixed(4)}`,
    '',
    '### Cost Breakdown',
    ''
  ];

  for (const [provider, cost] of Object.entries(synthesis.metrics.costEstimates)) {
    if (cost > 0) {
      lines.push(`- **${provider}**: $${cost.toFixed(4)}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format provider details section
 */
function formatProviderDetails(sources: ProviderResult[]): string {
  const lines = [
    '',
    '## Provider Details',
    ''
  ];

  // Group by provider
  const byProvider: Record<Provider, ProviderResult[]> = {
    openai: [],
    gemini: [],
    perplexity: [],
    deepseek: []
  };

  for (const source of sources) {
    if (!source.error) {
      byProvider[source.provider].push(source);
    }
  }

  for (const [provider, results] of Object.entries(byProvider)) {
    if (results.length === 0) continue;

    lines.push(`### ${provider.charAt(0).toUpperCase() + provider.slice(1)}`);
    lines.push('');
    
    for (const result of results) {
      lines.push(`**Question ${result.questionId}** (${result.model}, ${result.latencyMs}ms)`);
      lines.push('');
      lines.push(result.content.split('\n').map(l => `> ${l}`).join('\n'));
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Generate complete Markdown report
 */
export function generateMarkdownReport(
  synthesis: SynthesisResult,
  questions: ResearchQuery[],
  includeProviderDetails = false,
  includeMetrics = false
): string {
  const sections = [
    generateFrontMatter(synthesis, questions),
    '',
    '# Research Summary',
    '',
    synthesis.synthesized,
    formatCitations(synthesis.sources)
  ];

  if (includeMetrics) {
    sections.push(formatMetrics(synthesis));
  }

  if (includeProviderDetails) {
    sections.push(formatProviderDetails(synthesis.sources));
  }

  return sections.join('\n');
}

/**
 * Save synthesis result to Markdown file
 *
 * @param synthesis Synthesis result to save
 * @param questions Original questions
 * @param includeMetrics Include metrics section
 * @param filename Optional custom filename
 * @returns Filepath of saved report
 */
export function saveMarkdownReport(
  synthesis: SynthesisResult,
  questions: ResearchQuery[],
  includeMetrics = false,
  filename?: string
): string {
  ensureReportsDirectory();

  const filepath = join(
    REPORTS_DIR,
    filename || generateFilename()
  );

  const content = generateMarkdownReport(synthesis, questions, true, includeMetrics);

  writeFileSync(filepath, content, 'utf-8');

  return filepath;
}

/**
 * Get absolute path for a report filename
 */
export function getReportPath(filename: string): string {
  return join(REPORTS_DIR, filename);
}

/**
 * Generate report content without saving
 */
export function previewMarkdownReport(
  synthesis: SynthesisResult,
  questions: ResearchQuery[],
  includeProviderDetails = false,
  includeMetrics = false
): string {
  return generateMarkdownReport(synthesis, questions, includeProviderDetails, includeMetrics);
}