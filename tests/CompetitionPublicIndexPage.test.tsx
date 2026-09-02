import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicCompetitionSummaryDto } from '../shared/competition-portal.contract';
import { AppRoutes } from '../src/app/AppRoutes';
import CompetitionIndexPage from '../src/features/competition/portal/public/CompetitionIndexPage';
import { resolveApiRoute } from '../src/services/api/routeResolver';

const mocks = vi.hoisted(() => ({
  callApi: vi.fn(),
}));

vi.mock('../src/services/apiAdapter', () => ({
  callApi: mocks.callApi,
}));

const campaign = (
  slug: string,
  title: string,
  publicState: PublicCompetitionSummaryDto['publicState'],
): PublicCompetitionSummaryDto => ({
  slug,
  title,
  summary: `${title} summary`,
  schoolYear: '2026-2027',
  publicState,
  startsAt: '2026-08-01T00:00:00.000Z',
  endsAt: '2026-09-30T23:59:59.000Z',
  timezone: 'Asia/Ho_Chi_Minh',
  hero: { title: `${title} hero`, subtitle: `${title} subtitle` },
  cta: { label: 'VÀO THI' },
  rounds: Array.from({ length: 6 }, (_, index) => ({
    roundNumber: index + 1,
    title: `Vòng ${index + 1}`,
    opensAt: `2026-08-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
    closesAt: `2026-08-${String(index + 2).padStart(2, '0')}T23:59:59.000Z`,
    state: index === 0 ? 'OPEN' : 'LOCKED',
  })),
  articleSummaryAvailable: true,
});

const publicCampaigns = [
  { ...campaign('dang-dien-ra', 'Cuộc thi đang diễn ra', 'ONGOING'), internalCampaignStatus: 'ACTIVE' },
  { ...campaign('sap-dien-ra', 'Cuộc thi sắp diễn ra', 'UPCOMING'), internalCampaignStatus: 'SCHEDULED' },
  { ...campaign('da-ket-thuc', 'Cuộc thi đã kết thúc', 'ENDED'), internalCampaignStatus: 'CLOSED' },
] as PublicCompetitionSummaryDto[];

const renderIndex = () => render(
  <MemoryRouter initialEntries={['/cuoc-thi']}>
    <CompetitionIndexPage />
  </MemoryRouter>,
);

describe('Competition public index', () => {
  beforeEach(() => {
    mocks.callApi.mockReset();
    mocks.callApi.mockResolvedValue({ status: 'success', data: publicCampaigns });
  });

  it('browses anonymously in a dedicated semantic shell and groups only public states', async () => {
    renderIndex();

    expect(await screen.findByRole('heading', { name: /sân chơi tô hiệu quiz/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /bỏ qua đến nội dung/i })).toHaveAttribute('href', '#competition-public-main');
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /điều hướng cuộc thi/i })).toBeInTheDocument();

    const running = screen.getByRole('region', { name: /đang diễn ra/i });
    const upcoming = screen.getByRole('region', { name: /sắp diễn ra/i });
    const completed = screen.getByRole('region', { name: /đã kết thúc/i });
    expect(within(running).getByText('Cuộc thi đang diễn ra')).toBeInTheDocument();
    expect(within(upcoming).getByText('Cuộc thi sắp diễn ra')).toBeInTheDocument();
    expect(within(completed).getByText('Cuộc thi đã kết thúc')).toBeInTheDocument();

    expect(screen.queryByText('ACTIVE')).not.toBeInTheDocument();
    expect(screen.queryByText('SCHEDULED')).not.toBeInTheDocument();
    expect(screen.queryByText('CLOSED')).not.toBeInTheDocument();
    expect(screen.queryByText(/student dashboard/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/teacher dashboard/i)).not.toBeInTheDocument();

    expect(mocks.callApi).toHaveBeenCalledTimes(1);
    expect(mocks.callApi).toHaveBeenCalledWith('list_public_competitions');
    expect(resolveApiRoute('list_public_competitions').auth).toBe('public');
  });

  it('renders the six-round journey and public entry points with canonical student CTAs', async () => {
    renderIndex();

    const journey = await screen.findByRole('region', { name: /hành trình 6 vòng/i });
    expect(within(journey).getAllByRole('listitem')).toHaveLength(6);

    const schedule = screen.getByRole('region', { name: /lịch thi nổi bật/i });
    expect(within(schedule).getByText(/cuộc thi đang diễn ra/i)).toBeInTheDocument();
    expect(schedule.querySelector('time[datetime="2026-08-01T00:00:00.000Z"]')).not.toBeNull();
    expect(schedule.querySelector('time[datetime="2026-09-30T23:59:59.000Z"]')).not.toBeNull();
    expect(schedule.querySelector('time[datetime="2026-08-01T00:00:00.000Z"]')).toHaveTextContent('07:00 1 thg 8, 2026');

    const firstRound = within(schedule).getAllByRole('listitem')[0];
    expect(firstRound.querySelector('time[datetime="2026-08-01T00:00:00.000Z"]')).toHaveTextContent('07:00 1 thg 8, 2026');
    expect(firstRound.querySelector('time[datetime="2026-08-02T23:59:59.000Z"]')).toHaveTextContent('06:59 3 thg 8, 2026');

    expect(screen.getAllByRole('link', { name: 'VÀO THI' })[0]).toHaveAttribute('href', '/thi/dang-dien-ra');
    expect(screen.getByRole('link', { name: /lịch thi/i })).toHaveAttribute('href', '/cuoc-thi/dang-dien-ra#lich-thi');
    expect(screen.getByRole('link', { name: /tin mới nhất/i })).toHaveAttribute('href', '/cuoc-thi/dang-dien-ra#tin-tuc');
    expect(screen.getByRole('link', { name: /thể lệ/i })).toHaveAttribute('href', '/cuoc-thi/dang-dien-ra#the-le');
    expect(screen.getByRole('link', { name: /hướng dẫn/i })).toHaveAttribute('href', '/cuoc-thi/dang-dien-ra#huong-dan');
    expect(screen.getByRole('link', { name: /bảng vàng/i })).toHaveAttribute('href', '/cuoc-thi/dang-dien-ra/bang-vang');
  });

  it('keeps system Hanoi formatting stable when the public DTO timezone is invalid', async () => {
    mocks.callApi.mockResolvedValue({
      status: 'success',
      data: [{ ...campaign('invalid-timezone', 'Cuộc thi timezone lỗi', 'ONGOING'), timezone: 'Invalid/Timezone' }],
    });

    renderIndex();

    const schedule = await screen.findByRole('region', { name: /lịch thi nổi bật/i });
    expect(schedule.querySelector('time[datetime="2026-08-01T00:00:00.000Z"]')).toHaveTextContent('07:00 1 thg 8, 2026');
    expect(within(schedule).getByText('Cuộc thi timezone lỗi')).toBeInTheDocument();
  });

  it('mounts `/cuoc-thi` without ProtectedRoute or a Student session', async () => {
    render(
      <MemoryRouter initialEntries={['/cuoc-thi']}>
        <AppRoutes giftShopEnabled={false} sessionsReady />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: /sân chơi tô hiệu quiz/i })).toBeInTheDocument();
    expect(screen.queryByTestId('route-session-loading')).not.toBeInTheDocument();
    expect(mocks.callApi).toHaveBeenCalledWith('list_public_competitions');
  });
});
