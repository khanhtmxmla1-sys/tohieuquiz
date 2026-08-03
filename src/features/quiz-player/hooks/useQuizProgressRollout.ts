import { useEffect, useMemo, useRef } from 'react';
import type { Question } from '../../../types';
import {
  isQuestionAnswered as isLegacyQuestionComplete,
} from '../../../domain/quiz-scoring';
import {
  normalizeProgressQuestionType,
  type QuestionProgressResult,
  type QuizProgressSummary,
} from '../../../domain/quiz-progress';
import { isQuizProgressV2Enabled } from '../../../config/featureFlags';
import {
  reportQuizProgressMismatch,
  type QuizProgressMismatchTelemetry,
} from '../../../services/telemetryService';
import { useQuizProgress } from './useQuizProgress';

export const QUIZ_PROGRESS_RELEASE_ID = 'quiz-progress-v2' as const;

export type QuizProgressMismatchEvent = QuizProgressMismatchTelemetry;
export type QuizProgressMismatchReporter = (event: QuizProgressMismatchEvent) => void;

const emptyProgress = (complete: boolean): QuestionProgressResult => ({
  state: complete ? 'complete' : 'empty',
  hasInteraction: complete,
  completedParts: complete ? 1 : 0,
  requiredParts: 1,
});

export const buildLegacyQuizProgressSummary = (
  questions: readonly Question[],
  answers: Record<string, unknown>,
): QuizProgressSummary => {
  const summary: QuizProgressSummary = {
    totalCount: questions.length,
    emptyCount: 0,
    partialCount: 0,
    completeCount: 0,
    byQuestionId: {},
  };

  questions.forEach((question) => {
    const questionId = String(question.id ?? '').trim();
    const complete = isLegacyQuestionComplete(
      question,
      questionId ? answers[questionId] : undefined,
    );
    if (complete) summary.completeCount += 1;
    else summary.emptyCount += 1;
    if (questionId) summary.byQuestionId[questionId] = emptyProgress(complete);
  });

  return summary;
};

interface UseQuizProgressRolloutOptions {
  quizId: string;
  questions: readonly Question[];
  answers: Record<string, unknown>;
  enabled?: boolean;
  reportMismatch?: QuizProgressMismatchReporter;
}

export const useQuizProgressRollout = ({
  quizId,
  questions,
  answers,
  enabled = isQuizProgressV2Enabled(),
  reportMismatch = reportQuizProgressMismatch,
}: UseQuizProgressRolloutOptions): QuizProgressSummary => {
  const v2Summary = useQuizProgress(questions, answers);
  const legacySummary = useMemo(
    () => buildLegacyQuizProgressSummary(questions, answers),
    [questions, answers],
  );
  const dedupeRef = useRef<{ quizId: string; keys: Set<string> }>({
    quizId,
    keys: new Set<string>(),
  });

  if (dedupeRef.current.quizId !== quizId) {
    dedupeRef.current = { quizId, keys: new Set<string>() };
  }

  useEffect(() => {
    if (enabled) return;

    questions.forEach((question) => {
      const questionId = String(question.id ?? '').trim();
      if (!questionId) return;
      const legacyComplete = legacySummary.byQuestionId[questionId]?.state === 'complete';
      const v2State = v2Summary.byQuestionId[questionId]?.state ?? 'empty';
      const equivalentV2State = legacyComplete ? 'complete' : 'empty';
      if (v2State === equivalentV2State) return;

      const dedupeKey = `${questionId}:${legacyComplete}:${v2State}`;
      if (dedupeRef.current.keys.has(dedupeKey)) return;
      dedupeRef.current.keys.add(dedupeKey);
      reportMismatch({
        event: 'quiz_progress_mismatch',
        quizId,
        questionId,
        questionType: normalizeProgressQuestionType(question),
        legacyComplete,
        v2State,
        releaseId: QUIZ_PROGRESS_RELEASE_ID,
      });
    });
  }, [enabled, legacySummary.byQuestionId, questions, quizId, reportMismatch, v2Summary.byQuestionId]);

  return enabled ? v2Summary : legacySummary;
};
