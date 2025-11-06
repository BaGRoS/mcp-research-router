/**
 * Research Save Tool
 * 
 * MCP tool for manually saving the last synthesis result to a Markdown file.
 * Useful when the original run used 'json' or 'markdown' format but user wants a file.
 */

import { saveMarkdownReport } from '../utils/md.js';
import { notifyFileSaved } from '../utils/log.js';
import type { SynthesisResult, ResearchQuery } from '../types.js';

/**
 * Cache for last synthesis result and questions
 */
let lastSynthesis: SynthesisResult | null = null;
let lastQuestions: ResearchQuery[] | null = null;

/**
 * Store synthesis result for later saving
 * (Called internally by researchRun)
 * 
 * @param synthesis Synthesis result to cache
 * @param questions Original questions
 */
export function cacheSynthesisResult(
  synthesis: SynthesisResult,
  questions: ResearchQuery[]
): void {
  lastSynthesis = synthesis;
  lastQuestions = questions;
}

/**
 * Save the last synthesis result to a Markdown file
 * 
 * @param filename Optional custom filename (without path)
 * @returns Filepath of saved report or error message
 */
export function researchSave(filename?: string): { filepath: string } | { error: string } {
  if (!lastSynthesis || !lastQuestions) {
    return {
      error: 'No synthesis result available to save. Run a research query first.'
    };
  }

  try {
    // Save with provider details and metrics by default for manual saves
    const filepath = saveMarkdownReport(lastSynthesis, lastQuestions, true, true, filename);

    // Calculate file size for logging
    const content = JSON.stringify(lastSynthesis);
    const fileSize = Buffer.byteLength(content, 'utf8');
    
    notifyFileSaved(filepath, fileSize);

    return { filepath };
  } catch (error) {
    return {
      error: `Failed to save report: ${(error as Error).message}`
    };
  }
}

/**
 * Check if a synthesis result is available for saving
 * 
 * @returns True if result is cached and ready to save
 */
export function hasCachedResult(): boolean {
  return lastSynthesis !== null && lastQuestions !== null;
}

/**
 * Get information about the cached result
 * 
 * @returns Summary of cached result or null
 */
export function getCachedResultInfo(): {
  timestamp: string;
  questionCount: number;
  providerCount: number;
  hasContent: boolean;
} | null {
  if (!lastSynthesis || !lastQuestions) {
    return null;
  }

  return {
    timestamp: lastSynthesis.timestamp,
    questionCount: lastQuestions.length,
    providerCount: lastSynthesis.sources.length,
    hasContent: lastSynthesis.synthesized.length > 0
  };
}

/**
 * Clear cached synthesis result
 */
export function clearCachedResult(): void {
  lastSynthesis = null;
  lastQuestions = null;
}