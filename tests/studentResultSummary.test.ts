import { describe, expect, it } from 'vitest';
import type { StudentResult } from '../src/types';
import {
  buildStudentResultSummary,
  formatResultDuration,
  getStoredAnswerOutcome,
  isSkippedAnswer,
} from '../src/features/results/studentResultSummary';

const makeResult = (overrides: Partial<StudentResult> = {}): StudentResult => ({
  id: 'result-1',
  quizId: 'quiz-1',
  studentName: 'An',
  studentClass: '5A',
  score: 0,
  correctCount: 0,
  totalQuestions: 3,
  timeTaken: 0.5,
  submittedAt: new Date().toISOString(),
  answers: {
    q1: { selectedAnswer: 'A', isCorrect: true },
    q2: { selectedAnswer: 'B', isCorrect: false },
    q3: { selectedAnswer: '', isCorrect: false },
  },
  validationDetails: [
    { questionId: 'q1', isCorrect: false },
    { questionId: 'q2', isCorrect: true },
    { questionId: 'q3', isCorrect: false },
  ],
  ...overrides,
});

describe('student result summary', () => {
  it('recognizes empty values without treating false or zero as skipped', () => {
    expect(isSkippedAnswer(undefined)).toBe(true);
    expect(isSkippedAnswer('')).toBe(true);
    expect(isSkippedAnswer([])).toBe(true);
    expect(isSkippedAnswer({})).toBe(true);
    expect(isSkippedAnswer(false)).toBe(false);
    expect(isSkippedAnswer(0)).toBe(false);
  });

  it('uses graded answer snapshots instead of stale validation details', () => {
    const result = makeResult();

    expect(getStoredAnswerOutcome(result, 'q1', 'A')).toBe('correct');
    expect(getStoredAnswerOutcome(result, 'q2', 'B')).toBe('incorrect');
    expect(getStoredAnswerOutcome(result, 'q3', '')).toBe('skipped');
  });

  it('builds one consistent correct incorrect and skipped summary', () => {
    expect(buildStudentResultSummary(makeResult(), {
      q1: 'A',
      q2: 'B',
      q3: '',
    })).toEqual({
      correct: 1,
      incorrect: 1,
      skipped: 1,
      total: 3,
      score10: 3.3,
      accuracyPercent: 33,
    });
  });

  it('formats sub-minute decimal minutes as seconds', () => {
    expect(formatResultDuration(0.5)).toBe('30 giây');
    expect(formatResultDuration(2.25)).toBe('2 phút 15 giây');
    expect(formatResultDuration(Number.NaN)).toBe('Chưa xác định');
  });
});
