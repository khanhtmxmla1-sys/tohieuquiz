import { analyzeMathText, hasMathSyntax, normalizeMathText, type MathSyntaxIssue } from './mathText';

export interface QuestionMathIssue extends MathSyntaxIssue {
  field: string;
}

const SKIPPED_KEYS = new Set([
  'id', 'quizId', 'quiz_id', 'image', 'optionImages', 'createdAt', 'createdBy',
  'accessCode', 'type', 'subject', 'skillCode', 'subskillCode', 'tags',
]);

const visitStrings = (
  value: unknown,
  path: string,
  visitor: (text: string, path: string) => string,
): unknown => {
  if (typeof value === 'string') return visitor(value, path);
  if (Array.isArray(value)) {
    return value.map((item, index) => visitStrings(item, `${path}[${index}]`, visitor));
  }
  if (!value || typeof value !== 'object') return value;

  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const childPath = path ? `${path}.${key}` : key;
    output[key] = SKIPPED_KEYS.has(key) ? child : visitStrings(child, childPath, visitor);
  }
  return output;
};

export const validateQuestionMath = (question: unknown): QuestionMathIssue[] => {
  const issues: QuestionMathIssue[] = [];
  visitStrings(question, '', (text, field) => {
    if (hasMathSyntax(text)) {
      for (const issue of analyzeMathText(text)) issues.push({ ...issue, field });
    }
    return text;
  });
  return issues;
};

export const normalizeQuestionMath = <T>(question: T): T => visitStrings(
  question,
  '',
  (text) => hasMathSyntax(text) ? normalizeMathText(text) : text,
) as T;
