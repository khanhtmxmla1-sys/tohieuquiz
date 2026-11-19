import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  callApi: vi.fn(),
  invalidatePrefix: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('../src/services/apiAdapter', () => ({ callApi: mocks.callApi }));
vi.mock('../src/services/CacheService', () => ({
  cacheService: { invalidatePrefix: mocks.invalidatePrefix },
}));
vi.mock('../src/services/logger', () => ({
  logger: { debug: mocks.debug },
}));

import { normalizeQuestionRow, useQuizStore } from '../stores/quizStore';

const quizRows = [{
  id: 'quiz-1',
  title: 'Phân số',
  classLevel: '4',
  category: 'Toán',
  timeLimit: 30,
  createdAt: '2026-07-24T00:00:00.000Z',
}];

const installSuccessfulApi = () => {
  mocks.callApi.mockImplementation(async (action: string) => {
    if (action === 'get_quizzes') return quizRows;
    if (action === 'get_questions') return [];
    throw new Error(`Unexpected action: ${action}`);
  });
};

describe('normalizeQuestionRow for authoring', () => {
  it('maps canonical option IDs back to authoring labels', () => {
    const mcq = normalizeQuestionRow({
      id: 'mcq',
      type: 'MCQ',
      options: 'mine|yours|hers|theirs',
      correct_answer: 'option-0',
    });
    const multiple = normalizeQuestionRow({
      id: 'multi',
      type: 'MULTIPLE_SELECT',
      options: 'ours|our|yours|your',
      correct_answer: JSON.stringify(['option-0', 'option-2']),
    });

    expect(mcq.correctAnswer).toBe('A');
    expect(multiple.correctAnswers).toEqual(['A', 'C']);
  });

  it('hydrates ordering correctOrder from the persisted correct_answer field', () => {
    const ordering = normalizeQuestionRow({
      id: 'ordering',
      type: 'ORDERING',
      items: JSON.stringify(['35 010', '34 999', '35 001', '35 000']),
      correct_answer: JSON.stringify([1, 3, 2, 0]),
    });

    expect(ordering.items).toEqual(['35 010', '34 999', '35 001', '35 000']);
    expect(ordering.correctOrder).toEqual([1, 3, 2, 0]);
  });
});

describe('quizStore.loadQuizzes', () => {
  beforeEach(() => {
    mocks.callApi.mockReset();
    mocks.invalidatePrefix.mockReset();
    mocks.debug.mockReset();
    useQuizStore.setState({
      quizzes: [],
      selectedQuiz: null,
      isLoading: false,
      error: null,
      quizzesLoadedAt: null,
    } as any);
  });

  it('can select a learner quiz without prefetching legacy authoring questions', async () => {
    useQuizStore.getState().selectQuiz({
      ...quizRows[0],
      questions: [],
    } as any, { loadQuestions: false });

    await Promise.resolve();

    expect(useQuizStore.getState().selectedQuiz?.id).toBe('quiz-1');
    expect(mocks.callApi).not.toHaveBeenCalled();
  });

  it('loads learner catalog metadata without calling the broad legacy question route', async () => {
    useQuizStore.setState({
      quizzes: [{ ...quizRows[0], questions: [{ id: 'stale-secret-answer-key' }] }],
    } as any);
    mocks.callApi.mockImplementation(async (action: string) => {
      if (action === 'get_quizzes') return quizRows;
      throw new Error(`Legacy question route must not run: ${action}`);
    });

    await useQuizStore.getState().loadQuizzes({ includeQuestions: false });

    expect(mocks.callApi).toHaveBeenCalledWith('get_quizzes');
    expect(mocks.callApi).not.toHaveBeenCalledWith('get_questions');
    expect(useQuizStore.getState().quizzes[0].questions).toEqual([]);
  });

  it('does not let an in-flight metadata load satisfy a concurrent authoring load', async () => {
    let releaseMetadata!: (value: unknown[]) => void;
    const metadataPromise = new Promise<unknown[]>((resolve) => {
      releaseMetadata = resolve;
    });
    let catalogCalls = 0;
    mocks.callApi.mockImplementation((action: string) => {
      if (action === 'get_quizzes') {
        catalogCalls += 1;
        return catalogCalls === 1 ? metadataPromise : Promise.resolve(quizRows);
      }
      if (action === 'get_questions') return Promise.resolve([{
        id: 'question-1', quiz_id: 'quiz-1', type: 'MCQ',
        question: '1 + 1?', options: '1|2', correct_answer: 'option-1',
      }]);
      throw new Error(`Unexpected action: ${action}`);
    });

    const metadataLoad = useQuizStore.getState().loadQuizzes({ includeQuestions: false });
    await Promise.resolve();
    const authoringLoad = useQuizStore.getState().loadQuizzes({ includeQuestions: true });

    expect(mocks.callApi).toHaveBeenCalledWith('get_questions');
    expect(catalogCalls).toBe(2);
    releaseMetadata(quizRows);
    await Promise.all([metadataLoad, authoringLoad]);
    expect(useQuizStore.getState().quizzes[0].questions).toHaveLength(1);
  });

  it('does not treat one embedded quiz as proof that the whole catalog is authoring-hydrated', async () => {
    installSuccessfulApi();
    await useQuizStore.getState().loadQuizzes({ includeQuestions: false });
    useQuizStore.setState({
      quizzes: [{ ...quizRows[0], questions: [{ id: 'one-embedded-question' }] }],
      quizzesLoadedAt: Date.now(),
    } as any);
    mocks.callApi.mockClear();

    await useQuizStore.getState().loadQuizzes({ includeQuestions: true });

    expect(mocks.callApi).toHaveBeenCalledWith('get_questions');
  });

  it('keeps legacy question hydration explicit for teacher authoring', async () => {
    const questionRows = [{
      id: 'question-1', quiz_id: 'quiz-1', type: 'MCQ',
      question: '1 + 1?', options: '1|2', correct_answer: 'option-1',
    }];
    mocks.callApi.mockImplementation(async (action: string) => {
      if (action === 'get_quizzes') return quizRows;
      if (action === 'get_questions') return questionRows;
      throw new Error(`Unexpected action: ${action}`);
    });

    await useQuizStore.getState().loadQuizzes({ includeQuestions: true });

    expect(mocks.callApi).toHaveBeenCalledWith('get_questions');
    expect(useQuizStore.getState().quizzes[0].questions).toHaveLength(1);
    expect(useQuizStore.getState().quizzes[0].questions[0]).toMatchObject({ correctAnswer: 'B' });
  });

  it('shares one API request pair across concurrent callers', async () => {
    let release!: (value: unknown[]) => void;
    const quizPromise = new Promise<unknown[]>((resolve) => {
      release = resolve;
    });
    mocks.callApi.mockImplementation((action: string) => {
      if (action === 'get_quizzes') return quizPromise;
      if (action === 'get_questions') return Promise.resolve([]);
      throw new Error(`Unexpected action: ${action}`);
    });

    const first = useQuizStore.getState().loadQuizzes({ includeQuestions: true });
    const second = useQuizStore.getState().loadQuizzes({ includeQuestions: true });

    expect(mocks.callApi).toHaveBeenCalledTimes(2);
    release(quizRows);
    await Promise.all([first, second]);
    expect(mocks.callApi).toHaveBeenCalledTimes(2);
  });

  it('lets a force caller join an active load without opening a parallel request', async () => {
    let release!: (value: unknown[]) => void;
    const quizPromise = new Promise<unknown[]>((resolve) => {
      release = resolve;
    });
    mocks.callApi.mockImplementation((action: string) => {
      if (action === 'get_quizzes') return quizPromise;
      if (action === 'get_questions') return Promise.resolve([]);
      throw new Error(`Unexpected action: ${action}`);
    });

    const first = useQuizStore.getState().loadQuizzes({ includeQuestions: true });
    const forced = useQuizStore.getState().loadQuizzes({ force: true, includeQuestions: true });

    expect(mocks.invalidatePrefix).toHaveBeenCalledWith('quizzes:');
    expect(mocks.callApi).toHaveBeenCalledTimes(2);
    release(quizRows);
    await Promise.all([first, forced]);
    expect(mocks.callApi).toHaveBeenCalledTimes(2);
  });

  it('reuses fresh data and force reloads after invalidating cache', async () => {
    installSuccessfulApi();

    await useQuizStore.getState().loadQuizzes({ includeQuestions: true });
    await useQuizStore.getState().loadQuizzes({ includeQuestions: true });
    expect(mocks.callApi).toHaveBeenCalledTimes(2);

    await useQuizStore.getState().loadQuizzes({ force: true, includeQuestions: true });
    expect(mocks.invalidatePrefix).toHaveBeenCalledWith('quizzes:');
    expect(mocks.callApi).toHaveBeenCalledTimes(4);
  });

  it('clears the active coordinator after failure so a later call retries', async () => {
    let shouldFail = true;
    mocks.callApi.mockImplementation(async (action: string) => {
      if (shouldFail) throw new Error('offline');
      if (action === 'get_quizzes') return quizRows;
      if (action === 'get_questions') return [];
      throw new Error(`Unexpected action: ${action}`);
    });

    await useQuizStore.getState().loadQuizzes({ includeQuestions: true });
    expect(useQuizStore.getState().quizzesLoadedAt).toBeNull();

    shouldFail = false;
    await useQuizStore.getState().loadQuizzes({ includeQuestions: true });
    expect(useQuizStore.getState().quizzes).toHaveLength(1);
    expect(mocks.callApi).toHaveBeenCalledTimes(4);
  });

  it('preserves assignment metadata on the selected quiz after a catalog refresh', async () => {
    installSuccessfulApi();
    const assignmentData = {
      id: 'assignment-1',
      quizId: 'quiz-1',
      classId: 'class-1',
      deadline: '2099-01-01T00:00:00.000Z',
      maxAttempts: 1,
      attemptCount: 0,
      status: 'OPEN',
      createdAt: '2026-08-04T00:00:00.000Z',
    };
    useQuizStore.setState({
      selectedQuiz: {
        ...quizRows[0],
        questions: [],
        _assignmentData: assignmentData,
      },
    } as any);

    await useQuizStore.getState().loadQuizzes({ force: true, includeQuestions: true });

    expect(useQuizStore.getState().selectedQuiz?._assignmentData).toEqual(assignmentData);
  });

  it('uses the production-silent logger instead of console.log', async () => {
    installSuccessfulApi();
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await useQuizStore.getState().loadQuizzes({ includeQuestions: true });

    expect(mocks.debug).toHaveBeenCalledWith(
      'Loaded 1 quizzes from D1',
      { module: 'QuizStore' },
    );
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
