import {
  ServerQuizGenerationRequestSchema,
  type ServerQuizAiSource,
  type ServerQuizGenerationRequest,
} from '../../../../shared/quiz-generation.contract';

export function canonicalizeQuizGenerationRequest(raw: unknown): ServerQuizGenerationRequest {
  return ServerQuizGenerationRequestSchema.parse(raw);
}

export function getUnsupportedQuizCapabilities(
  request: ServerQuizGenerationRequest,
  source: ServerQuizAiSource,
): string[] {
  if (source === 'system') return [];

  const unsupported: string[] = [];
  if (request.typeAllocations.some(({ type }) => type === 'IMAGE_QUESTION')) {
    unsupported.push('IMAGE_QUESTION');
  }
  return unsupported;
}
