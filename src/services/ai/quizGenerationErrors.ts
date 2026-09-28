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

const SAFE_FIELD_LABELS: Readonly<Record<string, string>> = {
  question: 'nội dung câu hỏi',
  mainQuestion: 'nội dung câu hỏi',
  text: 'nội dung câu hỏi',
  options: 'phương án trả lời',
  correctAnswer: 'đáp án',
  correctAnswers: 'đáp án',
  pairs: 'ghép nối',
  categories: 'phân loại',
  items: 'phân loại',
  categoryId: 'phân loại',
  blanks: 'ô trống',
  slotId: 'cấu hình câu hỏi',
  type: 'cấu hình câu hỏi',
  difficulty: 'cấu hình câu hỏi',
  diagramPolicy: 'cấu hình câu hỏi',
};

const summarizeSchemaIssues = (issues: GeneratedQuizSchemaIssue[]): string | null => {
  const summaries = new Map<number, string>();

  for (const issue of issues) {
    const questionsIndex = issue.path.indexOf('questions');
    const questionIndex = questionsIndex >= 0 ? issue.path[questionsIndex + 1] : undefined;
    if (typeof questionIndex !== 'number' || questionIndex < 0 || !Number.isInteger(questionIndex)) {
      continue;
    }

    const field = issue.path
      .slice(questionsIndex + 2)
      .find((part): part is string => typeof part === 'string' && part in SAFE_FIELD_LABELS);
    const label = field ? SAFE_FIELD_LABELS[field] : 'cấu trúc câu hỏi';
    if (!summaries.has(questionIndex)) summaries.set(questionIndex, label);
    if (summaries.size === 3) break;
  }

  if (summaries.size === 0) return null;
  return [...summaries.entries()]
    .map(([index, label]) => `Câu ${index + 1}: phần ${label} chưa đúng cấu trúc.`)
    .join(' ');
};

export const getQuizGenerationUserMessage = (error: unknown): string => {
  if (error instanceof GeneratedQuizSchemaError || error instanceof z.ZodError) {
    const issues = error instanceof GeneratedQuizSchemaError
      ? error.issues
      : toGeneratedQuizSchemaIssues(error.issues);
    const summary = summarizeSchemaIssues(issues);
    return summary
      ? `AI tạo một số câu chưa đúng cấu trúc. ${summary} Đã thử sửa nhưng chưa thành công.`
      : GENERATED_QUIZ_SCHEMA_USER_MESSAGE;
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return 'Đã xảy ra lỗi khi tạo đề.';
};
