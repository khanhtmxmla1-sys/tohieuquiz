import { asRecord } from './questionIdentity';

const CANONICAL_ANSWER_TYPES = new Set([
  'MCQ', 'IMAGE_QUESTION', 'MULTIPLE_SELECT', 'SHORT_ANSWER', 'RIDDLE', 'TRUE_FALSE',
  'MATCHING', 'DROPDOWN', 'DRAG_DROP', 'ORDERING', 'UNDERLINE', 'CATEGORIZATION',
  'WORD_SCRAMBLE', 'ERROR_CORRECTION',
]);

export const unwrapStoredResultAnswer = (value: unknown): unknown => {
  const record = asRecord(value);
  if (typeof record.type === 'string' && CANONICAL_ANSWER_TYPES.has(record.type)) return value;
  if (Object.prototype.hasOwnProperty.call(record, 'selectedAnswer')) return record.selectedAnswer;
  return value;
};

export const withoutUiMetadata = (value: unknown): Record<string, unknown> => {
  const record = asRecord(value);
  return Object.fromEntries(Object.entries(record).filter(([key]) => key !== 'selectedLeft' && key !== '__shuffledIds' && key !== '_selected'));
};
