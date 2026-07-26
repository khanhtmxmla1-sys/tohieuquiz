import { z } from 'zod';

export interface GeneratedQuizSchemaIssue {
  path: Array<string | number>;
  code: string;
  message: string;
}

export const GENERATED_QUIZ_SCHEMA_USER_MESSAGE =
  'AI tạo một số câu chưa đúng cấu trúc. Vui lòng thử tạo lại đề hoặc giảm số dạng câu trong một lần.';

export class GeneratedQuizSchemaError extends Error {
  readonly code = 'AI_QUIZ_SCHEMA_INVALID';

  constructor(public readonly issues: GeneratedQuizSchemaIssue[]) {
    super(GENERATED_QUIZ_SCHEMA_USER_MESSAGE);
    this.name = 'GeneratedQuizSchemaError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const toGeneratedQuizSchemaIssues = (
  issues: z.core.$ZodIssue[],
): GeneratedQuizSchemaIssue[] => issues.map((issue) => ({
  path: issue.path.filter(
    (part): part is string | number => typeof part === 'string' || typeof part === 'number',
  ),
  code: issue.code,
  message: issue.message,
}));

export const getQuizGenerationUserMessage = (error: unknown): string => {
  if (error instanceof GeneratedQuizSchemaError || error instanceof z.ZodError) {
    return GENERATED_QUIZ_SCHEMA_USER_MESSAGE;
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return 'Đã xảy ra lỗi khi tạo đề.';
};
