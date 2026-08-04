import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const saveSnapshot = vi.hoisted(() => vi.fn());
const getSnapshot = vi.hoisted(() => vi.fn(async () => null));
const updateActivity = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('../src/hooks', () => ({
  useLiveExamTimer: () => ({ timeRemaining: 600, isExpired: false }),
  useLiveExamActivity: () => ({ updateActivity }),
}));
vi.mock('../src/hooks/useOnlineStatus', () => ({ useOnlineStatus: () => ({ isOnline: true }) }));
vi.mock('../src/services/liveExamService', () => ({
  getAnswerSnapshot: getSnapshot,
  saveAnswerSnapshot: saveSnapshot,
  submitAnswers: vi.fn(),
}));
vi.mock('../src/components/student/QuestionRenderer', () => ({
  default: ({ question, onAnswerChange }: any) => (
    <>
      <button type="button" onClick={() => onAnswerChange(question.id, 'A')}>Chọn A</button>
      <button type="button" onClick={() => onAnswerChange(question.id, 'B')}>Chọn B</button>
    </>
  ),
}));
vi.mock('../src/features/quiz-player/components/QuizHeader', () => ({ default: () => null }));
vi.mock('../src/features/quiz-player/components/QuizNavigation', () => ({ default: () => null }));
vi.mock('../src/features/quiz-player/components/QuizPagination', () => ({ default: () => null }));
vi.mock('../src/components/student', () => ({ SubmitConfirmModal: () => null }));

import { LiveExamQuiz } from '../src/components/LiveExam/LiveExamQuiz';

const question = {
  id: 'q1', quizId: 'quiz-1', type: 'MCQ', question: 'Chọn',
  options: ['A', 'B'], correctAnswer: 'A', points: 1,
};

describe('LiveExamQuiz autosave queue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    window.sessionStorage.clear();
  });

  afterEach(() => vi.useRealTimers());

  it('serializes two quick edits and assigns increasing versions', async () => {
    let resolveFirst!: (value: any) => void;
    saveSnapshot
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(async (_sessionId, payload) => ({
        attemptVersion: payload.attemptVersion,
        answers: payload.answers,
        updatedAt: '2026-08-04T05:00:02.000Z',
      }));

    render(
      <LiveExamQuiz
        sessionId="session-queue"
        questions={[question] as any}
        quizTitle="Thi thử"
        duration={30}
        endsAt="2099-01-01T00:00:00.000Z"
        onComplete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Chọn A' }));
    await act(async () => {
      vi.advanceTimersByTime(250);
      await Promise.resolve();
    });
    expect(saveSnapshot).toHaveBeenCalledTimes(1);
    expect(saveSnapshot.mock.calls[0][1]).toMatchObject({ attemptVersion: 1, answers: { q1: 'A' } });

    fireEvent.click(screen.getByRole('button', { name: 'Chọn B' }));
    await act(async () => {
      vi.advanceTimersByTime(250);
      await Promise.resolve();
    });
    expect(saveSnapshot).toHaveBeenCalledTimes(1);

    resolveFirst({
      attemptVersion: 1,
      answers: { q1: 'A' },
      updatedAt: '2026-08-04T05:00:01.000Z',
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(saveSnapshot).toHaveBeenCalledTimes(2);
    expect(saveSnapshot.mock.calls[1][1]).toMatchObject({ attemptVersion: 2, answers: { q1: 'B' } });
    expect(screen.getByText('Đáp án đã đồng bộ với máy chủ')).toBeVisible();
  });
});
