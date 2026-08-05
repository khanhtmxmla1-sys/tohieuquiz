import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QuestionType, type Quiz } from '../src/types';
import { quizAttemptStorageKey } from '../src/features/quiz-player/quizAttemptDraft';

const mocks = vi.hoisted(() => ({
  validateAnswersOnServer: vi.fn(),
  startAssignmentAttempt: vi.fn(),
}));

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
  validateAnswersOnServer: mocks.validateAnswersOnServer,
}));
vi.mock('../src/services/classroomService', () => ({
  startAssignmentAttempt: mocks.startAssignmentAttempt,
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
    vi.clearAllMocks();
    mocks.validateAnswersOnServer.mockResolvedValue({
      success: true,
      score: 0,
      correctCount: 0,
      total: 2,
      questionCount: 2,
      details: [],
    });
    mocks.startAssignmentAttempt.mockResolvedValue({
      assignmentId: 'assignment-1',
      attemptCount: 0,
      maxAttempts: 1,
      remainingAttempts: 1,
      deadline: '2099-01-01T00:00:00.000Z',
      status: 'OPEN',
    });
  });

  afterEach(() => vi.useRealTimers());

  it('shows the notice step instead of the editable student form for a logged-in student', () => {
    const { result } = renderHook(() => useQuizPlayer({
      quiz,
      onExit: vi.fn(),
      onSaveResult: vi.fn(),
    }));

    expect(result.current.step).toBe('notice');
    expect(result.current.shuffledQuestions).toEqual([]);
  });

  it('does not submit a timed quiz during the first render after the student starts', async () => {
    const onSaveResult = vi.fn();
    const { result } = renderHook(() => useQuizPlayer({
      quiz,
      onExit: vi.fn(),
      onSaveResult,
    }));

    await act(async () => {
      await result.current.handleStart();
    });

    expect(result.current.step).toBe('quiz');
    expect(result.current.timeLeft).toBe(600);
    expect(mocks.validateAnswersOnServer).not.toHaveBeenCalled();
    expect(onSaveResult).not.toHaveBeenCalled();
  });

  it('checks the current assignment before starting an assigned quiz', async () => {
    const assignedQuiz = {
      ...quiz,
      _assignmentData: {
        id: 'assignment-1',
        quizId: quiz.id,
        classId: 'class-1',
        deadline: '2099-01-01T00:00:00.000Z',
        maxAttempts: 1,
        attemptCount: 0,
        status: 'OPEN',
        createdAt: '2026-08-04T00:00:00.000Z',
      },
    } as Quiz;
    const { result } = renderHook(() => useQuizPlayer({
      quiz: assignedQuiz,
      onExit: vi.fn(),
      onSaveResult: vi.fn(),
    }));

    await act(async () => {
      await result.current.handleStart();
    });

    expect(mocks.startAssignmentAttempt).toHaveBeenCalledWith('assignment-1', 'student-1');
    expect(result.current.step).toBe('quiz');
  });

  it('submits exactly once when the real deadline expires', async () => {
    const onSaveResult = vi.fn(async (savedResult) => savedResult);
    const { result } = renderHook(() => useQuizPlayer({
      quiz,
      onExit: vi.fn(),
      onSaveResult,
    }));

    await act(async () => {
      await result.current.handleStart();
    });

    vi.setSystemTime('2026-08-04T05:10:00.000Z');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(mocks.validateAnswersOnServer).toHaveBeenCalledOnce();
    expect(onSaveResult).toHaveBeenCalledOnce();
    expect(result.current.step).toBe('result');
  });

  it('ignores a duplicate start click while the first start is in progress', async () => {
    const assignedQuiz = {
      ...quiz,
      _assignmentData: {
        id: 'assignment-1', quizId: quiz.id, classId: 'class-1',
        deadline: '2099-01-01T00:00:00.000Z', maxAttempts: 1, attemptCount: 0,
        status: 'OPEN', createdAt: '2026-08-04T00:00:00.000Z',
      },
    } as Quiz;
    const { result } = renderHook(() => useQuizPlayer({
      quiz: assignedQuiz,
      onExit: vi.fn(),
      onSaveResult: vi.fn(),
    }));

    await act(async () => {
      await Promise.all([result.current.handleStart(), result.current.handleStart()]);
    });

    expect(mocks.startAssignmentAttempt).toHaveBeenCalledOnce();
    expect(result.current.step).toBe('quiz');
  });

  it('keeps the notice visible and shows the business error when preflight fails', async () => {
    mocks.startAssignmentAttempt.mockRejectedValueOnce(new Error('Em đã hết lượt làm bài này (1/1).'));
    const assignedQuiz = {
      ...quiz,
      _assignmentData: {
        id: 'assignment-1', quizId: quiz.id, classId: 'class-1',
        deadline: '2099-01-01T00:00:00.000Z', maxAttempts: 1, attemptCount: 0,
        status: 'OPEN', createdAt: '2026-08-04T00:00:00.000Z',
      },
    } as Quiz;
    const { result } = renderHook(() => useQuizPlayer({
      quiz: assignedQuiz,
      onExit: vi.fn(),
      onSaveResult: vi.fn(),
    }));

    await act(async () => {
      await result.current.handleStart();
    });

    expect(result.current.step).toBe('notice');
    expect(result.current.startError).toBe('Em đã hết lượt làm bài này (1/1).');
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

  it('reassigns a matching target to the latest selected left item', () => {
    const { result } = renderHook(() => useQuizPlayer({
      quiz,
      onExit: vi.fn(),
      onSaveResult: vi.fn(),
    }));

    act(() => result.current.handleMatchingClick('q1', 'l-0', 'left'));
    act(() => result.current.handleMatchingClick('q1', 'r-0', 'right'));
    act(() => result.current.handleMatchingClick('q1', 'l-1', 'left'));
    act(() => result.current.handleMatchingClick('q1', 'r-0', 'right'));

    expect(result.current.answers.q1).toEqual({ 'l-1': 'r-0' });
  });

  it('persists answer updates after the student starts explicitly', async () => {
    vi.useRealTimers();
    const { result, unmount } = renderHook(() => useQuizPlayer({
      quiz,
      onExit: vi.fn(),
      onSaveResult: vi.fn(),
    }));

    await act(async () => {
      await result.current.handleStart();
    });
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
