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
});
