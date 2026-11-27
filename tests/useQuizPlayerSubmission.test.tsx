import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QuestionType, type Quiz, type StudentResult } from '../src/types';
import { quizAttemptStorageKey } from '../src/features/quiz-player/quizAttemptDraft';

const mocks = vi.hoisted(() => ({
  fetchQuizPlayQuestions: vi.fn(),
  requestQuizAccess: vi.fn(),
  adaptStudentQuizQuestion: vi.fn((question: unknown) => question),
  startAssignmentAttempt: vi.fn(),
  onSaveResult: vi.fn(),
  claimResultReward: vi.fn(),
  trackQuizActivity: vi.fn(),
  getGamificationState: vi.fn(),
  getGameLoopState: vi.fn(),
  playTingSound: vi.fn(),
  classroomStore: {
    studentSession: {
      studentId: 'student-1',
      username: 'student-1',
      fullName: 'Nguyễn Văn An',
      className: '5A',
      avatar: '',
    } as any,
  },
  gamificationState: {} as any,
  events: [] as string[],
}));

vi.mock('../src/stores/useClassroomStore', () => ({
  useClassroomStore: () => mocks.classroomStore,
}));
vi.mock('../src/stores/useGamificationStore', () => ({
  useGamificationStore: {
    getState: () => mocks.getGamificationState(),
  },
}));
vi.mock('../src/stores/useGameLoopStore', () => ({
  useGameLoopStore: {
    getState: () => mocks.getGameLoopState(),
  },
}));
vi.mock('../src/services/quizAccessService', () => ({
  fetchQuizPlayQuestions: mocks.fetchQuizPlayQuestions,
  requestQuizAccess: mocks.requestQuizAccess,
  adaptStudentQuizQuestion: mocks.adaptStudentQuizQuestion,
}));
vi.mock('../src/services/classroomService', () => ({
  startAssignmentAttempt: mocks.startAssignmentAttempt,
}));
vi.mock('../src/utils/toast', () => ({
  playTingSound: mocks.playTingSound,
}));

import { useQuizPlayer } from '../src/features/quiz-player/hooks/useQuizPlayer';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

const deferred = <T,>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const makeQuiz = (overrides: Partial<Quiz> = {}): Quiz => ({
  id: 'quiz-submission-matrix',
  title: 'Bài kiểm tra nộp bài',
  classLevel: '5',
  category: 'toan',
  timeLimit: 0,
  createdAt: '2026-11-28T00:00:00.000Z',
  questions: [
    { id: 'q1', type: QuestionType.MCQ, question: 'Câu 1', options: ['A', 'B'], correctAnswer: 'A' },
    { id: 'q2', type: QuestionType.MCQ, question: 'Câu 2', options: ['A', 'B'], correctAnswer: 'B' },
  ],
  isPractice: false,
  ...overrides,
});

const makeAuthoritativeResult = (
  submitted: StudentResult,
  overrides: Partial<StudentResult> = {},
): StudentResult => ({
  ...submitted,
  id: 'server-result-1',
  score: 7,
  correctCount: 1,
  questionCount: 2,
  totalQuestions: 2,
  voidedCount: 0,
  ...overrides,
});

const startPlayer = async (quiz = makeQuiz()) => {
  mocks.fetchQuizPlayQuestions.mockResolvedValueOnce({
    quizId: quiz.id,
    revision: 1,
    questions: quiz.questions,
  });
  const hook = renderHook(() => useQuizPlayer({
    quiz,
    onExit: vi.fn(),
    onSaveResult: mocks.onSaveResult,
    randomizationPolicy: {
      enabled: false,
      shuffleQuestions: false,
      shuffleChoices: false,
      shuffleMatching: false,
      shuffleOrdering: false,
      shuffleDragDrop: false,
      randomizePracticeSelection: false,
    },
  }));
  await act(async () => {
    await hook.result.current.handleStart();
  });
  return hook;
};

describe('useQuizPlayer formal submission characterization', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime('2026-11-28T05:00:00.000Z');
    window.sessionStorage.clear();
    vi.clearAllMocks();
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'client-result-1') });

    mocks.classroomStore = {
      studentSession: {
        studentId: 'student-1',
        username: 'student-1',
        fullName: 'Nguyễn Văn An',
        className: '5A',
        avatar: '',
      },
    } as any;
    mocks.events.length = 0;
    mocks.gamificationState = {
      pet: null,
      coins: 0,
      claimResultReward: mocks.claimResultReward,
    };
    mocks.getGamificationState.mockImplementation(() => mocks.gamificationState);
    mocks.getGameLoopState.mockImplementation(() => ({ trackQuizActivity: mocks.trackQuizActivity }));
    mocks.fetchQuizPlayQuestions.mockImplementation(async (quizId: string) => ({
      quizId,
      revision: 1,
      questions: makeQuiz().questions,
    }));
    mocks.startAssignmentAttempt.mockResolvedValue({ status: 'OPEN' });
    mocks.onSaveResult.mockImplementation(async (submitted: StudentResult) => (
      makeAuthoritativeResult(submitted)
    ));
    mocks.claimResultReward.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it.each(['manual', 'timeout'] as const)(
    'rejects a %s submission before a valid start without touching submission boundaries',
    async (reason) => {
      const quiz = makeQuiz();
      const { result } = renderHook(() => useQuizPlayer({
        quiz,
        onExit: vi.fn(),
        onSaveResult: mocks.onSaveResult,
      }));

      await act(async () => {
        await result.current.handleSubmit(reason);
      });

      expect(result.current.submitError).toContain('chưa được bắt đầu hợp lệ');
      expect(result.current.isSubmitting).toBe(false);
      expect(mocks.onSaveResult).not.toHaveBeenCalled();
      expect(mocks.claimResultReward).not.toHaveBeenCalled();
      expect(mocks.trackQuizActivity).not.toHaveBeenCalled();
      expect(window.sessionStorage.getItem(quizAttemptStorageKey(quiz.id))).toBeNull();
    },
  );

  it('builds the formal payload from raw answers, authoritative order, assignment id, UUID, and rounded elapsed time', async () => {
    const quiz = makeQuiz({
      _assignmentData: { id: 123 },
    } as Partial<Quiz>);
    mocks.classroomStore.studentSession.username = '';
    const startTime = Date.now();
    const { result } = await startPlayer(quiz);

    act(() => {
      result.current.handleAnswerChange('q1', 'B');
    });
    vi.setSystemTime(startTime + 91_000);

    await act(async () => {
      await result.current.handleSubmit('manual');
    });

    expect(mocks.onSaveResult).toHaveBeenCalledOnce();
    const [submitted, context] = mocks.onSaveResult.mock.calls[0] as [StudentResult, unknown];
    expect(submitted).toMatchObject({
      id: 'client-result-1',
      quizId: quiz.id,
      assignmentId: '123',
      quizTitle: quiz.title,
      studentName: 'Nguyễn Văn An',
      studentClass: '5A',
      score: 0,
      correctCount: 0,
      questionCount: 2,
      totalQuestions: 2,
      voidedCount: 0,
      timeTaken: 1.52,
      submittedAt: new Date(startTime + 91_000).toISOString(),
      answers: { q1: 'B', _questionOrder: ['q1', 'q2'] },
    });
    expect(context).toEqual({ accessGrant: undefined });
    expect(submitted).not.toHaveProperty('accessGrant');
    expect(submitted).not.toHaveProperty('practiceSession');
    expect(result.current.result?.id).toBe('server-result-1');
  });

  it('shares one lock across same-tick manual, timeout, and deadline callbacks while saving', async () => {
    const quiz = makeQuiz({ timeLimit: 1 });
    const save = deferred<StudentResult>();
    mocks.onSaveResult.mockReturnValueOnce(save.promise);
    const { result } = await startPlayer(quiz);

    let manual!: Promise<void>;
    let timeout!: Promise<void>;
    await act(async () => {
      manual = result.current.handleSubmit('manual');
      timeout = result.current.handleSubmit('timeout');
    });
    expect(mocks.onSaveResult).toHaveBeenCalledOnce();
    expect(result.current.isSubmitting).toBe(true);

    vi.setSystemTime('2026-11-28T05:01:00.000Z');
    await act(async () => {
      vi.advanceTimersByTime(1_000);
      await Promise.resolve();
    });
    expect(mocks.onSaveResult).toHaveBeenCalledOnce();
    expect(result.current.isSubmitting).toBe(true);

    await act(async () => {
      save.resolve(makeAuthoritativeResult(mocks.onSaveResult.mock.calls[0][0] as StudentResult));
      await Promise.all([manual, timeout]);
    });

    expect(mocks.onSaveResult).toHaveBeenCalledOnce();
    expect(result.current.step).toBe('result');
    await act(async () => {
      await result.current.handleSubmit('manual');
    });
    expect(mocks.onSaveResult).toHaveBeenCalledOnce();
  });

  it('keeps StrictMode and same-tick submissions on one pending save', async () => {
    const quiz = makeQuiz({ timeLimit: 1 });
    const save = deferred<StudentResult>();
    mocks.onSaveResult.mockReturnValueOnce(save.promise);
    const { result } = renderHook(() => useQuizPlayer({
      quiz,
      onExit: vi.fn(),
      onSaveResult: mocks.onSaveResult,
      randomizationPolicy: {
        enabled: false,
        shuffleQuestions: false,
        shuffleChoices: false,
        shuffleMatching: false,
        shuffleOrdering: false,
        shuffleDragDrop: false,
        randomizePracticeSelection: false,
      },
    }), { reactStrictMode: true });

    await act(async () => {
      await result.current.handleStart();
    });

    let manual!: Promise<void>;
    let timeout!: Promise<void>;
    await act(async () => {
      manual = result.current.handleSubmit('manual');
      timeout = result.current.handleSubmit('timeout');
    });

    expect(mocks.onSaveResult).toHaveBeenCalledOnce();
    expect(result.current.isSubmitting).toBe(true);

    await act(async () => {
      save.resolve(makeAuthoritativeResult(mocks.onSaveResult.mock.calls[0][0] as StudentResult));
      await Promise.all([manual, timeout]);
    });

    expect(mocks.onSaveResult).toHaveBeenCalledOnce();
    expect(result.current.step).toBe('result');
    expect(result.current.isSubmitting).toBe(false);
  });

  it.each([
    ['rejection', 'save failed', () => Promise.reject(new Error('save failed'))],
    ['falsy response', 'authoritative', () => Promise.resolve(undefined)],
  ] as const)('keeps the draft and unlocks a retry after a %s', async (_label, errorText, failure) => {
    const quiz = makeQuiz();
    const { result } = await startPlayer(quiz);
    act(() => {
      result.current.handleAnswerChange('q1', 'B');
    });
    const draftBefore = window.sessionStorage.getItem(quizAttemptStorageKey(quiz.id));
    mocks.onSaveResult.mockReset();
    mocks.onSaveResult.mockImplementationOnce(failure);

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(result.current.step).toBe('quiz');
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.submitError).toContain(errorText);
    expect(window.sessionStorage.getItem(quizAttemptStorageKey(quiz.id))).toBe(draftBefore);
    expect(mocks.claimResultReward).not.toHaveBeenCalled();
    expect(mocks.trackQuizActivity).not.toHaveBeenCalled();

    mocks.onSaveResult.mockImplementationOnce(async (submitted: StudentResult) => (
      makeAuthoritativeResult(submitted, { id: 'retry-result-1' })
    ));
    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(mocks.onSaveResult).toHaveBeenCalledTimes(2);
    expect(result.current.step).toBe('result');
    expect(result.current.result?.id).toBe('retry-result-1');
    expect(window.sessionStorage.getItem(quizAttemptStorageKey(quiz.id))).toBeNull();
  });

  it('retains the draft after a failed timeout save and retries once after the baseline unlock', async () => {
    const quiz = makeQuiz({ timeLimit: 1 });
    const firstSave = deferred<StudentResult>();
    const secondSave = deferred<StudentResult>();
    mocks.onSaveResult.mockReset();
    mocks.onSaveResult
      .mockImplementationOnce(() => firstSave.promise)
      .mockImplementationOnce(() => secondSave.promise);

    const { result } = await startPlayer(quiz);
    const draftBefore = window.sessionStorage.getItem(quizAttemptStorageKey(quiz.id));
    expect(draftBefore).not.toBeNull();

    vi.setSystemTime('2026-11-28T05:01:00.000Z');
    await act(async () => {
      vi.advanceTimersByTime(1_000);
      await Promise.resolve();
    });
    expect(mocks.onSaveResult).toHaveBeenCalledOnce();
    expect(result.current.isSubmitting).toBe(true);

    await act(async () => {
      firstSave.reject(new Error('timeout save failed'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.onSaveResult).toHaveBeenCalledTimes(2);
    expect(result.current.isSubmitting).toBe(true);
    expect(window.sessionStorage.getItem(quizAttemptStorageKey(quiz.id))).toBe(draftBefore);

    await act(async () => {
      vi.advanceTimersByTime(3_000);
      await Promise.resolve();
    });
    expect(mocks.onSaveResult).toHaveBeenCalledTimes(2);

    await act(async () => {
      secondSave.resolve(makeAuthoritativeResult(mocks.onSaveResult.mock.calls[1][0] as StudentResult, {
        id: 'timeout-retry-result-1',
      }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.onSaveResult).toHaveBeenCalledTimes(2);
    expect(result.current.step).toBe('result');
    expect(result.current.result?.id).toBe('timeout-retry-result-1');
    expect(window.sessionStorage.getItem(quizAttemptStorageKey(quiz.id))).toBeNull();
  });

  it('keeps the saved result in the quiz step when clearing the draft throws', async () => {
    const quiz = makeQuiz();
    const { result } = await startPlayer(quiz);
    const draftBefore = window.sessionStorage.getItem(quizAttemptStorageKey(quiz.id));
    const originalRemoveItem = Storage.prototype.removeItem;
    const removeDraft = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (this: Storage, key: string) {
      if (key === quizAttemptStorageKey(quiz.id)) throw new Error('draft storage failed');
      return originalRemoveItem.call(this, key);
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(removeDraft).toHaveBeenCalledWith(quizAttemptStorageKey(quiz.id));
    expect(result.current.result?.id).toBe('server-result-1');
    expect(result.current.step).toBe('quiz');
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.showReward).toBe(false);
    expect(result.current.submitError).toContain('draft storage failed');
    expect(window.sessionStorage.getItem(quizAttemptStorageKey(quiz.id))).toBe(draftBefore);
    expect(mocks.claimResultReward).not.toHaveBeenCalled();
    expect(mocks.trackQuizActivity).not.toHaveBeenCalled();
  });

  it('reads the captured classroom store after save and snapshots gamification only after clearing the draft', async () => {
    const quiz = makeQuiz();
    const capturedStore = mocks.classroomStore;
    mocks.events.push('before-save');
    mocks.onSaveResult.mockImplementation(async (submitted: StudentResult) => {
      mocks.events.push('save-start');
      capturedStore.studentSession.username = 'after-save-user';
      mocks.classroomStore = {
        studentSession: {
          ...capturedStore.studentSession,
          username: 'new-render-user',
        },
      } as any;
      mocks.events.push('save-resolved');
      return makeAuthoritativeResult(submitted, { id: 'ordered-result-1' });
    });
    mocks.getGamificationState.mockImplementation(() => {
      mocks.events.push(
        window.sessionStorage.getItem(quizAttemptStorageKey(quiz.id)) === null
          ? 'snapshot-after-clear'
          : 'snapshot-before-clear',
      );
      return mocks.gamificationState;
    });
    mocks.claimResultReward.mockImplementation(async (username: string, resultId: string) => {
      mocks.events.push(`claim:${username}:${resultId}`);
      return {
        awardedExp: 10,
        awardedCoins: 2,
        alreadyClaimed: false,
        newLevel: 2,
        newExp: 10,
        newExpToNext: 100,
        newCoins: 2,
        leveledUp: true,
      };
    });
    mocks.getGameLoopState.mockImplementation(() => ({
      trackQuizActivity: mocks.trackQuizActivity.mockImplementation(() => {
        mocks.events.push('track');
      }),
    }));
    mocks.playTingSound.mockImplementation(() => {
      mocks.events.push('sound');
    });

    const { result } = await startPlayer(quiz);
    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(mocks.events).toEqual([
      'before-save',
      'save-start',
      'save-resolved',
      'snapshot-after-clear',
      'claim:after-save-user:ordered-result-1',
      'track',
      'sound',
    ]);
    expect(mocks.claimResultReward).toHaveBeenCalledWith('after-save-user', 'ordered-result-1');
    expect(result.current.rewardData).toMatchObject({
      resultId: 'ordered-result-1',
      expEarned: 10,
      coinsEarned: 2,
      newLevel: 2,
      leveledUp: true,
    });
  });
});
