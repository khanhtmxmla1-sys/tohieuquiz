import type { StudentResult } from '../../types';
import { unwrapStoredResultAnswer } from '../../domain/quiz-scoring';

export type AnswerOutcome = 'correct' | 'incorrect' | 'skipped' | 'voided';

export interface StudentResultSummary {
  correct: number;
  incorrect: number;
  skipped: number;
  voided: number;
  total: number;
  score10: number;
  accuracyPercent: number;
}

export const isSkippedAnswer = (value: unknown): boolean => (
  value === undefined
  || value === null
  || value === ''
  || (Array.isArray(value) && value.length === 0)
  || (
    typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && Object.keys(value).length === 0
  )
);

const getSelectedAnswer = (storedAnswer: unknown, fallbackAnswer: unknown): unknown => {
  const stored = unwrapStoredResultAnswer(storedAnswer);
  return stored ?? unwrapStoredResultAnswer(fallbackAnswer);
};

export const getStoredAnswerOutcome = (
  result: StudentResult,
  questionId: string,
  fallbackAnswer?: unknown,
): AnswerOutcome => {
  const storedAnswer = result.answers?.[questionId];
  const storedStatus = storedAnswer && typeof storedAnswer === 'object' && !Array.isArray(storedAnswer)
    ? (storedAnswer as { status?: unknown }).status
    : undefined;
  if (storedStatus === 'voided') return 'voided';
  if (storedStatus === 'skipped') return 'skipped';

  const validation = result.validationDetails?.find((detail) => detail.questionId === questionId);
  if (validation?.status === 'voided') return 'voided';

  const selectedAnswer = getSelectedAnswer(storedAnswer, fallbackAnswer);
  if (isSkippedAnswer(selectedAnswer)) return 'skipped';

  if (storedAnswer && typeof storedAnswer === 'object' && !Array.isArray(storedAnswer)) {
    const graded = (storedAnswer as { isCorrect?: unknown }).isCorrect;
    if (typeof graded === 'boolean') return graded ? 'correct' : 'incorrect';
  }

  if (validation?.status === 'skipped') return 'skipped';
  if (validation) return validation.isCorrect ? 'correct' : 'incorrect';

  return 'incorrect';
};

const roundScore10 = (correct: number, total: number): number => (
  total > 0 ? Math.round((correct / total) * 100) / 10 : 0
);

export const buildStudentResultSummary = (
  result: StudentResult,
  answers: Record<string, unknown> = {},
): StudentResultSummary => {
  const storedIds = Object.keys(result.answers || {}).filter((key) => !key.startsWith('_'));
  const fallbackIds = Object.keys(answers).filter((key) => !key.startsWith('_'));
  const questionIds = Array.from(new Set([...storedIds, ...fallbackIds]));
  const total = Number.isFinite(result.totalQuestions) && result.totalQuestions >= 0
    ? result.totalQuestions
    : questionIds.length;

  let correct = 0;
  let incorrect = 0;
  let skipped = 0;
  let voided = 0;

  questionIds.forEach((questionId) => {
    const outcome = getStoredAnswerOutcome(result, questionId, answers[questionId]);
    if (outcome === 'correct') correct += 1;
    else if (outcome === 'incorrect') incorrect += 1;
    else if (outcome === 'skipped') skipped += 1;
    else voided += 1;
  });

  const countedValidQuestions = correct + incorrect + skipped;
  if (countedValidQuestions < total) skipped += total - countedValidQuestions;

  return {
    correct,
    incorrect,
    skipped,
    voided,
    total,
    score10: roundScore10(correct, total),
    accuracyPercent: total > 0 ? Math.round((correct / total) * 100) : 0,
  };
};

export const formatResultDuration = (timeTakenMinutes: number): string => {
  if (!Number.isFinite(timeTakenMinutes) || timeTakenMinutes < 0) return 'Chưa xác định';

  const totalSeconds = Math.round(timeTakenMinutes * 60);
  if (totalSeconds < 60) return `${totalSeconds} giây`;

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds > 0 ? `${minutes} phút ${seconds} giây` : `${minutes} phút`;
};
