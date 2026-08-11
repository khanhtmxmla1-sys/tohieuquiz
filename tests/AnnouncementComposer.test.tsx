import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  AnnouncementComposer,
  createEmptyAnnouncementDraft,
} from '../src/features/notifications/admin/AnnouncementComposer';
import { validateAnnouncementDraft } from '../src/features/notifications/admin/validateAnnouncementDraft';

describe('validateAnnouncementDraft', () => {
  it('allows incomplete drafts but validates every publish constraint', () => {
    const draft = createEmptyAnnouncementDraft();
    expect(validateAnnouncementDraft(draft, 'draft')).toEqual({});
    expect(validateAnnouncementDraft(draft, 'publish')).toMatchObject({
      channels: expect.any(String),
      content: expect.any(String),
    });

    expect(validateAnnouncementDraft({
      ...draft,
      channels: ['TICKER'],
      priority: 'URGENT',
    }, 'publish')).toHaveProperty('channels');

    expect(validateAnnouncementDraft({
      ...draft,
      channels: ['BANNER'],
      ctaLabel: 'Xem ngay',
    }, 'publish')).toHaveProperty('bannerLink');

    expect(validateAnnouncementDraft({
      ...draft,
      channels: ['BANNER'],
      bannerLink: 'javascript:alert(1)',
    }, 'publish')).toHaveProperty('bannerLink');

    expect(validateAnnouncementDraft({
      ...draft,
      channels: ['TICKER'],
      startsAt: '2026-07-25T10:00',
      endsAt: '2026-07-25T09:00',
    }, 'publish')).toHaveProperty('endsAt');

    expect(validateAnnouncementDraft({
      ...draft,
      channels: ['TICKER'],
      status: 'SCHEDULED',
    }, 'publish')).toHaveProperty('startsAt');
  });
});

describe('AnnouncementComposer', () => {
  it('renders content, distribution and production-component preview controls', () => {
    render(<AnnouncementComposer />);
    expect(screen.getByRole('heading', { name: 'Nội dung' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Phân phối' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Xem trước' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Học sinh' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mobile' }));
    expect(screen.getByTestId('announcement-preview'))
      .toHaveAttribute('data-surface', 'STUDENT_DASHBOARD');
    expect(screen.getByTestId('announcement-preview'))
      .toHaveAttribute('data-device', 'mobile');
  });

  it('keeps preview honest and restricts surfaces to the selected audience', () => {
    const initialDraft = {
      ...createEmptyAnnouncementDraft(),
      content: 'Thông báo giáo viên',
      channels: ['BANNER' as const],
      dismissible: true,
    };
    render(<AnnouncementComposer initialDraft={initialDraft} />);

    expect(screen.getByRole('button', { name: 'Đóng thông báo' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Giáo viên' }));
    expect(screen.queryByRole('button', { name: 'Học sinh' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Giáo viên' })).toBeInTheDocument();
  });

  it('shows an explicit empty preview instead of fake placeholder content', () => {
    render(<AnnouncementComposer initialDraft={{
      ...createEmptyAnnouncementDraft(),
      channels: ['BANNER'],
    }} />);

    expect(screen.queryByText('Tiêu đề thông báo')).not.toBeInTheDocument();
    expect(screen.queryByText('Nội dung thông báo sẽ hiển thị tại đây.')).not.toBeInTheDocument();
    expect(screen.getByText('Chưa có nội dung để xem trước.')).toBeInTheDocument();
  });

  it('keeps the content editor in a flexible main column instead of a collapsing three-column grid', () => {
    render(<AnnouncementComposer />);

    const layout = screen.getByTestId('announcement-composer-layout');
    const main = screen.getByTestId('announcement-content-panel');
    const rail = screen.getByTestId('announcement-composer-rail');

    expect(layout).toContainElement(main);
    expect(layout).toContainElement(rail);
    expect(layout.className).not.toContain(
      'xl:grid-cols-[minmax(0,1.25fr)_minmax(260px,0.9fr)_minmax(300px,1fr)]',
    );
    expect(layout.className).toContain(
      'xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)]',
    );
  });

  it('uses friendly preset radios and preserves entered content when applying a preset change', () => {
    render(<AnnouncementComposer initialDraft={{
      ...createEmptyAnnouncementDraft(),
      content: 'Giữ nguyên nội dung này',
      channels: ['TICKER'],
    }} />);

    expect(screen.getByRole('radiogroup', { name: 'Loại thông báo' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Cảnh báo khẩn' }));

    expect(screen.getByText('Thay đổi cách hiển thị?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng thay đổi' }));

    expect(screen.getByLabelText('Nội dung chính')).toHaveValue('Giữ nguyên nội dung này');
    expect(screen.getByRole('radio', { name: 'Cảnh báo khẩn' })).toBeChecked();
  });

  it('keeps CTA closed by default and shows worker-aligned character counters', () => {
    render(<AnnouncementComposer initialDraft={{
      ...createEmptyAnnouncementDraft(),
      channels: ['BANNER'],
    }} />);

    expect(screen.getByText('0/160 ký tự')).toBeInTheDocument();
    expect(screen.getByText('0/300 ký tự')).toBeInTheDocument();
    expect(screen.queryByLabelText('Nhãn CTA')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Thêm nút hành động' }));
    expect(screen.getByLabelText('Nhãn CTA')).toBeInTheDocument();
    expect(screen.getByText('0/80 ký tự')).toBeInTheDocument();
  });

  it('keeps the legacy image field inside an explained advanced section', () => {
    render(<AnnouncementComposer initialDraft={{
      ...createEmptyAnnouncementDraft(),
      channels: ['BANNER'],
    }} />);

    expect(screen.queryByLabelText('Ảnh thông báo')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Tùy chọn nâng cao'));
    expect(screen.getByLabelText('Ảnh thông báo')).toBeInTheDocument();
    expect(screen.getByText(/chỉ dùng URL ảnh từ nguồn media được hệ thống cho phép/i)).toBeInTheDocument();
  });

  it('shows a friendly Step 3 review summary without raw enums', () => {
    render(<AnnouncementComposer initialDraft={{
      ...createEmptyAnnouncementDraft(),
      content: 'Lịch thi học kỳ',
      channels: ['TICKER'],
      audience: 'ALL',
    }} />);

    expect(screen.getByText('Bước 3')).toBeInTheDocument();
    const review = screen.getByRole('heading', { name: 'Kiểm tra & xem trước' }).closest('section');
    expect(review).not.toBeNull();
    const reviewView = within(review!);
    expect(reviewView.getByText('Toàn hệ thống')).toBeInTheDocument();
    expect(reviewView.getByText('Tin chạy')).toBeInTheDocument();
    expect(reviewView.getByText('Phát ngay')).toBeInTheDocument();
    expect(screen.queryByText('ALL')).not.toBeInTheDocument();
    expect(screen.queryByText('TICKER')).not.toBeInTheDocument();
  });

  it('uses schedule-aware primary labels and submits with a specific loading state', () => {
    const { rerender } = render(<AnnouncementComposer initialDraft={{
      ...createEmptyAnnouncementDraft(),
      content: 'Lịch thi học kỳ',
      channels: ['TICKER'],
      audience: 'TEACHERS',
    }} />);

    expect(screen.getByRole('button', { name: 'Công bố ngay' })).toBeInTheDocument();

    rerender(<AnnouncementComposer saving initialDraft={{
      ...createEmptyAnnouncementDraft(),
      content: 'Lịch thi học kỳ',
      channels: ['TICKER'],
      audience: 'TEACHERS',
      status: 'SCHEDULED',
      startsAt: '2026-08-12T08:30',
    }} />);

    expect(screen.getByRole('button', { name: 'Đang lên lịch…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Đang lưu…' })).toBeDisabled();
  });

  it('requires a specific confirmation for all-audience publication', async () => {
    const onPublish = vi.fn().mockResolvedValue(undefined);
    render(<AnnouncementComposer
      initialDraft={{
        ...createEmptyAnnouncementDraft(),
        content: 'Thông báo toàn trường',
        channels: ['TICKER'],
        audience: 'ALL',
      }}
      onPublish={onPublish}
    />);

    fireEvent.click(screen.getByRole('button', { name: 'Công bố ngay' }));

    const dialog = await screen.findByRole('dialog', { name: 'Xác nhận công bố toàn hệ thống' });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText(/toàn hệ thống sẽ nhìn thấy/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/Thông báo toàn trường/)).toBeInTheDocument();
    expect(onPublish).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận công bố' }));
    await waitFor(() => expect(onPublish).toHaveBeenCalledTimes(1));
  });

  it('requires a specific confirmation for urgent publication', async () => {
    const onPublish = vi.fn().mockResolvedValue(undefined);
    render(<AnnouncementComposer
      initialDraft={{
        ...createEmptyAnnouncementDraft(),
        content: 'Hệ thống bảo trì khẩn',
        channels: ['CRITICAL_STRIP'],
        audience: 'TEACHERS',
        priority: 'URGENT',
        dismissible: false,
      }}
      onPublish={onPublish}
    />);

    fireEvent.click(screen.getByRole('button', { name: 'Công bố ngay' }));
    expect(await screen.findByRole('dialog', { name: 'Xác nhận cảnh báo khẩn' })).toBeInTheDocument();
    expect(screen.getByText(/giáo viên sẽ nhận cảnh báo khẩn/i)).toBeInTheDocument();
    expect(onPublish).not.toHaveBeenCalled();
  });

  it('focuses the publish error summary while retaining inline errors', async () => {
    render(<AnnouncementComposer />);

    fireEvent.click(screen.getByRole('button', { name: 'Công bố ngay' }));
    const alert = await screen.findByRole('alert');
    await waitFor(() => expect(alert).toHaveFocus());
    expect(screen.getByTestId('announcement-content-error')).toHaveTextContent('nội dung');
  });

  it('renders archived history as semantically read-only', () => {
    render(<AnnouncementComposer
      readOnly
      initialDraft={{
        ...createEmptyAnnouncementDraft(),
        status: 'ARCHIVED',
        bannerTitle: 'Thông báo cũ',
        content: 'Nội dung cũ',
        channels: ['BANNER'],
      }}
    />);

    expect(screen.getByRole('textbox', { name: 'Tiêu đề' })).toHaveAttribute('readonly');
    expect(screen.getByRole('textbox', { name: 'Nội dung chính' })).toHaveAttribute('readonly');
    expect(screen.getByRole('radio', { name: 'Toàn hệ thống' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Lưu nháp' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Công bố ngay' })).not.toBeInTheDocument();
  });

  it('hides unsupported inbox delivery and the fake send-test action', () => {
    render(<AnnouncementComposer />);

    expect(screen.queryByRole('checkbox', { name: 'Hộp thư' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Gửi thử' })).not.toBeInTheDocument();
  });

  it('saves a draft and validates publish before calling the mutation', async () => {
    const onSaveDraft = vi.fn().mockResolvedValue(undefined);
    const onPublish = vi.fn().mockResolvedValue(undefined);
    render(
      <AnnouncementComposer
        onSaveDraft={onSaveDraft}
        onPublish={onPublish}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }));
    await waitFor(() => expect(onSaveDraft).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'DRAFT' }),
    ));

    fireEvent.click(screen.getByRole('button', { name: 'Công bố ngay' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Chọn ít nhất một kênh');
    expect(onPublish).not.toHaveBeenCalled();
    expect(screen.getByTestId('announcement-content-error')).toHaveTextContent('nội dung');
    expect(screen.getByText('0/1000 ký tự')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: 'Tin chạy' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Giáo viên' }));
    fireEvent.change(screen.getByLabelText('Nội dung chính'), {
      target: { value: 'Lịch thi học kỳ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Công bố ngay' }));
    await waitFor(() => expect(onPublish).toHaveBeenCalledWith(expect.objectContaining({
      priority: 'INFO',
      channels: ['TICKER'],
      audience: 'TEACHERS',
      dismissible: true,
    })));

    expect(onPublish).toHaveBeenCalledTimes(1);
  });
});
