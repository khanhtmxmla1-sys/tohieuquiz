import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearQuizAttemptDraft,
  loadQuizAttemptDraft,
  quizAttemptStorageKey,
  saveQuizAttemptDraft,
  type QuizAttemptDraft,
} from '../src/features/quiz-player/quizAttemptDraft';

const draft: QuizAttemptDraft = {
  version: 1,
  quizId: 'quiz-1',
  studentName: 'Nguyễn Văn An',
  studentClass: '5A1',
  answers: { q1: 'B' },
  questionOrder: ['q2', 'q1'],
  currentPage: 2,
  startedAt: '2026-08-04T05:00:00.000Z',
  expiresAt: '2026-08-04T05:30:00.000Z',
};

describe('quizAttemptDraft', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('round-trips a valid attempt draft', () => {
    saveQuizAttemptDraft(draft);
    expect(loadQuizAttemptDraft('quiz-1')).toEqual(draft);
  });

  it('ignores malformed, wrong-version and wrong-quiz values', () => {
    const key = quizAttemptStorageKey('quiz-1');
    window.sessionStorage.setItem(key, '{bad json');
    expect(loadQuizAttemptDraft('quiz-1')).toBeNull();

    window.sessionStorage.setItem(key, JSON.stringify({ ...draft, version: 2 }));
    expect(loadQuizAttemptDraft('quiz-1')).toBeNull();

    window.sessionStorage.setItem(key, JSON.stringify({ ...draft, quizId: 'quiz-2' }));
    expect(loadQuizAttemptDraft('quiz-1')).toBeNull();
  });

  it('clears the active attempt', () => {
    saveQuizAttemptDraft(draft);
    clearQuizAttemptDraft('quiz-1');
    expect(loadQuizAttemptDraft('quiz-1')).toBeNull();
  });
});
