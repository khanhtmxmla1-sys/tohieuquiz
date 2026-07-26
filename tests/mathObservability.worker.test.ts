import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JWTPayload } from '../workers/src/utils/jwt';

let currentUser: JWTPayload | null = null;
vi.mock('../workers/src/middleware/jwtAuth', () => ({
  verifyJWTMiddleware: vi.fn(async () => currentUser
    ? { user: currentUser }
    : new Response(JSON.stringify({ status: 'error' }), { status: 401 })),
  requireAdmin: vi.fn((user: JWTPayload) => user.role === 'admin'),
}));

import { mapQuestionForSave } from '../workers/src/utils/helpers';
import { QuestionMathValidationError } from '../workers/src/services/questionMath';
import {
  handleMathObservabilityRoutes,
  sanitizeMathTelemetryPayload,
} from '../workers/src/routes/mathObservability';

class Statement {
  bindings: unknown[] = [];
  constructor(readonly sql: string, readonly db: Database) {}
  bind(...values: unknown[]) { this.bindings = values; return this; }
  async first<T>() { this.db.executed.push(this); return this.db.first(this.sql, this.bindings) as T; }
  async all<T>() { this.db.executed.push(this); return { results: this.db.all(this.sql, this.bindings) as T[] }; }
  async run() { this.db.executed.push(this); return { success: true, meta: { changes: 1 } }; }
}

class Database {
  executed: Statement[] = [];
  row: any = {
    id: 'q-1', quiz_id: 'quiz-1', quiz_title: 'Đề toán', type: 'MCQ',
    question: '$\\frac{1}{2}$ = \\frac{2}{4}$',
    options: '$\\frac{1}{2}$|$\\frac{2}{3}$', correct_answer: 'A',
    items: '', text_field: '', blanks: '', distractors: '', sentence: '', words: '',
    correct_word_indexes: '', image: '', tags: '', subject: '', skill_code: '',
    subskill_code: '', difficulty: 1, math_format_version: 1,
  };
  prepare(sql: string) { return new Statement(sql, this); }
  first(sql: string, bindings: unknown[]) {
    if (sql.includes('SELECT * FROM questions WHERE id')) {
      return bindings[0] === this.row.id ? { ...this.row } : null;
    }
    return null;
  }
  all(sql: string) {
    if (sql.includes('FROM questions q')) return [{ ...this.row }];
    if (sql.includes('FROM question_math_repairs')) return [];
    if (sql.includes('FROM math_render_events')) return [];
    return [];
  }
  async batch(statements: Statement[]) {
    this.executed.push(...statements);
    return statements.map(() => ({ success: true }));
  }
}

const env = (db: Database) => ({ DB: db, JWT_SECRET: 'test' } as any);
const request = (url: string, body?: unknown) => new Request(url, {
  method: body === undefined ? 'GET' : 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test' },
  body: body === undefined ? undefined : JSON.stringify(body),
});

describe('server-owned math normalization and observability', () => {
  beforeEach(() => { currentUser = null; });

  it('normalizes incoming question fields and writes the current format version', () => {
    const values = mapQuestionForSave({
      id: 'q-1',
      type: 'MCQ',
      question: 'So sánh $\\frac{1}{2}$ và \\frac{2}{4}$',
      options: ['\\frac{1}{2}', '$\\frac{2}{3}$'],
      correctAnswer: 'A',
      imageAlt: 'Hai phân số cần so sánh',
    } as any, 'quiz-1');

    expect(values).toHaveLength(23);
    expect(values[3]).toBe('So sánh $\\frac{1}{2}$ và $\\frac{2}{4}$');
    expect(values[4]).toBe('$\\frac{1}{2}$|$\\frac{2}{3}$');
    expect(values[19]).toBe('2');
    expect(values[20]).toBe('');
    expect(values[21]).toBe('');
    expect(values[22]).toBe('Hai phân số cần so sánh');
  });

  it('rejects malformed TeX before returning D1 bindings', () => {
    expect(() => mapQuestionForSave({
      id: 'q-bad', type: 'MCQ', question: 'Tính $\\frac{1}{2', options: [],
    } as any, 'quiz-1')).toThrow(QuestionMathValidationError);
  });

  it('drops formula text, messages, stack traces, and unknown fields from telemetry', () => {
    const sanitized = sanitizeMathTelemetryPayload({
      quizId: 'quiz-1', questionId: 'q-1', questionType: 'mcq',
      errorCode: 'mathjax_merror', route: '/quiz?student=secret', mathFormatVersion: 2,
      formula: '$\\frac{secret}{data}$', message: 'student answer', stack: 'private stack',
    });

    expect(sanitized).toEqual({
      quizId: 'quiz-1', questionId: 'q-1', questionType: 'MCQ',
      errorCode: 'MATHJAX_MERROR', route: '/quiz', mathFormatVersion: 2,
    });
    expect(sanitized).not.toHaveProperty('formula');
    expect(sanitized).not.toHaveProperty('message');
    expect(sanitized).not.toHaveProperty('stack');
  });

  it('stores only privacy-safe telemetry bindings', async () => {
    const db = new Database();
    const response = await handleMathObservabilityRoutes(request('https://test/api/math/telemetry', {
      quizId: 'quiz-1', questionId: 'q-1', questionType: 'MCQ',
      errorCode: 'MATHJAX_MERROR', route: '/quiz?student=secret', mathFormatVersion: 2,
      formula: '$\\frac{private}{answer}$', message: 'private message',
    }), env(db), '/api/math/telemetry', 'POST');

    expect(response?.status).toBe(202);
    const flattened = JSON.stringify(db.executed.flatMap((statement) => statement.bindings));
    expect(flattened).not.toContain('private');
    expect(flattened).not.toContain('secret');
    expect(flattened).toContain('MATHJAX_MERROR');
  });

  it('lists auto-fixable legacy questions only for admins', async () => {
    currentUser = { username: 'admin', role: 'admin' } as JWTPayload;
    const db = new Database();
    const response = await handleMathObservabilityRoutes(
      request('https://test/api/admin/math-audit/issues'),
      env(db),
      '/api/admin/math-audit/issues',
      'GET',
    );
    const payload = await response?.json() as any;

    expect(response?.status).toBe(200);
    expect(payload.summary.scanned).toBe(1);
    expect(payload.summary.affected).toBe(1);
    expect(payload.data[0].questionId).toBe('q-1');
    expect(payload.data[0].previewAfter).toContain('$\\frac{2}{4}$');
  });

  it('keeps the monitoring dashboard read-only even for administrators', async () => {
    currentUser = { username: 'admin', role: 'admin' } as JWTPayload;
    const db = new Database();
    const response = await handleMathObservabilityRoutes(
      request('https://test/api/admin/math-audit/apply', { questionIds: ['q-1'] }),
      env(db),
      '/api/admin/math-audit/apply',
      'POST',
    );
    const payload = await response?.json() as any;

    expect(response?.status).toBe(410);
    expect(payload.code).toBe('MATH_REPAIR_DISABLED');
    expect(db.executed).toHaveLength(0);
  });

  it('does not classify a clean version-one question as a syntax warning', async () => {
    currentUser = { username: 'admin', role: 'admin' } as JWTPayload;
    const db = new Database();
    db.row = {
      ...db.row,
      question: 'Một câu hỏi không có công thức lỗi.',
      options: 'A|B|C|D',
      math_format_version: 1,
    };

    const response = await handleMathObservabilityRoutes(
      request('https://test/api/admin/math-audit/issues'),
      env(db),
      '/api/admin/math-audit/issues',
      'GET',
    );
    const payload = await response?.json() as any;

    expect(response?.status).toBe(200);
    expect(payload.summary.scanned).toBe(1);
    expect(payload.summary.affected).toBe(0);
    expect(payload.data).toEqual([]);
  });
});
