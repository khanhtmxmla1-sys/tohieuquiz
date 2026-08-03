import {
  unwrapStoredResultAnswer,
  withoutUiMetadata,
} from '../quiz-scoring/legacyAnswerAdapters';
import { normalizeProgressQuestionType } from './questionType';
import type { QuestionProgressResult } from './types';

const asRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
);

const result = (completedParts: number, requiredParts = 1): QuestionProgressResult => {
  const safeRequired = Math.max(1, requiredParts);
  const safeCompleted = Math.max(0, Math.min(completedParts, safeRequired));
  if (safeCompleted === 0) {
    return {
      state: 'empty',
      hasInteraction: false,
      completedParts: 0,
      requiredParts: safeRequired,
    };
  }
  return {
    state: safeCompleted >= safeRequired ? 'complete' : 'partial',
    hasInteraction: true,
    completedParts: safeCompleted,
    requiredParts: safeRequired,
  };
};

const hasText = (value: unknown): boolean => String(value ?? '').trim().length > 0;

const scalarValue = (value: unknown): unknown => {
  const record = asRecord(value);
  if (Object.prototype.hasOwnProperty.call(record, 'value')) return record.value;
  return value;
};

const singleChoiceFilled = (value: unknown): boolean => {
  if (typeof value === 'number') return Number.isInteger(value) && value >= 0;
  const record = asRecord(value);
  if (Object.prototype.hasOwnProperty.call(record, 'optionId')) return hasText(record.optionId);
  if (Object.prototype.hasOwnProperty.call(record, 'value')) return hasText(record.value);
  return hasText(value);
};

const selectedList = (value: unknown, key: string): unknown[] => {
  if (Array.isArray(value)) return value;
  const record = asRecord(value);
  const nested = record[key];
  if (Array.isArray(nested)) return nested;
  return Object.entries(withoutUiMetadata(value))
    .filter(([, selected]) => selected === true)
    .map(([selectedKey]) => selectedKey);
};

const unknownFilled = (value: unknown): boolean => {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') {
    return Object.keys(withoutUiMetadata(value)).length > 0;
  }
  return hasText(value);
};

export const getQuestionProgress = (
  question: unknown,
  rawAnswer: unknown,
): QuestionProgressResult => {
  const answer = unwrapStoredResultAnswer(rawAnswer);
  const type = normalizeProgressQuestionType(question);

  switch (type) {
    case 'MCQ':
    case 'IMAGE_QUESTION':
      return result(singleChoiceFilled(answer) ? 1 : 0);
    case 'MULTIPLE_SELECT':
      return result(selectedList(answer, 'optionIds').length > 0 ? 1 : 0);
    case 'UNDERLINE':
      return result(selectedList(answer, 'indexes').length > 0 ? 1 : 0);
    case 'SHORT_ANSWER':
    case 'RIDDLE':
    case 'MATH_INPUT':
    case 'GEOMETRY':
      return result(hasText(scalarValue(answer)) ? 1 : 0);
    case 'UNKNOWN':
      return result(unknownFilled(answer) ? 1 : 0);
    default:
      return result(unknownFilled(answer) ? 1 : 0);
  }
};
