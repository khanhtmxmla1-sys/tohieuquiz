import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes, useNavigate, useOutletContext } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StudentCompetitionPortalDto } from '../shared/competition-portal.contract';
import CompetitionStudentRoute from '../src/features/competition/portal/student/CompetitionStudentRoute';

const mocks = vi.hoisted(() => ({
  resolveBySlug: vi.fn(),
  classifyError: vi.fn(),
}));

vi.mock('../src/features/competition/portal/studentCompetitionPortalService', () => ({
  studentCompetitionPortalService: {
    resolveBySlug: mocks.resolveBySlug,
    classifyError: mocks.classifyError,
  },
}));

const portal: StudentCompetitionPortalDto = {
  campaignId: 'campaign-1',
  slug: 'olympic-toan',
  title: 'Olympic Toán 2026',
  schoolYear: '2026-2027',
  publicState: 'ONGOING',
  rounds: [],
};

const PortalProbe = () => {
  const context = useOutletContext<StudentCompetitionPortalDto>();
  return <p>Child portal: {context.title}</p>;
};

const NavigationProbe = () => {
  const navigate = useNavigate();
  return (
    <>
      <button type="button" onClick={() => navigate('/thi/olympic-toan')}>Go to A</button>
      <button type="button" onClick={() => navigate('/thi/olympic-ly')}>Go to B</button>
    </>
  );
};

const renderRoute = (entry = '/thi/olympic-toan') => render(
  <React.StrictMode>
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/thi/:campaignSlug" element={<CompetitionStudentRoute />}>
          <Route element={<><Outlet /><PortalProbe /><NavigationProbe /></>}>
            <Route index element={<p>Trang cuộc thi</p>} />
            <Route path="vong/:roundNumber/lam-bai" element={<p>Đang làm bài</p>} />
          </Route>
        </Route>
      </Routes>
    </MemoryRouter>
  </React.StrictMode>,
);

describe('CompetitionStudentRoute and CompetitionStudentShell', () => {
  beforeEach(() => {
    mocks.resolveBySlug.mockReset();
    mocks.classifyError.mockReset();
    mocks.resolveBySlug.mockResolvedValue({ competition: {} as never, portal });
  });

  it('resolves once for the slug and gives the portal DTO to child routes', async () => {
    renderRoute();

    expect(screen.getByRole('status')).toHaveTextContent('Đang tải cuộc thi');
    expect(await screen.findByText('Child portal: Olympic Toán 2026')).toBeInTheDocument();
    expect(mocks.resolveBySlug).toHaveBeenCalledTimes(1);
    expect(mocks.resolveBySlug).toHaveBeenCalledWith('olympic-toan');
  });

  it('resolves a slug again when revisiting it within the mounted parent route', async () => {
    const portalAFirst = { ...portal, title: 'Olympic ToÃ¡n láº§n Ä‘áº§u' };
    const portalB = { ...portal, campaignId: 'campaign-2', slug: 'olympic-ly', title: 'Olympic LÃ½' };
    const portalASecond = { ...portal, title: 'Olympic ToÃ¡n má»›i' };
    mocks.resolveBySlug
      .mockResolvedValueOnce({ competition: {} as never, portal: portalAFirst })
      .mockResolvedValueOnce({ competition: {} as never, portal: portalB })
      .mockResolvedValueOnce({ competition: {} as never, portal: portalASecond });

    renderRoute();

    expect(await screen.findByText('Child portal: Olympic ToÃ¡n láº§n Ä‘áº§u')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Go to B' }));
    expect(await screen.findByText('Child portal: Olympic LÃ½')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Go to A' }));

    expect(await screen.findByText('Child portal: Olympic ToÃ¡n má»›i')).toBeInTheDocument();
    expect(mocks.resolveBySlug.mock.calls.map(([slug]) => slug)).toEqual([
      'olympic-toan',
      'olympic-ly',
      'olympic-toan',
    ]);
  });

  it('renders a distraction-free semantic shell with a skip link and dashboard back action', async () => {
    renderRoute();

    expect(await screen.findByRole('banner')).toHaveTextContent('Cuộc thi');
    expect(screen.getByRole('link', { name: 'Bỏ qua đến nội dung cuộc thi' })).toHaveAttribute('href', '#competition-main');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'competition-main');
    expect(screen.getByRole('link', { name: 'Quay lại bảng điều khiển học sinh' })).toHaveAttribute('href', '/student/dashboard');
    expect(screen.queryByText(/trò chuyện|cửa hàng|thành tích/i)).not.toBeInTheDocument();
  });

  it('hides unrelated back navigation while an exam is active', async () => {
    renderRoute('/thi/olympic-toan/vong/2/lam-bai');

    expect(await screen.findByText('Đang làm bài')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Quay lại bảng điều khiển học sinh' })).not.toBeInTheDocument();
  });

  it.each([
    ['BUSINESS_RULE', 'Không thể tham gia cuộc thi', false],
    ['NOT_FOUND', 'Không tìm thấy cuộc thi', false],
    ['AUTH', 'Phiên học sinh không hợp lệ', false],
    ['TRANSIENT', 'Không thể kết nối đến cuộc thi', true],
  ] as const)('distinguishes %s failures', async (kind, message, retryable) => {
    const error = new Error(kind);
    mocks.resolveBySlug.mockRejectedValue(error);
    mocks.classifyError.mockReturnValue({
      kind,
      code: kind,
      message: 'Server detail',
      status: kind === 'NOT_FOUND' ? 404 : 400,
      retryable,
    });

    renderRoute();

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    if (retryable) expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
    else expect(screen.queryByRole('button', { name: 'Thử lại' })).not.toBeInTheDocument();
    await waitFor(() => expect(mocks.classifyError).toHaveBeenCalledWith(error));
  });
});
