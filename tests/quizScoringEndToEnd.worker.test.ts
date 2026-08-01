import { describe, expect, it } from 'vitest';
import { calculateStudentScore } from '../src/features/quiz-player/utils/quizScoring';
import {
  buildAuthoritativeStoredAnswers,
  gradeQuizSubmission,
} from '../workers/src/services/quizGradingService';

class Statement {
  constructor(private readonly rows: unknown[]) {}
  bind() { return this; }
  async all<T>() { return { results: this.rows as T[] }; }
}

class Database {
  constructor(private readonly rows: unknown[]) {}
  prepare() { return new Statement(this.rows); }
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
  answer_schema_version: 2,
  ...overrides,
});

const rows = [
  row('mcq', 'MCQ', { options: '2|4|6', correct_answer: 'option-1' }),
  row('image', 'IMAGE_QUESTION', { options: 'tròn|vuông', correct_answer: 'option-0', image: '/shape.png' }),
  row('multi', 'MULTIPLE_SELECT', { options: '1|2|3|4', correct_answer: JSON.stringify(['option-1', 'option-3']) }),
  row('short', 'SHORT_ANSWER', { correct_answer: 'Hà Nội|Ha Noi' }),
  row('tf', 'TRUE_FALSE', { items: JSON.stringify([{ id: 't1', statement: 'A', isCorrect: true }, { id: 't2', statement: 'B', isCorrect: false }]) }),
  row('matching', 'MATCHING', { items: JSON.stringify([{ left: 'A', right: '1' }, { left: 'B', right: '2' }]) }),
  row('drag', 'DRAG_DROP', {
    text_field: '[1] và [2]',
    blanks: JSON.stringify([{ id: 'drag-a', correctAnswer: 'xanh' }, { id: 'drag-b', correctAnswer: 'đỏ' }]),
    distractors: JSON.stringify(['vàng']),
  }),
  row('dropdown', 'DROPDOWN', {
    text_field: '[1]',
    blanks: JSON.stringify([{ id: 'drop-a', options: ['x', 'y'], correctAnswer: 'x' }]),
  }),
  row('ordering', 'ORDERING', { items: JSON.stringify(['B', 'A']), correct_answer: JSON.stringify([1, 0]) }),
  row('category', 'CATEGORIZATION', {
    items: JSON.stringify([{ id: '2', content: '2', categoryId: 'even' }, { id: '3', content: '3', categoryId: 'odd' }]),
    distractors: JSON.stringify([{ id: 'even', name: 'Chẵn' }, { id: 'odd', name: 'Lẻ' }]),
  }),
  row('underline', 'UNDERLINE', { words: JSON.stringify(['Em', 'học', 'bài']), correct_word_indexes: JSON.stringify([1, 2]) }),
  row('scramble', 'WORD_SCRAMBLE', { items: JSON.stringify(['O', 'H', 'A']), correct_answer: 'HOA' }),
  row('riddle', 'RIDDLE', { items: JSON.stringify(['Hoa gì nở mùa hè?']), correct_answer: 'hoa phượng' }),
  row('error', 'ERROR_CORRECTION', { text_field: 'Bạn nhỏ rất ngoãn.', distractors: 'ngoãn', correct_answer: 'ngoan' }),
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

describe('canonical scoring end-to-end matrix', () => {
  it('gives one authoritative result across D1 mapping, Worker storage and frontend facade', async () => {
    const grading = await gradeQuizSubmission(new Database(rows) as any, 'quiz-14', answers);

    expect(grading).toMatchObject({
      gradingVersion: '2.0.0',
      answerSchemaVersion: 2,
      score: 10,
      correctCount: 14,
      totalQuestions: 14,
    });
    expect(grading.details).toHaveLength(14);
    expect(grading.details.every((detail) => detail.status === 'correct' && detail.isCorrect)).toBe(true);

    const stored = buildAuthoritativeStoredAnswers(grading.questions, answers, grading.details);
    expect(Object.keys(stored)).toHaveLength(14);
    expect(Object.values(stored).every((answer: any) => answer.isCorrect === true)).toBe(true);
    const serializedSnapshots = JSON.stringify(
      Object.values(stored).map((answer: any) => answer.questionSnapshot),
    );
    expect(serializedSnapshots).not.toMatch(/correctAnswer|correctAnswers|correctOrder|correctWordIndexes|correctWord|categoryId/);

    const facade = calculateStudentScore({ questions: grading.questions } as any, answers);
    expect(facade).toMatchObject({ score: 10, correctCount: 14, totalItems: 14 });
    expect(facade.details.every((detail) => detail.isCorrect)).toBe(true);
  });
});
