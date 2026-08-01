import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JWTPayload } from '../workers/src/utils/jwt';

let currentUser: JWTPayload | null = null;
vi.mock('../workers/src/middleware/jwtAuth', () => ({
  verifyJWTMiddleware: vi.fn(async () => currentUser
    ? { user: currentUser }
    : new Response(JSON.stringify({ status: 'error' }), { status: 401 })),
  requireAdmin: vi.fn((user: JWTPayload) => user.role === 'admin'),
  requireTeacher: vi.fn((user: JWTPayload) => user.role === 'teacher' || user.role === 'admin'),
}));

import { handleQuizRoutes } from '../workers/src/routes/quizzes';

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
  resultCount = 0;
  activeLiveExamCount = 0;
  openAssignmentCount = 0;
  quiz = {
    id: 'quiz-a',
    title: 'Đề Toán',
    class_level: '4',
    category: 'toan',
    time_limit: 20,
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
    created_by: 'teacher-a',
    access_code: '',
    require_code: 'FALSE',
    show_on_home: 'TRUE',
    tags: '[]',
    source_type: 'ai',
    parent_quiz_id: null,
    version_number: 1,
    revision: 4,
  };

  prepare(sql: string) { return new Statement(sql, this); }
  first(sql: string, bindings: unknown[]) {
    if (sql.includes('FROM teachers t')) {
      return { username: 'teacher-a', full_name: 'Cô A', full_name_count: 1 };
    }
    if (sql.includes('SELECT created_by FROM quizzes')) return { created_by: 'teacher-a' };
    if (sql.includes('SELECT * FROM quizzes WHERE id')) return bindings[0] === 'quiz-a' ? this.quiz : null;
    if (sql.includes('FROM results WHERE quiz_id')) return { count: this.resultCount };
    if (sql.includes('FROM live_exam_sessions WHERE quiz_id')) return { count: this.activeLiveExamCount };
    if (sql.includes('FROM assignments WHERE quiz_id')) return { count: this.openAssignmentCount };
    if (sql.includes('MAX(version_number)')) return { max_version: 1 };
    if (sql.includes('COUNT(*) as cnt')) return { cnt: 1 };
    return null;
  }
  all(sql: string) {
    if (!sql.includes('FROM questions')) return [];
    return [{
      id: 'q-1', quiz_id: 'quiz-a', type: 'MCQ', question: '1 + 1 = ?',
      options: '1|2', correct_answer: 'B', items: '', text_field: '', blanks: '',
      distractors: '', sentence: '', words: '', correct_word_indexes: '', image: '',
      tags: '', subject: 'toan', skill_code: '', subskill_code: '', difficulty: 1,
      math_format_version: 2, points: 1, explanation: '', image_alt: '',
    }];
  }
  async batch(statements: Statement[]) {
    this.executed.push(...statements);
    return statements.map(() => ({ success: true }));
  }
}

const env = (db: Database) => ({ DB: db, JWT_SECRET: 'test-secret' } as any);
const request = (path: string, method = 'GET', body?: unknown) => new Request(`https://test${path}`, {
  method,
  headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
});

beforeEach(() => {
  currentUser = { username: 'teacher-a', role: 'teacher' };
});

describe('unified quiz editor access contract', () => {
  it('returns editor metadata, questions and editability in one response', async () => {
    const db = new Database();
    db.openAssignmentCount = 2;

    const response = await handleQuizRoutes(
      request('/api/quizzes/quiz-a/editor'), env(db), '/api/quizzes/quiz-a/editor', 'GET',
    );
    const payload = await response.json() as any;

    expect(response.status).toBe(200);
    expect(payload.quiz).toEqual(expect.objectContaining({
      id: 'quiz-a', sourceType: 'ai', versionNumber: 1, revision: 4,
    }));
    expect(payload.questions).toHaveLength(1);
    expect(payload.editability).toEqual(expect.objectContaining({
      mode: 'EDIT', canEditStructure: true, canCreateVersion: true,
      reason: null, resultCount: 0, activeLiveExamCount: 0, openAssignmentCount: 2,
      requiresPublishedWarning: true,
    }));
  });

  it('returns readonly access when the quiz already has submissions', async () => {
    const db = new Database();
    db.resultCount = 3;

    const response = await handleQuizRoutes(
      request('/api/quizzes/quiz-a/editor'), env(db), '/api/quizzes/quiz-a/editor', 'GET',
    );
    const payload = await response.json() as any;

    expect(response.status).toBe(200);
    expect(payload.editability).toEqual(expect.objectContaining({
      mode: 'READONLY', canEditStructure: false, reason: 'HAS_SUBMISSIONS', resultCount: 3,
    }));
  });

  it('rejects structural updates after a submission without deleting existing rows', async () => {
    const db = new Database();
    db.resultCount = 1;

    const response = await handleQuizRoutes(request('/api/quizzes/quiz-a', 'PUT', {
      id: 'quiz-a', title: 'Đề đã sửa', classLevel: '4', category: 'toan', timeLimit: 20,
      createdAt: db.quiz.created_at, revision: 4, questions: [],
    }), env(db), '/api/quizzes/quiz-a', 'PUT');
    const payload = await response.json() as any;

    expect(response.status).toBe(409);
    expect(payload.code).toBe('QUIZ_HAS_SUBMISSIONS');
    expect(db.executed.some(statement => statement.sql.startsWith('DELETE FROM'))).toBe(false);
  });

  it('rejects structural updates while a live exam is active', async () => {
    const db = new Database();
    db.activeLiveExamCount = 1;

    const response = await handleQuizRoutes(request('/api/quizzes/quiz-a', 'PUT', {
      id: 'quiz-a', title: 'Đề đã sửa', classLevel: '4', category: 'toan', timeLimit: 20,
      createdAt: db.quiz.created_at, revision: 4, questions: [],
    }), env(db), '/api/quizzes/quiz-a', 'PUT');
    const payload = await response.json() as any;

    expect(response.status).toBe(409);
    expect(payload.code).toBe('QUIZ_LIVE_EXAM_ACTIVE');
  });

  it('rejects stale revisions instead of silently overwriting a newer edit', async () => {
    const db = new Database();

    const response = await handleQuizRoutes(request('/api/quizzes/quiz-a', 'PUT', {
      id: 'quiz-a', title: 'Đề cũ', classLevel: '4', category: 'toan', timeLimit: 20,
      createdAt: db.quiz.created_at, revision: 3, questions: [],
    }), env(db), '/api/quizzes/quiz-a', 'PUT');
    const payload = await response.json() as any;

    expect(response.status).toBe(409);
    expect(payload.code).toBe('QUIZ_REVISION_CONFLICT');
    expect(payload.currentRevision).toBe(4);
  });

  it('creates an editable version without copying attempts or assignments', async () => {
    const db = new Database();
    db.resultCount = 4;

    const response = await handleQuizRoutes(
      request('/api/quizzes/quiz-a/versions', 'POST', { title: 'Đề Toán - bản chỉnh sửa' }),
      env(db), '/api/quizzes/quiz-a/versions', 'POST',
    );
    const payload = await response.json() as any;

    expect(response.status).toBe(200);
    expect(payload.status).toBe('success');
    expect(payload.data).toEqual(expect.objectContaining({
      title: 'Đề Toán - bản chỉnh sửa', parentQuizId: 'quiz-a', versionNumber: 2, revision: 1,
    }));
    const quizInsert = db.executed.find(statement => statement.sql.includes('INSERT INTO quizzes'));
    expect(quizInsert?.sql).toContain('parent_quiz_id');
    expect(db.executed.some(statement => statement.sql.includes('INSERT INTO results'))).toBe(false);
    expect(db.executed.some(statement => statement.sql.includes('INSERT INTO assignments'))).toBe(false);
  });
});
