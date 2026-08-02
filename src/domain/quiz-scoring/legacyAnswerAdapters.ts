import { asRecord } from './questionIdentity';

const CANONICAL_ANSWER_TYPES = new Set([
  'MCQ', 'IMAGE_QUESTION', 'MULTIPLE_SELECT', 'SHORT_ANSWER', 'RIDDLE', 'TRUE_FALSE',
  'MATCHING', 'DROPDOWN', 'DRAG_DROP', 'ORDERING', 'UNDERLINE', 'CATEGORIZATION',
  'WORD_SCRAMBLE', 'ERROR_CORRECTION',
]);

const UI_METADATA_KEYS = new Set([
  'selectedLeft',
  '__shuffledIds',
  '_selected',
  '_questionOrder',
  'isCorrect',
  'questionSnapshot',
  'status',
  'gradingVersion',
  'timeSpent',
]);

export const withoutUiMetadata = (value: unknown): Record<string, unknown> => {
  const record = asRecord(value);
  return Object.fromEntries(Object.entries(record).filter(([key]) => !UI_METADATA_KEYS.has(key)));
};

export const unwrapStoredResultAnswer = (value: unknown, depth = 0): unknown => {
  if (depth > 4) return null;
  if (value === undefined || value === null) return null;

  const record = asRecord(value);
  if (Object.keys(record).length === 0) return value;
  if (typeof record.type === 'string' && CANONICAL_ANSWER_TYPES.has(record.type)) return value;
  if (Object.prototype.hasOwnProperty.call(record, 'selectedAnswer')) {
    return unwrapStoredResultAnswer(record.selectedAnswer, depth + 1);
  }
  return Object.keys(withoutUiMetadata(record)).length === 0 ? null : value;
};
