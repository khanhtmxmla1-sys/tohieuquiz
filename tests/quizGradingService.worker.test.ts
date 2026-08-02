import { describe, expect, it } from 'vitest';
import {
  QuizGradingServiceError,
  buildAuthoritativeStoredAnswers,
  buildStoredResultReviewDetails,
  gradeQuizSubmission,
} from '../workers/src/services/quizGradingService';

class Statement {
  bindings: unknown[] = [];
  constructor(private readonly rows: unknown[]) {}
  bind(...values: unknown[]) { this.bindings = values; return this; }
  async all<T>() { return { results: this.rows as T[] }; }
}

class Database {
  constructor(readonly rows: unknown[]) {}
  prepare() { return new Statement(this.rows); }
}

const rows = [
  {
    id: 'drop', type: 'DROPDOWN', question: 'Chọn', options: '', correct_answer: '', items: '',
    text_field: '[blank_0]', blanks: JSON.stringify([{ id: 'blank_0', options: ['x', 'y'], correctAnswer: 'x' }]),
    distractors: '', sentence: '', words: '', correct_word_indexes: '', image: '', difficulty: 1,
    answer_schema_version: 1,
  },
  {
    id: 'match', type: 'MATCHING', question: 'Nối', options: '', correct_answer: '',
    items: JSON.stringify([{ left: 'A', right: '1' }, { left: 'B', right: '2' }]),
    text_field: '', blanks: '', distractors: '', sentence: '', words: '', correct_word_indexes: '', image: '', difficulty: 1,
    answer_schema_version: 1,
  },
];

describe('Worker quiz grading service', () => {
  it('grades D1 rows through the canonical engine', async () => {
    const result = await gradeQuizSubmission(new Database(rows) as any, 'quiz-a', {
      drop: { 0: 'x', isCorrect: false },
      match: { 'l-0': 'r-0', 'l-1': 'r-1', isCorrect: false },
    });

    expect(result).toMatchObject({
      gradingVersion: '2.0.0',
      answerSchemaVersion: 2,
      score: 10,
      correctCount: 2,
      totalQuestions: 2,
    });
    expect(result.details).toEqual([
      expect.objectContaining({ questionId: 'drop', isCorrect: true }),
      expect.objectContaining({ questionId: 'match', isCorrect: true }),
    ]);
    expect(result.details[0]).not.toHaveProperty('correctAnswer');
  });

  it('creates server-owned result answers and strips correct fields from snapshots', async () => {
    const result = await gradeQuizSubmission(new Database(rows) as any, 'quiz-a', {
      drop: { selectedAnswer: { 0: 'y' }, isCorrect: true, questionSnapshot: { correctAnswer: 'y' } },
      match: { selectedAnswer: { 'l-0': 'r-0', 'l-1': 'r-1' }, isCorrect: false },
    });

    const stored = buildAuthoritativeStoredAnswers(result.questions, {
      drop: { selectedAnswer: { 0: 'y' }, isCorrect: true, questionSnapshot: { correctAnswer: 'y' } },
      match: { selectedAnswer: { 'l-0': 'r-0', 'l-1': 'r-1' }, isCorrect: false },
    }, result.details);

    expect(stored.drop).toMatchObject({ selectedAnswer: { 0: 'y' }, isCorrect: false });
    expect(stored.match).toMatchObject({ isCorrect: true });
    expect(JSON.stringify(stored)).not.toContain('correctAnswer');
    expect(JSON.stringify(stored)).not.toContain('correct_answer');
    expect(JSON.stringify(stored)).not.toContain('isCorrect":false,"questionSnapshot":{"correctAnswer');
  });

  it('stores skipped metadata-only wrappers as a null selected answer', async () => {
    const grading = await gradeQuizSubmission(new Database(rows) as any, 'quiz-a', {
      drop: {
        isCorrect: false,
        status: 'skipped',
        gradingVersion: '2.0.0',
        questionSnapshot: { id: 'drop', type: 'DROPDOWN' },
      },
    });

    const stored = buildAuthoritativeStoredAnswers(grading.questions, {
      drop: {
        isCorrect: false,
        status: 'skipped',
        gradingVersion: '2.0.0',
        questionSnapshot: { id: 'drop', type: 'DROPDOWN' },
      },
    }, grading.details);

    expect(stored.drop).toMatchObject({
      selectedAnswer: null,
      isCorrect: false,
      status: 'skipped',
      gradingVersion: '2.0.0',
    });
  });

  it('infers skipped and wrong statuses for legacy stored results without a status field', () => {
    const review = buildStoredResultReviewDetails([
      { id: 'drop', type: 'DROPDOWN', text: '[1]', blanks: [{ id: 'blank-0', options: ['x', 'y'], correctAnswer: 'x' }] },
      { id: 'match', type: 'MATCHING', pairs: [{ left: 'a', right: '1' }] },
    ], {
      drop: {
        selectedAnswer: {
          isCorrect: false,
          gradingVersion: '2.0.0',
          questionSnapshot: { id: 'drop' },
        },
        isCorrect: false,
      },
      match: {
        selectedAnswer: { 'left-0': 'right-0' },
        isCorrect: false,
      },
    });

    expect(review[0]).toMatchObject({ questionId: 'drop', status: 'skipped', isCorrect: false });
    expect(review[1]).toMatchObject({ questionId: 'match', status: 'wrong', isCorrect: false });
  });
  it('rejects a quiz with no questions', async () => {
    await expect(gradeQuizSubmission(new Database([]) as any, 'missing', {}))
      .rejects.toMatchObject<Partial<QuizGradingServiceError>>({ status: 404, code: 'QUIZ_QUESTIONS_NOT_FOUND' });
  });

  it('rejects invalid question contracts instead of silently scoring zero', async () => {
    const invalid = [{ ...rows[0], type: 'GEOMETRY', id: 'geometry' }];
    await expect(gradeQuizSubmission(new Database(invalid) as any, 'quiz-a', { geometry: '42' }))
      .rejects.toMatchObject<Partial<QuizGradingServiceError>>({ status: 422, code: 'INVALID_QUESTION_CONTRACT' });
  });
});
