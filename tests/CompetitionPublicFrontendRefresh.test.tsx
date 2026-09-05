import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  PublicCompetitionArticleDto,
  PublicCompetitionDetailDto,
  PublicCompetitionSummaryDto,
  PublicGoldenBoardDto,
} from '../shared/competition-portal.contract';
import CompetitionArticlePage from '../src/features/competition/portal/public/CompetitionArticlePage';
import CompetitionCampaignPage from '../src/features/competition/portal/public/CompetitionCampaignPage';
import CompetitionGoldenBoardPage from '../src/features/competition/portal/public/CompetitionGoldenBoardPage';
import CompetitionIndexPage from '../src/features/competition/portal/public/CompetitionIndexPage';

const mocks = vi.hoisted(() => ({
  listCompetitions: vi.fn(),
  getCompetition: vi.fn(),
  getArticle: vi.fn(),
  getGoldenBoard: vi.fn(),
}));

vi.mock('../src/features/competition/portal/public/publicCompetitionPortalService', () => ({
  publicCompetitionPortalService: mocks,
}));

const rounds = Array.from({ length: 6 }, (_, index) => ({
  roundNumber: index + 1,
  title: `Chặng ${index + 1}`,
  opensAt: `2026-09-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
  closesAt: `2026-09-${String(index + 2).padStart(2, '0')}T23:59:59.000Z`,
  state: index === 0 ? 'OPEN' as const : 'LOCKED' as const,
}));

const articles: PublicCompetitionArticleDto[] = [
  {
    slug: 'lich-thi',
    title: 'Lịch thi chính thức',
    summary: 'Theo dõi thời gian mở và kết thúc của từng vòng thi.',
    content: '## Lịch thi\n\nThông tin lịch thi công khai.',
    type: 'SCHEDULE',
    publishedAt: '2026-08-25T00:00:00.000Z',
  },
  {
    slug: 'the-le',
    title: 'Thể lệ Trạng Nguyên Nhí',
    summary: 'Những quy định cần biết trước khi tham gia.',
    content: '## Thể lệ\n\nNội dung thể lệ công khai.',
    type: 'RULES',
    publishedAt: '2026-08-26T00:00:00.000Z',
  },
  {
    slug: 'huong-dan',
    title: 'Hướng dẫn tham gia',
    summary: 'Các bước chuẩn bị và vào thi.',
    content: '## Hướng dẫn\n\nNội dung hướng dẫn công khai.',
    type: 'GUIDE',
    publishedAt: '2026-08-27T00:00:00.000Z',
  },
];

const campaign: PublicCompetitionDetailDto = {
  slug: 'trang-nguyen-nhi-2026-2027',
  title: 'Trạng Nguyên Nhí 2026–2027',
  summary: 'Sân chơi học tập để mỗi học sinh khám phá và ghi nhận sự tiến bộ.',
  schoolYear: '2026-2027',
  publicState: 'ONGOING',
  startsAt: '2026-09-01T00:00:00.000Z',
  endsAt: '2027-05-31T23:59:59.000Z',
  timezone: 'Asia/Ho_Chi_Minh',
  hero: {
    title: 'Tự tin chinh phục từng vòng thi',
    subtitle: 'Học hỏi, rèn luyện và tỏa sáng cùng Tô Hiệu Quiz.',
  },
  cta: { label: 'VÀO THI' },
  rounds,
  articleSummaryAvailable: true,
  goldenBoardAvailable: true,
  articles,
};

const summary: PublicCompetitionSummaryDto = {
  slug: campaign.slug,
  title: campaign.title,
  summary: campaign.summary,
  schoolYear: campaign.schoolYear,
  publicState: campaign.publicState,
  startsAt: campaign.startsAt,
  endsAt: campaign.endsAt,
  timezone: campaign.timezone,
  hero: campaign.hero,
  cta: campaign.cta,
  rounds: campaign.rounds,
  articleSummaryAvailable: true,
};

const goldenBoard: PublicGoldenBoardDto = {
  publicationVersion: 1,
  rankingVersion: 1,
  awardRuleVersion: 1,
  publishedAt: '2027-06-01T00:00:00.000Z',
  winners: [{
    awardCode: 'GOLD',
    awardLabel: 'Giải Nhất',
    fullName: 'Nguyễn Minh Anh',
    className: '5A1',
    schoolName: 'Tiểu học Tô Hiệu',
    gradeLevel: 5,
  }],
};

describe('Competition public frontend refresh', () => {
  beforeEach(() => {
    mocks.listCompetitions.mockReset().mockResolvedValue([summary]);
    mocks.getCompetition.mockReset().mockResolvedValue(campaign);
    mocks.getArticle.mockReset().mockResolvedValue(articles[1]);
    mocks.getGoldenBoard.mockReset().mockResolvedValue(goldenBoard);
  });

  it('presents an original discovery-first landing experience', async () => {
    render(
      <MemoryRouter initialEntries={['/cuoc-thi']}>
        <CompetitionIndexPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: /sân chơi tô hiệu quiz/i })).toBeInTheDocument();
    expect(screen.getByText('Mỗi thử thách, một bước trưởng thành')).toBeInTheDocument();
    const discovery = screen.getByRole('region', { name: 'Khám phá cuộc thi' });
    expect(within(discovery).getByRole('link', { name: 'Xem thông tin' })).toHaveAttribute(
      'href',
      `/cuoc-thi/${campaign.slug}`,
    );
    expect(screen.getByRole('navigation', { name: 'Lối tắt nội dung cuộc thi' })).toBeInTheDocument();
  });

  it('organizes campaign information with Vietnamese labels and quick navigation', async () => {
    render(
      <MemoryRouter initialEntries={[`/cuoc-thi/${campaign.slug}`]}>
        <CompetitionCampaignPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { level: 1, name: campaign.title })).toBeInTheDocument();
    const navigation = screen.getByRole('navigation', { name: 'Khám phá cuộc thi' });
    expect(within(navigation).getByRole('link', { name: 'Lịch thi' })).toHaveAttribute('href', '#lich-thi');
    expect(within(navigation).getByRole('link', { name: 'Tin mới' })).toHaveAttribute('href', '#tin-tuc');
    expect(screen.getByRole('heading', { name: 'Lịch thi' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Thể lệ' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hướng dẫn' })).toBeInTheDocument();
  });

  it('turns a public article into a readable editorial page', async () => {
    render(
      <MemoryRouter initialEntries={[`/cuoc-thi/${campaign.slug}/tin-tuc/the-le`]}>
        <CompetitionArticlePage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { level: 1, name: articles[1].title })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Điều hướng bài viết' })).toBeInTheDocument();
    expect(screen.getAllByText('Thể lệ')).not.toHaveLength(0);
    expect(screen.getByText(articles[1].summary!)).toBeInTheDocument();
    expect(screen.getByText('Nội dung bài viết')).toBeInTheDocument();
  });

  it('celebrates published winners in a dedicated recognition experience', async () => {
    render(
      <MemoryRouter initialEntries={[`/cuoc-thi/${campaign.slug}/bang-vang`]}>
        <CompetitionGoldenBoardPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { level: 1, name: 'Bảng vàng' })).toBeInTheDocument();
    expect(screen.getByText('Những gương mặt tỏa sáng')).toBeInTheDocument();
    const winners = screen.getByRole('region', { name: 'Giải Nhất' });
    expect(within(winners).getByRole('heading', { name: 'Nguyễn Minh Anh' })).toBeInTheDocument();
  });
});
