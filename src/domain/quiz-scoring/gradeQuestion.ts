import { isNormalizedAnswerComplete, isRawAnswerSkipped } from './answerCompleteness';
import { normalizeCompactText, normalizeText } from './questionIdentity';
import { normalizeAnswerForNormalizedQuestion } from './normalizeAnswer';
import { normalizeQuestionForGrading } from './normalizeQuestion';
import type { NormalizedGradableQuestion, QuestionGradingResult, QuizAnswer } from './types';

const sameRecord = <T extends string | number | boolean>(expected: Record<string, T>, actual: Record<string, T>): boolean => {
  const keys = Object.keys(expected);
  return keys.length === Object.keys(actual).length && keys.every((key) => actual[key] === expected[key]);
};

const gradeNormalized = (question: NormalizedGradableQuestion, answer: QuizAnswer): boolean => {
  switch (question.type) {
    case 'MCQ':
    case 'IMAGE_QUESTION':
      return answer.type === question.type && answer.optionId === question.correctOptionId;
    case 'MULTIPLE_SELECT':
      return answer.type === 'MULTIPLE_SELECT'
        && answer.optionIds.length === question.correctOptionIds.length
        && answer.optionIds.every((value, index) => value === question.correctOptionIds[index]);
    case 'SHORT_ANSWER':
    case 'RIDDLE':
      return answer.type === question.type && question.acceptedValues.includes(normalizeText(answer.value));
    case 'TRUE_FALSE':
      return answer.type === 'TRUE_FALSE' && sameRecord(question.correctValues, answer.values);
    case 'MATCHING':
      return answer.type === 'MATCHING' && sameRecord(question.correctPairs, answer.pairs);
    case 'DROPDOWN':
    case 'DRAG_DROP':
      return answer.type === question.type
        && Object.keys(question.correctValues).length === Object.keys(answer.values).length
        && Object.entries(question.correctValues).every(([key, value]) => normalizeText(answer.values[key]) === normalizeText(value));
    case 'ORDERING':
      return answer.type === 'ORDERING' && sameRecord(question.correctRanks, answer.ranks);
    case 'CATEGORIZATION':
      return answer.type === 'CATEGORIZATION' && sameRecord(question.correctCategories, answer.categoriesByItemId);
    case 'UNDERLINE':
      return answer.type === 'UNDERLINE'
        && answer.indexes.length === question.correctIndexes.length
        && answer.indexes.every((value, index) => value === question.correctIndexes[index]);
    case 'WORD_SCRAMBLE':
      return answer.type === 'WORD_SCRAMBLE'
        && normalizeCompactText(answer.letterIndexes.map((index) => question.letters[index] ?? '').join('')) === question.correctWord;
    case 'ERROR_CORRECTION':
      return answer.type === 'ERROR_CORRECTION'
        && normalizeText(answer.wrongWord) === question.wrongWord
        && normalizeText(answer.correctWord) === question.correctWord;
  }
};

export const gradeQuestion = (questionInput: unknown, answerInput: unknown): QuestionGradingResult => {
  const normalizedQuestion = normalizeQuestionForGrading(questionInput);
  if (normalizedQuestion.ok === false) {
    return {
      questionId: normalizedQuestion.questionId,
      type: normalizedQuestion.type,
      status: 'invalid',
      isCorrect: false,
      normalizedStudentAnswer: null,
      issueCode: normalizedQuestion.issues[0]?.code ?? 'INVALID_QUESTION_CONTRACT',
    };
  }
  const question = normalizedQuestion.question;
  if (isRawAnswerSkipped(answerInput)) {
    return { questionId: question.id, type: question.type, status: 'skipped', isCorrect: false, normalizedStudentAnswer: null };
  }
  const normalizedAnswer = normalizeAnswerForNormalizedQuestion(question, answerInput);
  if (normalizedAnswer.ok === false) {
    return {
      questionId: question.id,
      type: question.type,
      status: 'invalid',
      isCorrect: false,
      normalizedStudentAnswer: null,
      issueCode: normalizedAnswer.issueCode,
    };
  }
  if (!isNormalizedAnswerComplete(question, normalizedAnswer.answer)) {
    return { questionId: question.id, type: question.type, status: 'wrong', isCorrect: false, normalizedStudentAnswer: normalizedAnswer.answer };
  }
  const isCorrect = gradeNormalized(question, normalizedAnswer.answer);
  return {
    questionId: question.id,
    type: question.type,
    status: isCorrect ? 'correct' : 'wrong',
    isCorrect,
    normalizedStudentAnswer: normalizedAnswer.answer,
  };
};
