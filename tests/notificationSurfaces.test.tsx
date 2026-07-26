import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Announcement } from '../src/services/announcementService';
import {
  AnnouncementTicker,
  InFlowAnnouncementBanner,
} from '../src/features/notifications/components';

const announcement: Announcement = {
  id: 'announcement-1',
  content: 'Ngày mai toàn trường nghỉ để bảo trì hệ thống.',
  bannerTitle: 'Lịch bảo trì',
  bannerLink: 'javascript:alert(1)',
  isActive: true,
  updatedAt: '2026-07-24T00:00:00.000Z',
  priority: 'IMPORTANT',
  channels: ['TICKER', 'BANNER'],
  dismissible: true,
};

describe('notification announcement surfaces', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
  });

  it('runs ticker even when the message fits and supports pause by button, hover, and focus', () => {
    render(<AnnouncementTicker announcement={announcement} />);
    const region = screen.getByRole('region', { name: 'Thông báo chung' });
    const track = screen.getByTestId('notification-ticker-track');

    expect(track).toHaveClass('notification-ticker__track--animated');

    const pause = screen.getByRole('button', { name: 'Tạm dừng tin chạy' });
    fireEvent.click(pause);
    expect(pause).toHaveAttribute('aria-pressed', 'true');
    expect(track).toHaveClass('notification-ticker__track--paused');

    fireEvent.mouseEnter(region);
    fireEvent.focus(region);
    expect(track).toHaveClass('notification-ticker__track--paused');
  });

  it('respects reduced motion and does not attach the animated class', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
    render(<AnnouncementTicker announcement={announcement} />);
    expect(screen.getByTestId('notification-ticker-track'))
      .not.toHaveClass('notification-ticker__track--animated');
  });

  it('renders banner in flow, blocks unsafe CTA, and stores the full dismiss key', () => {
    render(
      <InFlowAnnouncementBanner
        announcement={announcement}
        surface="LOGIN"
      />,
    );
    const banner = screen.getByRole('region', { name: 'Lịch bảo trì' });
    expect(banner).not.toHaveClass('fixed');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Đóng thông báo' }));
    expect(localStorage.getItem(
      'tohieuquiz:announcement-dismissed:LOGIN:announcement-1:2026-07-24T00:00:00.000Z',
    )).toBe('1');
    expect(screen.queryByRole('region', { name: 'Lịch bảo trì' })).not.toBeInTheDocument();
  });
});
