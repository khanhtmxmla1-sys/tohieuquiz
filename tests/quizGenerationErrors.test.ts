import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  GENERATED_QUIZ_SCHEMA_USER_MESSAGE,
  GeneratedQuizSchemaError,
  getQuizGenerationUserMessage,
} from '../src/services/ai/quizGenerationErrors';

describe('quiz generation user errors', () => {
  it('summarizes a question and allowlisted field without exposing raw diagnostics', () => {
    const error = new GeneratedQuizSchemaError([{
      path: ['questions', 3, 'correctAnswer'],
      code: 'invalid_type',
      message: 'PRIVATE_RAW_DIAGNOSTIC',
    }]);

    const message = getQuizGenerationUserMessage(error);

    expect(message).toContain('Câu 4');
    expect(message).toContain('đáp án');
    expect(message).not.toContain('PRIVATE_RAW_DIAGNOSTIC');
  });

  it('deduplicates affected questions and shows at most three safe summaries', () => {
    const error = new GeneratedQuizSchemaError([
      { path: ['questions', 0, 'question'], code: 'too_small', message: 'secret-1' },
      { path: ['questions', 0, 'options'], code: 'too_small', message: 'secret-2' },
      { path: ['questions', 1, 'pairs'], code: 'invalid_type', message: 'secret-3' },
      { path: ['questions', 2, 'items'], code: 'custom', message: 'secret-4' },
      { path: ['questions', 3, 'unknownAttackerField'], code: 'custom', message: 'secret-5' },
    ]);

    const message = getQuizGenerationUserMessage(error);

    expect(message).toContain('Câu 1');
    expect(message).toContain('Câu 2');
    expect(message).toContain('Câu 3');
    expect(message).not.toContain('Câu 4');
    expect(message).not.toMatch(/secret-|unknownAttackerField/);
  });

  it('uses the generic fallback for root-only issues', () => {
    const error = new GeneratedQuizSchemaError([{
      path: [],
      code: 'custom',
      message: 'PRIVATE_ROOT_DIAGNOSTIC',
    }]);

    expect(getQuizGenerationUserMessage(error)).toBe(GENERATED_QUIZ_SCHEMA_USER_MESSAGE);
  });

  it('summarizes raw Zod issues and preserves unrelated error messages', () => {
    const schema = z.object({
      questions: z.array(z.object({ correctAnswer: z.string() })),
    });
    const result = schema.safeParse({ questions: [{ correctAnswer: 1 }] });
    expect(result.success).toBe(false);
    if (result.success) throw new Error('Expected a Zod error');

    expect(getQuizGenerationUserMessage(result.error)).toContain('Câu 1');
    expect(getQuizGenerationUserMessage(new Error('Lỗi hạn mức an toàn.')))
      .toBe('Lỗi hạn mức an toàn.');
  });
});
