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

describe('quizStore.loadResults fail-closed contract', () => {
  beforeEach(() => {
    mocks.callApi.mockReset();
    useQuizStore.setState({
      results: [],
      error: null,
    } as any);
  });

  it('rejects a malformed results envelope instead of treating it as an empty success', async () => {
    mocks.callApi.mockResolvedValue({ data: { unexpected: true } });

    await expect(useQuizStore.getState().loadResults()).rejects.toThrow(
      'Dữ liệu kết quả học tập không hợp lệ.',
    );
    expect(useQuizStore.getState().error).toBe('Dữ liệu kết quả học tập không hợp lệ.');
  });

  it('rejects transport failures after recording the store error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.callApi.mockRejectedValue(new Error('offline'));

    await expect(useQuizStore.getState().loadResults()).rejects.toThrow('offline');
    expect(useQuizStore.getState().error).toBe('offline');

    consoleSpy.mockRestore();
  });

  it('loads every cursor page with the maximum supported page size', async () => {
    const firstResult = {
      id: 'result-1',
      studentName: 'An',
      quizId: 'quiz-1',
      score: 8,
    };
    const secondResult = {
      id: 'result-2',
      studentName: 'Bình',
      quizId: 'quiz-1',
      score: 9,
    };
    mocks.callApi
      .mockResolvedValueOnce({
        data: [firstResult],
        meta: { hasMore: true, nextCursor: 'cursor-2' },
      })
      .mockResolvedValueOnce({
        data: [secondResult],
        meta: { hasMore: false, nextCursor: null },
      });

    await useQuizStore.getState().loadResults();

    expect(mocks.callApi).toHaveBeenNthCalledWith(1, 'get_results', { limit: 100 });
    expect(mocks.callApi).toHaveBeenNthCalledWith(2, 'get_results', {
      limit: 100,
      cursor: 'cursor-2',
    });
    expect(useQuizStore.getState().results.map((result) => result.id)).toEqual([
      'result-1',
      'result-2',
    ]);
  });

  it('rejects when the API repeats a cursor instead of storing partial results', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.callApi
      .mockResolvedValueOnce({
        data: [{ id: 'result-1', studentName: 'An' }],
        meta: { hasMore: true, nextCursor: 'cursor-loop' },
      })
      .mockResolvedValueOnce({
        data: [{ id: 'result-2', studentName: 'Bình' }],
        meta: { hasMore: true, nextCursor: 'cursor-loop' },
      });

    await expect(useQuizStore.getState().loadResults()).rejects.toThrow(
      'Dữ liệu phân trang kết quả học tập không hợp lệ.',
    );

    expect(mocks.callApi).toHaveBeenCalledTimes(2);
    expect(useQuizStore.getState().results).toEqual([]);
    expect(useQuizStore.getState().error).toBe('Dữ liệu phân trang kết quả học tập không hợp lệ.');

    consoleSpy.mockRestore();
  });

  it('keeps accepting legacy array responses', async () => {
    mocks.callApi.mockResolvedValue([
      { id: 'legacy-result', studentName: 'Chi' },
    ]);

    await useQuizStore.getState().loadResults();

    expect(mocks.callApi).toHaveBeenCalledWith('get_results', { limit: 100 });
    expect(useQuizStore.getState().results.map((result) => result.id)).toEqual(['legacy-result']);
  });

  it.each([
    ['missing', undefined],
    ['non-string', 42],
  ])('rejects a page claiming more results when its next cursor is %s', async (_label, nextCursor) => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.callApi.mockResolvedValue({
      data: [{ id: 'partial-result', studentName: 'An' }],
      meta: { hasMore: true, nextCursor },
    });

    await expect(useQuizStore.getState().loadResults()).rejects.toThrow(
      'Dữ liệu phân trang kết quả học tập không hợp lệ.',
    );
    expect(useQuizStore.getState().results).toEqual([]);
    expect(useQuizStore.getState().error).toBe('Dữ liệu phân trang kết quả học tập không hợp lệ.');
    expect(mocks.callApi).toHaveBeenCalledTimes(1);

    consoleSpy.mockRestore();
  });

  it.each([
    ['meta is missing', undefined],
    ['hasMore is missing', {}],
    ['hasMore is null', { hasMore: null }],
  ])('rejects an object response when %s', async (_label, meta) => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = meta === undefined
      ? { data: [{ id: 'partial-result', studentName: 'An' }] }
      : { data: [{ id: 'partial-result', studentName: 'An' }], meta };
    mocks.callApi.mockResolvedValue(response);

    await expect(useQuizStore.getState().loadResults()).rejects.toThrow(
      'Dữ liệu phân trang kết quả học tập không hợp lệ.',
    );
    expect(useQuizStore.getState().results).toEqual([]);
    expect(useQuizStore.getState().error).toBe('Dữ liệu phân trang kết quả học tập không hợp lệ.');
    expect(mocks.callApi).toHaveBeenCalledTimes(1);

    consoleSpy.mockRestore();
  });

  it('rejects instead of storing partial results when the pagination hard cap is reached', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let cursorIndex = 0;
    mocks.callApi.mockImplementation(async () => {
      cursorIndex += 1;
      return {
        data: [{ id: `result-${cursorIndex}`, studentName: 'An' }],
        meta: { hasMore: true, nextCursor: `cursor-${cursorIndex}` },
      };
    });

    await expect(useQuizStore.getState().loadResults()).rejects.toThrow(
      'Dữ liệu kết quả học tập vượt quá giới hạn phân trang.',
    );
    expect(useQuizStore.getState().results).toEqual([]);
    expect(useQuizStore.getState().error).toBe('Dữ liệu kết quả học tập vượt quá giới hạn phân trang.');
    expect(mocks.callApi).toHaveBeenCalledTimes(1000);

    consoleSpy.mockRestore();
  });
});
