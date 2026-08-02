import { unwrapStoredResultAnswer, withoutUiMetadata } from './legacyAnswerAdapters';
import { normalizeText } from './questionIdentity';
import { normalizeAnswerForNormalizedQuestion } from './normalizeAnswer';
import { normalizeQuestionForGrading } from './normalizeQuestion';
import type { NormalizedGradableQuestion, QuizAnswer } from './types';

export const isRawAnswerSkipped = (value: unknown): boolean => {
  const unwrapped = unwrapStoredResultAnswer(value);
  if (unwrapped === undefined || unwrapped === null || unwrapped === '') return true;
  if (Array.isArray(unwrapped)) return unwrapped.length === 0;
  if (typeof unwrapped === 'object') {
    return Object.keys(withoutUiMetadata(unwrapped)).length === 0;
  }
  return false;
};

export const isNormalizedAnswerComplete = (question: NormalizedGradableQuestion, answer: QuizAnswer): boolean => {
  switch (question.type) {
    case 'MCQ':
    case 'IMAGE_QUESTION':
      return answer.type === question.type && Boolean(answer.optionId);
    case 'MULTIPLE_SELECT':
      return answer.type === 'MULTIPLE_SELECT' && answer.optionIds.length > 0;
    case 'SHORT_ANSWER':
    case 'RIDDLE':
      return answer.type === question.type && Boolean(normalizeText(answer.value));
    case 'TRUE_FALSE':
      return answer.type === 'TRUE_FALSE' && Object.keys(question.correctValues).every((key) => typeof answer.values[key] === 'boolean');
    case 'MATCHING':
      return answer.type === 'MATCHING' && Object.keys(question.correctPairs).every((key) => Boolean(answer.pairs[key]));
    case 'DROPDOWN':
    case 'DRAG_DROP':
      return answer.type === question.type && question.blanks.every((blank) => Boolean(normalizeText(answer.values[blank.id])));
    case 'ORDERING':
      return answer.type === 'ORDERING' && question.items.every((item) => Number.isInteger(answer.ranks[item.id]));
    case 'CATEGORIZATION':
      return answer.type === 'CATEGORIZATION' && Object.keys(question.correctCategories).every((key) => Boolean(answer.categoriesByItemId[key]));
    case 'UNDERLINE':
      return answer.type === 'UNDERLINE' && answer.indexes.length > 0;
    case 'WORD_SCRAMBLE':
      return answer.type === 'WORD_SCRAMBLE' && answer.letterIndexes.length > 0;
    case 'ERROR_CORRECTION':
      return answer.type === 'ERROR_CORRECTION' && Boolean(normalizeText(answer.wrongWord)) && Boolean(normalizeText(answer.correctWord));
  }
};

export const isQuestionAnswered = (questionInput: unknown, answerInput: unknown): boolean => {
  if (isRawAnswerSkipped(answerInput)) return false;
  const normalizedQuestion = normalizeQuestionForGrading(questionInput);
  if (!normalizedQuestion.ok) return false;
  const normalizedAnswer = normalizeAnswerForNormalizedQuestion(normalizedQuestion.question, answerInput);
  return normalizedAnswer.ok && isNormalizedAnswerComplete(normalizedQuestion.question, normalizedAnswer.answer);
};
