import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuestionType, type Quiz } from '../src/types';
import { quizAttemptStorageKey } from '../src/features/quiz-player/quizAttemptDraft';

const mocks = vi.hoisted(() => ({
  gradePracticeQuiz: vi.fn(),
  gradeQuiz: vi.fn(),
  claimResultReward: vi.fn(),
  trackQuizActivity: vi.fn(),
}));

vi.mock('../src/services/practiceService', () => ({
  practiceService: {
    gradePracticeQuiz: mocks.gradePracticeQuiz,
  },
}));
vi.mock('../src/domain/quiz-scoring', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/domain/quiz-scoring')>(),
  gradeQuiz: mocks.gradeQuiz,
}));
vi.mock('../src/stores/useClassroomStore', () => ({
  useClassroomStore: () => ({
    studentSession: {
      studentId: 'student-1', username: 'student-1', fullName: 'Học sinh', className: '5A', avatar: '',
    },
  }),
}));
vi.mock('../src/stores/useGamificationStore', () => ({
  useGamificationStore: { getState: () => ({
    pet: null, coins: 0, claimResultReward: mocks.claimResultReward,
  }) },
}));
vi.mock('../src/stores/useGameLoopStore', () => ({
  useGameLoopStore: { getState: () => ({ trackQuizActivity: mocks.trackQuizActivity }) },
}));
vi.mock('../src/services/quizAccessService', () => ({
  fetchQuizPlayQuestions: vi.fn(),
  requestQuizAccess: vi.fn(),
  adaptStudentQuizQuestion: (question: unknown) => question,
}));
vi.mock('../src/services/classroomService', () => ({ startAssignmentAttempt: vi.fn() }));
vi.mock('../src/utils/toast', () => ({ playTingSound: vi.fn(), showConfirm: vi.fn() }));

import { useQuizPlayer } from '../src/features/quiz-player/hooks/useQuizPlayer';

type SecureQuiz = Quiz & {
  practiceSession: { version: 'server-v1'; token: string; expiresAt: string };
};

const makeQuiz = (expiresAt = '2099-01-01T00:00:00.000Z'): SecureQuiz => ({
  id: 'practice-1',
  title: 'Secure practice',
  classLevel: '5',
  timeLimit: 10,
  createdAt: '2026-11-22T00:00:00.000Z',
  isPractice: true,
  questions: [{
    id: 'q1', type: QuestionType.MCQ, question: 'Chọn A', options: ['A', 'B'],
  } as any],
  practiceSession: { version: 'server-v1', token: 'session-token', expiresAt },
});

const successfulGrade = {
  status: 'success', practiceId: 'practice-1', score: 10, correctCount: 1,
  questionCount: 1, totalQuestions: 1, voidedCount: 0, gradingVersion: 'server-v1',
  answers: { q1: { selectedAnswer: 'A' } },
  validationDetails: [{ questionId: 'q1', type: 'MCQ', isCorrect: true, status: 'correct' }],
  reviewDetails: [{
    questionId: 'q1', type: 'MCQ', status: 'correct', isCorrect: true,
    studentAnswer: { kind: 'text', lines: [{ value: 'A' }] },
    correctAnswer: { kind: 'text', lines: [{ value: 'A' }] },
    presentation: {
      schemaVersion: 1, source: 'submission', type: 'MCQ',
      items: [{ id: 'option-0', index: 0, state: 'correct', text: 'A', selected: true, correct: true }],
    },
  }],
};

describe('useQuizPlayer secure practice submission', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime('2026-11-22T05:00:00.000Z');
    window.sessionStorage.clear();
    vi.clearAllMocks();
    mocks.gradePracticeQuiz.mockResolvedValue(successfulGrade);
    mocks.gradeQuiz.mockReturnValue({
      score: 10,
      correctCount: 1,
      questionCount: 1,
      totalQuestions: 1,
      voidedCount: 0,
      engineVersion: 'legacy-v1',
      details: [{ questionId: 'q1', isCorrect: true, status: 'correct' }],
    });
  });

  it('submits the raw answers and maps authoritative review into completion state', async () => {
    const onSaveResult = vi.fn();
    const quiz = makeQuiz();
    const { result } = renderHook(() => useQuizPlayer({ quiz, onExit: vi.fn(), onSaveResult }));

    await act(async () => result.current.handleStart());
    const persistedDraft = window.sessionStorage.getItem(quizAttemptStorageKey(quiz.id));
    expect(persistedDraft).not.toBeNull();
    expect(persistedDraft).not.toContain('session-token');
    act(() => result.current.handleAnswerChange('q1', 'A'));
    await act(async () => result.current.handleSubmit());

    expect(mocks.gradePracticeQuiz).toHaveBeenCalledWith({
      sessionToken: 'session-token',
      answers: { q1: 'A' },
      questionOrder: ['q1'],
    }, 'practice-1');
    expect(mocks.gradePracticeQuiz.mock.calls[0][0]).not.toHaveProperty('score');
    expect(mocks.gradePracticeQuiz.mock.calls[0][0]).not.toHaveProperty('correctCount');
    expect(onSaveResult).not.toHaveBeenCalled();
    expect(mocks.claimResultReward).not.toHaveBeenCalled();
    expect(mocks.trackQuizActivity).not.toHaveBeenCalled();
    expect(result.current.step).toBe('result');
    expect(result.current.result).toMatchObject({
      id: 'practice-1', quizId: 'practice-1', score: 10, correctCount: 1,
      totalQuestions: 1, gradingVersion: 'server-v1',
      validationDetails: [{ questionId: 'q1', type: 'MCQ', isCorrect: true, status: 'correct' }],
      reviewDetails: successfulGrade.reviewDetails,
    });
    expect(JSON.stringify(result.current.result)).not.toContain('session-token');
    expect(JSON.stringify(result.current.rewardData)).not.toContain('session-token');
  });

  it('submits a partial raw answer map when a question is untouched', async () => {
    const onSaveResult = vi.fn();
    const quiz = {
      ...makeQuiz(),
      questions: [
        ...makeQuiz().questions,
        { id: 'q2', type: QuestionType.MCQ, question: 'Chọn B', options: ['A', 'B'] } as any,
      ],
    } as SecureQuiz;
    mocks.gradePracticeQuiz.mockResolvedValueOnce({
      ...successfulGrade,
      score: 5,
      correctCount: 1,
      questionCount: 2,
      totalQuestions: 2,
      answers: {
        q1: { selectedAnswer: 'A', isCorrect: true, status: 'correct' },
        q2: { selectedAnswer: null, isCorrect: false, status: 'skipped' },
      },
      validationDetails: [
        { questionId: 'q1', type: 'MCQ', isCorrect: true, status: 'correct' },
        { questionId: 'q2', type: 'MCQ', isCorrect: false, status: 'skipped' },
      ],
      reviewDetails: [
        successfulGrade.reviewDetails[0],
        {
          ...successfulGrade.reviewDetails[0],
          questionId: 'q2', status: 'skipped', isCorrect: false,
          studentAnswer: { kind: 'empty', lines: [{ value: 'Chưa trả lời' }] },
          presentation: {
            ...successfulGrade.reviewDetails[0].presentation,
            items: [{ id: 'option-0', index: 0, state: 'skipped', text: 'A', selected: false, correct: true }],
          },
        },
      ],
    });
    const { result } = renderHook(() => useQuizPlayer({ quiz, onExit: vi.fn(), onSaveResult }));

    await act(async () => result.current.handleStart());
    act(() => result.current.handleAnswerChange('q1', 'A'));
    const expectedQuestionOrder = result.current.shuffledQuestions.map((question) => question.id);
    await act(async () => result.current.handleSubmit());

    expect(mocks.gradePracticeQuiz).toHaveBeenCalledTimes(1);
    expect(mocks.gradePracticeQuiz.mock.calls[0][0]).toEqual({
      sessionToken: 'session-token', answers: { q1: 'A' }, questionOrder: expectedQuestionOrder,
    });
    expect(new Set(expectedQuestionOrder)).toEqual(new Set(['q1', 'q2']));
    expect(result.current.step).toBe('result');
    expect(onSaveResult).not.toHaveBeenCalled();
  });

  it.each([
    ['network', new Error('network down')],
    ['conflict', Object.assign(new Error('refresh required'), { status: 409 })],
    ['malformed response', new Error('Invalid authoritative practice response')],
  ])('keeps the draft and blocks completion on secure %s failure', async (_label, error) => {
    mocks.gradePracticeQuiz.mockRejectedValueOnce(error);
    const onSaveResult = vi.fn();
    const quiz = makeQuiz();
    const { result } = renderHook(() => useQuizPlayer({ quiz, onExit: vi.fn(), onSaveResult }));

    await act(async () => result.current.handleStart());
    act(() => result.current.handleAnswerChange('q1', 'A'));
    const draftBeforeSubmit = window.sessionStorage.getItem(quizAttemptStorageKey(quiz.id));
    await act(async () => result.current.handleSubmit());

    expect(result.current.step).toBe('quiz');
    expect(result.current.showReward).toBe(false);
    expect(result.current.submitError).toContain(String(error.message));
    expect(window.sessionStorage.getItem(quizAttemptStorageKey(quiz.id))).toBe(draftBeforeSubmit);
    expect(onSaveResult).not.toHaveBeenCalled();
    expect(mocks.claimResultReward).not.toHaveBeenCalled();
    expect(mocks.trackQuizActivity).not.toHaveBeenCalled();
  });

  it('does not fall back to local scoring when the secure session has expired', async () => {
    const quiz = makeQuiz('2020-01-01T00:00:00.000Z');
    const onSaveResult = vi.fn();
    const { result } = renderHook(() => useQuizPlayer({ quiz, onExit: vi.fn(), onSaveResult }));

    await act(async () => result.current.handleStart());
    act(() => result.current.handleAnswerChange('q1', 'A'));
    await act(async () => result.current.handleSubmit());

    expect(mocks.gradePracticeQuiz).not.toHaveBeenCalled();
    expect(mocks.gradeQuiz).not.toHaveBeenCalled();
    expect(result.current.step).toBe('quiz');
    expect(result.current.submitError).toMatch(/hết hạn|expired|refresh/i);
    expect(onSaveResult).not.toHaveBeenCalled();
    expect(mocks.claimResultReward).not.toHaveBeenCalled();
  });

  it('treats a secure session expiring at the current clock as expired', async () => {
    const quiz = makeQuiz(new Date(Date.now()).toISOString());
    const onSaveResult = vi.fn();
    const { result } = renderHook(() => useQuizPlayer({ quiz, onExit: vi.fn(), onSaveResult }));

    await act(async () => result.current.handleStart());
    act(() => result.current.handleAnswerChange('q1', 'A'));
    await act(async () => result.current.handleSubmit());

    expect(mocks.gradePracticeQuiz).not.toHaveBeenCalled();
    expect(mocks.gradeQuiz).not.toHaveBeenCalled();
    expect(result.current.step).toBe('quiz');
    expect(result.current.submitError).toMatch(/hết hạn|expired|refresh/i);
    expect(onSaveResult).not.toHaveBeenCalled();
  });

  it('keeps the legacy local grading path synchronous when no own secure marker exists', async () => {
    const quiz = {
      ...makeQuiz(),
      questions: [
        ...makeQuiz().questions,
        { id: 'q2', type: QuestionType.MCQ, question: 'Chọn B', options: ['A', 'B'] } as any,
      ],
    } as unknown as Quiz & { practiceSession?: unknown };
    delete quiz.practiceSession;
    Object.setPrototypeOf(quiz, { practiceSession: makeQuiz().practiceSession });
    mocks.gradeQuiz.mockReturnValueOnce({
      score: 5,
      correctCount: 1,
      questionCount: 2,
      totalQuestions: 1,
      voidedCount: 1,
      engineVersion: 'legacy-v2',
      details: [
        { questionId: 'q1', isCorrect: true, status: 'correct' },
        { questionId: 'q2', isCorrect: false, status: 'voided', issueCode: 'MISSING_CORRECT_ANSWER' },
      ],
    });
    const onSaveResult = vi.fn();
    const { result } = renderHook(() => useQuizPlayer({ quiz, onExit: vi.fn(), onSaveResult }));

    await act(async () => result.current.handleStart());
    act(() => result.current.handleAnswerChange('q1', 'A'));
    const expectedQuestionOrder = result.current.shuffledQuestions.map((question) => question.id);
    let submitPromise: Promise<void> | undefined;
    act(() => {
      submitPromise = result.current.handleSubmit();
      expect(mocks.gradeQuiz).toHaveBeenCalledTimes(1);
    });
    expect(result.current.step).toBe('result');
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.result).toMatchObject({
      score: 5,
      correctCount: 1,
      questionCount: 2,
      totalQuestions: 1,
      voidedCount: 1,
      gradingVersion: 'legacy-v2',
      answers: expect.objectContaining({ _questionOrder: expectedQuestionOrder }),
    });
    await act(async () => {
      await submitPromise;
    });

    expect(mocks.gradePracticeQuiz).not.toHaveBeenCalled();
    expect(onSaveResult).not.toHaveBeenCalled();
    expect(mocks.claimResultReward).not.toHaveBeenCalled();
    expect(mocks.trackQuizActivity).not.toHaveBeenCalled();
    expect(result.current.step).toBe('result');
    expect(result.current.result).toMatchObject({
      quizId: 'practice-1', score: 5, correctCount: 1, questionCount: 2, totalQuestions: 1,
      voidedCount: 1, gradingVersion: 'legacy-v2',
      answers: expect.objectContaining({
        q1: expect.objectContaining({
          selectedAnswer: 'A', isCorrect: true, status: 'correct', gradingVersion: 'legacy-v2',
          questionSnapshot: expect.objectContaining({ id: 'q1', question: 'Chọn A' }),
        }),
        q2: expect.objectContaining({
          selectedAnswer: null, isCorrect: false, status: 'voided', gradingVersion: 'legacy-v2',
          questionSnapshot: expect.objectContaining({ id: 'q2', question: 'Chọn B' }),
        }),
        _questionOrder: expectedQuestionOrder,
      }),
      validationDetails: [
        { questionId: 'q1', isCorrect: true, status: 'correct' },
        { questionId: 'q2', isCorrect: false, status: 'voided', issueCode: 'MISSING_CORRECT_ANSWER' },
      ],
    });
  });

  it.each([
    undefined,
    null,
    {},
    { version: 'legacy', token: 'session-token', expiresAt: '2099-01-01T00:00:00.000Z' },
    { version: 'server-v1', token: '  ', expiresAt: '2099-01-01T00:00:00.000Z' },
    { version: 'server-v1', token: 'session-token', expiresAt: 'not-a-date' },
  ])('treats a secure metadata marker with value %j as secure and fails closed', async (practiceSession) => {
    const quiz = { ...makeQuiz(), practiceSession } as unknown as Quiz;
    const onSaveResult = vi.fn();
    const { result } = renderHook(() => useQuizPlayer({ quiz, onExit: vi.fn(), onSaveResult }));

    await act(async () => result.current.handleStart());
    act(() => result.current.handleAnswerChange('q1', 'A'));
    await act(async () => result.current.handleSubmit());

    expect(mocks.gradePracticeQuiz).not.toHaveBeenCalled();
    expect(mocks.gradeQuiz).not.toHaveBeenCalled();
    expect(onSaveResult).not.toHaveBeenCalled();
    expect(result.current.step).toBe('quiz');
    expect(result.current.showReward).toBe(false);
  });
});
