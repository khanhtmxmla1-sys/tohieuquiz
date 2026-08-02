// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JWTPayload } from '../workers/src/utils/jwt';

const authState = vi.hoisted(() => ({ user: null as JWTPayload | null }));
const repo = vi.hoisted(() => ({
  parse: vi.fn(() => ({ scope: 'SYSTEM', page: 1, pageSize: 30 })),
  list: vi.fn(),
  get: vi.fn(),
}));
const service = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  copy: vi.fn(),
  bulk: vi.fn(),
}));

vi.mock('../workers/src/middleware/jwtAuth', () => ({
  verifyJWTMiddleware: vi.fn(async () => authState.user
    ? { user: authState.user }
    : new Response(JSON.stringify({ status: 'error' }), { status: 401 })),
  requireTeacher: vi.fn((user: JWTPayload) => user.role === 'teacher' || user.role === 'admin'),
}));

vi.mock('../workers/src/services/questionBankRepository', async () => {
  const actual = await vi.importActual<typeof import('../workers/src/services/questionBankRepository')>(
    '../workers/src/services/questionBankRepository',
  );
  return {
    ...actual,
    parseQuestionBankListParams: repo.parse,
    listQuestionBankItems: repo.list,
    getQuestionBankItem: repo.get,
  };
});

vi.mock('../workers/src/services/questionBankService', async () => {
  const actual = await vi.importActual<typeof import('../workers/src/services/questionBankService')>(
    '../workers/src/services/questionBankService',
  );
  return {
    ...actual,
    createQuestionBankItem: service.create,
    updateQuestionBankItem: service.update,
    removeQuestionBankItem: service.remove,
    copySystemQuestionToPersonal: service.copy,
    bulkImportSystemItems: service.bulk,
  };
});

import { handleTestBankRoutes } from '../workers/src/routes/testBank';
import { QuestionBankServiceError } from '../workers/src/services/questionBankService';

const question = {
  id: 'q-1', type: 'MCQ', question: '2 + 2?', options: ['3', '4'], correctAnswer: 'B',
};
const personalItem = {
  id: 'bank-1', scope: 'PERSONAL', ownerId: 'teacher-a', status: 'PUBLISHED',
  questionData: question, questionText: '2 + 2?', questionType: 'MCQ', difficulty: 1,
  explanation: '', metadata: { grade: null, subject: 'MATH', semester: null, topicCode: '', lessonCode: '', source: 'MANUAL', tags: ['math'] },
  createdBy: 'teacher-a', updatedBy: 'teacher-a', createdAt: '2026-08-02T00:00:00.000Z', updatedAt: '2026-08-02T00:00:00.000Z', publishedAt: '2026-08-02T00:00:00.000Z', archivedAt: null,
};
const systemItem = { ...personalItem, id: 'system-1', scope: 'SYSTEM', ownerId: '', createdBy: 'admin', updatedBy: 'admin' };
const listResult = (items = [systemItem]) => ({
  items,
  pagination: { page: 1, pageSize: 30, totalItems: items.length, totalPages: items.length ? 1 : 0 },
  appliedFilters: { scope: 'SYSTEM', page: 1, pageSize: 30 },
});

const call = (path: string, method = 'GET', body?: unknown) => {
  const url = new URL(`https://test${path}`);
  return handleTestBankRoutes(
    new Request(url, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    { DB: {} } as any,
    url.pathname,
    method,
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  authState.user = { id: 'teacher-a', username: 'teacher-a', role: 'teacher' };
  repo.list.mockResolvedValue(listResult());
  repo.get.mockResolvedValue(systemItem);
  service.create.mockResolvedValue(personalItem);
  service.update.mockResolvedValue(systemItem);
  service.remove.mockResolvedValue({ status: 'success' });
  service.copy.mockResolvedValue(personalItem);
  service.bulk.mockResolvedValue({ summary: { received: 1, created: 1, duplicates: 0, invalid: 0 }, results: [{ index: 0, status: 'CREATED', id: 'system-1' }] });
});

describe('test-bank route compatibility and V2 dispatch', () => {
  it('keeps legacy teacher GET response and owner authorization', async () => {
    repo.list.mockResolvedValueOnce(listResult([personalItem]));
    const response = await call('/api/test-bank/teacher/teacher-a');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ items: [{
      id: 'bank-1', teacher_id: 'teacher-a', question_data: question,
      tags: ['math'], created_at: '2026-08-02T00:00:00.000Z',
    }] });

    const forbidden = await call('/api/test-bank/teacher/teacher-b');
    expect(forbidden.status).toBe(403);

    authState.user = { id: 'admin', username: 'admin', role: 'admin' };
    repo.list.mockResolvedValueOnce(listResult([{ ...personalItem, ownerId: 'teacher-b' }]));
    expect((await call('/api/test-bank/teacher/teacher-b')).status).toBe(200);
  });

  it('maps legacy POST payload to PERSONAL while preserving legacy response shape', async () => {
    const response = await call('/api/test-bank', 'POST', {
      id: 'bank-1', teacher_id: 'teacher-a', question_data: question, tags: ['math'],
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'success', id: 'bank-1' });
    expect(service.create).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ username: 'teacher-a' }), {
      id: 'bank-1', scope: 'PERSONAL', ownerId: 'teacher-a', questionData: question,
      metadata: { tags: ['math'] },
    });
  });

  it('dispatches V2 list, detail, patch, delete, copy and bulk routes', async () => {
    expect((await call('/api/test-bank?scope=SYSTEM')).status).toBe(200);
    expect(repo.parse).toHaveBeenCalled();
    expect(repo.list).toHaveBeenCalled();

    expect((await call('/api/test-bank/system-1')).status).toBe(200);
    expect(repo.get).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'system-1');

    expect((await call('/api/test-bank/system-1', 'PATCH', { status: 'PUBLISHED' })).status).toBe(200);
    expect(service.update).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'system-1', { status: 'PUBLISHED' });

    expect((await call('/api/test-bank/system-1', 'DELETE')).status).toBe(200);
    expect(service.remove).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'system-1');

    expect((await call('/api/test-bank/system-1/copy-to-personal', 'POST')).status).toBe(201);
    expect(service.copy).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'system-1');

    expect((await call('/api/test-bank/bulk', 'POST', { items: [{ questionData: question }] })).status).toBe(200);
    expect(service.bulk).toHaveBeenCalledWith(expect.anything(), expect.anything(), [{ questionData: question }]);
  });

  it('returns structured V2 errors without exposing internals', async () => {
    service.create.mockRejectedValueOnce(new QuestionBankServiceError('FORBIDDEN', 403, 'Không có quyền.'));
    const response = await call('/api/test-bank', 'POST', { scope: 'SYSTEM', questionData: question });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'FORBIDDEN', message: 'Không có quyền.' },
    });
  });

  it('rejects unauthenticated and non-teacher requests', async () => {
    authState.user = null;
    expect((await call('/api/test-bank?scope=SYSTEM')).status).toBe(401);

    authState.user = { id: 'student-a', username: 'student-a', role: 'student' };
    expect((await call('/api/test-bank?scope=SYSTEM')).status).toBe(403);
  });
});
