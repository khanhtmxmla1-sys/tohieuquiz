/**
 * OpenAI-compatible provider routed through the authenticated Cloudflare Worker.
 * Provider credentials never enter browser code or localStorage.
 */

import { SYSTEM_INSTRUCTION } from '../../../config/constants';
import type { IAIProvider, AIProviderType, QuizGenerationOptions, QuizGenerationResult } from '../ai.types';
import { buildPrompt, buildFileAttachmentPrompt } from '../shared/prompt-builder';
import { parseAndRepairJSON, formatMathSymbols } from '../shared/json-repair';
import { fileToBase64 } from '../shared/file-utils';
import { requestWorkerAiText } from '../../../services/ai/workerAiClient';


const buildMessages = async (
    promptText: string,
    file?: File | null,
): Promise<Array<{ role: string; content: unknown }>> => {
    const userContent: Array<Record<string, unknown>> = [{ type: 'text', text: promptText }];
    if (file) {
        const base64Data = await fileToBase64(file);
        userContent.unshift({ type: 'text', text: buildFileAttachmentPrompt() });
        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
            userContent.splice(1, 0, {
                type: 'input_file',
                file_data: `data:${file.type || 'application/pdf'};base64,${base64Data}`,
                filename: file.name,
            });
        } else {
            userContent.splice(1, 0, {
                type: 'image_url',
                image_url: { url: `data:${file.type};base64,${base64Data}` },
            });
        }
    }
    return [
        { role: 'system', content: SYSTEM_INSTRUCTION },
        { role: 'user', content: userContent },
    ];
};

export class OpenAIProvider implements IAIProvider {
    readonly type: AIProviderType = 'openai';
    readonly displayName = 'OpenAI-compatible';

    constructor(_apiKey: string = '', _type: AIProviderType = 'openai', _baseUrl: string = '', _modelName?: string) {}

    validateApiKey(_apiKey: string): boolean {
        return true;
    }

    async generate(
        topic: string,
        classLevel: string,
        content: string,
        options?: QuizGenerationOptions,
        file?: File | null,
    ): Promise<QuizGenerationResult> {
        const promptText = buildPrompt(topic, classLevel, content, options);
        const text = await requestWorkerAiText({
            model: 'gpt-4o',
            messages: await buildMessages(promptText, file),
            temperature: 0.4,
            response_format: { type: 'json_object' },
        });
        return parseAndRepairJSON(formatMathSymbols(text)) as QuizGenerationResult;
    }
}
