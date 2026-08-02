import {
  getOptionId,
  getOrderingItemId,
  normalizeAnswerForQuestion,
  type QuizAnswer,
} from '../../../../../domain/quiz-scoring';

export const optionIdAt = getOptionId;
export const orderingItemIdAt = getOrderingItemId;

export const normalizedRendererAnswer = (
  question: unknown,
  answer: unknown,
): QuizAnswer | null => {
  const normalized = normalizeAnswerForQuestion(question, answer);
  return normalized.ok ? normalized.answer : null;
};

const looseOptionId = (question: unknown, answer: unknown): string | null => {
  if (answer && typeof answer === 'object' && !Array.isArray(answer)) {
    const optionId = (answer as Record<string, unknown>).optionId;
    if (typeof optionId === 'string' && /^option-\d+$/.test(optionId)) return optionId;
  }
  if (typeof answer === 'number' && Number.isInteger(answer)) return getOptionId(answer);
  const value = String(answer ?? '').trim();
  if (!value) return null;
  if (/^option-\d+$/i.test(value)) return value.toLowerCase();
  const label = value.match(/^([A-Z])[.)\-\s]*/i)?.[1];
  if (label) return getOptionId(label.toUpperCase().charCodeAt(0) - 65);

  const options = question && typeof question === 'object'
    ? (question as Record<string, unknown>).options
    : [];
  if (Array.isArray(options)) {
    const matches = options
      .map((option, index) => ({ index, value: String(option ?? '').trim().toLocaleLowerCase('vi-VN') }))
      .filter((option) => option.value === value.toLocaleLowerCase('vi-VN'));
    if (matches.length === 1) return getOptionId(matches[0].index);
  }
  return null;
};

export const selectedOptionId = (question: unknown, answer: unknown): string | null => {
  const normalized = normalizedRendererAnswer(question, answer);
  if (normalized && (normalized.type === 'MCQ' || normalized.type === 'IMAGE_QUESTION')) {
    return normalized.optionId;
  }
  return looseOptionId(question, answer);
};

export const selectedOptionIds = (question: unknown, answer: unknown): string[] => {
  const normalized = normalizedRendererAnswer(question, answer);
  if (normalized?.type === 'MULTIPLE_SELECT') return normalized.optionIds;
  const rawValues = Array.isArray(answer)
    ? answer
    : answer && typeof answer === 'object' && Array.isArray((answer as Record<string, unknown>).optionIds)
      ? (answer as Record<string, unknown>).optionIds as unknown[]
      : [];
  return Array.from(new Set(rawValues.map((value) => looseOptionId(question, value)).filter((value): value is string => Boolean(value)))).sort();
};

export const selectedOrderingRanks = (
  question: unknown,
  answer: unknown,
): Record<string, number> => {
  const normalized = normalizedRendererAnswer(question, answer);
  return normalized?.type === 'ORDERING' ? normalized.ranks : {};
};
