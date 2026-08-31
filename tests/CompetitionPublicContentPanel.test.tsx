import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CompetitionPublicContentPanel from '../src/features/competition/public-content/CompetitionPublicContentPanel';

const service = vi.hoisted(() => ({
  getPublicPage: vi.fn(),
  updatePublicPage: vi.fn(),
  previewPublicPage: vi.fn(),
  publishPublicPage: vi.fn(),
  archivePublicPage: vi.fn(),
  listArticles: vi.fn(),
  getArticle: vi.fn(),
  createArticle: vi.fn(),
  updateArticle: vi.fn(),
  deleteArticle: vi.fn(),
  getGoldenBoardConfig: vi.fn(),
  updateGoldenBoardConfig: vi.fn(),
  listAwardRuleVersions: vi.fn(),
  createAwardRuleVersion: vi.fn(),
  activateAwardRuleVersion: vi.fn(),
}));

vi.mock('../src/features/competition/public-content/competitionPublicContentService', () => ({
  competitionPublicContentService: service,
}));

const page = (status: 'DRAFT' | 'PREVIEW' | 'PUBLISHED' | 'ARCHIVED' = 'DRAFT') => ({
  id: 'page-1', campaignId: 'campaign-1', slug: 'hoi-thi-2026', status,
  heroTitle: 'Trang thi 2026', heroSubtitle: 'Cùng tranh tài', heroImageUrl: null,
  summary: 'Thông tin hội thi', ctaLabel: 'Tham gia', seoTitle: 'Hội thi 2026',
  seoDescription: 'Mô tả SEO', ogImageUrl: null, publishedAt: status === 'PUBLISHED' ? '2026-08-01T00:00:00.000Z' : null,
  archivedAt: status === 'ARCHIVED' ? '2026-08-02T00:00:00.000Z' : null,
  createdBy: 'admin', createdAt: '2026-07-01T00:00:00.000Z', updatedBy: 'admin', updatedAt: '2026-07-01T00:00:00.000Z',
});

const article = {
  id: 'article-1', campaignId: 'campaign-1', title: 'Thể lệ', slug: 'the-le', summary: 'Tóm tắt',
  coverImageUrl: null, content: 'Nội dung thể lệ', type: 'RULES', status: 'DRAFT', publishedAt: null,
  createdBy: 'admin', createdAt: '2026-07-01T00:00:00.000Z', updatedBy: 'admin', updatedAt: '2026-07-01T00:00:00.000Z',
};

const config = {
  id: 'board-1', campaignId: 'campaign-1', enabled: false, sourceEventId: null,
  awardRuleVersion: null, displayMode: 'AWARD_WINNERS', title: 'Bảng vàng', updatedBy: 'admin', updatedAt: '2026-07-01T00:00:00.000Z',
};

const rules = [{
  id: 'rule-1', rankFrom: 1, rankTo: 1, awardCode: 'GOLD', awardLabel: 'Giải Nhất', sortOrder: 1,
  scope: 'EVENT',
}];

const awardRuleVersion = {
  id: 'version-1', campaignId: 'campaign-1', version: 1, status: 'DRAFT', activatedAt: null,
  rules, createdBy: 'admin', createdAt: '2026-07-01T00:00:00.000Z', updatedBy: 'admin', updatedAt: '2026-07-01T00:00:00.000Z',
};

const events = [
  { id: 'event-same', campaignId: 'campaign-1', title: 'Thi cấp trường 2026', status: 'READY', examDate: '2026-08-10T00:00:00.000Z' },
  { id: 'event-other', campaignId: 'campaign-other', title: 'Không được chọn', status: 'READY', examDate: '2026-08-10T00:00:00.000Z' },
];

const renderPanel = (isAdmin = true) => render(
  <CompetitionPublicContentPanel campaignId="campaign-1" isAdmin={isAdmin} schoolExamEvents={events} />,
);

describe('CompetitionPublicContentPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    service.getPublicPage.mockResolvedValue(page());
    service.listArticles.mockResolvedValue([article]);
    service.getGoldenBoardConfig.mockResolvedValue(config);
    service.listAwardRuleVersions.mockResolvedValue([awardRuleVersion]);
    service.updatePublicPage.mockResolvedValue(page());
    service.previewPublicPage.mockResolvedValue(page('PREVIEW'));
    service.publishPublicPage.mockResolvedValue(page('PUBLISHED'));
    service.archivePublicPage.mockResolvedValue(page('ARCHIVED'));
    service.createArticle.mockResolvedValue(article);
    service.updateArticle.mockResolvedValue(article);
    service.updateGoldenBoardConfig.mockResolvedValue(config);
    service.createAwardRuleVersion.mockResolvedValue(awardRuleVersion);
    service.activateAwardRuleVersion.mockResolvedValue({ ...awardRuleVersion, status: 'ACTIVE' });
  });

  it('shows public content state to Teacher without mutation controls or winner editing', async () => {
    service.getPublicPage.mockResolvedValue(page('PREVIEW'));
    renderPanel(false);

    expect(await screen.findByText('Trang thi 2026')).toBeInTheDocument();
    expect(screen.getByText('PREVIEW')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lưu trang công khai' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xem trước trang công khai' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Công bố trang công khai' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/winner|mã học sinh|student/i)).not.toBeInTheDocument();
  });

  it('lets Admin edit the draft page and create an article with campaign scope', async () => {
    renderPanel();

    const heroTitle = await screen.findByLabelText('Tiêu đề hero');
    fireEvent.change(heroTitle, { target: { value: 'Hội thi Toàn quốc 2026' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu trang công khai' }));
    await waitFor(() => expect(service.updatePublicPage).toHaveBeenCalledWith('campaign-1', expect.objectContaining({
      heroTitle: 'Hội thi Toàn quốc 2026', requestId: expect.any(String),
    })));

    fireEvent.change(screen.getByLabelText('Tiêu đề bài viết mới'), { target: { value: 'Hướng dẫn tham gia' } });
    fireEvent.change(screen.getByLabelText('Slug bài viết mới'), { target: { value: 'huong-dan' } });
    fireEvent.change(screen.getByLabelText('Nội dung bài viết mới'), { target: { value: 'Các bước tham gia' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo bài viết' }));
    await waitFor(() => expect(service.createArticle).toHaveBeenCalledWith(expect.objectContaining({
      campaignId: 'campaign-1', title: 'Hướng dẫn tham gia', slug: 'huong-dan',
      content: 'Các bước tham gia', status: 'DRAFT', requestId: expect.any(String),
    })));
  });

  it('previews staff-only and requires confirmation before publishing or archiving', async () => {
    renderPanel();

    await screen.findByLabelText('Tiêu đề hero');
    fireEvent.click(screen.getByRole('button', { name: 'Xem trước trang công khai' }));
    await waitFor(() => expect(service.previewPublicPage).toHaveBeenCalledWith('campaign-1', expect.any(String)));
    expect(await screen.findByRole('dialog', { name: 'Bản xem trước staff-only' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Đóng xem trước' }));

    fireEvent.click(screen.getByRole('button', { name: 'Công bố trang công khai' }));
    expect(await screen.findByRole('button', { name: 'Xác nhận công bố' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận công bố' }));
    await waitFor(() => expect(service.publishPublicPage).toHaveBeenCalledWith('campaign-1', expect.any(String)));

    fireEvent.click(screen.getByRole('button', { name: 'Lưu trữ trang công khai' }));
    expect(await screen.findByRole('button', { name: 'Xác nhận lưu trữ' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận lưu trữ' }));
    await waitFor(() => expect(service.archivePublicPage).toHaveBeenCalledWith('campaign-1', expect.any(String)));
  });

  it('filters Golden Board source events to the selected campaign and persists award configuration', async () => {
    renderPanel();

    expect(await screen.findByRole('option', { name: 'Thi cấp trường 2026' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Không được chọn' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Bật Golden Board'));
    fireEvent.change(screen.getByLabelText('Sự kiện nguồn Golden Board'), { target: { value: 'event-same' } });
    fireEvent.change(screen.getByLabelText('Phiên bản luật giải Golden Board'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu cấu hình Golden Board' }));
    await waitFor(() => expect(service.updateGoldenBoardConfig).toHaveBeenCalledWith('campaign-1', expect.objectContaining({
      enabled: true, sourceEventId: 'event-same', awardRuleVersion: 1, requestId: expect.any(String),
    })));
  });

  it('creates a new award-rule version and activates a DRAFT version as Admin', async () => {
    renderPanel();

    await screen.findByRole('button', { name: 'Kích hoạt v1' });
    fireEvent.click(screen.getByRole('button', { name: 'Kích hoạt v1' }));
    await waitFor(() => expect(service.activateAwardRuleVersion).toHaveBeenCalledWith('campaign-1', 1, expect.any(String)));

    fireEvent.click(screen.getByRole('button', { name: 'Tạo phiên bản luật giải' }));
    await waitFor(() => expect(service.createAwardRuleVersion).toHaveBeenCalledWith(expect.objectContaining({
      campaignId: 'campaign-1',
      rules: [expect.objectContaining({ scope: 'EVENT', rankFrom: 1, rankTo: 1 })],
      requestId: expect.any(String),
    })));
  });
});
