import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuestionType, type Question } from '../src/types';
import type { QuestionBankItem } from '../src/features/question-bank/questionBank.types';

const mocks = vi.hoisted(() => {
  const toast = Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() });
  return {
    resolveFlag: vi.fn(),
    list: vi.fn(),
    legacyList: vi.fn(),
    deleteLegacy: vi.fn(),
    copy: vi.fn(),
    archive: vi.fn(),
    toast,
  };
});

vi.mock('../src/services/featureRolloutService', () => ({
  resolveRuntimeFeatureFlag: mocks.resolveFlag,
}));

vi.mock('react-hot-toast', () => ({ default: mocks.toast }));

vi.mock('../src/services/testBankService', async () => {
  const actual = await vi.importActual<typeof import('../src/services/testBankService')>(
    '../src/services/testBankService',
  );
  return {
    ...actual,
    testBankService: {
      ...actual.testBankService,
      listQuestionBank: mocks.list,
      getTestBank: mocks.legacyList,
      deleteQuestion: mocks.deleteLegacy,
      copyQuestionToPersonal: mocks.copy,
      archiveQuestionBankItem: mocks.archive,
    },
  };
});

vi.mock('../src/components/common/MathSpan', () => ({
  default: ({ content, as: Element = 'span', ...props }: any) => <Element {...props}>{content}</Element>,
}));

import { TestBankModal } from '../src/features/quiz-editor/components/TestBankModal';

const question: Question = {
  id: 'question-1',
  type: QuestionType.MCQ,
  question: 'Tính 2 + 3.',
  options: ['4', '5', '6'],
  correctAnswer: 'B',
  difficulty: 1,
  subject: 'MATH',
};

const item = (scope: 'SYSTEM' | 'PERSONAL', id = 'bank-1'): QuestionBankItem => ({
  id,
  scope,
  ownerId: scope === 'PERSONAL' ? 'teacher-a' : '',
  status: 'PUBLISHED',
  questionData: { ...question, id: `${id}-question` },
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
  publishedAt: '2026-08-02T00:00:00.000Z',
  archivedAt: null,
});

const listResponse = (items: QuestionBankItem[], scope: 'SYSTEM' | 'PERSONAL') => ({
  items,
  pagination: { page: 1, pageSize: 30, totalItems: items.length, totalPages: items.length ? 1 : 0 },
  appliedFilters: { scope, page: 1, pageSize: 30 },
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolveFlag.mockResolvedValue({ enabled: true });
  mocks.list.mockImplementation((filters: { scope: 'SYSTEM' | 'PERSONAL' }) =>
    Promise.resolve(listResponse([item(filters.scope)], filters.scope)));
  mocks.legacyList.mockResolvedValue([]);
  mocks.copy.mockResolvedValue(item('PERSONAL', 'personal-copy'));
  mocks.archive.mockResolvedValue(true);
});

describe('TestBankModal system question bank', () => {
  it('shows system and personal tabs, copies system questions and adds a selected question', async () => {
    const onAddQuestion = vi.fn();
    render(<TestBankModal isOpen teacherId="teacher-a" onClose={vi.fn()} onAddQuestion={onAddQuestion} />);

    const dialog = await screen.findByRole('dialog', { name: 'Ngân hàng câu hỏi' });
    expect(within(dialog).getByRole('tab', { name: 'Kho hệ thống' })).toHaveAttribute('aria-selected', 'true');
    expect(await within(dialog).findByText('Tính 2 + 3.')).toBeInTheDocument();
    expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({ scope: 'SYSTEM', page: 1, pageSize: 30 }));

    fireEvent.click(within(dialog).getByRole('button', { name: /Sao chép về kho của tôi/ }));
    await waitFor(() => expect(mocks.copy).toHaveBeenCalledWith('bank-1'));
    expect(mocks.toast.success).toHaveBeenCalledWith('Đã sao chép câu hỏi về kho của tôi.');

    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Tính 2 + 3.' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Thêm 1 câu vào đề' }));
    expect(onAddQuestion).toHaveBeenCalledTimes(1);
    expect(onAddQuestion.mock.calls[0][0]).toMatchObject({ question: 'Tính 2 + 3.' });
    expect(onAddQuestion.mock.calls[0][0].id).not.toBe('bank-1-question');
  });

  it('falls back to the personal tab when the published system bank is empty', async () => {
    mocks.list.mockImplementation((filters: { scope: 'SYSTEM' | 'PERSONAL' }) => (
      filters.scope === 'SYSTEM'
        ? Promise.resolve(listResponse([], 'SYSTEM'))
        : Promise.resolve(listResponse([item('PERSONAL', 'personal-1')], 'PERSONAL'))
    ));

    render(<TestBankModal isOpen teacherId="teacher-a" onClose={vi.fn()} onAddQuestion={vi.fn()} />);
    const dialog = await screen.findByRole('dialog', { name: 'Ngân hàng câu hỏi' });

    await waitFor(() => expect(within(dialog).getByRole('tab', { name: 'Kho của tôi' })).toHaveAttribute('aria-selected', 'true'));
    expect(await within(dialog).findByText('Tính 2 + 3.')).toBeInTheDocument();
    expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({ scope: 'PERSONAL' }));
  });

  it('uses the legacy personal-only modal when the runtime flag is disabled', async () => {
    mocks.resolveFlag.mockResolvedValue({ enabled: false });
    mocks.legacyList.mockResolvedValue([{ id: 'legacy-1', teacher_id: 'teacher-a', question_data: question, tags: [], created_at: '2026-08-02' }]);

    render(<TestBankModal isOpen teacherId="teacher-a" onClose={vi.fn()} onAddQuestion={vi.fn()} />);

    expect(await screen.findByRole('dialog', { name: 'Ngân hàng câu hỏi cá nhân' })).toBeInTheDocument();
    expect(mocks.legacyList).toHaveBeenCalledWith('teacher-a');
    expect(mocks.list).not.toHaveBeenCalled();
  });
});
