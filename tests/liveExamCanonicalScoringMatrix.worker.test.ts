import { describe, expect, it } from 'vitest';
import { submitAnswers } from '../workers/src/services/liveExam/submissionService';

class Statement {
  bindings: unknown[] = [];

  constructor(
    readonly sql: string,
    private readonly db: Database,
  ) {}

  bind(...values: unknown[]) {
    this.bindings = values;
    return this;
  }

  async first<T>() {
    return this.db.first(this.sql) as T | null;
  }

  async all<T>() {
    return { results: this.db.all(this.sql) as T[] };
  }

  async run() {
    this.db.executed.push(this);
    return { success: true, meta: { changes: 1 } };
  }
}

const row = (id: string, type: string, overrides: Record<string, unknown> = {}) => ({
  id,
  type,
  question: id,
  options: '',
  correct_answer: '',
  items: '',
  text_field: '',
  blanks: '',
  distractors: '',
  sentence: '',
  words: '',
  correct_word_indexes: '',
  image: '',
  difficulty: 1,
  ...overrides,
});

const questions = [
  row('mcq', 'MCQ', { options: '2|4|6', correct_answer: 'B' }),
  row('image', 'IMAGE_QUESTION', { options: 'tròn|vuông', correct_answer: 'A', image: '/shape.png' }),
  row('multi', 'MULTIPLE_SELECT', { options: '1|2|3|4', correct_answer: JSON.stringify(['B', 'D']) }),
  row('short', 'SHORT_ANSWER', { correct_answer: 'Hà Nội|Ha Noi' }),
  row('tf', 'TRUE_FALSE', {
    items: JSON.stringify([
      { id: 't1', statement: 'A', isCorrect: true },
      { id: 't2', statement: 'B', isCorrect: false },
    ]),
  }),
  row('matching', 'MATCHING', {
    items: JSON.stringify([
      { left: 'A', right: '1' },
      { left: 'B', right: '2' },
    ]),
  }),
  row('drag', 'DRAG_DROP', {
    text_field: '[1] và [2]',
    blanks: JSON.stringify([
      { id: 'drag-a', correctAnswer: 'xanh' },
      { id: 'drag-b', correctAnswer: 'đỏ' },
    ]),
    distractors: JSON.stringify(['vàng']),
  }),
  row('dropdown', 'DROPDOWN', {
    text_field: '[1]',
    blanks: JSON.stringify([
      { id: 'drop-a', options: ['x', 'y'], correctAnswer: 'x' },
    ]),
  }),
  row('ordering', 'ORDERING', {
    items: JSON.stringify(['B', 'A']),
    correct_answer: JSON.stringify([1, 0]),
  }),
  row('category', 'CATEGORIZATION', {
    items: JSON.stringify([
      { id: '2', content: '2', categoryId: 'even' },
      { id: '3', content: '3', categoryId: 'odd' },
    ]),
    distractors: JSON.stringify([
      { id: 'even', name: 'Chẵn' },
      { id: 'odd', name: 'Lẻ' },
    ]),
  }),
  row('underline', 'UNDERLINE', {
    words: JSON.stringify(['Em', 'học', 'bài']),
    correct_word_indexes: JSON.stringify([1, 2]),
  }),
  row('scramble', 'WORD_SCRAMBLE', {
    items: JSON.stringify(['O', 'H', 'A']),
    correct_answer: 'HOA',
  }),
  row('riddle', 'RIDDLE', {
    items: JSON.stringify(['Hoa gì nở mùa hè?']),
    correct_answer: 'hoa phượng',
  }),
  row('error', 'ERROR_CORRECTION', {
    text_field: 'Bạn nhỏ rất ngoãn.',
    distractors: 'ngoãn',
    correct_answer: 'ngoan',
  }),
];

const answers = {
  mcq: { type: 'MCQ', optionId: 'option-1' },
  image: { type: 'IMAGE_QUESTION', optionId: 'option-0' },
  multi: { type: 'MULTIPLE_SELECT', optionIds: ['option-3', 'option-1'] },
  short: { type: 'SHORT_ANSWER', value: ' HÀ NỘI ' },
  tf: { type: 'TRUE_FALSE', values: { t1: true, t2: false } },
  matching: { type: 'MATCHING', pairs: { 'left-0': 'right-0', 'left-1': 'right-1' } },
  drag: { type: 'DRAG_DROP', values: { 'drag-a': 'xanh', 'drag-b': 'đỏ' } },
  dropdown: { type: 'DROPDOWN', values: { 'drop-a': 'x' } },
  ordering: { type: 'ORDERING', ranks: { 'item-0': 2, 'item-1': 1 } },
  category: { type: 'CATEGORIZATION', categoriesByItemId: { '2': 'even', '3': 'odd' } },
  underline: { type: 'UNDERLINE', indexes: [2, 1] },
  scramble: { type: 'WORD_SCRAMBLE', letterIndexes: [1, 0, 2] },
  riddle: { type: 'RIDDLE', value: 'Hoa Phượng' },
  error: { type: 'ERROR_CORRECTION', wrongWord: 'NGOÃN', correctWord: 'Ngoan' },
};

class Database {
  executed: Statement[] = [];

  prepare(sql: string) {
    return new Statement(sql, this);
  }

  first(sql: string) {
    if (sql.includes('FROM live_exam_sessions s')) {
      return {
        id: 'live-14',
        title: 'Ma trận 14 dạng',
        quiz_id: 'quiz-14',
        quiz_title: 'Ma trận 14 dạng',
        teacher_id: 'teacher-a',
        class_id: 'class-a',
        class_name: '4A',
        duration: 30,
        scheduled_at: null,
        started_at: '2026-08-02T00:00:00.000Z',
        ends_at: '2099-08-02T00:30:00.000Z',
        closed_at: null,
        settings: '{}',
        status: 'active',
        access_code: 'ABC123',
        chat_enabled: 1,
        archived_at: null,
        created_at: '2026-08-02T00:00:00.000Z',
        updated_at: '2026-08-02T00:00:00.000Z',
      };
    }
    if (sql.includes('SELECT id, submitted_at, individual_ends_at')) {
      return { id: 'participant-14', submitted_at: null, individual_ends_at: null };
    }
    if (sql.includes('SELECT id, title, class_level')) {
      return {
        id: 'quiz-14',
        title: 'Ma trận 14 dạng',
        class_level: '4',
        time_limit: 30,
        created_at: '2026-08-02T00:00:00.000Z',
        created_by: 'teacher-a',
      };
    }
    return null;
  }

  all(sql: string) {
    return sql.includes('FROM questions') ? questions : [];
  }
}

describe('live exam canonical scoring matrix', () => {
  it('grades all 14 published question types through the live submission service', async () => {
    const db = new Database();

    const result = await submitAnswers(db as any, {
      liveExamId: 'live-14',
      studentId: 'student-14',
      answers,
    });

    expect(result).toMatchObject({ score: 10, correctCount: 14, wrongCount: 0 });

    const update = db.executed.find((statement) => (
      statement.sql.includes('UPDATE live_exam_participants')
      && statement.sql.includes('submitted_at IS NULL')
    ));
    expect(update).toBeDefined();
    expect(update?.bindings[2]).toBe(10);
    expect(update?.bindings[3]).toBe(14);
    expect(update?.bindings[4]).toBe(0);
    expect(update?.bindings[5]).toBe('2.0.0');
  });
});
