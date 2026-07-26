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

import { useQuizStore } from '../stores/quizStore';

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

    const first = useQuizStore.getState().loadQuizzes();
    const second = useQuizStore.getState().loadQuizzes();

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

    const first = useQuizStore.getState().loadQuizzes();
    const forced = useQuizStore.getState().loadQuizzes({ force: true });

    expect(mocks.invalidatePrefix).toHaveBeenCalledWith('quizzes:');
    expect(mocks.callApi).toHaveBeenCalledTimes(2);
    release(quizRows);
    await Promise.all([first, forced]);
    expect(mocks.callApi).toHaveBeenCalledTimes(2);
  });

  it('reuses fresh data and force reloads after invalidating cache', async () => {
    installSuccessfulApi();

    await useQuizStore.getState().loadQuizzes();
    await useQuizStore.getState().loadQuizzes();
    expect(mocks.callApi).toHaveBeenCalledTimes(2);

    await useQuizStore.getState().loadQuizzes({ force: true });
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

    await useQuizStore.getState().loadQuizzes();
    expect(useQuizStore.getState().quizzesLoadedAt).toBeNull();

    shouldFail = false;
    await useQuizStore.getState().loadQuizzes();
    expect(useQuizStore.getState().quizzes).toHaveLength(1);
    expect(mocks.callApi).toHaveBeenCalledTimes(4);
  });

  it('uses the production-silent logger instead of console.log', async () => {
    installSuccessfulApi();
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await useQuizStore.getState().loadQuizzes();

    expect(mocks.debug).toHaveBeenCalledWith(
      'Loaded 1 quizzes from D1',
      { module: 'QuizStore' },
    );
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
