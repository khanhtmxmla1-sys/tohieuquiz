import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuestionType, type Quiz } from '../src/types';

const verifyQuizAccessCode = vi.hoisted(() => vi.fn());
vi.mock('../src/services/quizAccessService', () => ({ verifyQuizAccessCode }));
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
    verifyQuizAccessCode.mockReset();
    window.sessionStorage.clear();
  });

  it('uses the API and advances only after a valid code', async () => {
    verifyQuizAccessCode.mockResolvedValue(true);
    const { result } = renderHook(() => useQuizPlayer({ quiz, onExit: vi.fn(), onSaveResult: vi.fn() }));
    act(() => result.current.setEnteredCode('abc123'));

    await act(async () => {
      await result.current.handleCodeVerify();
    });

    expect(verifyQuizAccessCode).toHaveBeenCalledWith('quiz-code', 'abc123');
    expect(result.current.step).toBe('info');
    expect(result.current.codeError).toBe('');
  });

  it('keeps the student on the code form after an invalid code', async () => {
    verifyQuizAccessCode.mockResolvedValue(false);
    const { result } = renderHook(() => useQuizPlayer({ quiz, onExit: vi.fn(), onSaveResult: vi.fn() }));
    act(() => result.current.setEnteredCode('wrong1'));

    await act(async () => {
      await result.current.handleCodeVerify();
    });

    expect(result.current.step).toBe('code');
    expect(result.current.codeError).toBe('Mã không đúng. Vui lòng thử lại!');
  });

  it('shows a retryable message when verification cannot reach the server', async () => {
    verifyQuizAccessCode.mockRejectedValue(new Error('offline'));
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
