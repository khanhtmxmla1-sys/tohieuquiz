import type { Quiz, StudentResult } from '../../../types';
import { checkAnswer } from '../../../utils/question/scoring.util';
import type { ResultDisplayOverride } from './types';

const isAnswerSkipped = (value: unknown): boolean => {
  if (value === undefined || value === null || value === '') return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') {
    const meaningfulEntries = Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key !== 'selectedLeft' && key !== '__shuffledIds');
    return meaningfulEntries.length === 0
      || meaningfulEntries.every(([, item]) => isAnswerSkipped(item));
  }
  return false;
};

export const calculateOverrideFromAnswers = (
  result: StudentResult,
  answers: Record<string, unknown>,
  quiz?: Quiz,
): ResultDisplayOverride | null => {
  const answerEntries = Object.entries(answers || {}).filter(([key]) => !key.startsWith('_'));
  if (answerEntries.length === 0) return null;

  const questionsById = new Map(
    (quiz?.questions || []).map(question => [String(question.id), question]),
  );
  let correctedCount = 0;
  answerEntries.forEach(([questionId, answerData]) => {
    if (answerData && typeof answerData === 'object' && ('selectedAnswer' in answerData || 'questionSnapshot' in answerData)) {
      const selectedAnswer = (answerData as any).selectedAnswer;
      if (isAnswerSkipped(selectedAnswer)) return;

      const storedIsCorrect = (answerData as any).isCorrect;
      if (typeof storedIsCorrect === 'boolean') {
        if (storedIsCorrect) correctedCount += 1;
        return;
      }

      const gradingQuestion = (answerData as any).questionSnapshot || questionsById.get(String(questionId));
      if (gradingQuestion?.type && checkAnswer(gradingQuestion, selectedAnswer).isCorrect) {
        correctedCount += 1;
      }
      return;
    }
    if (isAnswerSkipped(answerData)) return;
    const gradingQuestion = questionsById.get(String(questionId));
    if (gradingQuestion?.type) {
      if (checkAnswer(gradingQuestion, answerData).isCorrect) correctedCount += 1;
      return;
    }
    if (answerData && typeof answerData === 'object' && (answerData as any).isCorrect === true) {
      correctedCount += 1;
      return;
    }
    if (result.validationDetails?.find(item => item.questionId === questionId)?.isCorrect) correctedCount += 1;
  });

  const totalQuestions = quiz?.questions.length
    || (result.totalQuestions && result.totalQuestions > 0 ? result.totalQuestions : answerEntries.length);
  const score = totalQuestions > 0
    ? Math.round((correctedCount / totalQuestions) * 100) / 10
    : result.score;
  return { correctCount: correctedCount, totalQuestions, score };
};
