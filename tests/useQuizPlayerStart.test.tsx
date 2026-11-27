import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QuestionType, type Quiz, type StudentResult } from '../src/types';
import { quizAttemptStorageKey } from '../src/features/quiz-player/quizAttemptDraft';

const sessionState = vi.hoisted(() => ({
  value: {
    studentId: 'student-1',
    username: 'student-1',
    fullName: 'Nguyễn Văn An',
    className: '5A1',
    avatar: '',
  } as Record<string, string> | null,
}));

const mocks = vi.hoisted(() => ({
  fetchQuizPlayQuestions: vi.fn(),
  requestQuizAccess: vi.fn(),
  adaptStudentQuizQuestion: vi.fn((question: unknown) => question),
  startAssignmentAttempt: vi.fn(),
  validateAnswersOnServer: vi.fn(),
  trackQuizActivity: vi.fn(),
  showConfirm: vi.fn(),
}));

vi.mock('../src/stores/useClassroomStore', () => ({
  useClassroomStore: () => ({ studentSession: sessionState.value }),
}));
vi.mock('../src/stores/useGamificationStore', () => ({
  useGamificationStore: { getState: () => ({ pet: null, coins: 0 }) },
}));
vi.mock('../src/stores/useGameLoopStore', () => ({
  useGameLoopStore: { getState: () => ({ trackQuizActivity: mocks.trackQuizActivity }) },
}));
vi.mock('../src/services/quizValidationService', () => ({
  validateAnswersOnServer: mocks.validateAnswersOnServer,
}));
vi.mock('../src/services/classroomService', () => ({
  startAssignmentAttempt: mocks.startAssignmentAttempt,
}));
vi.mock('../src/services/quizAccessService', () => ({
  fetchQuizPlayQuestions: mocks.fetchQuizPlayQuestions,
  requestQuizAccess: mocks.requestQuizAccess,
  adaptStudentQuizQuestion: mocks.adaptStudentQuizQuestion,
}));
vi.mock('../src/utils/toast', () => ({
  playTingSound: vi.fn(),
  showConfirm: mocks.showConfirm,
  showError: vi.fn(),
}));

import { useQuizPlayer } from '../src/features/quiz-player/hooks/useQuizPlayer';

const catalogQuestions = [
  { id: 'catalog-q1', type: QuestionType.MCQ, question: 'Catalog?', options: ['A', 'B'], correctAnswer: 'A' },
  { id: 'catalog-q2', type: QuestionType.MCQ, question: 'Catalog 2?', options: ['A', 'B'], correctAnswer: 'B' },
];

const makeQuiz = (overrides: Partial<Quiz> = {}): Quiz => ({
  id: 'quiz-start',
  title: 'Bài bắt đầu',
  classLevel: '5',
  category: 'toan',
  timeLimit: 10,
  createdAt: '2026-08-04T00:00:00.000Z',
  requireCode: false,
  questions: catalogQuestions,
  ...overrides,
});

const scopedQuestions = [
  { id: 'scoped-q1', type: 'MCQ', question: 'Scoped?', options: ['A', 'B'] },
];

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

const assignmentQuiz = (overrides: Partial<Quiz> = {}): Quiz => makeQuiz({
  _assignmentData: {
    id: 'assignment-start',
    quizId: 'quiz-start',
    classId: 'class-1',
    deadline: '2099-01-01T00:00:00.000Z',
    maxAttempts: 2,
    attemptCount: 0,
    status: 'OPEN',
    createdAt: '2026-08-04T00:00:00.000Z',
  },
  ...overrides,
});

describe('useQuizPlayer start pipeline', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime('2026-08-04T05:00:00.000Z');
    window.sessionStorage.clear();
    window.localStorage.clear();
    vi.clearAllMocks();
    sessionState.value = {
      studentId: 'student-1',
      username: 'student-1',
      fullName: 'Nguyễn Văn An',
      className: '5A1',
      avatar: '',
    };
    mocks.adaptStudentQuizQuestion.mockImplementation((question: unknown) => question);
    mocks.fetchQuizPlayQuestions.mockResolvedValue({
      quizId: 'quiz-start',
      revision: 1,
      questions: scopedQuestions,
    });
    mocks.startAssignmentAttempt.mockResolvedValue({
      assignmentId: 'assignment-start',
      attemptCount: 1,
      maxAttempts: 2,
      remainingAttempts: 1,
      deadline: '2099-01-01T00:00:00.000Z',
      status: 'OPEN',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads formal questions from the scoped endpoint instead of catalog questions', async () => {
    const quiz = makeQuiz();
    const rawScopedQuestion = {
      id: 'raw-q1', type: 'MCQ', question: 'Raw?', options: ['A', 'B'], rawOnly: 'must-not-render',
    };
    const adaptedQuestion = {
      id: 'adapted-q1', type: QuestionType.MCQ, question: 'Adapted?', options: ['A', 'B'],
    };
    mocks.fetchQuizPlayQuestions.mockResolvedValueOnce({
      quizId: 'quiz-start', revision: 1, questions: [rawScopedQuestion],
    });
    mocks.adaptStudentQuizQuestion.mockReturnValueOnce(adaptedQuestion);
    const { result } = renderHook(() => useQuizPlayer({ quiz, onExit: vi.fn(), onSaveResult: vi.fn() }));

    await act(async () => result.current.handleStart());

    expect(mocks.fetchQuizPlayQuestions).toHaveBeenCalledWith('quiz-start', {
      assignmentId: undefined,
      accessGrant: undefined,
    });
    expect(mocks.adaptStudentQuizQuestion).toHaveBeenCalledWith(rawScopedQuestion);
    expect(result.current.shuffledQuestions).toEqual([adaptedQuestion]);
    expect(result.current.shuffledQuestions[0]).not.toHaveProperty('rawOnly');
    expect(result.current.shuffledQuestions.map((question) => question.id)).not.toContain('catalog-q1');
    expect(mocks.startAssignmentAttempt).not.toHaveBeenCalled();
  });

  it('keeps an authenticated coded assignment in notice and carries the grant only through start and submit', async () => {
    const quiz = assignmentQuiz({ id: 'quiz-coded-assignment', requireCode: true });
    const onSaveResult = vi.fn(async (savedResult: StudentResult) => ({
      ...savedResult,
      id: 'server-result',
      score: 10,
      correctCount: 1,
    }));
    mocks.requestQuizAccess.mockResolvedValue({ valid: true, accessGrant: 'grant-coded-assignment' });
    mocks.fetchQuizPlayQuestions.mockResolvedValue({
      quizId: quiz.id,
      revision: 1,
      questions: scopedQuestions,
    });
    const { result } = renderHook(() => useQuizPlayer({ quiz, onExit: vi.fn(), onSaveResult }));

    expect(result.current.step).toBe('code');
    act(() => result.current.setEnteredCode('abc123'));
    await act(async () => result.current.handleCodeVerify());
    expect(result.current.step).toBe('notice');

    await act(async () => result.current.handleStart());
    expect(mocks.fetchQuizPlayQuestions).toHaveBeenCalledWith(quiz.id, {
      assignmentId: 'assignment-start',
      accessGrant: 'grant-coded-assignment',
    });
    expect(mocks.startAssignmentAttempt).toHaveBeenCalledWith('assignment-start', 'student-1');
    expect(result.current.enteredCode).toBe('abc123');
    expect(result.current).not.toHaveProperty('accessGrant');
    expect(JSON.stringify(result.current)).not.toContain('grant-coded-assignment');

    const storedValues = Array.from({ length: window.sessionStorage.length }, (_, index) => (
      window.sessionStorage.getItem(window.sessionStorage.key(index) || '') || ''
    )).join('\n');
    const localValues = Array.from({ length: window.localStorage.length }, (_, index) => (
      window.localStorage.getItem(window.localStorage.key(index) || '') || ''
    )).join('\n');
    expect(storedValues).not.toContain('grant-coded-assignment');
    expect(storedValues).not.toContain('abc123');
    expect(localValues).not.toContain('grant-coded-assignment');
    expect(localValues).not.toContain('abc123');

    await act(async () => result.current.handleSubmit());
    const submittedResult = onSaveResult.mock.calls[0][0];
    expect(onSaveResult).toHaveBeenCalledWith(expect.anything(), { accessGrant: 'grant-coded-assignment' });
    expect(JSON.stringify(submittedResult)).not.toContain('grant-coded-assignment');
    expect(JSON.stringify(submittedResult)).not.toContain('abc123');
    expect(window.sessionStorage.getItem(quizAttemptStorageKey(quiz.id))).toBeNull();
  });

  it('keeps the notice and does not create a new draft while scoped loading is pending', async () => {
    const pendingQuestions = deferred<{ quizId: string; revision: number; questions: typeof scopedQuestions }>();
    mocks.fetchQuizPlayQuestions.mockReturnValue(pendingQuestions.promise);
    const { result } = renderHook(() => useQuizPlayer({
      quiz: assignmentQuiz(),
      onExit: vi.fn(),
      onSaveResult: vi.fn(),
    }));

    let startPromise!: Promise<void>;
    await act(async () => {
      startPromise = result.current.handleStart();
      await Promise.resolve();
    });

    expect(result.current.step).toBe('notice');
    expect(result.current.isStarting).toBe(true);
    expect(result.current.shuffledQuestions).toEqual([]);
    expect(mocks.startAssignmentAttempt).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(quizAttemptStorageKey('quiz-start'))).toBeNull();

    pendingQuestions.resolve({ quizId: 'quiz-start', revision: 1, questions: scopedQuestions });
    await act(async () => startPromise);
    expect(result.current.step).toBe('quiz');
    expect(mocks.startAssignmentAttempt).toHaveBeenCalledOnce();
  });

  it('does not restore a coded grant on remount when a draft exists', async () => {
    const quiz = makeQuiz({ requireCode: true });
    mocks.requestQuizAccess.mockResolvedValueOnce({ valid: true, accessGrant: 'grant-first-mount' });
    mocks.fetchQuizPlayQuestions.mockResolvedValueOnce({
      quizId: quiz.id, revision: 1, questions: scopedQuestions,
    });

    const firstMount = renderHook(() => useQuizPlayer({
      quiz,
      onExit: vi.fn(),
      onSaveResult: vi.fn(),
    }));
    act(() => firstMount.result.current.setEnteredCode('first1'));
    await act(async () => firstMount.result.current.handleCodeVerify());
    await act(async () => firstMount.result.current.handleStart());
    expect(firstMount.result.current.step).toBe('quiz');
    expect(mocks.fetchQuizPlayQuestions).toHaveBeenCalledWith(quiz.id, {
      assignmentId: undefined,
      accessGrant: 'grant-first-mount',
    });
    expect(window.sessionStorage.getItem(quizAttemptStorageKey(quiz.id))).not.toBeNull();
    firstMount.unmount();

    mocks.fetchQuizPlayQuestions.mockReset();
    mocks.fetchQuizPlayQuestions.mockResolvedValueOnce({
      quizId: quiz.id, revision: 1, questions: scopedQuestions,
    });
    const secondMount = renderHook(() => useQuizPlayer({
      quiz,
      onExit: vi.fn(),
      onSaveResult: vi.fn(),
    }));
    expect(secondMount.result.current.step).toBe('code');
    expect(secondMount.result.current.enteredCode).toBe('');
    expect(secondMount.result.current).not.toHaveProperty('accessGrant');

    await act(async () => secondMount.result.current.handleStart());
    expect(mocks.fetchQuizPlayQuestions).toHaveBeenCalledWith(quiz.id, {
      assignmentId: undefined,
      accessGrant: undefined,
    });
  });

  it('clears a previous grant when a later valid verification has no grant', async () => {
    const quiz = makeQuiz({ requireCode: true });
    mocks.requestQuizAccess
      .mockResolvedValueOnce({ valid: true, accessGrant: 'grant-old' })
      .mockResolvedValueOnce({ valid: true });
    const { result } = renderHook(() => useQuizPlayer({
      quiz,
      onExit: vi.fn(),
      onSaveResult: vi.fn(),
    }));

    act(() => result.current.setEnteredCode('old111'));
    await act(async () => result.current.handleCodeVerify());
    act(() => result.current.setEnteredCode('new222'));
    await act(async () => result.current.handleCodeVerify());
    await act(async () => result.current.handleStart());

    expect(mocks.fetchQuizPlayQuestions).toHaveBeenCalledWith(quiz.id, {
      assignmentId: undefined,
      accessGrant: undefined,
    });
  });

  it.each([
    ['empty', []],
    ['non-array', null],
  ])('keeps the previous step and allows retry when scoped questions are %s', async (_label, questions) => {
    mocks.fetchQuizPlayQuestions.mockResolvedValueOnce({ quizId: 'quiz-start', revision: 1, questions });
    const { result } = renderHook(() => useQuizPlayer({
      quiz: assignmentQuiz(),
      onExit: vi.fn(),
      onSaveResult: vi.fn(),
    }));

    await act(async () => result.current.handleStart());
    expect(result.current.step).toBe('notice');
    expect(result.current.startError).toBe('Không tải được câu hỏi của bài làm.');
    expect(result.current.isStarting).toBe(false);
    expect(mocks.startAssignmentAttempt).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(quizAttemptStorageKey('quiz-start'))).toBeNull();

    await act(async () => result.current.handleStart());
    expect(result.current.step).toBe('quiz');
    expect(result.current.startError).toBeNull();
    expect(mocks.fetchQuizPlayQuestions).toHaveBeenCalledTimes(2);
    expect(mocks.startAssignmentAttempt).toHaveBeenCalledOnce();
  });

  it('loads scoped questions before assignment preflight and uses the quiz timer', async () => {
    const events: string[] = [];
    mocks.fetchQuizPlayQuestions.mockImplementation(async () => {
      events.push('fetch');
      return { quizId: 'quiz-start', revision: 1, questions: scopedQuestions };
    });
    mocks.startAssignmentAttempt.mockImplementation(async () => {
      events.push('preflight');
      return { deadline: '2099-01-01T00:00:00.000Z' };
    });
    const quiz = assignmentQuiz();
    const { result } = renderHook(() => useQuizPlayer({ quiz, onExit: vi.fn(), onSaveResult: vi.fn() }));

    await act(async () => result.current.handleStart());

    expect(events).toEqual(['fetch', 'preflight']);
    expect(mocks.startAssignmentAttempt).toHaveBeenCalledWith('assignment-start', 'student-1');
    expect(result.current.step).toBe('quiz');
    expect(result.current.timeLeft).toBe(600);
  });

  it('starts a new timer at successful preflight completion, not at click or response deadline', async () => {
    const pendingPreflight = deferred<Record<string, unknown>>();
    mocks.startAssignmentAttempt.mockReturnValue(pendingPreflight.promise);
    const quiz = assignmentQuiz();
    const { result } = renderHook(() => useQuizPlayer({ quiz, onExit: vi.fn(), onSaveResult: vi.fn() }));

    let startPromise!: Promise<void>;
    await act(async () => {
      startPromise = result.current.handleStart();
      await Promise.resolve();
    });
    expect(result.current.step).toBe('notice');
    expect(result.current.isStarting).toBe(true);
    expect(window.sessionStorage.getItem(quizAttemptStorageKey(quiz.id))).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    });
    pendingPreflight.resolve({ deadline: '2099-01-01T00:00:00.000Z' });
    await act(async () => startPromise);

    expect(result.current.step).toBe('quiz');
    expect(result.current.timeLeft).toBe(600);
    expect(JSON.parse(window.sessionStorage.getItem(quizAttemptStorageKey(quiz.id)) || '{}')).toMatchObject({
      startedAt: '2026-08-04T05:05:00.000Z',
      expiresAt: '2026-08-04T05:15:00.000Z',
    });
  });

  it('keeps an existing draft deadline while assignment preflight is pending', async () => {
    window.sessionStorage.setItem(quizAttemptStorageKey('quiz-start'), JSON.stringify({
      version: 1,
      quizId: 'quiz-start',
      studentName: 'Nguyễn Văn An',
      studentClass: '5A1',
      answers: { 'catalog-q1': 'A' },
      questionOrder: ['catalog-q1', 'catalog-q2'],
      currentPage: 1,
      startedAt: '2026-08-04T04:55:00.000Z',
      expiresAt: '2026-08-04T05:05:00.000Z',
    }));
    const pendingPreflight = deferred<Record<string, unknown>>();
    mocks.fetchQuizPlayQuestions.mockResolvedValueOnce({
      quizId: 'quiz-start',
      revision: 1,
      questions: catalogQuestions,
    });
    mocks.startAssignmentAttempt.mockReturnValue(pendingPreflight.promise);
    const { result } = renderHook(() => useQuizPlayer({
      quiz: assignmentQuiz(),
      onExit: vi.fn(),
      onSaveResult: vi.fn(),
    }));
    expect(result.current.timeLeft).toBe(300);

    let startPromise!: Promise<void>;
    await act(async () => {
      startPromise = result.current.handleStart();
      await Promise.resolve();
    });
    expect(result.current.step).toBe('notice');
    expect(result.current.isStarting).toBe(true);
    expect(result.current.timeLeft).toBe(300);
    expect(result.current.shuffledQuestions).toEqual([]);

    pendingPreflight.resolve({ deadline: '2099-01-01T00:00:00.000Z' });
    await act(async () => startPromise);
    expect(result.current.step).toBe('quiz');
    expect(result.current.timeLeft).toBe(300);
  });

  it('fails after loading when an assignment has no student id and skips preflight', async () => {
    sessionState.value = {
      studentId: '', username: 'guest', fullName: 'Khách', className: '5A1', avatar: '',
    };
    const { result } = renderHook(() => useQuizPlayer({
      quiz: assignmentQuiz(),
      onExit: vi.fn(),
      onSaveResult: vi.fn(),
    }));

    await act(async () => result.current.handleStart());

    expect(result.current.step).toBe('notice');
    expect(result.current.startError).toBe('Phiên học sinh không hợp lệ. Em hãy đăng nhập lại.');
    expect(mocks.fetchQuizPlayQuestions).toHaveBeenCalledOnce();
    expect(mocks.startAssignmentAttempt).not.toHaveBeenCalled();
  });

  it('reopens the start lock and retries after a preflight error', async () => {
    mocks.startAssignmentAttempt.mockRejectedValueOnce(new Error('Em đã hết lượt làm bài này (1/1).'));
    const { result } = renderHook(() => useQuizPlayer({
      quiz: assignmentQuiz(),
      onExit: vi.fn(),
      onSaveResult: vi.fn(),
    }));

    await act(async () => result.current.handleStart());
    expect(result.current.step).toBe('notice');
    expect(result.current.startError).toBe('Em đã hết lượt làm bài này (1/1).');
    expect(result.current.isStarting).toBe(false);
    expect(window.sessionStorage.getItem(quizAttemptStorageKey('quiz-start'))).toBeNull();

    await act(async () => result.current.handleStart());
    expect(result.current.step).toBe('quiz');
    expect(result.current.startError).toBeNull();
    expect(mocks.startAssignmentAttempt).toHaveBeenCalledTimes(2);
    expect(mocks.fetchQuizPlayQuestions).toHaveBeenCalledTimes(2);

    await act(async () => result.current.handleStart());
    expect(mocks.fetchQuizPlayQuestions).toHaveBeenCalledTimes(2);
    expect(mocks.startAssignmentAttempt).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['network', new Error('network down')],
    ['forbidden', Object.assign(new Error('Forbidden'), { status: 403 })],
  ])('keeps the previous step and retries after scoped fetch %s', async (_label, error) => {
    mocks.fetchQuizPlayQuestions.mockRejectedValueOnce(error);
    const { result } = renderHook(() => useQuizPlayer({
      quiz: assignmentQuiz(),
      onExit: vi.fn(),
      onSaveResult: vi.fn(),
    }));

    await act(async () => result.current.handleStart());
    expect(result.current.step).toBe('notice');
    expect(result.current.startError).toBe(error.message);
    expect(result.current.isStarting).toBe(false);
    expect(mocks.startAssignmentAttempt).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(quizAttemptStorageKey('quiz-start'))).toBeNull();

    await act(async () => result.current.handleStart());
    expect(result.current.step).toBe('quiz');
    expect(result.current.startError).toBeNull();
    expect(mocks.fetchQuizPlayQuestions).toHaveBeenCalledTimes(2);
    expect(mocks.startAssignmentAttempt).toHaveBeenCalledOnce();
  });

  it('does not start when the guest has not provided name and class', async () => {
    sessionState.value = null;
    const { result } = renderHook(() => useQuizPlayer({
      quiz: makeQuiz(),
      onExit: vi.fn(),
      onSaveResult: vi.fn(),
    }));

    await act(async () => result.current.handleStart());

    expect(result.current.step).toBe('info');
    expect(result.current.isStarting).toBe(false);
    expect(mocks.fetchQuizPlayQuestions).not.toHaveBeenCalled();
    expect(mocks.startAssignmentAttempt).not.toHaveBeenCalled();
  });

  it('starts a normal practice quiz from memory without scoped load or preflight', async () => {
    const practiceQuestions = [{
      id: 'practice-q1', type: QuestionType.MCQ, question: 'Practice?', options: ['A', 'B'], correctAnswer: 'A',
    }];
    const { result } = renderHook(() => useQuizPlayer({
      quiz: makeQuiz({ id: 'practice-start', isPractice: true, questions: practiceQuestions }),
      onExit: vi.fn(),
      onSaveResult: vi.fn(),
    }));

    await act(async () => result.current.handleStart());

    expect(result.current.step).toBe('quiz');
    expect(result.current.shuffledQuestions.map((question) => question.id)).toEqual(['practice-q1']);
    expect(mocks.fetchQuizPlayQuestions).not.toHaveBeenCalled();
    expect(mocks.adaptStudentQuizQuestion).not.toHaveBeenCalled();
    expect(mocks.startAssignmentAttempt).not.toHaveBeenCalled();
  });

  it('still preflights synthetic practice data that carries assignment metadata', async () => {
    const practiceQuiz = assignmentQuiz({
      id: 'practice-assignment-start',
      isPractice: true,
      questions: [{
        id: 'practice-q1', type: QuestionType.MCQ, question: 'Practice?', options: ['A', 'B'], correctAnswer: 'A',
      }],
    });
    const { result } = renderHook(() => useQuizPlayer({
      quiz: practiceQuiz,
      onExit: vi.fn(),
      onSaveResult: vi.fn(),
    }));
    await act(async () => {
      await result.current.handleStart();
    });

    expect(result.current.step).toBe('quiz');
    expect(mocks.fetchQuizPlayQuestions).not.toHaveBeenCalled();
    expect(mocks.adaptStudentQuizQuestion).not.toHaveBeenCalled();
    expect(mocks.startAssignmentAttempt).toHaveBeenCalledWith('assignment-start', 'student-1');
  });
});
