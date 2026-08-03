import { getQuestionProgress } from './getQuestionProgress';
import type { QuestionProgressResult } from './types';

export interface QuizProgressSummary {
  totalCount: number;
  emptyCount: number;
  partialCount: number;
  completeCount: number;
  byQuestionId: Record<string, QuestionProgressResult>;
}

const asRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
);

export const summarizeQuizProgress = (
  questions: readonly unknown[],
  answers: Record<string, unknown>,
): QuizProgressSummary => {
  const summary: QuizProgressSummary = {
    totalCount: questions.length,
    emptyCount: 0,
    partialCount: 0,
    completeCount: 0,
    byQuestionId: {},
  };

  for (const question of questions) {
    const questionId = String(asRecord(question).id ?? '').trim();
    const progress = getQuestionProgress(
      question,
      questionId ? answers[questionId] : undefined,
    );

    if (progress.state === 'empty') summary.emptyCount += 1;
    else if (progress.state === 'partial') summary.partialCount += 1;
    else summary.completeCount += 1;

    if (questionId) summary.byQuestionId[questionId] = progress;
  }

  return summary;
};
