import { describe, expect, it } from 'vitest';
import { summarizeQuizProgress } from '../src/domain/quiz-progress';

describe('summarizeQuizProgress', () => {
  it('summarizes empty, partial, and complete questions from one shared engine', () => {
    const summary = summarizeQuizProgress(
      [
        { id: 'q1', type: 'SHORT_ANSWER' },
        { id: 'q2', type: 'TRUE_FALSE', items: [{ id: 'a' }, { id: 'b' }] },
        { id: 'q3', type: 'MCQ', options: ['A', 'B'] },
      ],
      {
        q1: 'mine',
        q2: { a: true },
      },
    );

    expect(summary).toMatchObject({
      totalCount: 3,
      completeCount: 1,
      partialCount: 1,
      emptyCount: 1,
    });
    expect(summary.byQuestionId.q1.state).toBe('complete');
    expect(summary.byQuestionId.q2.state).toBe('partial');
    expect(summary.byQuestionId.q3.state).toBe('empty');
  });

  it('counts a question without an id without adding an unstable map key', () => {
    const summary = summarizeQuizProgress(
      [
        { type: 'SHORT_ANSWER' },
        { id: 'known', type: 'SHORT_ANSWER' },
      ],
      { known: 'answer' },
    );

    expect(summary).toMatchObject({
      totalCount: 2,
      emptyCount: 1,
      partialCount: 0,
      completeCount: 1,
    });
    expect(summary.byQuestionId).toEqual({
      known: {
        state: 'complete',
        hasInteraction: true,
        completedParts: 1,
        requiredParts: 1,
      },
    });
  });

  it('returns a stable empty summary for missing inputs', () => {
    expect(summarizeQuizProgress([], {})).toEqual({
      totalCount: 0,
      emptyCount: 0,
      partialCount: 0,
      completeCount: 0,
      byQuestionId: {},
    });
  });
});
