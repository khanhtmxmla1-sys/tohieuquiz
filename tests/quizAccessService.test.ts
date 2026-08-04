import { beforeEach, describe, expect, it, vi } from 'vitest';
const callApi = vi.hoisted(() => vi.fn());
vi.mock('../src/services/apiAdapter', () => ({ callApi }));

import { verifyQuizAccessCode } from '../src/services/quizAccessService';

describe('quizAccessService', () => {
  beforeEach(() => callApi.mockReset());

  it('normalizes the code and uses the public verification action', async () => {
    callApi.mockResolvedValue({ valid: true });
    await expect(verifyQuizAccessCode('quiz-1', ' abc123 ')).resolves.toBe(true);
    expect(callApi).toHaveBeenCalledWith('verify_quiz_access_code', {
      quizId: 'quiz-1',
      accessCode: 'ABC123',
    });
  });

  it('maps a generic 403 to an invalid code result', async () => {
    callApi.mockImplementationOnce(() => Promise.reject({
      status: 403,
      code: 'INVALID_ACCESS_CODE',
      message: 'Forbidden',
    }));
    await expect(verifyQuizAccessCode('quiz-1', 'ABC123')).resolves.toBe(false);
  });

  it('rethrows network and server failures', async () => {
    callApi.mockImplementationOnce(() => Promise.reject({
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'Offline',
    }));
    await expect(verifyQuizAccessCode('quiz-1', 'ABC123')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });
});
