import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuestionType, type Quiz } from '../src/types';

const requestQuizAccess = vi.hoisted(() => vi.fn());
const fetchQuizPlayQuestions = vi.hoisted(() => vi.fn());
const adaptStudentQuizQuestion = vi.hoisted(() => vi.fn((question: unknown) => question));
vi.mock('../src/services/quizAccessService', () => ({
  requestQuizAccess,
  fetchQuizPlayQuestions,
  adaptStudentQuizQuestion,
}));
vi.mock('../src/stores/useClassroomStore', () => ({
  useClassroomStore: () => ({ studentSession: null }),
}));
vi.mock('../src/stores/useGamificationStore', () => ({
  useGamificationStore: { getState: () => ({ pet: null, coins: 0 }) },
}));
vi.mock('../src/stores/useGameLoopStore', () => ({
  useGameLoopStore: { getState: () => ({ trackQuizActivity: vi.fn() }) },
}));
vi.mock('../src/services/quizValidationService', () => ({ validateAnswersOnServer: vi.fn() }));
vi.mock('../src/utils/toast', () => ({ playTingSound: vi.fn(), showError: vi.fn() }));

import { useQuizPlayer } from '../src/features/quiz-player/hooks/useQuizPlayer';

const quiz: Quiz = {
  id: 'quiz-code',
  title: 'Đề có mã',
  classLevel: '5',
  category: 'toan',
  timeLimit: 10,
  createdAt: '2026-08-04T00:00:00.000Z',
  requireCode: true,
  questions: [
    { id: 'q1', type: QuestionType.MCQ, question: '1?', options: ['A', 'B'], correctAnswer: 'A' },
  ],
};

describe('useQuizPlayer access-code verification', () => {
  beforeEach(() => {
    requestQuizAccess.mockReset();
    fetchQuizPlayQuestions.mockReset();
    adaptStudentQuizQuestion.mockClear();
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it('uses the API and advances only after a valid code', async () => {
    requestQuizAccess.mockResolvedValue({ valid: true, accessGrant: 'grant-memory-only' });
    const { result } = renderHook(() => useQuizPlayer({ quiz, onExit: vi.fn(), onSaveResult: vi.fn() }));
    act(() => result.current.setEnteredCode('abc123'));

    await act(async () => {
      await result.current.handleCodeVerify();
    });

    expect(requestQuizAccess).toHaveBeenCalledWith('quiz-code', 'abc123', undefined);
    expect(result.current.step).toBe('info');
    expect(result.current.enteredCode).toBe('abc123');
    expect(result.current.codeError).toBe('');
    expect(window.sessionStorage.getItem('quiz-access-grant')).toBeNull();
    expect(JSON.stringify(window.localStorage)).not.toContain('grant-memory-only');
  });

  it('advances with a valid response that does not contain a grant', async () => {
    requestQuizAccess.mockResolvedValue({ valid: true });
    const { result } = renderHook(() => useQuizPlayer({ quiz, onExit: vi.fn(), onSaveResult: vi.fn() }));
    act(() => result.current.setEnteredCode('abc123'));

    await act(async () => {
      await result.current.handleCodeVerify();
    });

    expect(result.current.step).toBe('info');
    expect(result.current.codeError).toBe('');
    expect(result.current).not.toHaveProperty('accessGrant');
  });

  it('passes an assignment id to access verification without exposing the grant', async () => {
    const assignedQuiz = {
      ...quiz,
      id: 'quiz-code-assignment',
      _assignmentData: { id: 'assignment-code' },
    } as Quiz;
    requestQuizAccess.mockResolvedValue({ valid: true, accessGrant: 'grant-assignment-only' });
    const { result } = renderHook(() => useQuizPlayer({
      quiz: assignedQuiz,
      onExit: vi.fn(),
      onSaveResult: vi.fn(),
    }));

    act(() => result.current.setEnteredCode('abc123'));
    await act(async () => {
      await result.current.handleCodeVerify();
    });

    expect(requestQuizAccess).toHaveBeenCalledWith('quiz-code-assignment', 'abc123', 'assignment-code');
    expect(result.current.step).toBe('info');
    expect(result.current).not.toHaveProperty('accessGrant');
    expect(JSON.stringify(window.sessionStorage)).not.toContain('grant-assignment-only');
  });

  it('keeps verification busy until the response settles', async () => {
    let resolveAccess!: (value: { valid: boolean }) => void;
    const pendingAccess = new Promise<{ valid: boolean }>((resolve) => {
      resolveAccess = resolve;
    });
    requestQuizAccess.mockReturnValue(pendingAccess);
    const { result } = renderHook(() => useQuizPlayer({ quiz, onExit: vi.fn(), onSaveResult: vi.fn() }));
    act(() => result.current.setEnteredCode('abc123'));

    let verifyPromise!: Promise<void>;
    await act(async () => {
      verifyPromise = result.current.handleCodeVerify();
      await Promise.resolve();
    });
    expect(result.current.isVerifyingCode).toBe(true);
    let duplicatePromise!: Promise<void>;
    await act(async () => {
      duplicatePromise = result.current.handleCodeVerify();
      await Promise.resolve();
    });
    expect(requestQuizAccess).toHaveBeenCalledTimes(1);
    resolveAccess({ valid: true });
    await act(async () => {
      await Promise.all([verifyPromise, duplicatePromise]);
    });
    expect(result.current.isVerifyingCode).toBe(false);
    expect(result.current.step).toBe('info');
  });

  it('passes the verified grant only to the scoped start request', async () => {
    requestQuizAccess.mockResolvedValue({ valid: true, accessGrant: 'grant-start-only' });
    fetchQuizPlayQuestions.mockResolvedValue({
      quizId: quiz.id,
      revision: 1,
      questions: [{ id: 'scoped-q1', type: 'MCQ', question: 'Scoped?', options: ['A', 'B'] }],
    });
    const { result } = renderHook(() => useQuizPlayer({ quiz, onExit: vi.fn(), onSaveResult: vi.fn() }));

    act(() => {
      result.current.setEnteredCode('abc123');
      result.current.setStudentName('Học sinh thử');
      result.current.setStudentClass('5A');
    });
    await act(async () => {
      await result.current.handleCodeVerify();
      await result.current.handleStart();
    });

    expect(fetchQuizPlayQuestions).toHaveBeenCalledWith('quiz-code', {
      assignmentId: undefined,
      accessGrant: 'grant-start-only',
    });
    expect(adaptStudentQuizQuestion).toHaveBeenCalledWith(expect.objectContaining({ id: 'scoped-q1' }));
    expect(result.current.shuffledQuestions.map((question) => question.id)).toEqual(['scoped-q1']);
    expect(JSON.stringify(window.sessionStorage)).not.toContain('grant-start-only');
    expect(JSON.stringify(window.sessionStorage)).not.toContain('abc123');
  });

  it('retains a previously verified grant after invalid verification and server error', async () => {
    requestQuizAccess.mockResolvedValueOnce({ valid: true, accessGrant: 'grant-retained' });
    requestQuizAccess.mockResolvedValueOnce({ valid: false });
    requestQuizAccess.mockRejectedValueOnce(new Error('offline'));
    fetchQuizPlayQuestions.mockResolvedValue({
      quizId: quiz.id,
      revision: 1,
      questions: [{ id: 'scoped-q1', type: 'MCQ', question: 'Scoped?', options: ['A', 'B'] }],
    });
    const { result } = renderHook(() => useQuizPlayer({ quiz, onExit: vi.fn(), onSaveResult: vi.fn() }));

    act(() => result.current.setEnteredCode('first1'));
    await act(async () => result.current.handleCodeVerify());
    act(() => result.current.setEnteredCode('wrong1'));
    await act(async () => result.current.handleCodeVerify());
    act(() => result.current.setEnteredCode('retry1'));
    await act(async () => result.current.handleCodeVerify());

    act(() => {
      result.current.setStudentName('Học sinh thử');
      result.current.setStudentClass('5A');
    });
    await act(async () => result.current.handleStart());

    expect(result.current.step).toBe('quiz');
    expect(result.current.codeError).toBe('Không thể kiểm tra mã lúc này. Vui lòng thử lại.');
    expect(fetchQuizPlayQuestions).toHaveBeenCalledWith('quiz-code', {
      assignmentId: undefined,
      accessGrant: 'grant-retained',
    });
  });

  it('keeps the student on the code form after an invalid code', async () => {
    requestQuizAccess.mockResolvedValue({ valid: false });
    const { result } = renderHook(() => useQuizPlayer({ quiz, onExit: vi.fn(), onSaveResult: vi.fn() }));
    act(() => result.current.setEnteredCode('wrong1'));

    await act(async () => {
      await result.current.handleCodeVerify();
    });

    expect(result.current.step).toBe('code');
    expect(result.current.codeError).toBe('Mã không đúng. Vui lòng thử lại!');
  });

  it('shows a retryable message when verification cannot reach the server', async () => {
    requestQuizAccess.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useQuizPlayer({ quiz, onExit: vi.fn(), onSaveResult: vi.fn() }));
    act(() => result.current.setEnteredCode('abc123'));

    await act(async () => {
      await result.current.handleCodeVerify();
    });

    expect(result.current.step).toBe('code');
    expect(result.current.codeError).toBe('Không thể kiểm tra mã lúc này. Vui lòng thử lại.');
    expect(result.current.isVerifyingCode).toBe(false);
  });
});
