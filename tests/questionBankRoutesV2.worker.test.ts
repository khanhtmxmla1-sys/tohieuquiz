// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { QuestionBankActor } from '../workers/src/services/questionBankRepository';
import {
  getQuestionBankItem,
  listQuestionBankItems,
  parseQuestionBankListParams,
} from '../workers/src/services/questionBankRepository';

interface RecordedQuery {
  sql: string;
  bindings: unknown[];
}

class RecordingDatabase {
  queries: RecordedQuery[] = [];
  rows: Record<string, unknown>[] = [];
  total = 0;
  detail: Record<string, unknown> | null = null;

  prepare(sql: string) {
    const query: RecordedQuery = { sql, bindings: [] };
    this.queries.push(query);
    const statement = {
      bind: (...bindings: unknown[]) => {
        query.bindings = bindings;
        return statement;
      },
      first: async () => {
        if (/COUNT\(\*\)/i.test(sql)) return { total: this.total };
        return this.detail;
      },
      all: async () => ({ results: this.rows }),
      run: async () => ({ success: true }),
    };
    return statement;
  }
}

const teacher: QuestionBankActor = { username: 'teacher-a', role: 'teacher' };
const admin: QuestionBankActor = { username: 'admin', role: 'admin' };
const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'qb-1',
  scope: 'SYSTEM',
  owner_id: '',
  status: 'PUBLISHED',
  question_data: JSON.stringify({ id: 'q-1', type: 'MCQ', question: '2 + 2?', options: ['3', '4'], correctAnswer: 'B' }),
  question_text: '2 + 2?',
  question_type: 'MCQ',
  difficulty: 1,
  explanation: '2 + 2 = 4.',
  grade: 5,
  subject: 'MATH',
  semester: 1,
  topic_code: 'M5-S1-T01',
  lesson_code: 'M5-S1-L01',
  source: 'CURATED_ORIGINAL',
  tags: JSON.stringify(['Toán', 'Lớp 5']),
  content_hash: 'hash',
  created_by: 'admin',
  updated_by: 'admin',
  created_at: '2026-08-02T00:00:00.000Z',
  updated_at: '2026-08-02T00:00:00.000Z',
  published_at: '2026-08-02T00:00:00.000Z',
  archived_at: null,
  ...overrides,
});

describe('question-bank V2 repository', () => {
  it('normalizes pagination and validates numeric filters', () => {
    const params = parseQuestionBankListParams(new URL('https://test/api/test-bank?page=0&pageSize=999&grade=5&difficulty=2'), teacher);
    expect(params).toMatchObject({ page: 1, pageSize: 100, grade: 5, difficulty: 2, scope: 'SYSTEM' });

    expect(() => parseQuestionBankListParams(new URL('https://test/api/test-bank?difficulty=9'), teacher))
      .toThrow('VALIDATION_ERROR');
  });

  it('enforces published system visibility and escapes LIKE search values', async () => {
    const db = new RecordingDatabase();
    db.rows = [row()];
    db.total = 1;
    const params = parseQuestionBankListParams(
      new URL('https://test/api/test-bank?scope=SYSTEM&search=50%_\\&page=1&pageSize=30'),
      teacher,
    );

    const result = await listQuestionBankItems(db as unknown as D1Database, teacher, params);

    expect(result.items).toHaveLength(1);
    expect(result.pagination).toEqual({ page: 1, pageSize: 30, totalItems: 1, totalPages: 1 });
    const listQuery = db.queries.find((entry) => /ORDER BY/i.test(entry.sql));
    expect(listQuery?.sql).toContain("question_text LIKE ? ESCAPE '\\'");
    expect(listQuery?.bindings).toContain('SYSTEM');
    expect(listQuery?.bindings).toContain('PUBLISHED');
    expect(listQuery?.bindings).toContain('%50\\%\\_\\\\%');
  });

  it('rejects teacher access to another personal owner and builds ALL visibility safely', async () => {
    expect(() => parseQuestionBankListParams(
      new URL('https://test/api/test-bank?scope=PERSONAL&ownerId=teacher-b'),
      teacher,
    )).toThrow('FORBIDDEN');

    const db = new RecordingDatabase();
    db.rows = [row(), row({ id: 'personal-1', scope: 'PERSONAL', owner_id: 'teacher-a' })];
    db.total = 2;
    const result = await listQuestionBankItems(
      db as unknown as D1Database,
      teacher,
      parseQuestionBankListParams(new URL('https://test/api/test-bank?scope=ALL'), teacher),
    );

    expect(result.items).toHaveLength(2);
    const listQuery = db.queries.find((entry) => /ORDER BY/i.test(entry.sql));
    expect(listQuery?.sql).toContain("scope = 'SYSTEM' AND status = 'PUBLISHED'");
    expect(listQuery?.sql).toContain("scope = 'PERSONAL' AND owner_id = ?");
    expect(listQuery?.bindings).toContain('teacher-a');
  });

  it('skips malformed stored JSON without failing the full page', async () => {
    const db = new RecordingDatabase();
    db.rows = [row(), row({ id: 'bad', question_data: '{not-json' })];
    db.total = 2;

    const result = await listQuestionBankItems(
      db as unknown as D1Database,
      admin,
      parseQuestionBankListParams(new URL('https://test/api/test-bank?scope=SYSTEM'), admin),
    );

    expect(result.items.map((item) => item.id)).toEqual(['qb-1']);
    expect(result.pagination.totalItems).toBe(2);
  });

  it('applies row-level authorization to detail reads', async () => {
    const db = new RecordingDatabase();
    db.detail = row({ status: 'DRAFT' });
    await expect(getQuestionBankItem(db as unknown as D1Database, teacher, 'qb-1')).resolves.toBeNull();
    await expect(getQuestionBankItem(db as unknown as D1Database, admin, 'qb-1')).resolves.toMatchObject({ id: 'qb-1' });

    db.detail = row({ scope: 'PERSONAL', owner_id: 'teacher-b' });
    await expect(getQuestionBankItem(db as unknown as D1Database, teacher, 'qb-1')).resolves.toBeNull();
  });
});
