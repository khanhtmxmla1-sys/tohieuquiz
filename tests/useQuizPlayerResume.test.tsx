import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QuestionType, type Quiz } from '../src/types';
import { quizAttemptStorageKey } from '../src/features/quiz-player/quizAttemptDraft';

vi.mock('../src/stores/useClassroomStore', () => ({
  useClassroomStore: () => ({
    studentSession: {
      studentId: 'student-1', username: 'student-1', fullName: 'Nguyễn Văn An',
      className: '5A1', avatar: '',
    },
  }),
}));
vi.mock('../src/stores/useGamificationStore', () => ({
  useGamificationStore: { getState: () => ({ pet: null, coins: 0 }) },
}));
vi.mock('../src/stores/useGameLoopStore', () => ({
  useGameLoopStore: { getState: () => ({ trackQuizActivity: vi.fn() }) },
}));
vi.mock('../src/services/quizValidationService', () => ({
  validateAnswersOnServer: vi.fn(),
}));
vi.mock('../src/utils/toast', () => ({ playTingSound: vi.fn(), showError: vi.fn() }));

import { useQuizPlayer } from '../src/features/quiz-player/hooks/useQuizPlayer';

const quiz: Quiz = {
  id: 'quiz-resume',
  title: 'Bài kiểm tra có thời gian',
  classLevel: '5',
  category: 'toan',
  timeLimit: 10,
  createdAt: '2026-08-04T00:00:00.000Z',
  questions: [
    { id: 'q1', type: QuestionType.MCQ, question: '1?', options: ['A', 'B'], correctAnswer: 'A' },
    { id: 'q2', type: QuestionType.MCQ, question: '2?', options: ['A', 'B'], correctAnswer: 'B' },
  ],
};

describe('useQuizPlayer resume', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime('2026-08-04T05:00:00.000Z');
    window.sessionStorage.clear();
  });

  afterEach(() => vi.useRealTimers());

  it('does not auto-start a fresh timed quiz for a logged-in student', () => {
    const { result } = renderHook(() => useQuizPlayer({
      quiz,
      onExit: vi.fn(),
      onSaveResult: vi.fn(),
    }));

    expect(result.current.step).toBe('info');
    expect(result.current.shuffledQuestions).toEqual([]);
  });

  it('restores answers, question order, page and remaining time from an active draft', () => {
    window.sessionStorage.setItem(quizAttemptStorageKey(quiz.id), JSON.stringify({
      version: 1,
      quizId: quiz.id,
      studentName: 'Nguyễn Văn An',
      studentClass: '5A1',
      answers: { q2: 'B' },
      questionOrder: ['q2', 'q1'],
      currentPage: 1,
      startedAt: '2026-08-04T04:55:00.000Z',
      expiresAt: '2026-08-04T05:05:00.000Z',
    }));

    const { result } = renderHook(() => useQuizPlayer({
      quiz,
      onExit: vi.fn(),
      onSaveResult: vi.fn(),
    }));

    expect(result.current.step).toBe('quiz');
    expect(result.current.answers).toEqual({ q2: 'B' });
    expect(result.current.shuffledQuestions.map((question) => question.id)).toEqual(['q2', 'q1']);
    expect(result.current.currentPage).toBe(1);
    expect(result.current.timeLeft).toBe(300);
  });

  it('persists answer updates after the student starts explicitly', () => {
    vi.useRealTimers();
    const { result, unmount } = renderHook(() => useQuizPlayer({
      quiz,
      onExit: vi.fn(),
      onSaveResult: vi.fn(),
    }));

    act(() => result.current.handleStart());
    act(() => result.current.handleAnswerChange('q1', 'A'));

    const raw = window.sessionStorage.getItem(quizAttemptStorageKey(quiz.id));
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw || '{}')).toMatchObject({
      quizId: quiz.id,
      answers: { q1: 'A' },
      studentName: 'Nguyễn Văn An',
      studentClass: '5A1',
    });
    unmount();
  });
});
