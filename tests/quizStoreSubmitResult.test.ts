import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StudentResult } from '../src/types';

const mocks = vi.hoisted(() => ({
  callApi: vi.fn(),
  invalidatePrefix: vi.fn(),
}));

vi.mock('../src/services/apiAdapter', () => ({ callApi: mocks.callApi }));
vi.mock('../src/services/CacheService', () => ({
  cacheService: { invalidatePrefix: mocks.invalidatePrefix },
}));

import { useQuizStore } from '../stores/quizStore';

const result: StudentResult = {
  id: 'temporary-client-id',
  quizId: 'quiz-1',
  quizTitle: 'Ôn tập Toán',
  studentName: 'Nguyễn Văn An',
  studentClass: '5A',
  score: 8,
  correctCount: 8,
  totalQuestions: 10,
  timeTaken: 3,
  submittedAt: '2026-07-20T12:00:00.000Z',
  answers: {},
};

describe('quizStore submitResult', () => {
  beforeEach(() => {
    mocks.callApi.mockReset();
    mocks.invalidatePrefix.mockReset();
    useQuizStore.setState({ results: [], error: null, isLoading: false });
  });

  it('replaces the temporary client id with the database result id', async () => {
    mocks.callApi.mockResolvedValue({ status: 'success', resultId: 42 });

    const saved = await useQuizStore.getState().submitResult(result);

    expect(saved.id).toBe('42');
    expect(useQuizStore.getState().results).toContainEqual(expect.objectContaining({ id: '42' }));
    expect(mocks.invalidatePrefix).toHaveBeenCalledWith('results:');
  });

  it('replaces client scoring fields with the authoritative Worker response', async () => {
    mocks.callApi.mockResolvedValue({
      status: 'success',
      resultId: 43,
      score: 0,
      correctCount: 0,
      totalQuestions: 1,
      gradingVersion: '2.0.0',
      answers: {
        q1: { selectedAnswer: 'B', isCorrect: false, gradingVersion: '2.0.0' },
      },
      validationDetails: [{ questionId: 'q1', isCorrect: false, status: 'wrong' }],
    });

    const saved = await useQuizStore.getState().submitResult({
      ...result,
      score: 10,
      correctCount: 1,
      totalQuestions: 1,
      answers: { q1: { selectedAnswer: 'B', isCorrect: true } },
    });

    expect(saved).toMatchObject({
      id: '43',
      score: 0,
      correctCount: 0,
      totalQuestions: 1,
      gradingVersion: '2.0.0',
      answers: { q1: { selectedAnswer: 'B', isCorrect: false, gradingVersion: '2.0.0' } },
      validationDetails: [{ questionId: 'q1', isCorrect: false, status: 'wrong' }],
    });
  });});
