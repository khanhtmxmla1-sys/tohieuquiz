import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import ParentAssignmentsPage from '../src/features/parent-portal/pages/ParentAssignmentsPage';
import ParentCertificatesPage from '../src/features/parent-portal/pages/ParentCertificatesPage';
import ParentResultDetailPage from '../src/features/parent-portal/pages/ParentResultDetailPage';
import ParentResultsPage from '../src/features/parent-portal/pages/ParentResultsPage';

const service = vi.hoisted(() => ({
  listResults: vi.fn(), getResult: vi.fn(), listAssignments: vi.fn(), listCertificates: vi.fn(),
}));
vi.mock('../src/features/parent-portal/parentPortalService', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/features/parent-portal/parentPortalService')>(),
  ...service,
}));

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}{location.search}</div>;
};
const page = (items: unknown[]) => ({ items, page: 1, limit: 20, total: items.length, totalPages: 1 });

describe('parent history pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    service.listResults.mockResolvedValue(page([{
      id: 'result-1', quizId: 'quiz-1', title: 'Phép nhân', subject: 'Toán', score: 8,
      correctCount: 8, totalQuestions: 10, correctRate: 80, classification: 'Tốt',
      hasTeacherReport: true, comment: null, needsImprovement: null, encouragement: null,
      submittedAt: '2026-07-22T00:00:00.000Z',
    }]));
    service.getResult.mockResolvedValue({
      id: 'result-1', quizId: 'quiz-1', title: 'Phép nhân', subject: 'Toán', score: 8,
      correctCount: 8, totalQuestions: 10, correctRate: 80, classification: 'Tốt',
      hasTeacherReport: true, comment: 'Con làm tốt.', needsImprovement: 'Đọc kỹ đề.',
      encouragement: 'Tiếp tục phát huy.', submittedAt: '2026-07-22T00:00:00.000Z',
    });
    service.listAssignments.mockResolvedValue(page([
      { id: 'a-1', assignmentId: 'hw-1', title: 'Bài tập Toán', subject: 'Toán', deadline: '2026-07-25T00:00:00.000Z', status: 'pending', score: null, teacherFeedback: null, submittedAt: null, publishedAt: null },
      { id: 'a-2', assignmentId: 'hw-2', title: 'Bài đã chấm', subject: 'Toán', deadline: '2026-07-20T00:00:00.000Z', status: 'graded', score: 9, teacherFeedback: 'Tốt', submittedAt: '2026-07-19T00:00:00.000Z', publishedAt: '2026-07-20T00:00:00.000Z' },
    ]));
    service.listCertificates.mockResolvedValue(page([{
      id: 'c-1', batchId: 'b-1', title: 'Hoàn thành xuất sắc', teacherName: 'Cô Khánh',
      message: 'Chúc mừng', quizTitle: 'Toán', studentScore: 9, imageUrl: 'https://assets.thtohieu.com/cert.png',
      issuedAt: '2026-07-22T00:00:00.000Z', sentAt: '2026-07-22T00:00:00.000Z', status: 'sent',
    }]));
  });

  it('keeps result filters in the URL and opens safe detail', async () => {
    render(<MemoryRouter initialEntries={['/results']}><ParentResultsPage /><LocationProbe /></MemoryRouter>);
    expect(await screen.findByText('Phép nhân')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Khoảng thời gian'), { target: { value: 'month' } });
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('period=month'));
  });

  it('shows aggregate result detail and teacher comments without answers', async () => {
    render(<MemoryRouter initialEntries={['/results/result-1']}><Routes><Route path="/results/:resultId" element={<ParentResultDetailPage />} /></Routes></MemoryRouter>);
    expect(await screen.findByText('Con làm tốt.')).toBeInTheDocument();
    expect(screen.getByText('8/10 câu đúng')).toBeInTheDocument();
    expect(screen.getByText('Đọc kỹ đề.')).toBeInTheDocument();
    expect(screen.queryByText(/đáp án đúng/i)).not.toBeInTheDocument();
  });

  it('filters assignment tabs and previews a certificate', async () => {
    const assignments = render(<MemoryRouter><ParentAssignmentsPage /></MemoryRouter>);
    expect(await screen.findByText('Bài tập Toán')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Đã chấm' }));
    expect(screen.queryByText('Bài tập Toán')).not.toBeInTheDocument();
    expect(screen.getByText('Bài đã chấm')).toBeInTheDocument();
    assignments.unmount();

    render(<MemoryRouter><ParentCertificatesPage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /Hoàn thành xuất sắc/ }));
    expect(screen.getByRole('dialog', { name: 'Chi tiết chứng nhận' })).toBeInTheDocument();
    expect(screen.getByAltText('Chứng nhận Hoàn thành xuất sắc')).toHaveAttribute(
      'src',
      '/api/parent/certificates/c-1/image',
    );
  });
});
