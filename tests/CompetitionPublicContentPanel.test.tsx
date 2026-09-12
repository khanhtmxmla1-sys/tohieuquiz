import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../src/services/api/errors';
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
  publishArticle: vi.fn(),
  archiveArticle: vi.fn(),
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

const campaign = {
  id: 'campaign-1', title: 'Trạng Nguyên Nhí', schoolYear: '2026-2027', timezone: 'Asia/Ho_Chi_Minh', status: 'PUBLISHED',
  audienceRule: { gradeLevels: [4, 5], classIds: ['4A', '5B'] },
  eligibilityPolicy: { requiredRounds: 6 as const, requiredPassedRounds: 5 },
  startsAt: '2026-08-24T09:00:00.000Z', endsAt: '2026-12-31T16:00:00.000Z',
};

const rounds = [
  { id: 'round-1', campaignId: 'campaign-1', roundNumber: 1, opensAt: '2026-08-25T09:00:00.000Z', closesAt: '2026-08-31T16:00:00.000Z', maxAttempts: 2, passingScore: 7, status: 'SCHEDULED' },
  { id: 'round-2', campaignId: 'campaign-1', roundNumber: 2, opensAt: '2026-09-01T09:00:00.000Z', closesAt: '2026-09-07T16:00:00.000Z', maxAttempts: 3, passingScore: 8, status: 'SCHEDULED' },
];

const renderPanel = (isAdmin = true) => render(
  <CompetitionPublicContentPanel campaignId="campaign-1" isAdmin={isAdmin} schoolExamEvents={events} campaign={campaign} rounds={rounds} />,
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
    service.publishArticle.mockResolvedValue({ ...article, status: 'PUBLISHED', publishedAt: '2026-08-02T00:00:00.000Z' });
    service.archiveArticle.mockResolvedValue({ ...article, status: 'ARCHIVED', publishedAt: '2026-08-02T00:00:00.000Z' });
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
    expect(screen.queryByRole('button', { name: 'Công bố bài viết' })).not.toBeInTheDocument();
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

  it('prefills an official schedule draft from canonical configuration without calling the API', async () => {
    renderPanel();

    const typeSelect = await screen.findByLabelText('Loại bài viết mới');
    fireEvent.change(typeSelect, { target: { value: 'SCHEDULE' } });
    fireEvent.click(screen.getByRole('button', { name: 'Điền mẫu từ cấu hình' }));

    expect(screen.getByLabelText('Tiêu đề bài viết mới')).toHaveValue('Lịch thi Trạng Nguyên Nhí');
    expect(screen.getByLabelText('Slug bài viết mới')).toHaveValue('lich-thi-trang-nguyen-nhi');
    const scheduleContent = screen.getByLabelText('Nội dung bài viết mới') as HTMLTextAreaElement;
    expect(scheduleContent.value).toContain('25/08/2026 16:00');
    expect(scheduleContent.value).toContain('Số lượt tối đa: 2');
    expect(scheduleContent.value).toContain('Điểm đạt: 7');
    expect(service.createArticle).not.toHaveBeenCalled();
  });

  it('prefills rules and guide only with canonical campaign facts and warns about duplicate types', async () => {
    renderPanel();

    const typeSelect = screen.getByLabelText('Loại bài viết mới');
    expect(screen.getByRole('option', { name: 'Thể lệ' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Hướng dẫn' })).toBeInTheDocument();

    fireEvent.change(typeSelect, { target: { value: 'RULES' } });
    expect(await screen.findByText(/Đã có bài viết loại Thể lệ/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Điền mẫu từ cấu hình' }));
    const rulesContent = screen.getByLabelText('Nội dung bài viết mới') as HTMLTextAreaElement;
    expect(rulesContent.value).toContain('Năm học: 2026-2027');
    expect(rulesContent.value).toContain('Khối: 4, 5');
    expect(rulesContent.value).toContain('Lớp: 4A, 5B');
    expect(rulesContent.value).toContain('Cần đạt: 5/6 vòng thi');
    expect(rulesContent.value).not.toContain('Giải');
    expect(rulesContent.value).not.toContain('Thời lượng');
    expect(rulesContent.value).not.toContain('hotline');

    fireEvent.change(typeSelect, { target: { value: 'GUIDE' } });
    fireEvent.click(screen.getByRole('button', { name: 'Điền mẫu từ cấu hình' }));
    expect(screen.getByLabelText('Tiêu đề bài viết mới')).toHaveValue('Hướng dẫn tham gia Trạng Nguyên Nhí');
    const guideContent = screen.getByLabelText('Nội dung bài viết mới') as HTMLTextAreaElement;
    expect(guideContent.value).toContain('Số lượt tối đa: 2');
    expect(guideContent.value).toContain('Điểm đạt: 7');
    expect(service.createArticle).not.toHaveBeenCalled();
  });

  it('does not expose template or create controls to a read-only teacher', async () => {
    renderPanel(false);

    await screen.findByText('Thể lệ');
    expect(screen.queryByRole('button', { name: 'Điền mẫu từ cấu hình' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tạo bài viết' })).not.toBeInTheDocument();
  });

  it('does not enable templates when campaign context belongs to another campaign', async () => {
    render(
      <CompetitionPublicContentPanel
        campaignId="campaign-1"
        isAdmin
        schoolExamEvents={events}
        campaign={{ ...campaign, id: 'campaign-other' }}
        rounds={rounds}
      />,
    );

    await screen.findByLabelText('Loại bài viết mới');
    expect(screen.queryByRole('button', { name: 'Điền mẫu từ cấu hình' })).not.toBeInTheDocument();
  });

  it('warns about a published legacy announcement that uses a guide slug', async () => {
    service.listArticles.mockResolvedValueOnce([{
      ...article,
      type: 'ANNOUNCEMENT',
      status: 'PUBLISHED',
      slug: 'huong-dan-tham-gia-trang-nguyen-nhi-2026-2027',
    }]);
    renderPanel();

    const typeSelect = await screen.findByLabelText('Loại bài viết mới');
    fireEvent.change(typeSelect, { target: { value: 'GUIDE' } });
    expect(await screen.findByText(/Đã có bài viết loại Hướng dẫn/)).toBeInTheDocument();
  });

  it('publishes a draft article only after confirmation and archives the published article', async () => {
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: 'Công bố bài viết' }));
    expect(await screen.findByRole('dialog', { name: 'Xác nhận công bố bài viết' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(service.publishArticle).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Công bố bài viết' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận công bố bài viết' }));
    await waitFor(() => expect(service.publishArticle).toHaveBeenCalledWith(
      'campaign-1', 'article-1', expect.any(String),
    ));
    expect(await screen.findByRole('button', { name: 'Lưu trữ bài viết' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Lưu trữ bài viết' }));
    expect(await screen.findByRole('dialog', { name: 'Xác nhận lưu trữ bài viết' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận lưu trữ bài viết' }));
    await waitFor(() => expect(service.archiveArticle).toHaveBeenCalledWith(
      'campaign-1', 'article-1', expect.any(String),
    ));
    expect(await screen.findByText(/ARCHIVED/)).toBeInTheDocument();
  });

  it('blocks publishing a draft with unsaved changes and tells Admin to save first', async () => {
    renderPanel();

    const content = await screen.findByLabelText(/Nội dung bài viết .*article-1/);
    fireEvent.change(content, { target: { value: 'Nội dung chưa lưu' } });

    expect(await screen.findByText('Lưu bài viết trước khi công bố.')).toBeInTheDocument();
    const publishButton = screen.getByRole('button', { name: 'Công bố bài viết' });
    expect(publishButton).toBeDisabled();
    fireEvent.click(publishButton);
    expect(service.publishArticle).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Xác nhận công bố bài viết' })).not.toBeInTheDocument();
  });

  it('keeps saved content after a failed publish and prevents duplicate pending requests', async () => {
    let rejectPublish!: (error: unknown) => void;
    service.publishArticle.mockReturnValue(new Promise((_, reject) => { rejectPublish = reject; }));
    renderPanel();

    const content = await screen.findByLabelText(/Nội dung bài viết .*article-1/);
    fireEvent.click(screen.getByRole('button', { name: 'Công bố bài viết' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận công bố bài viết' }));
    await waitFor(() => expect(service.publishArticle).toHaveBeenCalledTimes(1));

    const confirmButton = screen.getByRole('button', { name: 'Xác nhận công bố bài viết' });
    expect(confirmButton).toBeDisabled();
    fireEvent.click(confirmButton);
    expect(service.publishArticle).toHaveBeenCalledTimes(1);

    rejectPublish(new Error('raw server detail'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Không thể công bố bài viết.'));
    expect(screen.getByRole('alert')).not.toHaveTextContent('raw server detail');
    expect(screen.queryByRole('dialog', { name: 'Xác nhận công bố bài viết' })).not.toBeInTheDocument();
    expect(content).toHaveValue('Nội dung thể lệ');
  });

  it.each([
    ['gate', new ApiError('raw gate detail', 503, 'COMPETITION_PORTAL_FEATURE_DISABLED'), 'Tính năng công bố bài viết đang tạm thời chưa khả dụng.'],
    ['permission', new ApiError('raw permission detail', 403, 'FORBIDDEN'), 'Bạn không có quyền công bố bài viết.'],
    ['payload', new ApiError('raw payload detail', 400, 'COMPETITION_ARTICLE_NOT_READY'), 'Bài viết chưa đủ điều kiện công bố.'],
    ['conflict', new ApiError('raw conflict detail', 409, 'COMPETITION_ARTICLE_STALE_WRITE'), 'Bài viết đã thay đổi. Hãy tải lại danh sách rồi thử lại.'],
  ])('shows a safe %s error for article publishing', async (_kind, error, expectedMessage) => {
    service.publishArticle.mockRejectedValue(error);
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: 'Công bố bài viết' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận công bố bài viết' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(expectedMessage));
    expect(screen.getByRole('alert')).not.toHaveTextContent(/raw (gate|permission|payload|conflict) detail/);
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
