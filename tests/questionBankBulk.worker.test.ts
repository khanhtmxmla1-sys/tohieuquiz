// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const repo = vi.hoisted(() => ({
  findDuplicate: vi.fn(),
  prepareInsert: vi.fn((_db: unknown, item: { id: string }) => ({ kind: 'insert', id: item.id })),
  prepareAudit: vi.fn((_db: unknown, audit: { itemId: string }) => ({ kind: 'audit', id: audit.itemId })),
}));

vi.mock('../workers/src/services/questionBankRepository', async () => {
  const actual = await vi.importActual<typeof import('../workers/src/services/questionBankRepository')>(
    '../workers/src/services/questionBankRepository',
  );
  return {
    ...actual,
    findQuestionBankDuplicate: repo.findDuplicate,
    prepareInsertQuestionBankItem: repo.prepareInsert,
    prepareQuestionBankAudit: repo.prepareAudit,
  };
});

import { bulkImportSystemItems } from '../workers/src/services/questionBankService';

class BatchDatabase {
  batches: unknown[][] = [];
  async batch(statements: unknown[]) {
    this.batches.push(statements);
    return statements.map(() => ({ success: true }));
  }
}

const admin = { username: 'admin', role: 'admin' as const };
const teacher = { username: 'teacher-a', role: 'teacher' as const };
const validQuestion = (id: string, question = `${id}: 2 + 2 bằng bao nhiêu?`) => ({
  questionData: {
    id,
    type: 'MCQ',
    question,
    options: ['3', '4'],
    correctAnswer: 'B',
    difficulty: 1,
    explanation: '2 + 2 = 4.',
  },
  metadata: {
    grade: 5,
    subject: 'MATH',
    semester: 1,
    topicCode: 'M5-S1-T01',
    lessonCode: 'M5-S1-L01',
    source: 'CURATED_ORIGINAL',
    tags: ['Toán'],
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  repo.findDuplicate.mockResolvedValue(null);
});

describe('question-bank bulk import', () => {
  it('allows only admin and enforces the 100-item limit', async () => {
    const db = new BatchDatabase();
    await expect(bulkImportSystemItems(db as unknown as D1Database, teacher, [validQuestion('q-1')]))
      .rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 });
    await expect(bulkImportSystemItems(
      db as unknown as D1Database,
      admin,
      Array.from({ length: 101 }, (_, index) => validQuestion(`q-${index}`)),
    )).rejects.toMatchObject({ code: 'IMPORT_LIMIT_EXCEEDED', status: 413 });
  });

  it('returns CREATED, DUPLICATE and INVALID independently', async () => {
    const db = new BatchDatabase();
    repo.findDuplicate
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('existing-question');

    const result = await bulkImportSystemItems(db as unknown as D1Database, admin, [
      validQuestion('q-created'),
      validQuestion('q-duplicate', 'Câu trùng trong D1'),
      { questionData: { id: 'bad', type: 'MCQ', question: '', options: ['1'], correctAnswer: 'Z' } },
    ]);

    expect(result.summary).toEqual({ received: 3, created: 1, duplicates: 1, invalid: 1 });
    expect(result.results[0]).toMatchObject({ index: 0, status: 'CREATED' });
    expect(result.results[1]).toEqual({ index: 1, status: 'DUPLICATE', existingId: 'existing-question' });
    expect(result.results[2]).toMatchObject({ index: 2, status: 'INVALID' });
    expect(db.batches).toHaveLength(1);
    expect(db.batches[0]).toHaveLength(2);
  });

  it('writes valid records in chunks of 25 items with matching audits', async () => {
    const db = new BatchDatabase();
    const result = await bulkImportSystemItems(
      db as unknown as D1Database,
      admin,
      Array.from({ length: 30 }, (_, index) => validQuestion(`q-${index}`)),
    );

    expect(result.summary.created).toBe(30);
    expect(db.batches).toHaveLength(2);
    expect(db.batches[0]).toHaveLength(50);
    expect(db.batches[1]).toHaveLength(10);
    expect(repo.prepareAudit).toHaveBeenCalledTimes(30);
  });
});
