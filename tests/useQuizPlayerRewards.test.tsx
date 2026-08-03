import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QuestionType, type Quiz, type StudentResult } from '../src/types';

const mocks = vi.hoisted(() => ({
  validateAnswersOnServer: vi.fn(),
  calculateStudentScore: vi.fn(),
  onSaveResult: vi.fn(),
  claimResultReward: vi.fn(),
  trackQuizActivity: vi.fn(),
}));

vi.mock('../src/stores/useClassroomStore', () => ({
  useClassroomStore: () => ({
    studentSession: {
      studentId: 'student-1',
      username: 'student-1',
      fullName: 'Nguyễn Văn An',
      className: '5A',
      avatar: '',
    },
  }),
}));
vi.mock('../src/stores/useGamificationStore', () => ({
  useGamificationStore: {
    getState: () => ({
      claimResultReward: mocks.claimResultReward,
      pet: { level: 1, exp: 20, expToNext: 100 },
    }),
  },
}));
vi.mock('../src/stores/useGameLoopStore', () => ({
  useGameLoopStore: { getState: () => ({ trackQuizActivity: mocks.trackQuizActivity }) },
}));
vi.mock('../src/services/quizValidationService', () => ({
  validateAnswersOnServer: mocks.validateAnswersOnServer,
}));
vi.mock('../src/features/quiz-player/utils/quizScoring', () => ({
  calculateStudentScore: mocks.calculateStudentScore,
}));
vi.mock('../src/utils/toast', () => ({
  playTingSound: vi.fn(),
  showError: vi.fn(),
}));

import { useQuizPlayer } from '../src/features/quiz-player/hooks/useQuizPlayer';

const makeQuiz = (isPractice = false): Quiz => ({
  id: 'quiz-result-reward',
  title: 'Ôn tập cuối tuần',
  classLevel: '5',
  category: 'toan',
  timeLimit: 0,
  createdAt: '2026-07-20T00:00:00.000Z',
  questions: [{
    id: 'q1',
    type: QuestionType.MCQ,
    question: '1 + 1?',
    options: ['1', '2'],
    correctAnswer: 'B',
  }],
  isPractice,
});

const makeMatchingQuiz = (): Quiz => ({
  ...makeQuiz(),
  id: 'quiz-matching-state',
  questions: [{
    id: 'matching-1',
    type: QuestionType.MATCHING,
    question: 'Nối các cặp tương ứng',
    pairs: [],
    leftItems: [
      { id: 'l-0', content: 'Một' },
      { id: 'l-1', content: 'Hai' },
    ],
    rightItems: [
      { id: 'r-0', content: '1' },
      { id: 'r-1', content: '2' },
    ],
  } as any],
});

const makeStudentSafeShortAnswerQuiz = (): Quiz => ({
  ...makeQuiz(),
  id: 'quiz-student-safe-short-answer',
  questions: [{
    id: 'q12',
    type: QuestionType.SHORT_ANSWER,
    question: 'The eraser is ____.',
  } as any],
});

const savedResult = (result: StudentResult): StudentResult => ({ ...result, id: '42' });

describe('useQuizPlayer result rewards', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_FEATURE_QUIZ_PROGRESS_V2', 'true');
    vi.clearAllMocks();
    mocks.validateAnswersOnServer.mockResolvedValue({
      success: true,
      score: 0,
      correctCount: 0,
      total: 1,
      gradingVersion: '2.0.0',
      details: [{ questionId: 'q1', isCorrect: false, status: 'wrong' }],
    });
    mocks.calculateStudentScore.mockReturnValue({
      score: 0,
      correctCount: 0,
      totalItems: 1,
      details: [{ questionId: 'q1', isCorrect: false }],
    });
    mocks.onSaveResult.mockImplementation(async (result: StudentResult) => savedResult(result));
    mocks.claimResultReward.mockResolvedValue({
      awardedExp: 10,
      awardedCoins: 0,
      alreadyClaimed: false,
      newLevel: 1,
      newExp: 30,
      newExpToNext: 100,
      newCoins: 50,
      leveledUp: false,
      mood: 'excited',
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('tracks a student-safe short answer without requiring the correct answer', async () => {
    const quiz = makeStudentSafeShortAnswerQuiz();
    const question = quiz.questions[0];
    const { result } = renderHook(() => useQuizPlayer({
      quiz,
      onExit: vi.fn(),
      onSaveResult: mocks.onSaveResult,
    }));

    await waitFor(() => expect(result.current.step).toBe('quiz'));
    expect(result.current.quizProgress).toMatchObject({
      emptyCount: 1,
      partialCount: 0,
      completeCount: 0,
    });

    act(() => result.current.handleAnswerChange(question.id, 'mine'));

    expect(result.current.quizProgress).toMatchObject({
      emptyCount: 0,
      partialCount: 0,
      completeCount: 1,
    });
    expect(result.current.isQuestionAnswered(question)).toBe(true);
  });

  it('does not mark a matching question answered from shuffle metadata or a partial pair', async () => {
    const quiz = makeMatchingQuiz();
    const question = quiz.questions[0];
    const { result } = renderHook(() => useQuizPlayer({
      quiz,
      onExit: vi.fn(),
      onSaveResult: mocks.onSaveResult,
    }));

    await waitFor(() => expect(result.current.step).toBe('quiz'));

    act(() => result.current.handleAnswerChange(question.id, {
      __shuffledIds: ['r-1', 'r-0'],
    }));
    expect(result.current.isQuestionAnswered(question)).toBe(false);

    act(() => result.current.handleAnswerChange(question.id, {
      __shuffledIds: ['r-1', 'r-0'],
      'l-0': 'r-0',
    }));
    expect(result.current.isQuestionAnswered(question)).toBe(false);

    act(() => result.current.handleAnswerChange(question.id, {
      __shuffledIds: ['r-1', 'r-0'],
      'l-0': 'r-0',
      'l-1': 'r-1',
    }));
    expect(result.current.isQuestionAnswered(question)).toBe(true);
  });

  it('never lets a client override turn a server-wrong ordering answer into correct', async () => {
    const orderingQuiz = {
      ...makeQuiz(),
      id: 'quiz-ordering-authoritative',
      questions: [{
        id: 'q1', type: QuestionType.ORDERING, question: 'Sắp xếp',
        items: ['B', 'A'], correctOrder: [1, 0],
      }],
    } as Quiz;
    mocks.calculateStudentScore.mockReturnValue({
      score: 10,
      correctCount: 1,
      totalItems: 1,
      details: [{ questionId: 'q1', isCorrect: true }],
    });

    const { result } = renderHook(() => useQuizPlayer({
      quiz: orderingQuiz,
      onExit: vi.fn(),
      onSaveResult: mocks.onSaveResult,
    }));

    await waitFor(() => expect(result.current.step).toBe('quiz'));
    act(() => result.current.handleAnswerChange('q1', { 0: 2, 1: 1 }));
    await act(async () => result.current.handleSubmit());

    expect(mocks.onSaveResult).toHaveBeenCalledWith(expect.objectContaining({
      score: 0,
      correctCount: 0,
      totalQuestions: 1,
      answers: expect.objectContaining({
        q1: expect.objectContaining({ isCorrect: false }),
      }),
    }));
  });
  it('preserves authoritative voided counts and zero-safe denominators', async () => {
    const voidedQuiz = {
      ...makeQuiz(),
      id: 'quiz-voided-result',
      questions: [
        { id: 'q1', type: QuestionType.MCQ, question: 'Câu 1', options: ['A', 'B'], correctAnswer: 'A' },
        { id: 'q2', type: QuestionType.MCQ, question: 'Câu 2', options: ['A', 'B'], correctAnswer: 'A' },
        { id: 'q3', type: QuestionType.SHORT_ANSWER, question: 'Câu lỗi', correctAnswer: '' },
      ],
    } as Quiz;
    mocks.validateAnswersOnServer.mockResolvedValueOnce({
      success: true,
      score: 10,
      correctCount: 2,
      questionCount: 3,
      total: 2,
      voidedCount: 1,
      gradingVersion: '2.0.0',
      details: [
        { questionId: 'q1', isCorrect: true, status: 'correct' },
        { questionId: 'q2', isCorrect: true, status: 'correct' },
        { questionId: 'q3', isCorrect: false, status: 'voided', issueCode: 'MISSING_CORRECT_ANSWER' },
      ],
    });

    const { result } = renderHook(() => useQuizPlayer({
      quiz: voidedQuiz,
      onExit: vi.fn(),
      onSaveResult: mocks.onSaveResult,
    }));

    await waitFor(() => expect(result.current.step).toBe('quiz'));
    await act(async () => result.current.handleSubmit());

    expect(mocks.onSaveResult).toHaveBeenCalledWith(expect.objectContaining({
      score: 10,
      correctCount: 2,
      questionCount: 3,
      totalQuestions: 2,
      voidedCount: 1,
      validationDetails: expect.arrayContaining([
        expect.objectContaining({ questionId: 'q3', status: 'voided' }),
      ]),
      answers: expect.objectContaining({
        q3: expect.objectContaining({ status: 'voided', isCorrect: false }),
      }),
    }));
  });

  it('claims the reward with the saved result id and shows completion at zero correct', async () => {
    const { result } = renderHook(() => useQuizPlayer({
      quiz: makeQuiz(),
      onExit: vi.fn(),
      onSaveResult: mocks.onSaveResult,
    }));

    await waitFor(() => expect(result.current.step).toBe('quiz'));
    await act(async () => result.current.handleSubmit());

    expect(mocks.claimResultReward).toHaveBeenCalledWith('student-1', '42');
    expect(result.current.showReward).toBe(true);
    expect(result.current.rewardData).toMatchObject({
      status: 'ready',
      resultId: '42',
      score: 0,
      correctCount: 0,
      totalQuestions: 1,
      expEarned: 10,
      coinsEarned: 0,
      newExp: 30,
      newExpToNext: 100,
    });
  });

  it('keeps the saved result and exposes reward retry when synchronization fails', async () => {
    mocks.claimResultReward.mockResolvedValueOnce(null).mockResolvedValueOnce({
      awardedExp: 10,
      awardedCoins: 0,
      alreadyClaimed: true,
      newLevel: 1,
      newExp: 30,
      newExpToNext: 100,
      newCoins: 50,
      leveledUp: false,
      mood: 'excited',
    });

    const { result } = renderHook(() => useQuizPlayer({
      quiz: makeQuiz(),
      onExit: vi.fn(),
      onSaveResult: mocks.onSaveResult,
    }));

    await waitFor(() => expect(result.current.step).toBe('quiz'));
    await act(async () => result.current.handleSubmit());

    expect(result.current.result?.id).toBe('42');
    expect(result.current.showReward).toBe(true);
    expect(result.current.rewardData?.status).toBe('error');

    await act(async () => result.current.handleRetryReward());
    expect(result.current.rewardData?.status).toBe('ready');
    expect(mocks.claimResultReward).toHaveBeenCalledTimes(2);
  });

  it('shows a completion dialog without server rewards for practice quizzes', async () => {
    const { result } = renderHook(() => useQuizPlayer({
      quiz: makeQuiz(true),
      onExit: vi.fn(),
      onSaveResult: mocks.onSaveResult,
    }));

    await waitFor(() => expect(result.current.step).toBe('quiz'));
    await act(async () => result.current.handleSubmit());

    expect(mocks.onSaveResult).not.toHaveBeenCalled();
    expect(mocks.claimResultReward).not.toHaveBeenCalled();
    expect(result.current.showReward).toBe(true);
    expect(result.current.rewardData).toMatchObject({ status: 'ready', expEarned: 0, coinsEarned: 0 });
  });
});
