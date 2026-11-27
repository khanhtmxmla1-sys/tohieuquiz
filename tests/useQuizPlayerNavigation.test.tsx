import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QuestionType, type Quiz } from '../src/types';
import { quizAttemptStorageKey } from '../src/features/quiz-player/quizAttemptDraft';

const mocks = vi.hoisted(() => ({
  fetchQuizPlayQuestions: vi.fn(),
  requestQuizAccess: vi.fn(),
  adaptStudentQuizQuestion: vi.fn((question: unknown) => question),
  startAssignmentAttempt: vi.fn(),
  showConfirm: vi.fn(),
  showError: vi.fn(),
  playTingSound: vi.fn(),
  trackQuizActivity: vi.fn(),
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
  useGameLoopStore: { getState: () => ({ trackQuizActivity: mocks.trackQuizActivity }) },
}));
vi.mock('../src/services/quizAccessService', () => ({
  fetchQuizPlayQuestions: mocks.fetchQuizPlayQuestions,
  requestQuizAccess: mocks.requestQuizAccess,
  adaptStudentQuizQuestion: mocks.adaptStudentQuizQuestion,
}));
vi.mock('../src/services/classroomService', () => ({
  startAssignmentAttempt: mocks.startAssignmentAttempt,
}));
vi.mock('../src/services/quizValidationService', () => ({
  validateAnswersOnServer: vi.fn(),
}));
vi.mock('../src/utils/toast', () => ({
  playTingSound: mocks.playTingSound,
  showConfirm: mocks.showConfirm,
  showError: mocks.showError,
}));

import { useQuizPlayer } from '../src/features/quiz-player/hooks/useQuizPlayer';

const quiz: Quiz = {
  id: 'quiz-navigation',
  title: 'Bài kiểm tra điều hướng',
  classLevel: '5',
  category: 'toan',
  timeLimit: 10,
  createdAt: '2026-08-04T00:00:00.000Z',
  questions: [
    { id: 'q1', type: QuestionType.MCQ, question: '1?', options: ['A', 'B'], correctAnswer: 'A' },
    { id: 'q2', type: QuestionType.MCQ, question: '2?', options: ['A', 'B'], correctAnswer: 'B' },
  ],
};

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

const dispatchBack = () => {
  window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
};

describe('useQuizPlayer navigation guard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime('2026-08-04T05:00:00.000Z');
    window.sessionStorage.clear();
    vi.clearAllMocks();
    mocks.showConfirm.mockResolvedValue(false);
    mocks.fetchQuizPlayQuestions.mockResolvedValue({
      quizId: quiz.id,
      revision: 1,
      questions: quiz.questions,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('does not prompt for Back while the hook is on notice or result', async () => {
    const onSaveResult = vi.fn(async (savedResult) => savedResult);
    const { result } = renderHook(() => useQuizPlayer({
      quiz,
      onExit: vi.fn(),
      onSaveResult,
    }));

    dispatchBack();
    expect(mocks.showConfirm).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.handleStart();
    });
    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(result.current.step).toBe('result');
    dispatchBack();
    expect(mocks.showConfirm).not.toHaveBeenCalled();
  });

  it('opens one confirmation for multiple Back events while a prompt is pending', async () => {
    const pending = deferred<boolean>();
    mocks.showConfirm.mockReturnValue(pending.promise);
    const { result } = renderHook(() => useQuizPlayer({
      quiz,
      onExit: vi.fn(),
      onSaveResult: vi.fn(),
    }));

    await act(async () => {
      await result.current.handleStart();
    });
    const pushState = vi.spyOn(window.history, 'pushState');
    pushState.mockClear();

    dispatchBack();
    dispatchBack();

    expect(mocks.showConfirm).toHaveBeenCalledOnce();
    expect(pushState).toHaveBeenCalledOnce();

    await act(async () => {
      pending.resolve(false);
      await pending.promise;
    });
    pushState.mockRestore();
  });

  it('keeps the draft and restores the history entry when Back is cancelled', async () => {
    const onExit = vi.fn();
    const { result } = renderHook(() => useQuizPlayer({
      quiz,
      onExit,
      onSaveResult: vi.fn(),
    }));

    await act(async () => {
      await result.current.handleStart();
    });
    act(() => result.current.handleAnswerChange('q1', 'A'));
    const pushState = vi.spyOn(window.history, 'pushState');
    pushState.mockClear();

    mocks.showConfirm.mockResolvedValue(false);
    await act(async () => {
      dispatchBack();
      await Promise.resolve();
    });

    expect(onExit).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(quizAttemptStorageKey(quiz.id))).not.toBeNull();
    expect(pushState).toHaveBeenCalledOnce();
    pushState.mockRestore();
  });

  it('clears the draft before invoking onExit when Back is confirmed', async () => {
    let draftAtExit: string | null = 'not-called';
    const onExit = vi.fn(() => {
      draftAtExit = window.sessionStorage.getItem(quizAttemptStorageKey(quiz.id));
    });
    const { result } = renderHook(() => useQuizPlayer({
      quiz,
      onExit,
      onSaveResult: vi.fn(),
    }));

    await act(async () => {
      await result.current.handleStart();
    });
    act(() => result.current.handleAnswerChange('q1', 'A'));

    mocks.showConfirm.mockResolvedValue(true);
    await act(async () => {
      dispatchBack();
      await Promise.resolve();
    });

    expect(onExit).toHaveBeenCalledOnce();
    expect(draftAtExit).toBeNull();
    expect(window.sessionStorage.getItem(quizAttemptStorageKey(quiz.id))).toBeNull();
  });

  it('replaces the navigation listener when onExit changes during an active quiz', async () => {
    const firstExit = vi.fn();
    const secondExit = vi.fn();
    const { result, rerender } = renderHook(
      ({ onExit }) => useQuizPlayer({ quiz, onExit, onSaveResult: vi.fn() }),
      { initialProps: { onExit: firstExit } },
    );

    await act(async () => {
      await result.current.handleStart();
    });
    rerender({ onExit: secondExit });

    mocks.showConfirm.mockResolvedValue(true);
    await act(async () => {
      dispatchBack();
      await Promise.resolve();
    });

    expect(firstExit).not.toHaveBeenCalled();
    expect(secondExit).toHaveBeenCalledOnce();
  });

  it('removes the navigation listener on unmount', async () => {
    const addPopstate = vi.spyOn(window, 'addEventListener');
    const removePopstate = vi.spyOn(window, 'removeEventListener');
    const activePopstateListeners = () => {
      const active = new Set<unknown>();
      addPopstate.mock.calls.forEach(([type, listener]) => {
        if (type === 'popstate') active.add(listener);
      });
      removePopstate.mock.calls.forEach(([type, listener]) => {
        if (type === 'popstate') active.delete(listener);
      });
      return active;
    };
    const { result, unmount } = renderHook(() => useQuizPlayer({
      quiz,
      onExit: vi.fn(),
      onSaveResult: vi.fn(),
    }));

    await act(async () => {
      await result.current.handleStart();
    });
    expect(activePopstateListeners().size).toBe(1);
    unmount();
    expect(activePopstateListeners().size).toBe(0);
    dispatchBack();

    expect(mocks.showConfirm).not.toHaveBeenCalled();
  });

  it('keeps a single active listener under StrictMode', async () => {
    const addPopstate = vi.spyOn(window, 'addEventListener');
    const removePopstate = vi.spyOn(window, 'removeEventListener');
    const pushState = vi.spyOn(window.history, 'pushState');
    const activePopstateListeners = () => {
      const active = new Set<unknown>();
      addPopstate.mock.calls.forEach(([type, listener]) => {
        if (type === 'popstate') active.add(listener);
      });
      removePopstate.mock.calls.forEach(([type, listener]) => {
        if (type === 'popstate') active.delete(listener);
      });
      return active;
    };
    const onExit = vi.fn();
    const onSaveResult = vi.fn();
    const { result, unmount } = renderHook(() => useQuizPlayer({
      quiz,
      onExit,
      onSaveResult,
    }), { reactStrictMode: true });

    expect(pushState).not.toHaveBeenCalled();
    expect(activePopstateListeners().size).toBe(0);
    await act(async () => {
      await result.current.handleStart();
    });
    expect(activePopstateListeners().size).toBe(1);
    expect(pushState).toHaveBeenCalledTimes(1);
    mocks.showConfirm.mockResolvedValue(false);
    await act(async () => {
      dispatchBack();
      await Promise.resolve();
    });

    expect(mocks.showConfirm).toHaveBeenCalledOnce();
    expect(pushState).toHaveBeenCalledTimes(2);
    unmount();
    expect(activePopstateListeners().size).toBe(0);
    expect(pushState).toHaveBeenCalledTimes(2);
  });

  it('characterizes the late confirmation promise after unmount', async () => {
    const pending = deferred<boolean>();
    const onExit = vi.fn();
    mocks.showConfirm.mockReturnValue(pending.promise);
    const { result, unmount } = renderHook(() => useQuizPlayer({
      quiz,
      onExit,
      onSaveResult: vi.fn(),
    }));

    await act(async () => {
      await result.current.handleStart();
    });
    dispatchBack();
    unmount();

    await act(async () => {
      pending.resolve(true);
      await pending.promise;
    });

    expect(onExit).toHaveBeenCalledOnce();
    expect(window.sessionStorage.getItem(quizAttemptStorageKey(quiz.id))).toBeNull();
  });
});
