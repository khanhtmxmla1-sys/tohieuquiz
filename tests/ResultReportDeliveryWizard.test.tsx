import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResultReportBatchDetail, ResultReportCohortResponse } from '../shared/result-reports.contract';

const mocks = vi.hoisted(() => ({
  getClasses: vi.fn(),
  getCohort: vi.fn(),
  createBatch: vi.fn(),
  getBatch: vi.fn(),
  retryBatch: vi.fn(),
  revokeLinks: vi.fn(),
}));

vi.mock('../src/services/classroomService', () => ({ getClasses: mocks.getClasses }));
vi.mock('../src/features/results/services/resultReportDeliveryService', async () => {
  const actual = await vi.importActual<any>('../src/features/results/services/resultReportDeliveryService');
  return {
    ...actual,
    resultReportDeliveryService: {
      getCohort: mocks.getCohort,
      createBatch: mocks.createBatch,
      getBatch: mocks.getBatch,
      retryBatch: mocks.retryBatch,
      revokeLinks: mocks.revokeLinks,
    },
  };
});

vi.mock('../src/stores/useAuthStore', () => ({
  useAuthStore: (selector?: any) => {
    const state = { username: 'teacher-a', fullName: 'Cô Khánh' };
    return selector ? selector(state) : state;
  },
}));

import { ResultReportDeliveryWizard } from '../src/features/results/components/result-report-delivery';

const cohort: ResultReportCohortResponse = {
  class: { id: 'class-4a9', name: '4A9' },
  quiz: { id: 'quiz-1', title: 'Bài 1 – Ôn tập phép nhân' },
  attemptPolicy: 'latest',
  summary: {
    totalStudents: 3,
    completedStudents: 2,
    notCompletedStudents: 1,
    unresolvedStudents: 0,
    reportCount: 2,
  },
  ready: [
    {
      student: { id: 'student-an', fullName: 'Nguyễn Văn An', username: 'an', parentPhone: '0901' },
      result: {
        id: 'result-an', studentName: 'Nguyễn Văn An', score: 8, correctCount: 8,
        totalQuestions: 10, submittedAt: '2026-07-20T08:00:00.000Z', quizTitle: 'Bài 1',
      },
      attemptCount: 2,
    },
    {
      student: { id: 'student-binh', fullName: 'Trần Minh Bình', username: 'binh', parentPhone: null },
      result: {
        id: 'result-binh', studentName: 'Trần Minh Bình', score: 6, correctCount: 6,
        totalQuestions: 10, submittedAt: '2026-07-20T08:05:00.000Z', quizTitle: 'Bài 1',
      },
      attemptCount: 1,
    },
  ],
  notCompleted: [
    { id: 'student-chi', fullName: 'Lê Thị Chi', username: 'chi', parentPhone: '0903' },
  ],
  unresolved: [],
};

const partialDetail: ResultReportBatchDetail = {
  batch: {
    id: 'batch-1', requestId: 'request-1', classId: 'class-4a9', className: '4A9',
    quizId: 'quiz-1', quizTitle: 'Bài 1 – Ôn tập phép nhân', attemptPolicy: 'latest',
    notifyStudents: true, createParentLinks: true, deliveryStatus: 'partial_failed',
    createdAt: '2026-07-21T08:00:00.000Z', updatedAt: '2026-07-21T08:00:00.000Z',
    counts: { total: 2, studentSent: 1, studentViewed: 0, parentLinks: 2, parentOpened: 0, failed: 1 },
  },
  items: [
    {
      id: 'item-an', batchId: 'batch-1', resultId: 'result-an', phieuId: 'phieu-an',
      studentId: 'student-an', studentName: 'Nguyễn Văn An', parentPhone: '0901',
      notificationId: 'notification-an', publicLinkId: 'link-an', publicUrl: 'https://phieu.test/an',
      studentStatus: 'sent', parentStatus: 'link_created', attemptCount: 1, lastError: null,
      score: 8, submittedAt: '2026-07-20T08:00:00.000Z',
    },
    {
      id: 'item-binh', batchId: 'batch-1', resultId: 'result-binh', phieuId: 'phieu-binh',
      studentId: 'student-binh', studentName: 'Trần Minh Bình', parentPhone: null,
      notificationId: null, publicLinkId: 'link-binh', publicUrl: 'https://phieu.test/binh',
      studentStatus: 'failed', parentStatus: 'link_created', attemptCount: 1,
      lastError: 'Student notification: unavailable', score: 6,
      submittedAt: '2026-07-20T08:05:00.000Z',
    },
  ],
};

const renderWizard = (onClose = vi.fn()) => render(
  <ResultReportDeliveryWizard
    isOpen
    className="4A9"
    quizId="quiz-1"
    quizTitle="Bài 1 – Ôn tập phép nhân"
    onClose={onClose}
    requestIdFactory={() => 'request-1'}
  />,
);

describe('ResultReportDeliveryWizard', () => {
  beforeEach(() => {
    mocks.getClasses.mockReset().mockResolvedValue([
      { id: 'class-4a9', name: 'Lớp 4A9', teacherUsername: 'teacher-a', createdAt: '2026-01-01' },
    ]);
    mocks.getCohort.mockReset().mockResolvedValue(cohort);
    mocks.createBatch.mockReset().mockResolvedValue({ batchId: 'batch-1', status: 'partial_failed' });
    mocks.getBatch.mockReset().mockResolvedValue(partialDetail);
    mocks.retryBatch.mockReset().mockResolvedValue({
      ...partialDetail,
      batch: { ...partialDetail.batch, deliveryStatus: 'completed', counts: { ...partialDetail.batch.counts, failed: 0, studentSent: 2 } },
      items: partialDetail.items.map((item) => ({ ...item, studentStatus: 'sent', lastError: null })),
    });
    mocks.revokeLinks.mockReset().mockResolvedValue(partialDetail);
  });

  it('resolves the selected class and shows a server-owned scope summary', async () => {
    renderWizard();

    expect(screen.getByRole('dialog', { name: 'Tạo và gửi phiếu kết quả' })).toBeInTheDocument();
    await waitFor(() => expect(mocks.getClasses).toHaveBeenCalled());
    await waitFor(() => expect(mocks.getCohort).toHaveBeenCalledWith({
      classId: 'class-4a9', quizId: 'quiz-1', attemptPolicy: 'latest',
    }));

    expect(screen.queryByText('31')).not.toBeInTheDocument();
    expect(screen.getByText('3', { selector: '[data-metric="total"]' })).toBeInTheDocument();
    expect(screen.getByText('2', { selector: '[data-metric="completed"]' })).toBeInTheDocument();
    expect(screen.getByText('1', { selector: '[data-metric="not-completed"]' })).toBeInTheDocument();
    expect(screen.getByText(/Lê Thị Chi/)).toBeInTheDocument();
    expect(screen.getByText('Lần làm mới nhất')).toBeInTheDocument();
  });

  it('keeps selection when review search changes and allows editing the active draft', async () => {
    renderWizard();
    await screen.findByText(/Lê Thị Chi/);
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }));

    expect(screen.getByText('Sẽ gửi 2 phiếu')).toBeInTheDocument();
    const anCheckbox = screen.getByRole('checkbox', { name: /Chọn Nguyễn Văn An/i });
    const binhCheckbox = screen.getByRole('checkbox', { name: /Chọn Trần Minh Bình/i });
    expect(anCheckbox).toBeChecked();
    expect(binhCheckbox).toBeChecked();

    fireEvent.change(screen.getByPlaceholderText('Tìm học sinh trong danh sách...'), { target: { value: 'Bình' } });
    const studentList = screen.getByTestId('result-report-student-list');
    expect(within(studentList).queryByText('Nguyễn Văn An')).not.toBeInTheDocument();
    expect(within(studentList).getByText('Trần Minh Bình')).toBeInTheDocument();
    expect(screen.getByText('Sẽ gửi 2 phiếu')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Nhận xét'), { target: { value: 'Nhận xét đã chỉnh.' } });
    expect(screen.getByDisplayValue('Nhận xét đã chỉnh.')).toBeInTheDocument();
    fireEvent.click(binhCheckbox);
    expect(screen.getByText('Sẽ gửi 1 phiếu')).toBeInTheDocument();
  });

  it('submits exact scope with default delivery channels and reuses one request id for retry', async () => {
    renderWizard();
    await screen.findByText(/Lê Thị Chi/);
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục chọn cách gửi' }));

    expect(screen.getByRole('checkbox', { name: 'Gửi vào tài khoản học sinh' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Tạo link riêng cho phụ huynh' })).toBeChecked();
    expect(screen.getByText(/Lớp 4A9/)).toBeInTheDocument();
    expect(screen.getByText(/Bài 1 – Ôn tập phép nhân/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Gửi 2 phiếu kết quả' }));
    await waitFor(() => expect(mocks.createBatch).toHaveBeenCalledTimes(1));
    expect(mocks.createBatch).toHaveBeenCalledWith(expect.objectContaining({
      requestId: 'request-1', classId: 'class-4a9', quizId: 'quiz-1', attemptPolicy: 'latest',
      notifyStudents: true, createParentLinks: true,
      drafts: expect.arrayContaining([
        expect.objectContaining({ resultId: 'result-an' }),
        expect.objectContaining({ resultId: 'result-binh' }),
      ]),
    }));

    expect(await screen.findByText('Có 1 phiếu cần thử lại')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Thử gửi lại 1 phiếu' }));
    await waitFor(() => expect(mocks.retryBatch).toHaveBeenCalledWith('batch-1', ['item-binh']));
    expect(mocks.createBatch).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Đã gửi đủ 2 phiếu')).toBeInTheDocument();
  });

  it('closes on Escape and exposes a labelled close control', async () => {
    const onClose = vi.fn();
    renderWizard(onClose);
    await screen.findByText(/Lê Thị Chi/);

    expect(screen.getByRole('button', { name: 'Đóng cửa sổ tạo phiếu' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
