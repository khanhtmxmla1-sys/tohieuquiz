/**
 * AI Provider Types
 * 
 * Interface definitions for AI providers following Strategy Pattern.
 * All providers must implement the same interface for interchangeability.
 */

import type { QuestionType } from '../../types';

/**
 * AI Provider identifier type
 */
export type AIProviderType = 'gemini' | 'perplexity' | 'openai' | 'llm-mux';

/**
 * Image library item for quiz generation
 */
export interface ImageLibraryItem {
    id: string;
    name: string;
    data?: string; // Base64 or URL
}

/**
 * Quiz generation options passed to AI provider
 */
export interface QuizGenerationOptions {
    title: string;
    questionCount: number;
    questionTypes: QuestionType[];
    difficultyLevels?: {
        level1: number; // Easy - Recognition
        level2: number; // Medium - Understanding
        level3: number; // Hard - Application
    };
    imageLibrary?: ImageLibraryItem[];
}

/**
 * Quiz generation result from AI
 */
export interface QuizGenerationResult {
    title: string;
    timeLimit: number;
    questions: any[]; // Will be normalized by quiz.transformer
}

/**
 * AI Provider Interface
 * 
 * All AI providers must implement this interface.
 * Follows Liskov Substitution Principle - any provider can substitute another.
 */
export interface IAIProvider {
    /**
     * Provider type identifier
     */
    readonly type: AIProviderType;

    /**
     * Display name for UI
     */
    readonly displayName: string;

    /**
     * Generate a quiz based on the given parameters
     * 
     * @param topic - Quiz topic
     * @param classLevel - Class level (1-5)
     * @param content - Reference content (optional)
     * @param options - Generation options
     * @param file - Attached file (image/PDF)
     * @returns Generated quiz result
     */
    generate(
        topic: string,
        classLevel: string,
        content: string,
        options?: QuizGenerationOptions,
        file?: File | null
    ): Promise<QuizGenerationResult>;

    /**
     * Validate API key for this provider
     */
    validateApiKey(apiKey: string): boolean;
}

/**
 * Base configuration for AI providers
 */
export interface AIProviderConfig {
    apiKey: string;
    baseUrl?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
}

/**
 * Provider metadata for UI display
 */
export interface AIProviderInfo {
    type: AIProviderType;
    displayName: string;
    description: string;
    requiresApiKey: boolean;
    defaultModel: string;
    website: string;
}

/**
 * Provider registry metadata
 */
export const AI_PROVIDER_INFO: Record<AIProviderType, AIProviderInfo> = {
    gemini: {
        type: 'gemini',
        displayName: 'Google Gemini',
        description: 'Gemini 2.0 Flash - Free tier available',
        requiresApiKey: true,
        defaultModel: 'gemini-2.0-flash',
        website: 'https://ai.google.dev/'
    },
    perplexity: {
        type: 'perplexity',
        displayName: 'Perplexity',
        description: 'Sonar model with web search',
        requiresApiKey: true,
        defaultModel: 'sonar',
        website: 'https://perplexity.ai/'
    },
    openai: {
        type: 'openai',
        displayName: 'OpenAI',
        description: 'GPT-4o model',
        requiresApiKey: true,
        defaultModel: 'gpt-4o',
        website: 'https://openai.com/'
    },
    'llm-mux': {
        type: 'llm-mux',
        displayName: 'LLM-Mux',
        description: 'Local proxy for multiple providers',
        requiresApiKey: false,
        defaultModel: 'gemini-2.5-flash',
        website: 'https://github.com/nghyane/llm-mux'
    }
};
