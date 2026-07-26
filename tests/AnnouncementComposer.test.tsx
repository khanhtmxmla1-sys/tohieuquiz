import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  it('saves a draft, validates publish, and keeps send-test separate', async () => {
    const onSaveDraft = vi.fn().mockResolvedValue(undefined);
    const onPublish = vi.fn().mockResolvedValue(undefined);
    const onSendTest = vi.fn().mockResolvedValue(undefined);
    render(
      <AnnouncementComposer
        onSaveDraft={onSaveDraft}
        onPublish={onPublish}
        onSendTest={onSendTest}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }));
    await waitFor(() => expect(onSaveDraft).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'DRAFT' }),
    ));

    fireEvent.click(screen.getByRole('button', { name: 'Công bố' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Chọn ít nhất một kênh');
    expect(onPublish).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Tin chạy' }));
    fireEvent.change(screen.getByLabelText('Nội dung chính'), {
      target: { value: 'Lịch thi học kỳ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Công bố' }));
    await waitFor(() => expect(onPublish).toHaveBeenCalledWith(expect.objectContaining({
      priority: 'INFO',
      channels: ['TICKER'],
      audience: 'ALL',
      dismissible: true,
    })));

    fireEvent.click(screen.getByRole('button', { name: 'Gửi thử' }));
    await waitFor(() => expect(onSendTest).toHaveBeenCalled());
    expect(onPublish).toHaveBeenCalledTimes(1);
  });
});
