import type { ProgressQuestionType } from './types';

const TYPE_ALIASES: Record<string, ProgressQuestionType> = {
  MCQ: 'MCQ',
  MULTIPLE_CHOICE: 'MCQ',
  IMAGE: 'IMAGE_QUESTION',
  IMAGE_MCQ: 'IMAGE_QUESTION',
  IMAGE_QUESTION: 'IMAGE_QUESTION',
  MULTIPLE_SELECT: 'MULTIPLE_SELECT',
  SHORT_ANSWER: 'SHORT_ANSWER',
  TRUE_FALSE: 'TRUE_FALSE',
  MATCHING: 'MATCHING',
  DRAG_DROP: 'DRAG_DROP',
  DROPDOWN: 'DROPDOWN',
  FILL_IN_THE_BLANK: 'DROPDOWN',
  ORDERING: 'ORDERING',
  CATEGORIZATION: 'CATEGORIZATION',
  UNDERLINE: 'UNDERLINE',
  WORD_SCRAMBLE: 'WORD_SCRAMBLE',
  RIDDLE: 'RIDDLE',
  ERROR_CORRECTION: 'ERROR_CORRECTION',
  MATH_INPUT: 'MATH_INPUT',
  GEOMETRY: 'GEOMETRY',
};

const asRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
);

export const normalizeProgressQuestionType = (question: unknown): ProgressQuestionType => {
  const raw = asRecord(question);
  const value = String(raw.type ?? raw.questionType ?? '')
    .trim()
    .toUpperCase()
    .replace(/-/g, '_');
  return TYPE_ALIASES[value] ?? 'UNKNOWN';
};
