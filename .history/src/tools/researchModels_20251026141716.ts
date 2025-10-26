/**
 * Research Models Tool
 * 
 * MCP tool for listing available models per provider.
 * Returns cached model lists without making API calls.
 */

import { openaiAdapter } from '../adapters/openai.js';
import { geminiAdapter } from '../adapters/gemini.js';
import { perplexityAdapter } from '../adapters/perplexity.js';
import { deepseekAdapter } from '../adapters/deepseek.js';
import type { Provider } from '../types.js';

/**
 * Provider adapter registry
 */
const ADAPTERS = {
  openai: openaiAdapter,
  gemini: geminiAdapter,
  perplexity: perplexityAdapter,
  deepseek: deepseekAdapter
};

/**
 * Get all available models grouped by provider
 * 
 * @returns Object mapping provider names to their available models
 */
export function researchModels(): Record<Provider, string[]> {
  return {
    openai: ADAPTERS.openai.listModels(),
    gemini: ADAPTERS.gemini.listModels(),
    perplexity: ADAPTERS.perplexity.listModels(),
    deepseek: ADAPTERS.deepseek.listModels()
  };
}

/**
 * Get models for a specific provider
 * 
 * @param provider Provider name
 * @returns Array of model identifiers or error
 */
export function getProviderModels(provider: Provider): string[] | { error: string } {
  const adapter = ADAPTERS[provider];
  
  if (!adapter) {
    return { error: `Unknown provider: ${provider}` };
  }

  return adapter.listModels();
}

/**
 * Get default model for a specific provider
 * 
 * @param provider Provider name
 * @returns Default model identifier or error
 */
export function getDefaultModel(provider: Provider): string | { error: string } {
  const adapter = ADAPTERS[provider];
  
  if (!adapter) {
    return { error: `Unknown provider: ${provider}` };
  }

  return adapter.getDefaultModel();
}

/**
 * Get all default models
 * 
 * @returns Object mapping provider names to their default models
 */
export function getAllDefaultModels(): Record<Provider, string> {
  return {
    openai: ADAPTERS.openai.getDefaultModel(),
    gemini: ADAPTERS.gemini.getDefaultModel(),
    perplexity: ADAPTERS.perplexity.getDefaultModel(),
    deepseek: ADAPTERS.deepseek.getDefaultModel()
  };
}

/**
 * Get formatted model list as markdown
 * 
 * @returns Human-readable model list
 */
export function researchModelsFormatted(): string {
  const models = researchModels();
  const defaults = getAllDefaultModels();

  const lines = [
    '# Available Models',
    '',
    'Models supported by each provider:',
    ''
  ];

  for (const [provider, modelList] of Object.entries(models)) {
    const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);
    const defaultModel = defaults[provider as Provider];
    
    lines.push(`## ${providerName}`);
    lines.push('');
    lines.push(`**Default**: \`${defaultModel}\``);
    lines.push('');
    lines.push('**Available models:**');
    
    for (const model of modelList) {
      const isDefault = model === defaultModel;
      lines.push(`- \`${model}\`${isDefault ? ' _(default)_' : ''}`);
    }
    
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Check if a model is valid for a provider
 * 
 * @param provider Provider name
 * @param model Model identifier
 * @returns True if model is valid for provider
 */
export function isValidModel(provider: Provider, model: string): boolean {
  const adapter = ADAPTERS[provider];
  
  if (!adapter) {
    return false;
  }

  return adapter.listModels().includes(model);
}

/**
 * Get model count per provider
 * 
 * @returns Object mapping provider names to model counts
 */
export function getModelCounts(): Record<Provider, number> {
  return {
    openai: ADAPTERS.openai.listModels().length,
    gemini: ADAPTERS.gemini.listModels().length,
    perplexity: ADAPTERS.perplexity.listModels().length,
    deepseek: ADAPTERS.deepseek.listModels().length
  };
}