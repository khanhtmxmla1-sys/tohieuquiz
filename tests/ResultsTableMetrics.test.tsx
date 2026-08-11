import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolveResultDisplayMetrics } from '../src/components/teacher/ResultsView/ResultsTable';

const result = (overrides: Record<string, unknown> = {}) => ({
  id: 'result-1', studentName: 'An', studentClass: '4A', quizId: 'quiz-1',
  score: 0, correctCount: 0, totalQuestions: 0, timeTaken: 0,
  submittedAt: '2026-08-01T00:00:00Z', answers: {},
  ...overrides,
}) as any;

describe('ResultsTable canonical metrics', () => {
  it('preserves backend zero and decimal metrics', () => {
    expect(resolveResultDisplayMetrics(result())).toEqual({ score: 0, correctCount: 0, totalQuestions: 0 });
    expect(resolveResultDisplayMetrics(result({ score: 7.5, correctCount: 3, totalQuestions: 4 })))
      .toEqual({ score: 7.5, correctCount: 3, totalQuestions: 4 });
  });

  it('uses one resolved metric object for authoritative overrides including zero', () => {
    expect(resolveResultDisplayMetrics(
      result({ score: 4, correctCount: 4, totalQuestions: 10 }),
      { score: 0, correctCount: 0, totalQuestions: 0 },
    )).toEqual({ score: 0, correctCount: 0, totalQuestions: 0 });
  });

  it('does not regrade sanitized snapshots inside ResultsTable', () => {
    const source = readFileSync('src/components/teacher/ResultsView/ResultsTable.tsx', 'utf8');
    expect(source).not.toContain('checkAnswer(');
    expect(source).not.toContain('questionSnapshot');
  });
});
