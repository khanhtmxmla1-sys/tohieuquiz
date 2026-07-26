/**
 * AI Domain - Barrel Export
 * 
 * Central export for AI-related functionality.
 */

// Types
export * from './ai.types';

// Factory
export { createProvider, getAvailableProviders, getDefaultProvider } from './ai.factory';
export type { CreateProviderConfig } from './ai.factory';

// Providers (if needed directly)
export { GeminiProvider } from './providers/gemini.provider';
export { PerplexityProvider } from './providers/perplexity.provider';
export { OpenAIProvider } from './providers/openai.provider';

// Shared utilities
export { buildPrompt, buildFileAttachmentPrompt } from './shared/prompt-builder';
export { parseAndRepairJSON, formatMathSymbols } from './shared/json-repair';
export { fileToBase64, urlToBase64 } from './shared/file-utils';
