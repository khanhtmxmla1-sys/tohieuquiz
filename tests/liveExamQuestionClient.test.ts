import { afterEach, describe, expect, it, vi } from 'vitest';

import { getLiveExamQuestions } from '../src/services/liveExamService';

describe('getLiveExamQuestions', () => {
  const forbiddenAnswerKeys = new Set([
    'correct_answer',
    'correctAnswer',
    'correctAnswers',
    'correctWordIndexes',
    'correctOrder',
    'wrongWord',
    'categoryId',
    'pairs',
    'explanation',
    'answer',
    'solution',
    'isCorrect',
  ]);

  const expectNoForbiddenAnswerFields = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(expectNoForbiddenAnswerFields);
      return;
    }
    Object.entries(value).forEach(([key, child]) => {
      expect(forbiddenAnswerKeys.has(key), `forbidden answer field: ${key}`).toBe(false);
      expectNoForbiddenAnswerFields(child);
    });
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads participant-scoped questions without exposing answer fields', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        success: true,
        sessionId: 'session-1',
        questions: [{
          id: 'question-1',
          type: 'MATCHING',
          question: 'Nối',
          leftItems: [{ id: 'sq1_left', content: 'A' }],
          rightItems: [{ id: 'sq1_right', content: 'X' }],
          correctAnswers: ['hidden'],
          correctWordIndexes: [0],
          correctOrder: [0],
          wrongWord: 'hidden',
          categoryId: 'secret',
          pairs: [{ left: 'A', right: 'X' }],
          explanation: { correctAnswer: 'hidden' },
          answer: 'hidden',
          solution: 'hidden',
          nested: { isCorrect: true, solution: 'hidden' },
        }],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));

    const result = await getLiveExamQuestions('session-1');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/live-exam/session-1/questions'),
      expect.objectContaining({ credentials: 'include' }),
    );
    expect(result.questions[0]).toMatchObject({
      id: 'question-1',
      type: 'MATCHING',
      question: 'Nối',
      leftItems: [{ id: 'sq1_left', content: 'A' }],
      rightItems: [{ id: 'sq1_right', content: 'X' }],
    });
    expectNoForbiddenAnswerFields(result);
  });
});
