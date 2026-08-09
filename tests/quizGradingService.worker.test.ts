import { describe, expect, it, vi } from 'vitest';
import { plainTextToRichText } from '../shared/question-rich-text.contract';
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
  lastPreparedSql = '';
  constructor(readonly rows: unknown[]) {}
  prepare(sql: string) {
    this.lastPreparedSql = sql;
    return new Statement(this.rows);
  }
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

  it('selects and preserves validated rich presentation in authoritative result snapshots', async () => {
    const rich = plainTextToRichText('Rich historical prompt');
    const db = new Database([{
      id: 'rich', type: 'MCQ', question: 'Rich historical prompt', question_rich_text: JSON.stringify(rich),
      options: 'A|B', correct_answer: 'A', items: '', text_field: '', blanks: '', distractors: '',
      sentence: '', words: '', correct_word_indexes: '', image: '', difficulty: 1, answer_schema_version: 1,
    }]);
    const grading = await gradeQuizSubmission(db as any, 'quiz-rich', { rich: 'A' });
    expect(db.lastPreparedSql).toContain('question_rich_text');
    const stored = buildAuthoritativeStoredAnswers(grading.questions, { rich: 'A' }, grading.details);
    const snapshot = (stored.rich as any).questionSnapshot;

    expect(snapshot.questionRichText).toEqual(rich);
    expect(JSON.stringify(snapshot)).not.toMatch(
      /correctAnswer|correctAnswers|correctOrder|correctWordIndexes|correctWord|categoryId|question_rich_text/,
    );
  });

  it('falls back to a plain snapshot when stored rich presentation is invalid', async () => {
    const grading = await gradeQuizSubmission(new Database([{
      id: 'bad-rich', type: 'MCQ', question: 'Plain historical prompt', question_rich_text: '{bad json',
      options: 'A|B', correct_answer: 'A', items: '', text_field: '', blanks: '', distractors: '',
      sentence: '', words: '', correct_word_indexes: '', image: '', difficulty: 1, answer_schema_version: 1,
    }]) as any, 'quiz-bad-rich', { 'bad-rich': 'A' });
    const stored = buildAuthoritativeStoredAnswers(grading.questions, { 'bad-rich': 'A' }, grading.details);
    const snapshot = (stored['bad-rich'] as any).questionSnapshot;

    expect(snapshot.question).toBe('Plain historical prompt');
    expect(snapshot.questionRichText).toBeUndefined();
  });

  it('keeps rich snapshots while the final serialized answers candidate stays within budget', () => {
    const rich = plainTextToRichText('x'.repeat(10_000));
    const questions = [{ id: 'within', type: 'MCQ', question: 'Plain', questionRichText: rich }];
    const details = [{ questionId: 'within', isCorrect: true, status: 'correct' }] as any;
    const stored = buildAuthoritativeStoredAnswers(questions, { within: 'A' }, details);

    expect(new TextEncoder().encode(JSON.stringify(stored)).byteLength).toBeLessThanOrEqual(1_500_000);
    expect((stored.within as any).questionSnapshot.questionRichText).toEqual(rich);
  });

  it('degrades all rich snapshots when final answers-with-rich exceeds the 1.5 MB budget', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const rich = plainTextToRichText('x'.repeat(60_000));
    const questions = Array.from({ length: 30 }, (_, index) => ({
      id: `q-${index}`, type: 'MCQ', question: `Plain ${index}`, questionRichText: rich,
    }));
    const details = questions.map((question) => ({
      questionId: question.id, isCorrect: true, status: 'correct',
    })) as any;
    const answers = Object.fromEntries(questions.map((question) => [question.id, 'A']));
    const stored = buildAuthoritativeStoredAnswers(questions, answers, details);

    expect(Object.values(stored).every((entry: any) =>
      entry.questionSnapshot.questionRichText === undefined)).toBe(true);
    expect(Object.values(stored).every((entry: any) =>
      typeof entry.questionSnapshot.question === 'string')).toBe(true);
    expect(info).toHaveBeenCalledWith(expect.stringContaining('result_rich_snapshot_budget_exceeded'));
    expect(info).not.toHaveBeenCalledWith(expect.stringContaining('Plain 0'));
    info.mockRestore();
  });

  it('does not impose the rich budget as a new rejection path for large plain-only answers', () => {
    const largePlain = 'p'.repeat(1_550_000);
    const questions = [{ id: 'plain-large', type: 'MCQ', question: largePlain }];
    const details = [{ questionId: 'plain-large', isCorrect: true, status: 'correct' }] as any;

    expect(() => buildAuthoritativeStoredAnswers(questions, { 'plain-large': 'A' }, details)).not.toThrow();
    const stored = buildAuthoritativeStoredAnswers(questions, { 'plain-large': 'A' }, details);
    expect((stored['plain-large'] as any).questionSnapshot.question).toBe(largePlain);
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

  it('voids an invalid source question without rejecting the whole submission', async () => {
    const invalidRow = {
      id: 'broken', type: 'SHORT_ANSWER', question: 'Điền', options: '', correct_answer: '', items: '',
      text_field: '', blanks: '', distractors: '', sentence: '', words: '', correct_word_indexes: '', image: '', difficulty: 1,
      answer_schema_version: 1,
    };
    const result = await gradeQuizSubmission(new Database([...rows, invalidRow]) as any, 'quiz-a', {
      drop: { 0: 'x' },
      match: { 'l-0': 'r-0', 'l-1': 'r-1' },
      broken: 'mine',
    });

    expect(result).toMatchObject({
      questionCount: 3,
      totalQuestions: 2,
      voidedCount: 1,
      correctCount: 2,
      score: 10,
    });
    expect(result.details.find((detail) => detail.questionId === 'broken')).toMatchObject({
      status: 'voided',
      issueCode: 'MISSING_CORRECT_ANSWER',
    });

    const stored = buildAuthoritativeStoredAnswers(result.questions, { broken: 'mine' }, result.details);
    expect(stored.broken).toMatchObject({ status: 'voided', isCorrect: false });
    const review = buildStoredResultReviewDetails(result.questions, stored);
    expect(review.find((detail) => detail.questionId === 'broken')).toMatchObject({
      status: 'voided',
      studentAnswer: { lines: [{ value: 'Câu hỏi không được tính điểm do lỗi dữ liệu' }] },
    });
  });
});