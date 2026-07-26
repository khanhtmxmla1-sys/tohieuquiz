import { beforeEach, describe, expect, it, vi } from 'vitest';
import { callApi } from '../src/services/apiAdapter';
import { practiceService } from '../src/services/practiceService';

vi.mock('../src/services/apiAdapter', () => ({
  callApi: vi.fn(),
}));

const callApiMock = vi.mocked(callApi);

describe('practiceService', () => {
  beforeEach(() => {
    callApiMock.mockReset();
  });

  it('returns topic data from the practice API', async () => {
    callApiMock.mockResolvedValueOnce({ topics: [{ name: '#toan', count: 5 }] });

    await expect(practiceService.getTopics()).resolves.toEqual([
      { name: '#toan', count: 5 },
    ]);
  });

  it('rejects topic API failures instead of converting them to empty data', async () => {
    callApiMock.mockRejectedValueOnce(new Error('network down'));

    await expect(practiceService.getTopics()).rejects.toThrow('network down');
  });
});
