import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Question } from '../src/types';
import { buildQuizProgressMismatchPayload } from '../src/services/telemetryService';
import {
  buildLegacyQuizProgressSummary,
  useQuizProgressRollout,
  type QuizProgressMismatchEvent,
} from '../src/features/quiz-player/hooks/useQuizProgressRollout';

const studentSafeQuestion = {
  id: 'q12',
  type: 'SHORT_ANSWER',
  question: 'The eraser is ____.',
} as unknown as Question;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('quiz progress controlled rollout', () => {
  it('builds the legacy boolean-only summary without partial states', () => {
    const summary = buildLegacyQuizProgressSummary(
      [studentSafeQuestion],
      { q12: 'mine' },
    );

    expect(summary).toMatchObject({
      totalCount: 1,
      emptyCount: 1,
      partialCount: 0,
      completeCount: 0,
    });
    expect(summary.byQuestionId.q12.state).toBe('empty');
  });

  it('returns V2 progress when the rollout flag is enabled', () => {
    const { result } = renderHook(() => useQuizProgressRollout({
      quizId: 'quiz-1',
      questions: [studentSafeQuestion],
      answers: { q12: 'mine' },
      enabled: true,
      reportMismatch: vi.fn(),
    }));

    expect(result.current).toMatchObject({
      emptyCount: 0,
      partialCount: 0,
      completeCount: 1,
    });
  });

  it('keeps V1 UI in shadow mode and reports each safe mismatch only once', async () => {
    const reportMismatch = vi.fn<(event: QuizProgressMismatchEvent) => void>();
    const { result, rerender } = renderHook(
      ({ answer }) => useQuizProgressRollout({
        quizId: 'quiz-shadow',
        questions: [studentSafeQuestion],
        answers: { q12: answer },
        enabled: false,
        reportMismatch,
      }),
      { initialProps: { answer: 'mine' } },
    );

    expect(result.current).toMatchObject({
      emptyCount: 1,
      partialCount: 0,
      completeCount: 0,
    });

    await waitFor(() => expect(reportMismatch).toHaveBeenCalledTimes(1));
    expect(reportMismatch).toHaveBeenCalledWith({
      event: 'quiz_progress_mismatch',
      quizId: 'quiz-shadow',
      questionId: 'q12',
      questionType: 'SHORT_ANSWER',
      legacyComplete: false,
      v2State: 'complete',
      releaseId: 'quiz-progress-v2',
    });

    rerender({ answer: 'mine' });
    await waitFor(() => expect(reportMismatch).toHaveBeenCalledTimes(1));

    rerender({ answer: '' });
    rerender({ answer: 'mine' });
    await waitFor(() => expect(reportMismatch).toHaveBeenCalledTimes(1));
  });

  it('builds an allowlisted telemetry payload without answer content', () => {
    const payload = buildQuizProgressMismatchPayload({
      event: 'quiz_progress_mismatch',
      quizId: 'quiz 1<script>',
      questionId: 'q12',
      questionType: 'short_answer',
      legacyComplete: false,
      v2State: 'complete',
      releaseId: 'quiz-progress-v2',
    });

    expect(payload).toEqual({
      event: 'quiz_progress_mismatch',
      quizId: 'quiz1script',
      questionId: 'q12',
      questionType: 'SHORT_ANSWER',
      legacyComplete: false,
      v2State: 'complete',
      releaseId: 'quiz-progress-v2',
    });
    expect(payload).not.toHaveProperty('answer');
    expect(payload).not.toHaveProperty('answerText');
  });

  it('resets mismatch dedupe for a new quiz session', async () => {
    const reportMismatch = vi.fn<(event: QuizProgressMismatchEvent) => void>();
    const { rerender } = renderHook(
      ({ quizId }) => useQuizProgressRollout({
        quizId,
        questions: [studentSafeQuestion],
        answers: { q12: 'mine' },
        enabled: false,
        reportMismatch,
      }),
      { initialProps: { quizId: 'quiz-a' } },
    );

    await waitFor(() => expect(reportMismatch).toHaveBeenCalledTimes(1));
    rerender({ quizId: 'quiz-b' });
    await waitFor(() => expect(reportMismatch).toHaveBeenCalledTimes(2));
  });
});
