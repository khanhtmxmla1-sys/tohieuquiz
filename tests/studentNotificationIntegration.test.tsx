import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InboxNotification } from '../shared/notifications.contract';

const inbox = vi.hoisted(() => ({ value: {} as any }));
vi.mock('../src/features/notifications/useNotificationInbox', () => ({
  useNotificationInbox: () => inbox.value,
}));

import { StudentDashboardHeader } from '../src/components/HomePage/student-dashboard';

const notification = (
  type: InboxNotification['type'],
  data: Record<string, unknown>,
): InboxNotification => ({
  id: `${type}-1`,
  type,
  priority: 'INFO',
  title: `Tin ${type}`,
  body: null,
  actionUrl: null,
  data,
  isRead: false,
  createdAt: '2026-07-24T00:00:00.000Z',
  expiresAt: null,
});

const callbacks = () => ({
  onSelectSection: vi.fn(),
  onOpenAssignment: vi.fn(),
  onOpenResultReport: vi.fn(),
  onOpenGiftShop: vi.fn(),
  onOpenLiveExam: vi.fn(),
  onOpenAvatar: vi.fn(),
  onOpenChangePassword: vi.fn(),
  onLogout: vi.fn(),
});

const renderHeader = (handlers: ReturnType<typeof callbacks>) => render(
  <StudentDashboardHeader
    studentName="Nguyễn Minh An"
    className="5A"
    avatarUrl="/avatar1.png"
    level={4}
    coins={250}
    activeSection="dashboard"
    giftShopEnabled
    studentId="student-1"
    unifiedNotificationsReady
    unifiedNotificationsEnabled
    {...handlers}
  />,
);

describe('student notification integration', () => {
  beforeEach(() => {
    inbox.value = {
      items: [],
      unreadCount: 0,
      isLoading: false,
      isRefreshing: false,
      isStale: false,
      error: null,
      markRead: vi.fn().mockResolvedValue(undefined),
      markAllRead: vi.fn().mockResolvedValue(undefined),
      refresh: vi.fn(),
    };
  });

  it('opens the exact assigned work from a new-assignment notification', async () => {
    inbox.value.items = [
      notification('assignment_created', { assignment_id: 'assignment-42' }),
    ];
    inbox.value.unreadCount = 1;
    const handlers = callbacks();
    renderHeader(handlers);

    fireEvent.click(screen.getByRole('button', { name: 'Thông báo, 1 chưa đọc' }));
    fireEvent.click(screen.getByRole('button', { name: /Tin assignment_created/ }));

    await waitFor(() => expect(inbox.value.markRead).toHaveBeenCalled());
    expect(handlers.onOpenAssignment).toHaveBeenCalledWith('assignment-42');
  });

  it('keeps certificate and result-report deep links', async () => {
    const handlers = callbacks();
    inbox.value.items = [
      notification('certificate_issued', { certificate_id: 'certificate-1' }),
    ];
    inbox.value.unreadCount = 1;
    const first = renderHeader(handlers);
    fireEvent.click(screen.getByRole('button', { name: 'Thông báo, 1 chưa đọc' }));
    fireEvent.click(screen.getByRole('button', { name: /Tin certificate_issued/ }));
    await waitFor(() => expect(handlers.onSelectSection).toHaveBeenCalledWith('achievements'));
    first.unmount();

    inbox.value.items = [
      notification('result_report_published', { phieu_id: 'phieu-1' }),
    ];
    renderHeader(handlers);
    fireEvent.click(screen.getByRole('button', { name: 'Thông báo, 1 chưa đọc' }));
    fireEvent.click(screen.getByRole('button', { name: /Tin result_report_published/ }));
    await waitFor(() => expect(handlers.onOpenResultReport).toHaveBeenCalledWith('phieu-1'));
  });
});
