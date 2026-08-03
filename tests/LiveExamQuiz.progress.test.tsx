import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Question } from '../src/types';
import { LiveExamQuiz } from '../src/components/LiveExam/LiveExamQuiz';

const mocks = vi.hoisted(() => ({
  updateActivity: vi.fn(),
  saveAnswerSnapshot: vi.fn(),
}));

vi.mock('../src/hooks', () => ({
  useLiveExamTimer: () => ({ timeRemaining: 600, isExpired: false }),
  useLiveExamActivity: () => ({ updateActivity: mocks.updateActivity }),
}));

vi.mock('../src/hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => ({ isOnline: true }),
}));

vi.mock('../src/services/liveExamService', () => ({
  getAnswerSnapshot: vi.fn(async () => null),
  saveAnswerSnapshot: mocks.saveAnswerSnapshot,
  submitAnswers: vi.fn(),
}));

vi.mock('../src/components/student/QuestionRenderer', () => ({
  default: ({ question, onAnswerChange }: {
    question: Question;
    onAnswerChange: (questionId: string, value: unknown) => void;
  }) => (
    <button type="button" onClick={() => onAnswerChange(question.id, 'mine')}>
      Điền mine
    </button>
  ),
}));

vi.mock('../src/features/quiz-player/components/QuizHeader', () => ({
  default: ({ answeredCount }: { answeredCount: number }) => (
    <div data-testid="completed-count">{answeredCount}</div>
  ),
}));

vi.mock('../src/features/quiz-player/components/QuizNavigation', () => ({
  default: () => null,
}));

vi.mock('../src/features/quiz-player/components/QuizPagination', () => ({
  default: () => null,
}));

vi.mock('../src/components/student', () => ({
  SubmitConfirmModal: () => null,
}));

describe('LiveExamQuiz progress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.saveAnswerSnapshot.mockResolvedValue({ attemptVersion: 1, answers: { q12: 'mine' } });
    window.sessionStorage.clear();
  });

  it('counts a student-safe short answer immediately and reports it to activity tracking', async () => {
    const questions = [{
      id: 'q12',
      type: 'SHORT_ANSWER',
      question: 'The eraser is ____.',
    }] as unknown as Question[];

    render(
      <LiveExamQuiz
        sessionId="session-progress"
        questions={questions}
        quizTitle="Thi thử"
        duration={60}
        endsAt="2026-08-04T12:00:00.000Z"
        onComplete={vi.fn()}
      />,
    );

    expect(screen.getByTestId('completed-count')).toHaveTextContent('0');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Điền mine' }));
    });

    expect(screen.getByTestId('completed-count')).toHaveTextContent('1');
    await waitFor(() => expect(mocks.updateActivity).toHaveBeenLastCalledWith(expect.objectContaining({
      answeredCount: 1,
    })));
  });
});
