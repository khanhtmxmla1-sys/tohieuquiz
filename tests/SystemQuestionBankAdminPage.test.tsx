import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuestionType, type Question } from '../src/types';
import type { QuestionBankItem } from '../src/features/question-bank/questionBank.types';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  patch: vi.fn(),
  archive: vi.fn(),
  bulk: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('../src/services/testBankService', async () => {
  const actual = await vi.importActual<typeof import('../src/services/testBankService')>(
    '../src/services/testBankService',
  );
  return {
    ...actual,
    testBankService: {
      ...actual.testBankService,
      listQuestionBank: mocks.list,
      patchQuestionBankItem: mocks.patch,
      archiveQuestionBankItem: mocks.archive,
      bulkImportQuestionBank: mocks.bulk,
    },
  };
});

vi.mock('../src/utils/toast', () => ({
  showSuccess: mocks.success,
  showError: mocks.error,
}));

import SystemQuestionBankAdminPage from '../src/features/question-bank/SystemQuestionBankAdminPage';

const question: Question = {
  id: 'question-1',
  type: QuestionType.MCQ,
  question: 'Tính 2 + 3.',
  options: ['4', '5', '6'],
  correctAnswer: 'B',
  difficulty: 1,
  subject: 'MATH',
};

const bankItem: QuestionBankItem = {
  id: 'qb-1',
  scope: 'SYSTEM',
  ownerId: '',
  status: 'DRAFT',
  questionData: question,
  questionText: question.question,
  questionType: question.type,
  difficulty: 1,
  explanation: '',
  metadata: {
    grade: 5,
    subject: 'MATH',
    semester: 1,
    topicCode: 'M5-S1-T01',
    lessonCode: 'M5-S1-L01',
    source: 'CURATED_ORIGINAL',
    tags: ['Toán', 'Lớp 5'],
  },
  createdBy: 'admin',
  updatedBy: 'admin',
  createdAt: '2026-08-02T00:00:00.000Z',
  updatedAt: '2026-08-02T00:00:00.000Z',
  publishedAt: null,
  archivedAt: null,
};

const response = (items: QuestionBankItem[], totalItems: number, status?: string) => ({
  items,
  pagination: { page: 1, pageSize: status ? 1 : 30, totalItems, totalPages: totalItems ? 1 : 0 },
  appliedFilters: { scope: 'SYSTEM', status },
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.list.mockImplementation((params: { status?: string; pageSize?: number }) => {
    if (params.pageSize === 1) {
      const counts: Record<string, number> = { DRAFT: 12, PUBLISHED: 28, ARCHIVED: 4 };
      return Promise.resolve(response([], counts[params.status || ''] || 0, params.status));
    }
    return Promise.resolve(response([bankItem], 1, params.status));
  });
  mocks.patch.mockResolvedValue({ ...bankItem, status: 'PUBLISHED' });
  mocks.archive.mockResolvedValue(true);
  mocks.bulk.mockResolvedValue({
    summary: { received: 2, created: 1, duplicates: 0, invalid: 1 },
    results: [
      { index: 0, status: 'CREATED', id: 'qb-created' },
      { index: 1, status: 'INVALID', errors: ['Thiếu đáp án'] },
    ],
  });
});

describe('SystemQuestionBankAdminPage', () => {
  it('shows status totals and can publish or archive a system question', async () => {
    render(<SystemQuestionBankAdminPage />);

    expect(await screen.findByRole('heading', { name: 'Ngân hàng câu hỏi hệ thống' })).toBeInTheDocument();
    expect(await screen.findByText('12')).toBeInTheDocument();
    expect(screen.getByText('28')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();

    const row = await screen.findByRole('row', { name: /Tính 2 \+ 3/ });
    fireEvent.click(within(row).getByRole('button', { name: 'Phát hành' }));
    await waitFor(() => expect(mocks.patch).toHaveBeenCalledWith('qb-1', { status: 'PUBLISHED' }));

    fireEvent.click(within(row).getByRole('button', { name: 'Lưu trữ' }));
    await waitFor(() => expect(mocks.archive).toHaveBeenCalledWith('qb-1'));
  });

  it('previews a JSON array, imports it and displays per-row results', async () => {
    render(<SystemQuestionBankAdminPage />);
    await screen.findByRole('heading', { name: 'Ngân hàng câu hỏi hệ thống' });

    const file = new File([
      JSON.stringify([
        { scope: 'SYSTEM', status: 'DRAFT', questionData: question, metadata: { lessonCode: 'M5-S1-L01' } },
        { scope: 'SYSTEM', status: 'DRAFT', questionData: { id: 'bad' }, metadata: { lessonCode: 'M5-S1-L02' } },
      ]),
    ], 'questions.json', { type: 'application/json' });

    fireEvent.change(screen.getByLabelText('Chọn file JSON câu hỏi'), { target: { files: [file] } });
    expect(await screen.findByText('Sẵn sàng nhập 2 câu')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Nhập 2 câu vào bản nháp' }));

    await waitFor(() => expect(mocks.bulk).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('CREATED')).toBeInTheDocument();
    expect(screen.getByText('INVALID')).toBeInTheDocument();
    expect(screen.getByText('Thiếu đáp án')).toBeInTheDocument();
  });

  it('rejects files containing more than 100 records before calling the API', async () => {
    render(<SystemQuestionBankAdminPage />);
    await screen.findByRole('heading', { name: 'Ngân hàng câu hỏi hệ thống' });
    const file = new File([JSON.stringify(Array.from({ length: 101 }, () => ({ questionData: question })))], 'too-many.json', { type: 'application/json' });

    fireEvent.change(screen.getByLabelText('Chọn file JSON câu hỏi'), { target: { files: [file] } });

    expect(await screen.findByRole('alert')).toHaveTextContent('tối đa 100 câu');
    expect(mocks.bulk).not.toHaveBeenCalled();
  });
});
