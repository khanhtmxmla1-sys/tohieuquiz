/**
 * AI Provider Factory
 * 
 * Creates AI provider instances based on type.
 * Follows Factory Pattern and Open/Closed Principle.
 * 
 * To add a new provider:
 * 1. Create new file in providers/
 * 2. Implement IAIProvider interface
 * 3. Add case to createProvider() switch
 */

import type { IAIProvider, AIProviderType } from './ai.types';
import { GeminiProvider } from './providers/gemini.provider';
import { PerplexityProvider } from './providers/perplexity.provider';
import { OpenAIProvider } from './providers/openai.provider';

/**
 * Configuration for creating an AI provider
 */
export interface CreateProviderConfig {
    type: AIProviderType;
    apiKey?: string;
    baseUrl?: string; // For LLM-Mux
    model?: string;   // Override default model
}

/**
 * Create an AI provider instance
 * 
 * @param config - Provider configuration
 * @returns AI provider instance
 * @throws Error if provider type is unknown
 * 
 * @example
 * const provider = createProvider({ type: 'gemini' });
 * const quiz = await provider.generate(...);
 */
export const createProvider = (config: CreateProviderConfig): IAIProvider => {
    const { type, apiKey = '', baseUrl, model } = config;

    switch (type) {
        case 'gemini':
            return new GeminiProvider(apiKey);

        case 'perplexity':
            return new PerplexityProvider(apiKey);

        case 'openai':
            return new OpenAIProvider(apiKey, 'openai', baseUrl || '', model);

        case 'llm-mux':
            return new OpenAIProvider(apiKey, 'llm-mux', '', model);

        default:
            throw new Error(`Unknown AI provider type: ${type}`);
    }
};

/**
 * Get all available provider types
 */
export const getAvailableProviders = (): AIProviderType[] => {
    return ['gemini', 'perplexity', 'openai', 'llm-mux'];
};

/**
 * Get default provider type
 */
export const getDefaultProvider = (): AIProviderType => {
    return 'gemini';
};
