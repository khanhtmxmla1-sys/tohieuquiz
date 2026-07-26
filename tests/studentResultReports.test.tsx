import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('better-react-mathjax', () => ({
  MathJax: ({ children }: { children: React.ReactNode }) => <span data-testid="mathjax">{children}</span>,
  MathJaxContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mocks = vi.hoisted(() => ({
  listMine: vi.fn(),
  getMine: vi.fn(),
}));

vi.mock('../src/features/results/services/resultReportDeliveryService', async () => {
  const actual = await vi.importActual<any>('../src/features/results/services/resultReportDeliveryService');
  return {
    ...actual,
    resultReportDeliveryService: {
      ...actual.resultReportDeliveryService,
      listMine: mocks.listMine,
      getMine: mocks.getMine,
    },
  };
});

import { StudentResultReportsPage } from '../src/features/results/components/student-reports/StudentResultReportsPage';

const summaries = [
  {
    id: 'phieu-an', resultId: 'result-an', quizId: 'quiz-1',
    quizTitle: 'Bài 1 – Ôn tập phép nhân', teacherName: 'Cô Khánh',
    score: 8, classification: 'Giỏi', submittedAt: '2026-07-20T08:00:00.000Z',
    publishedAt: '2026-07-21T08:00:00.000Z',
  },
  {
    id: 'phieu-phan-so', resultId: 'result-phan-so', quizId: 'quiz-2',
    quizTitle: 'Phân số', teacherName: 'Cô Khánh', score: 6,
    classification: 'Khá', submittedAt: '2026-07-18T08:00:00.000Z',
    publishedAt: '2026-07-19T08:00:00.000Z',
  },
];

const detail = {
  ...summaries[0],
  studentName: 'Nguyễn Văn An', classId: 'class-4a9', subject: 'Toán',
  totalQuestions: 10, correctCount: 8, incorrectCount: 2,
  comment: 'Em đã tính đúng $\\frac{3}{4}$ số câu.',
  needsImprovement: 'Ôn lại $\\sqrt{16}=4$.',
  encouragement: 'Tiếp tục phát huy.',
};

describe('StudentResultReportsPage', () => {
  beforeEach(() => {
    mocks.listMine.mockReset().mockResolvedValue(summaries);
    mocks.getMine.mockReset().mockResolvedValue(detail);
  });

  it('loads report history from the authenticated student endpoint', async () => {
    render(<StudentResultReportsPage />);

    expect(screen.getByLabelText('Đang tải phiếu kết quả')).toBeInTheDocument();
    await waitFor(() => expect(mocks.listMine).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('button', { name: /Bài 1 – Ôn tập phép nhân/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Phân số/i })).toBeInTheDocument();
    expect(mocks.getMine).not.toHaveBeenCalled();
  });

  it('opens the exact report supplied by a notification deep link', async () => {
    render(<StudentResultReportsPage selectedReportId="phieu-an" />);

    await waitFor(() => expect(mocks.getMine).toHaveBeenCalledWith('phieu-an'));
    expect(await screen.findByRole('heading', { name: 'Bài 1 – Ôn tập phép nhân' })).toBeInTheDocument();
    expect(screen.getByText(/Nguyễn Văn An · Cô Khánh/)).toBeInTheDocument();
    expect(screen.getAllByTestId('mathjax').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/\\frac\{3\}\{4\}/)).toBeInTheDocument();
    expect(screen.queryByText(/public_token|api\.thtohieu\.com\/p\//i)).not.toBeInTheDocument();
  });

  it('opens a report from history and returns to the list', async () => {
    render(<StudentResultReportsPage />);
    const card = await screen.findByRole('button', { name: /Bài 1 – Ôn tập phép nhân/i });

    fireEvent.click(card);
    await waitFor(() => expect(mocks.getMine).toHaveBeenCalledWith('phieu-an'));
    expect(await screen.findByRole('button', { name: 'Quay lại danh sách phiếu' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Quay lại danh sách phiếu' }));
    expect(screen.getByRole('button', { name: /Bài 1 – Ôn tập phép nhân/i })).toBeInTheDocument();
  });

  it('renders local empty and retry states', async () => {
    mocks.listMine.mockResolvedValueOnce([]);
    const { rerender } = render(<StudentResultReportsPage />);
    expect(await screen.findByText('Em chưa có phiếu kết quả nào.')).toBeInTheDocument();

    mocks.listMine.mockReset().mockRejectedValueOnce(new Error('Không tải được phiếu'));
    rerender(<StudentResultReportsPage key="error" />);
    expect(await screen.findByText('Không tải được phiếu')).toBeInTheDocument();
    mocks.listMine.mockResolvedValueOnce(summaries);
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await waitFor(() => expect(mocks.listMine).toHaveBeenCalledTimes(2));
  });
});
