// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const repo = vi.hoisted(() => ({
  getStored: vi.fn(),
  findDuplicate: vi.fn(),
  prepareInsert: vi.fn(() => ({ kind: 'insert' })),
  preparePatch: vi.fn(() => ({ kind: 'patch' })),
  prepareArchive: vi.fn(() => ({ kind: 'archive' })),
  prepareDeletePersonal: vi.fn(() => ({ kind: 'delete-personal' })),
  prepareLegacyUpsert: vi.fn(() => ({ kind: 'legacy-upsert' })),
  prepareLegacyDelete: vi.fn(() => ({ kind: 'legacy-delete' })),
  prepareAudit: vi.fn(() => ({ kind: 'audit' })),
}));

vi.mock('../workers/src/services/questionBankRepository', async () => {
  const actual = await vi.importActual<typeof import('../workers/src/services/questionBankRepository')>(
    '../workers/src/services/questionBankRepository',
  );
  return {
    ...actual,
    getQuestionBankStoredItem: repo.getStored,
    findQuestionBankDuplicate: repo.findDuplicate,
    prepareInsertQuestionBankItem: repo.prepareInsert,
    preparePatchQuestionBankItem: repo.preparePatch,
    prepareArchiveQuestionBankItem: repo.prepareArchive,
    prepareDeletePersonalQuestionBankItem: repo.prepareDeletePersonal,
    prepareUpsertLegacyTestBankItem: repo.prepareLegacyUpsert,
    prepareDeleteLegacyTestBankItem: repo.prepareLegacyDelete,
    prepareQuestionBankAudit: repo.prepareAudit,
  };
});

import {
  copySystemQuestionToPersonal,
  createQuestionBankItem,
  removeQuestionBankItem,
  updateQuestionBankItem,
} from '../workers/src/services/questionBankService';

class BatchDatabase {
  batches: unknown[][] = [];
  async batch(statements: unknown[]) {
    this.batches.push(statements);
    return statements.map(() => ({ success: true }));
  }
}

const teacher = { username: 'teacher-a', role: 'teacher' as const };
const admin = { username: 'admin', role: 'admin' as const };
const question = {
  id: 'q-1',
  type: 'MCQ',
  question: '2 + 2 bằng bao nhiêu?',
  options: ['3', '4'],
  correctAnswer: 'B',
  difficulty: 1,
  explanation: '2 + 2 = 4.',
  subject: 'MATH',
};
const stored = (overrides: Record<string, unknown> = {}) => ({
  id: 'qb-1',
  scope: 'SYSTEM',
  ownerId: '',
  status: 'DRAFT',
  questionData: question,
  questionText: question.question,
  questionType: 'MCQ',
  difficulty: 1,
  explanation: question.explanation,
  metadata: {
    grade: 5,
    subject: 'MATH',
    semester: 1,
    topicCode: 'M5-S1-T01',
    lessonCode: 'M5-S1-L01',
    source: 'CURATED_ORIGINAL',
    tags: ['Toán'],
  },
  contentHash: 'hash',
  createdBy: 'admin',
  updatedBy: 'admin',
  createdAt: '2026-08-02T00:00:00.000Z',
  updatedAt: '2026-08-02T00:00:00.000Z',
  publishedAt: null,
  archivedAt: null,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  repo.findDuplicate.mockResolvedValue(null);
  repo.getStored.mockResolvedValue(null);
});

describe('question-bank service authorization and mutations', () => {
  it('rejects teacher creation of SYSTEM questions', async () => {
    const db = new BatchDatabase();
    await expect(createQuestionBankItem(db as unknown as D1Database, teacher, {
      scope: 'SYSTEM',
      questionData: question,
    })).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 });
    expect(db.batches).toEqual([]);
  });

  it('creates personal questions for the actor and mirrors them to test_bank', async () => {
    const db = new BatchDatabase();
    const item = await createQuestionBankItem(db as unknown as D1Database, teacher, {
      scope: 'PERSONAL',
      ownerId: 'teacher-b',
      questionData: question,
      metadata: { tags: ['Cá nhân'] },
    });

    expect(item).toMatchObject({ scope: 'PERSONAL', ownerId: 'teacher-a', status: 'PUBLISHED' });
    expect(repo.prepareInsert).toHaveBeenCalled();
    expect(repo.prepareLegacyUpsert).toHaveBeenCalled();
    expect(db.batches[0]).toEqual([{ kind: 'insert' }, { kind: 'legacy-upsert' }]);
  });

  it('creates SYSTEM questions atomically with an audit record', async () => {
    const db = new BatchDatabase();
    const item = await createQuestionBankItem(db as unknown as D1Database, admin, {
      scope: 'SYSTEM',
      status: 'DRAFT',
      questionData: question,
      metadata: { grade: 5, subject: 'MATH', semester: 1 },
    });

    expect(item).toMatchObject({ scope: 'SYSTEM', ownerId: '', status: 'DRAFT' });
    expect(repo.prepareAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'CREATE' }));
    expect(db.batches[0]).toEqual([{ kind: 'insert' }, { kind: 'audit' }]);
  });

  it('publishes SYSTEM questions only for admin and records PUBLISH', async () => {
    repo.getStored.mockResolvedValue(stored());
    const db = new BatchDatabase();

    await expect(updateQuestionBankItem(db as unknown as D1Database, teacher, 'qb-1', { status: 'PUBLISHED' }))
      .rejects.toMatchObject({ code: 'FORBIDDEN' });

    const updated = await updateQuestionBankItem(db as unknown as D1Database, admin, 'qb-1', { status: 'PUBLISHED' });
    expect(updated.status).toBe('PUBLISHED');
    expect(updated.publishedAt).toEqual(expect.any(String));
    expect(repo.prepareAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'PUBLISH' }));
  });

  it('archives SYSTEM but physically removes PERSONAL with legacy mirror cleanup', async () => {
    const db = new BatchDatabase();
    repo.getStored.mockResolvedValueOnce(stored({ status: 'PUBLISHED' }));
    await removeQuestionBankItem(db as unknown as D1Database, admin, 'qb-1');
    expect(db.batches[0]).toEqual([{ kind: 'archive' }, { kind: 'audit' }]);

    repo.getStored.mockResolvedValueOnce(stored({
      id: 'personal-1', scope: 'PERSONAL', ownerId: 'teacher-a', status: 'PUBLISHED',
    }));
    await removeQuestionBankItem(db as unknown as D1Database, teacher, 'personal-1');
    expect(db.batches[1]).toEqual([{ kind: 'delete-personal' }, { kind: 'legacy-delete' }]);

    repo.getStored.mockResolvedValueOnce(null);
    await expect(removeQuestionBankItem(db as unknown as D1Database, teacher, 'missing')).resolves.toEqual({ status: 'success' });
  });

  it('copies only published SYSTEM questions and reports personal duplicates', async () => {
    repo.getStored.mockResolvedValue(stored({ status: 'PUBLISHED' }));
    const db = new BatchDatabase();
    const copied = await copySystemQuestionToPersonal(db as unknown as D1Database, teacher, 'qb-1');
    expect(copied).toMatchObject({ scope: 'PERSONAL', ownerId: 'teacher-a' });
    expect(copied.metadata.tags).toContain('Sao chép từ kho hệ thống');

    repo.findDuplicate.mockResolvedValue('personal-existing');
    await expect(copySystemQuestionToPersonal(db as unknown as D1Database, teacher, 'qb-1'))
      .rejects.toMatchObject({ code: 'DUPLICATE_QUESTION', details: { existingId: 'personal-existing' } });
  });
});
