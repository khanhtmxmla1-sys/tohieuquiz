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

const questionArray = (question: unknown, key: string): unknown[] => {
  const value = asRecord(question)[key];
  return Array.isArray(value) ? value : [];
};

const nestedRecord = (value: unknown, key: string): Record<string, unknown> => {
  const record = asRecord(value);
  return withoutUiMetadata(record[key] ?? value);
};

const filledRecordValueCount = (value: unknown): number => Object.values(withoutUiMetadata(value))
  .filter((item) => typeof item === 'boolean' || hasText(item))
  .length;

const trueFalseProgress = (question: unknown, answer: unknown): QuestionProgressResult => {
  const items = questionArray(question, 'items');
  const required = Math.max(1, items.length);
  const source = nestedRecord(answer, 'values');
  const itemIds = items.map((item, index) => String(asRecord(item).id ?? `item-${index}`));
  const completed = itemIds.length > 0
    ? itemIds.filter((id) => typeof source[id] === 'boolean').length
    : Object.values(source).filter((value) => typeof value === 'boolean').length;
  return result(completed, required);
};

const matchingProgress = (question: unknown, answer: unknown): QuestionProgressResult => {
  const leftItems = questionArray(question, 'leftItems');
  const pairs = questionArray(question, 'pairs');
  const legacyItems = questionArray(question, 'items');
  const required = Math.max(
    1,
    leftItems.length || pairs.length || Math.ceil(legacyItems.length / 2),
  );
  const source = nestedRecord(answer, 'pairs');
  const completed = Object.entries(source)
    .filter(([key, value]) => key !== 'type' && hasText(value))
    .length;
  return result(completed, required);
};

const blanksProgress = (question: unknown, answer: unknown): QuestionProgressResult => {
  const blanks = questionArray(question, 'blanks');
  const required = Math.max(1, blanks.length);
  if (Array.isArray(answer)) {
    return result(answer.filter(hasText).length, required);
  }
  const sourceRecord = asRecord(answer);
  const source = Object.prototype.hasOwnProperty.call(sourceRecord, 'values')
    ? sourceRecord.values
    : answer;
  return result(filledRecordValueCount(source), required);
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
    case 'TRUE_FALSE':
      return trueFalseProgress(question, answer);
    case 'MATCHING':
      return matchingProgress(question, answer);
    case 'DROPDOWN':
    case 'DRAG_DROP':
      return blanksProgress(question, answer);
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
