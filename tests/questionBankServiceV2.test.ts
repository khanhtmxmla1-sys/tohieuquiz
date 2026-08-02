import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuestionType, type Question } from '../src/types';

const apiConfigMocks = vi.hoisted(() => ({
  getWorkersApiBaseUrl: vi.fn(() => ''),
}));

vi.mock('../src/services/api/config', () => ({
  getWorkersApiBaseUrl: apiConfigMocks.getWorkersApiBaseUrl,
}));

import {
  QuestionBankApiError,
  testBankService,
} from '../src/services/testBankService';

const fetchMock = vi.fn();

const question: Question = {
  id: 'q-1',
  type: QuestionType.MCQ,
  question: '2 + 3 bằng bao nhiêu?',
  options: ['4', '5', '6'],
  correctAnswer: 'B',
  difficulty: 1,
  subject: 'MATH',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  apiConfigMocks.getWorkersApiBaseUrl.mockReturnValue('');
});

describe('testBankService V2', () => {
  it('serializes only defined list filters and maps pagination', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      items: [],
      pagination: { page: 2, pageSize: 50, totalItems: 51, totalPages: 2 },
      appliedFilters: { scope: 'SYSTEM', page: 2, pageSize: 50 },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const result = await testBankService.listQuestionBank({
      scope: 'SYSTEM',
      page: 2,
      pageSize: 50,
      grade: 5,
      subject: 'MATH',
      semester: 1,
      lessonCode: 'M5-S1-L06',
      search: '  phân số  ',
      topicCode: '',
    });

    expect(result.pagination).toEqual({ page: 2, pageSize: 50, totalItems: 51, totalPages: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const parsed = new URL(url, 'https://tohieuquiz.test');
    expect(parsed.pathname).toBe('/api/test-bank');
    expect(Object.fromEntries(parsed.searchParams)).toEqual({
      scope: 'SYSTEM',
      page: '2',
      pageSize: '50',
      grade: '5',
      subject: 'MATH',
      semester: '1',
      lessonCode: 'M5-S1-L06',
      search: 'phân số',
    });
    expect(init).toEqual({ credentials: 'include' });
  });

  it('uses JSON requests for create, patch, copy and bulk actions', async () => {
    apiConfigMocks.getWorkersApiBaseUrl.mockReturnValue('https://api.test');
    const item = {
      id: 'qb-1', scope: 'SYSTEM', ownerId: '', status: 'DRAFT', questionData: question,
      questionText: question.question, questionType: question.type, difficulty: 1, explanation: '',
      metadata: { grade: 5, subject: 'MATH', semester: 1, topicCode: 'M5-S1-T01', lessonCode: 'M5-S1-L01', source: 'MANUAL', tags: [] },
      createdBy: 'admin', updatedBy: 'admin', createdAt: '2026-08-02', updatedAt: '2026-08-02', publishedAt: null, archivedAt: null,
    };
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ item }), { status: 201, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ item: { ...item, status: 'PUBLISHED' } }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ item: { ...item, id: 'personal-1', scope: 'PERSONAL' } }), { status: 201, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ summary: { received: 1, created: 1, duplicates: 0, invalid: 0 }, results: [{ index: 0, status: 'CREATED', id: 'qb-2' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await testBankService.createQuestionBankItem({ scope: 'SYSTEM', status: 'DRAFT', questionData: question });
    await testBankService.patchQuestionBankItem('qb/1', { status: 'PUBLISHED' });
    await testBankService.copyQuestionToPersonal('qb/1');
    await testBankService.bulkImportQuestionBank([{ scope: 'SYSTEM', status: 'DRAFT', questionData: question }]);

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://api.test/api/test-bank', expect.objectContaining({
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.test/api/test-bank/qb%2F1', expect.objectContaining({ method: 'PATCH' }));
    expect(fetchMock).toHaveBeenNthCalledWith(3, 'https://api.test/api/test-bank/qb%2F1/copy-to-personal', expect.objectContaining({ method: 'POST' }));
    expect(fetchMock).toHaveBeenNthCalledWith(4, 'https://api.test/api/test-bank/bulk', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ items: [{ scope: 'SYSTEM', status: 'DRAFT', questionData: question }] }),
    }));
  });

  it('normalizes structured duplicate errors with status and details', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      error: {
        code: 'DUPLICATE_QUESTION',
        message: 'Câu hỏi đã tồn tại.',
        details: { existingId: 'personal-9' },
      },
    }), { status: 409, headers: { 'Content-Type': 'application/json' } }));

    const error = await testBankService.copyQuestionToPersonal('system-1').catch((value) => value);
    expect(error).toBeInstanceOf(QuestionBankApiError);
    expect(error).toMatchObject({
      code: 'DUPLICATE_QUESTION',
      status: 409,
      details: { existingId: 'personal-9' },
      message: 'Câu hỏi đã tồn tại.',
    });
  });
});
