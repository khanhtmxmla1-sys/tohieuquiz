import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  PublicCompetitionArticleDto,
  PublicCompetitionDetailDto,
} from '../shared/competition-portal.contract';
import CompetitionArticlePage from '../src/features/competition/portal/public/CompetitionArticlePage';
import CompetitionCampaignPage from '../src/features/competition/portal/public/CompetitionCampaignPage';

const mocks = vi.hoisted(() => ({
  getCompetition: vi.fn(),
  getArticle: vi.fn(),
}));

vi.mock('../src/features/competition/portal/public/publicCompetitionPortalService', () => ({
  publicCompetitionPortalService: mocks,
}));

const now = '2026-08-25T00:00:00.000Z';
const later = '2027-05-31T23:59:59.000Z';

const makeArticle = (
  slug: string,
  type: PublicCompetitionArticleDto['type'],
  title: string,
): PublicCompetitionArticleDto => ({
  slug,
  title,
  summary: `${title} summary`,
  coverImageUrl: 'https://example.edu/article.jpg',
  content: `## ${title}\n\nPublic article body.`,
  type,
  publishedAt: now,
});

const campaign: PublicCompetitionDetailDto = {
  slug: 'san-choi-2026',
  title: 'Sân chơi Tô Hiệu 2026',
  summary: 'Sáu vòng thi học tập dành cho học sinh.',
  schoolYear: '2026-2027',
  publicState: 'ONGOING',
  startsAt: now,
  endsAt: later,
  timezone: 'Asia/Ho_Chi_Minh',
  hero: {
    title: 'Chinh phục tri thức',
    subtitle: 'Cùng học, cùng vui',
    imageUrl: 'https://example.edu/hero.jpg',
  },
  cta: { label: 'VÀO THI' },
  rounds: Array.from({ length: 6 }, (_, index) => ({
    roundNumber: index + 1,
    title: `Vòng ${index + 1}`,
    opensAt: now,
    closesAt: later,
    state: index === 0 ? 'OPEN' : 'LOCKED',
  })),
  articleSummaryAvailable: true,
  goldenBoardAvailable: true,
  articles: [
    makeArticle('lich-thi', 'SCHEDULE', 'Lịch thi chính thức'),
    makeArticle('the-le', 'RULES', 'Thể lệ cuộc thi'),
    makeArticle('huong-dan', 'GUIDE', 'Hướng dẫn tham gia'),
    makeArticle('tin-moi', 'ANNOUNCEMENT', 'Tin mới nhất'),
  ],
};

const renderCampaign = (value = campaign) => render(
  <MemoryRouter initialEntries={[`/cuoc-thi/${value.slug}`]}>
    <CompetitionCampaignPage />
  </MemoryRouter>,
);

const renderArticle = (value = campaign.articles[1]) => render(
  <MemoryRouter initialEntries={[`/cuoc-thi/${campaign.slug}/tin-tuc/${value.slug}`]}>
    <CompetitionArticlePage />
  </MemoryRouter>,
);

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
};

describe('Competition public content pages', () => {
  beforeEach(() => {
    mocks.getCompetition.mockReset();
    mocks.getArticle.mockReset();
    mocks.getCompetition.mockResolvedValue(campaign);
    mocks.getArticle.mockResolvedValue(campaign.articles[1]);
  });

  it('renders the public campaign detail from the strict DTO and canonical links', async () => {
    renderCampaign();

    expect(await screen.findByRole('heading', { level: 1, name: campaign.title })).toBeInTheDocument();
    expect(screen.getByText('Năm học 2026-2027')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: campaign.hero.title })).toBeInTheDocument();
    expect(screen.getByText(campaign.hero.subtitle)).toBeInTheDocument();
    expect(screen.getByText(campaign.summary)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Chinh phục tri thức' }))
      .toHaveAttribute('src', campaign.hero.imageUrl);
    expect(screen.getByRole('img', { name: 'Chinh phục tri thức' }))
      .toHaveAttribute('width', '1200');
    expect(screen.getByRole('img', { name: 'Chinh phục tri thức' }))
      .toHaveAttribute('height', '900');

    const journey = screen.getByRole('region', { name: /hành trình 6 vòng/i });
    expect(within(journey).getAllByRole('listitem')).toHaveLength(6);

    expect(screen.getByRole('link', { name: 'VÀO THI' })).toHaveAttribute('href', '/thi/san-choi-2026');
    expect(screen.getByRole('link', { name: /bảng vàng/i })).toHaveAttribute(
      'href',
      '/cuoc-thi/san-choi-2026/bang-vang',
    );
    expect(screen.getByRole('link', { name: 'Thể lệ cuộc thi' })).toHaveAttribute(
      'href',
      '/cuoc-thi/san-choi-2026/tin-tuc/the-le',
    );
    expect(screen.getByRole('link', { name: 'Hướng dẫn tham gia' })).toHaveAttribute(
      'href',
      '/cuoc-thi/san-choi-2026/tin-tuc/huong-dan',
    );
    expect(screen.queryByText(/studentId|attempt|reconcile|incident/i)).not.toBeInTheDocument();
    expect(mocks.getCompetition).toHaveBeenCalledWith('san-choi-2026');
  });

  it('uses a meaningful stable hero fallback when campaign media is unavailable', async () => {
    const campaignWithoutImage = {
      ...campaign,
      hero: { ...campaign.hero, imageUrl: undefined },
    };
    mocks.getCompetition.mockResolvedValue(campaignWithoutImage);

    renderCampaign(campaignWithoutImage);

    expect(await screen.findByRole('heading', { level: 1, name: campaign.title })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Hình minh họa Chinh phục tri thức' })).toBeInTheDocument();
  });

  it('switches to the hero fallback when campaign media fails to load', async () => {
    renderCampaign();

    const heroImage = await screen.findByRole('img', { name: campaign.hero.title });
    fireEvent.error(heroImage);

    expect(screen.getByRole('img', { name: `Hình minh họa ${campaign.hero.title}` })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: campaign.hero.title })).not.toBeInTheDocument();
  });

  it('shows the Golden Board CTA only when the public availability flag is true', async () => {
    mocks.getCompetition.mockResolvedValue({ ...campaign, goldenBoardAvailable: false });
    renderCampaign({ ...campaign, goldenBoardAvailable: false });

    await screen.findByRole('heading', { name: 'Sân chơi Tô Hiệu 2026' });
    expect(screen.queryByRole('link', { name: /bảng vàng/i })).not.toBeInTheDocument();
  });

  it('ignores a stale campaign response after the route slug changes', async () => {
    const slow = deferred<PublicCompetitionDetailDto>();
    const currentCampaign = { ...campaign, slug: 'current-campaign', title: 'Current campaign' };
    const staleCampaign = { ...campaign, slug: 'stale-campaign', title: 'Stale campaign' };
    mocks.getCompetition.mockImplementation((slug: string) => (
      slug === staleCampaign.slug ? slow.promise : Promise.resolve(currentCampaign)
    ));

    render(
      <MemoryRouter initialEntries={[`/cuoc-thi/${staleCampaign.slug}`]}>
        <Link to={`/cuoc-thi/${currentCampaign.slug}`}>Switch campaign</Link>
        <Routes>
          <Route path="/cuoc-thi/:campaignSlug" element={<CompetitionCampaignPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(mocks.getCompetition).toHaveBeenCalledWith(staleCampaign.slug);
    fireEvent.click(screen.getByRole('link', { name: 'Switch campaign' }));
    expect(await screen.findByRole('heading', { name: currentCampaign.title })).toBeInTheDocument();

    slow.resolve(staleCampaign);
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: staleCampaign.title })).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: currentCampaign.title })).toBeInTheDocument();
    });
  });

  it('uses a friendly non-diagnostic state for unknown or unavailable public campaigns', async () => {
    mocks.getCompetition.mockRejectedValue(new Error('PRIVATE_CAMPAIGN_CONFIGURATION_SECRET'));

    renderCampaign();

    expect(await screen.findByRole('alert')).toHaveTextContent(/không tìm thấy|tạm thời chưa khả dụng/i);
    expect(screen.queryByText('PRIVATE_CAMPAIGN_CONFIGURATION_SECRET')).not.toBeInTheDocument();
    expect(screen.queryByText(/eligibility|quiz mapping|room|export/i)).not.toBeInTheDocument();
  });

  it('renders one published article through the safe Markdown component', async () => {
    const article = {
      ...campaign.articles[1],
      content: '# Thể lệ\n\nNội dung **công khai** với [quy định](https://example.edu/rules).',
    };
    mocks.getArticle.mockResolvedValue(article);

    renderArticle(article);

    expect(await screen.findByRole('heading', { level: 1, name: 'Thể lệ cuộc thi' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 2, name: 'Thể lệ' })).toBeInTheDocument();
    expect(screen.getByText('RULES')).toBeInTheDocument();
    expect(screen.getByText('Nội dung')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: article.title }))
      .toHaveAttribute('width', '1200');
    expect(screen.getByRole('img', { name: article.title }))
      .toHaveAttribute('height', '675');
    expect(screen.getByRole('link', { name: 'quy định' })).toHaveAttribute('href', 'https://example.edu/rules');
    expect(screen.getByRole('link', { name: 'quy định' })).toHaveAttribute('rel', 'noopener noreferrer');
    expect(mocks.getArticle).toHaveBeenCalledWith('san-choi-2026', 'the-le');
  });

  it('renders a stable, meaningful cover fallback when an article has no image', async () => {
    const articleWithoutCover = { ...campaign.articles[1], coverImageUrl: undefined };
    mocks.getArticle.mockResolvedValue(articleWithoutCover);

    renderArticle(articleWithoutCover);

    expect(await screen.findByRole('heading', { level: 1, name: articleWithoutCover.title })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: `Hình minh họa bài viết ${articleWithoutCover.title}` }))
      .toBeInTheDocument();
  });

  it('switches to the article cover fallback when media fails to load', async () => {
    renderArticle();

    const coverImage = await screen.findByRole('img', { name: campaign.articles[1].title });
    fireEvent.error(coverImage);

    expect(screen.getByRole('img', { name: `Hình minh họa bài viết ${campaign.articles[1].title}` }))
      .toBeInTheDocument();
    expect(screen.queryByRole('img', { name: campaign.articles[1].title })).not.toBeInTheDocument();
  });

  it('uses a friendly non-diagnostic state for missing or unavailable articles', async () => {
    mocks.getArticle.mockRejectedValue(new Error('PRIVATE_ARTICLE_DRAFT_SECRET'));

    renderArticle();

    expect(await screen.findByRole('alert')).toHaveTextContent(/không tìm thấy|tạm thời chưa khả dụng/i);
    expect(screen.queryByText('PRIVATE_ARTICLE_DRAFT_SECRET')).not.toBeInTheDocument();
    expect(screen.queryByText(/createdBy|campaignId|draft/i)).not.toBeInTheDocument();
  });

  it('ignores a stale article response after the article slug changes', async () => {
    const slow = deferred<PublicCompetitionArticleDto>();
    const staleArticle = makeArticle('stale-article', 'RULES', 'Stale article');
    const currentArticle = makeArticle('current-article', 'GUIDE', 'Current article');
    mocks.getArticle.mockImplementation((_campaignSlug: string, articleSlug: string) => (
      articleSlug === staleArticle.slug ? slow.promise : Promise.resolve(currentArticle)
    ));

    render(
      <MemoryRouter initialEntries={[`/cuoc-thi/${campaign.slug}/tin-tuc/${staleArticle.slug}`]}>
        <Link to={`/cuoc-thi/${campaign.slug}/tin-tuc/${currentArticle.slug}`}>Switch article</Link>
        <Routes>
          <Route
            path="/cuoc-thi/:campaignSlug/tin-tuc/:articleSlug"
            element={<CompetitionArticlePage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(mocks.getArticle).toHaveBeenCalledWith(campaign.slug, staleArticle.slug);
    fireEvent.click(screen.getByRole('link', { name: 'Switch article' }));
    expect(await screen.findByRole('heading', { level: 1, name: currentArticle.title })).toBeInTheDocument();

    slow.resolve(staleArticle);
    await waitFor(() => {
      expect(screen.queryByRole('heading', { level: 1, name: staleArticle.title })).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1, name: currentArticle.title })).toBeInTheDocument();
    });
  });
});
