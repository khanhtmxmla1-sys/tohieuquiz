import { useMemo } from 'react';
import type { Question } from '../../../types';
import {
  summarizeQuizProgress,
  type QuizProgressSummary,
} from '../../../domain/quiz-progress';

export const useQuizProgress = (
  questions: readonly Question[],
  answers: Record<string, unknown>,
): QuizProgressSummary => useMemo(
  () => summarizeQuizProgress(questions, answers),
  [questions, answers],
);
